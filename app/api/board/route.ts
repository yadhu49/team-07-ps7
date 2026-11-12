import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { todayInIndia } from "@/lib/dates";
import type { BoardDelivery, BoardResponse, BoardRider, DeliveryStatus } from "@/lib/types";

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
  vehicle: "bike" | "scooter" | "van";
  capacity: number;
  is_active: boolean;
  zones?: { name: string } | { name: string }[] | null;
};

type ShiftRow = { rider_id: string; shift_date: string; start_time: string; end_time: string };

/** Supabase returns a related row as an object or a one-item array. Handle both. */
function rel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/** GET /api/board -> everything the deliveries board and the riders panel show. */
export async function GET() {
  const today = todayInIndia();
  const supabase = getSupabase();

  const [deliveriesRes, ridersRes, shiftsRes] = await Promise.all([
    supabase
      .from("deliveries")
      .select(
        "id, order_ref, customer_name, address, zone_id, parcel_size, is_cod, cod_amount, delivery_date, time_window, rider_id, status, attempts, zones(name), riders(name)"
      )
      .order("delivery_date", { ascending: true })
      .order("order_ref", { ascending: true }),
    supabase
      .from("riders")
      .select("id, name, home_zone, vehicle, capacity, is_active, zones(name)")
      .order("id"),
    supabase
      .from("rider_shifts")
      .select("rider_id, shift_date, start_time, end_time")
      .eq("shift_date", today),
  ]);

  if (deliveriesRes.error) {
    console.error("[board] deliveries", deliveriesRes.error.message);
    return NextResponse.json({ error: deliveriesRes.error.message }, { status: 500 });
  }
  if (ridersRes.error) {
    console.error("[board] riders", ridersRes.error.message);
    return NextResponse.json({ error: ridersRes.error.message }, { status: 500 });
  }
  if (shiftsRes.error) {
    console.error("[board] shifts", shiftsRes.error.message);
    return NextResponse.json({ error: shiftsRes.error.message }, { status: 500 });
  }

  const deliveries: BoardDelivery[] = ((deliveriesRes.data ?? []) as DeliveryRow[]).map((row) => ({
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
  }));

  const counts: Record<DeliveryStatus, number> = {
    pending: 0,
    assigned: 0,
    out_for_delivery: 0,
    delivered: 0,
    failed: 0,
    returned: 0,
  };
  for (const d of deliveries) counts[d.status] += 1;

  const shifts = new Map<string, ShiftRow>(
    ((shiftsRes.data ?? []) as ShiftRow[]).map((s) => [s.rider_id, s])
  );

  const activeByRider = new Map<string, number>();
  const deliveredTodayByRider = new Map<string, number>();
  for (const d of deliveries) {
    if (!d.rider_id) continue;
    if (d.status === "assigned" || d.status === "out_for_delivery") {
      activeByRider.set(d.rider_id, (activeByRider.get(d.rider_id) ?? 0) + 1);
    }
    if (d.status === "delivered" && d.delivery_date === today) {
      deliveredTodayByRider.set(d.rider_id, (deliveredTodayByRider.get(d.rider_id) ?? 0) + 1);
    }
  }

  const riders: BoardRider[] = ((ridersRes.data ?? []) as RiderRow[]).map((row) => {
    const active = activeByRider.get(row.id) ?? 0;
    const shift = shifts.get(row.id);
    return {
      id: row.id,
      name: row.name,
      zone_id: row.home_zone,
      zone_name: rel(row.zones)?.name ?? row.home_zone,
      vehicle: row.vehicle,
      capacity: row.capacity,
      active,
      free: Math.max(row.capacity - active, 0),
      is_active: row.is_active,
      shift: shift ? { start: shift.start_time.slice(0, 5), end: shift.end_time.slice(0, 5) } : null,
      delivered_today: deliveredTodayByRider.get(row.id) ?? 0,
    };
  });

  const body: BoardResponse = { today, counts, deliveries, riders };
  return NextResponse.json(body);
}
