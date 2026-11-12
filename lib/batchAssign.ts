import "server-only";
import { getSupabase } from "./supabase";
import { todayInIndia } from "./dates";

/*
 * BATCH ASSIGN
 *
 * One request assigns every pending delivery that matches a filter (date, zone,
 * time window) instead of one tool call per delivery. It still goes through the
 * database function assign_delivery(), so every business rule (pending only, same
 * zone, shift that day, capacity, attempts) is checked by Postgres, not here.
 *
 * The rider for each delivery is the one in that zone with the most free
 * capacity, so a batch spreads across the zone's riders instead of filling one.
 */

export type BatchTimeWindow = "morning" | "afternoon" | "evening";

export type BatchAssignInput = {
  delivery_date?: string;
  zone?: string;
  time_window?: BatchTimeWindow;
  /** Preview the plan without writing anything. */
  dry_run?: boolean;
};

export type BatchAssignResult = {
  date: string;
  zone: string;
  time_window: string | null;
  dry_run: boolean;
  assigned: { order_ref: string; rider_id: string; rider_name: string }[];
  unassigned: { order_ref: string; reason: string }[];
  summary: string;
};

type ZoneRow = { id: string; name: string };

type RiderRow = {
  id: string;
  name: string;
  home_zone: string;
  capacity: number;
  is_active: boolean;
};

type PendingRow = { id: number; order_ref: string; zone_id: string };

type ShiftRow = { rider_id: string };

export async function batchAssign(input: BatchAssignInput): Promise<BatchAssignResult> {
  const supabase = getSupabase();
  const date = input.delivery_date ?? todayInIndia();
  const dryRun = input.dry_run ?? false;

  let zoneId: string | null = null;
  let zoneLabel = "all zones";
  if (input.zone?.trim()) {
    const { data, error } = await supabase.from("zones").select("id, name");
    if (error) throw new Error(error.message);
    const zones = (data ?? []) as ZoneRow[];
    const needle = input.zone.trim().toLowerCase();
    const match = zones.find((z) => z.id.toLowerCase() === needle || z.name.toLowerCase() === needle);
    if (!match) {
      throw new Error(
        `Unknown zone "${input.zone}". Known zones: ${zones.map((z) => `${z.id} ${z.name}`).join(", ")}`
      );
    }
    zoneId = match.id;
    zoneLabel = `${match.id} ${match.name}`;
  }

  let pendingQuery = supabase
    .from("deliveries")
    .select("id, order_ref, zone_id")
    .eq("delivery_date", date)
    .eq("status", "pending")
    .order("order_ref", { ascending: true });
  if (zoneId) pendingQuery = pendingQuery.eq("zone_id", zoneId);
  if (input.time_window) pendingQuery = pendingQuery.eq("time_window", input.time_window);

  const [pendingRes, ridersRes, shiftsRes, activeRes] = await Promise.all([
    pendingQuery,
    supabase.from("riders").select("id, name, home_zone, capacity, is_active").eq("is_active", true).order("id"),
    supabase.from("rider_shifts").select("rider_id").eq("shift_date", date),
    supabase.from("deliveries").select("rider_id").in("status", ["assigned", "out_for_delivery"]),
  ]);

  for (const res of [pendingRes, ridersRes, shiftsRes, activeRes]) {
    if (res.error) throw new Error(res.error.message);
  }

  const pending = (pendingRes.data ?? []) as PendingRow[];
  const onShift = new Set(((shiftsRes.data ?? []) as ShiftRow[]).map((s) => s.rider_id));
  const riders = ((ridersRes.data ?? []) as RiderRow[]).filter((r) => onShift.has(r.id));

  const load = new Map<string, number>();
  for (const row of (activeRes.data ?? []) as { rider_id: string | null }[]) {
    if (!row.rider_id) continue;
    load.set(row.rider_id, (load.get(row.rider_id) ?? 0) + 1);
  }

  const assigned: BatchAssignResult["assigned"] = [];
  const unassigned: BatchAssignResult["unassigned"] = [];

  for (const delivery of pending) {
    const candidates = riders
      .filter((r) => r.home_zone === delivery.zone_id)
      .filter((r) => (load.get(r.id) ?? 0) < r.capacity)
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.id.localeCompare(b.id));

    if (candidates.length === 0) {
      unassigned.push({
        order_ref: delivery.order_ref,
        reason: `No rider in ${delivery.zone_id} has a shift today with free capacity.`,
      });
      continue;
    }

    const rider = candidates[0];
    const riderName = rider.name;

    if (dryRun) {
      assigned.push({ order_ref: delivery.order_ref, rider_id: rider.id, rider_name: riderName });
      load.set(rider.id, (load.get(rider.id) ?? 0) + 1);
      continue;
    }

    const { error } = await supabase.rpc("assign_delivery", {
      p_delivery_id: delivery.id,
      p_rider_id: rider.id,
    });
    if (error) {
      unassigned.push({ order_ref: delivery.order_ref, reason: error.message });
      continue;
    }
    assigned.push({ order_ref: delivery.order_ref, rider_id: rider.id, rider_name: riderName });
    load.set(rider.id, (load.get(rider.id) ?? 0) + 1);
  }

  const verb = dryRun ? "would assign" : "assigned";
  const riderCount = new Set(assigned.map((a) => a.rider_id)).size;
  const summary =
    pending.length === 0
      ? `No pending deliveries for ${zoneLabel} on ${date}${input.time_window ? ` in the ${input.time_window}` : ""}.`
      : `${dryRun ? "Preview" : "Batch"}: ${verb} ${assigned.length} of ${pending.length} pending deliveries to ${riderCount} rider${riderCount === 1 ? "" : "s"}, ${unassigned.length} left pending.`;

  return {
    date,
    zone: zoneLabel,
    time_window: input.time_window ?? null,
    dry_run: dryRun,
    assigned,
    unassigned,
    summary,
  };
}
