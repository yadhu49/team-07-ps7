import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { todayInIndia } from "@/lib/dates";
import type {
  DashboardReason,
  DashboardResponse,
  DashboardRider,
  DashboardTotals,
  DashboardTrendPoint,
  DashboardZone,
  DeliveryStatus,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DeliveryRow = {
  id: number;
  order_ref: string;
  zone_id: string;
  status: DeliveryStatus;
  delivery_date: string;
  is_cod: boolean;
  cod_amount: number;
  rider_id: string | null;
  zones?: { name: string } | { name: string }[] | null;
};

type RiderRow = {
  id: string;
  name: string;
  home_zone: string;
  capacity: number;
  is_active: boolean;
  zones?: { name: string } | { name: string }[] | null;
};

type AttemptRow = { outcome: string; attempted_at: string };

function rel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function daysAgo(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** GET /api/dashboard -> hub KPIs, zone and rider performance, a 7-day trend and failure reasons. */
export async function GET() {
  const today = todayInIndia();
  const start = daysAgo(today, 6);
  const supabase = getSupabase();

  const [deliveriesRes, ridersRes, attemptsRes] = await Promise.all([
    supabase
      .from("deliveries")
      .select("id, order_ref, zone_id, status, delivery_date, is_cod, cod_amount, rider_id, zones(name)")
      .gte("delivery_date", start)
      .order("delivery_date", { ascending: true }),
    supabase.from("riders").select("id, name, home_zone, capacity, is_active, zones(name)").order("id"),
    supabase
      .from("delivery_attempts")
      .select("outcome, attempted_at")
      .gte("attempted_at", start)
      .order("attempted_at", { ascending: false }),
  ]);

  for (const res of [deliveriesRes, ridersRes, attemptsRes]) {
    if (res.error) {
      console.error("[dashboard]", res.error.message);
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
  }

  const all = (deliveriesRes.data ?? []) as DeliveryRow[];
  const todayRows = all.filter((d) => d.delivery_date === today);
  const riderRows = (ridersRes.data ?? []) as RiderRow[];
  const attempts = (attemptsRes.data ?? []) as AttemptRow[];

  const isOpen = (s: DeliveryStatus) => s === "pending" || s === "assigned" || s === "out_for_delivery";
  const isFailed = (s: DeliveryStatus) => s === "failed" || s === "returned";

  const totals: DashboardTotals = {
    date: today,
    deliveries: todayRows.length,
    delivered: todayRows.filter((d) => d.status === "delivered").length,
    failed: todayRows.filter((d) => isFailed(d.status)).length,
    open: todayRows.filter((d) => isOpen(d.status)).length,
    pending: todayRows.filter((d) => d.status === "pending").length,
    codCollected: todayRows
      .filter((d) => d.status === "delivered" && d.is_cod)
      .reduce((sum, d) => sum + Number(d.cod_amount), 0),
    codPending: todayRows
      .filter((d) => isOpen(d.status) && d.is_cod)
      .reduce((sum, d) => sum + Number(d.cod_amount), 0),
    successRate: 0,
    activeRiders: riderRows.filter((r) => r.is_active).length,
    capacityInUse: 0,
    capacityTotal: riderRows.filter((r) => r.is_active).reduce((sum, r) => sum + r.capacity, 0),
  };

  const finished = totals.delivered + totals.failed;
  totals.successRate = finished === 0 ? 0 : Math.round((totals.delivered / finished) * 100);

  const zoneMap = new Map<string, DashboardZone>();
  for (const d of todayRows) {
    const zone = zoneMap.get(d.zone_id) ?? {
      zone_id: d.zone_id,
      zone_name: rel(d.zones)?.name ?? d.zone_id,
      total: 0,
      delivered: 0,
      failed: 0,
      open: 0,
      cod_open: 0,
    };
    zone.total += 1;
    if (d.status === "delivered") zone.delivered += 1;
    else if (isFailed(d.status)) zone.failed += 1;
    else zone.open += 1;
    if (isOpen(d.status) && d.is_cod) zone.cod_open += Number(d.cod_amount);
    zoneMap.set(d.zone_id, zone);
  }
  const zones = [...zoneMap.values()].sort((a, b) => b.total - a.total);

  const riderMap = new Map<string, DashboardRider>();
  for (const d of todayRows) {
    if (!d.rider_id) continue;
    const rider = riderMap.get(d.rider_id) ?? { id: d.rider_id, name: d.rider_id, zone_name: "", delivered: 0, failed: 0, active: 0, capacity: 0, cod_collected: 0 };
    if (d.status === "delivered") {
      rider.delivered += 1;
      if (d.is_cod) rider.cod_collected += Number(d.cod_amount);
    } else if (isFailed(d.status)) {
      rider.failed += 1;
    } else {
      rider.active += 1;
    }
    riderMap.set(d.rider_id, rider);
  }
  for (const r of riderRows) {
    const row = riderMap.get(r.id);
    if (!row) continue;
    row.name = r.name;
    row.zone_name = rel(r.zones)?.name ?? r.home_zone;
    row.capacity = r.capacity;
  }
  const riders = [...riderMap.values()].sort((a, b) => b.delivered - a.delivered || a.name.localeCompare(b.name));
  totals.capacityInUse = riders.reduce((sum, r) => sum + r.active, 0);

  const trend: DashboardTrendPoint[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = daysAgo(today, i);
    const rows = all.filter((d) => d.delivery_date === date);
    trend.push({
      date,
      delivered: rows.filter((d) => d.status === "delivered").length,
      failed: rows.filter((d) => isFailed(d.status)).length,
      total: rows.length,
    });
  }

  // Only outcomes that mean the stop did not succeed.
  const NOT_A_FAILURE = new Set(["delivered", "rescheduled"]);
  const reasonMap = new Map<string, number>();
  for (const attempt of attempts) {
    if (NOT_A_FAILURE.has(attempt.outcome)) continue;
    reasonMap.set(attempt.outcome, (reasonMap.get(attempt.outcome) ?? 0) + 1);
  }
  const reasons: DashboardReason[] = [...reasonMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const body: DashboardResponse = { today, totals, zones, riders, trend, reasons };
  return NextResponse.json(body);
}
