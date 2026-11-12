import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { todayInIndia } from "@/lib/dates";
import type { BoardDelivery, DeliveryStatus, RiderSummary, RiderViewResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryRow = {
  id: number;
  order_ref: string;
  customer_name: string;
  address: string;
  zone_id: string;
  parcel_size: "small" | "medium" | "large";
  is_cod: boolean;
  cod_amount: number;
  delivery_date: string;
  time_window: "morning" | "afternoon" | "evening";
  rider_id: string | null;
  status: DeliveryStatus;
  attempts: number;
  zones?: { name: string } | { name: string }[] | null;
  riders?: { name: string } | { name: string }[] | null;
};

type RiderRow = {
  id: string;
  name: string;
  home_zone: string;
  vehicle: string;
  zones?: { name: string } | { name: string }[] | null;
};

type ShiftRow = { rider_id: string; start_time: string; end_time: string };

function rel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

const markSchema = z.object({
  delivery_id: z.number().int().positive(),
  rider_id: z.string().trim().min(2).max(8),
  outcome: z.enum(["delivered", "failed"]),
  /** Only used when outcome is "failed". */
  reason: z.enum(["customer_not_home", "wrong_address", "refused"]).optional(),
});

/** GET /api/rider -> each rider's active deliveries and today's cash-on-delivery totals. */
export async function GET() {
  const today = todayInIndia();
  const supabase = getSupabase();

  const [deliveriesRes, ridersRes, shiftsRes] = await Promise.all([
    supabase
      .from("deliveries")
      .select(
        "id, order_ref, customer_name, address, zone_id, parcel_size, is_cod, cod_amount, delivery_date, time_window, rider_id, status, attempts, zones(name), riders(name)"
      )
      .eq("delivery_date", today)
      .not("rider_id", "is", null)
      .order("order_ref", { ascending: true }),
    supabase
      .from("riders")
      .select("id, name, home_zone, vehicle, is_active, zones(name)")
      .eq("is_active", true)
      .order("id"),
    supabase.from("rider_shifts").select("rider_id, start_time, end_time").eq("shift_date", today),
  ]);

  for (const res of [deliveriesRes, ridersRes, shiftsRes]) {
    if (res.error) {
      console.error("[rider]", res.error.message);
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
  }

  const rows = (deliveriesRes.data ?? []) as DeliveryRow[];
  const byRider = new Map<string, DeliveryRow[]>();
  for (const row of rows) {
    if (!row.rider_id) continue;
    const bucket = byRider.get(row.rider_id) ?? [];
    bucket.push(row);
    byRider.set(row.rider_id, bucket);
  }

  const shifts = new Map<string, ShiftRow>(
    ((shiftsRes.data ?? []) as ShiftRow[]).map((s) => [s.rider_id, s])
  );

  const toBoardDelivery = (row: DeliveryRow): BoardDelivery => ({
    id: row.id,
    order_ref: row.order_ref,
    customer_name: row.customer_name,
    address: row.address,
    zone_id: row.zone_id,
    zone_name: rel(row.zones)?.name ?? row.zone_id,
    parcel_size: row.parcel_size,
    is_cod: row.is_cod,
    cod_amount: row.cod_amount,
    delivery_date: row.delivery_date,
    time_window: row.time_window,
    rider_id: row.rider_id,
    rider_name: rel(row.riders)?.name ?? null,
    status: row.status,
    attempts: row.attempts,
  });

  const riders: RiderSummary[] = ((ridersRes.data ?? []) as RiderRow[]).map((rider) => {
    const mine = byRider.get(rider.id) ?? [];
    const active = mine
      .filter((d) => d.status === "assigned" || d.status === "out_for_delivery")
      .map(toBoardDelivery);
    const delivered = mine.filter((d) => d.status === "delivered");
    const shift = shifts.get(rider.id);
    return {
      id: rider.id,
      name: rider.name,
      zone_id: rider.home_zone,
      zone_name: rel(rider.zones)?.name ?? rider.home_zone,
      vehicle: rider.vehicle,
      shift: shift ? { start: shift.start_time.slice(0, 5), end: shift.end_time.slice(0, 5) } : null,
      active,
      cod_collected: delivered.reduce((sum, d) => sum + (d.is_cod ? d.cod_amount : 0), 0),
      delivered_count: delivered.length,
      cod_pending: active.reduce((sum, d) => sum + (d.is_cod ? d.cod_amount : 0), 0),
    };
  });

  const body: RiderViewResponse = { today, riders };
  return NextResponse.json(body);
}

/** POST /api/rider -> a rider marks one of their own deliveries delivered or failed. */
export async function POST(request: Request) {
  const parsed = markSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    );
  }
  const { delivery_id, rider_id, outcome, reason } = parsed.data;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("deliveries")
    .select("id, order_ref, rider_id, status, attempts")
    .eq("id", delivery_id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  const delivery = data as { id: number; order_ref: string; rider_id: string | null; status: DeliveryStatus; attempts: number };

  if (delivery.rider_id !== rider_id) {
    return NextResponse.json(
      { error: `${delivery.order_ref} is not assigned to this rider` },
      { status: 403 }
    );
  }
  if (delivery.status !== "assigned" && delivery.status !== "out_for_delivery") {
    return NextResponse.json(
      { error: `${delivery.order_ref} is ${delivery.status.replace(/_/g, " ")}, so it cannot be marked here` },
      { status: 409 }
    );
  }
  if (delivery.attempts >= 3) {
    return NextResponse.json(
      { error: `${delivery.order_ref} already has 3 attempts. Ask the dispatcher to mark it returned` },
      { status: 409 }
    );
  }

  const attempts = delivery.attempts + 1;
  const status: DeliveryStatus =
    outcome === "delivered" ? "delivered" : attempts >= 3 ? "returned" : "failed";

  // Guarded update: only the current rider, and only while the delivery is still active.
  const { data: updated, error: updateError } = await supabase
    .from("deliveries")
    .update({ status, attempts })
    .eq("id", delivery.id)
    .eq("rider_id", rider_id)
    .eq("status", delivery.status)
    .select("id, order_ref, status, attempts")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updated) {
    return NextResponse.json(
      { error: "That delivery changed a moment ago. Reload and try again." },
      { status: 409 }
    );
  }

  const { error: attemptError } = await supabase.from("delivery_attempts").insert({
    delivery_id: delivery.id,
    rider_id,
    outcome: outcome === "delivered" ? "delivered" : reason ?? "customer_not_home",
    note: outcome === "delivered" ? "Marked delivered from the rider view" : "Marked failed from the rider view",
  });
  if (attemptError) {
    console.error("[rider] attempt insert", attemptError.message);
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  return NextResponse.json({ delivery: updated, attempts_left: 3 - attempts });
}
