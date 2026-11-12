import "server-only";
import { z } from "zod";
import { defineTool, type AgentTool } from "./defineTool";
import { getSupabase } from "../supabase";
import { isoDate } from "../schemas";
import { todayInIndia } from "../dates";
import { batchAssign } from "../batchAssign";

/*
 * ROUTEWISE TOOLS (PS7 Delivery Dispatch)
 *
 * Read tools:  getPendingDeliveries, getAvailableRiders, getRiderLoad, getFailedDeliveries
 * Write tools: assignDelivery, rescheduleDelivery, batchAssignDeliveries
 *
 * The two write tools call the database functions assign_delivery() and
 * reschedule_delivery() from seed/ps7_delivery_dispatch.sql. Those functions check
 * every business rule (pending only, same zone, shift that day, capacity, attempts).
 * We never update deliveries directly from TypeScript.
 */

type ZoneRow = { id: string; name: string };

const TIME_WINDOWS = ["morning", "afternoon", "evening"] as const;
const timeWindowSchema = z
  .enum(TIME_WINDOWS)
  .describe("Time window: morning, afternoon or evening");

type RiderRow = {
  id: string;
  name: string;
  phone: string;
  home_zone: string;
  vehicle: string;
  capacity: number;
  is_active: boolean;
  zones?: { name: string } | { name: string }[] | null;
};

type ShiftRow = { rider_id: string; shift_date: string; start_time: string; end_time: string };

type DeliveryRow = {
  id: number;
  order_ref: string;
  customer_name: string;
  address: string;
  zone_id: string;
  parcel_size: string;
  is_cod: boolean;
  cod_amount: number;
  delivery_date: string;
  time_window: string;
  rider_id: string | null;
  status: string;
  attempts: number;
  zones?: { name: string } | { name: string }[] | null;
  riders?: { name: string } | { name: string }[] | null;
};

/** Supabase returns a related row as an object or a one-item array. Handle both. */
function rel<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function hhmm(time: string): string {
  return time.slice(0, 5);
}

/** Accepts a zone id (Z1) or a zone name (Velachery). */
async function resolveZone(input: string): Promise<ZoneRow> {
  const { data, error } = await getSupabase().from("zones").select("id, name");
  if (error) throw new Error(error.message);
  const zones = (data ?? []) as ZoneRow[];
  const needle = input.trim().toLowerCase();
  const match = zones.find(
    (z) => z.id.toLowerCase() === needle || z.name.toLowerCase() === needle
  );
  if (!match) {
    throw new Error(
      `Unknown zone "${input}". Known zones: ${zones.map((z) => `${z.id} ${z.name}`).join(", ")}`
    );
  }
  return match;
}

/** Active deliveries a rider is holding right now (same rule the DB function uses). */
async function activeLoadByRider(): Promise<Map<string, number>> {
  const { data, error } = await getSupabase()
    .from("deliveries")
    .select("rider_id")
    .in("status", ["assigned", "out_for_delivery"]);
  if (error) throw new Error(error.message);
  const load = new Map<string, number>();
  for (const row of (data ?? []) as { rider_id: string | null }[]) {
    if (!row.rider_id) continue;
    load.set(row.rider_id, (load.get(row.rider_id) ?? 0) + 1);
  }
  return load;
}

async function loadDeliveries(filters: {
  status?: string | string[];
  delivery_date?: string;
  zone_id?: string;
  time_window?: string;
}): Promise<DeliveryRow[]> {
  let query = getSupabase()
    .from("deliveries")
    .select(
      "id, order_ref, customer_name, address, zone_id, parcel_size, is_cod, cod_amount, delivery_date, time_window, rider_id, status, attempts, zones(name), riders(name)"
    )
    .order("delivery_date", { ascending: true })
    .order("order_ref", { ascending: true });

  if (Array.isArray(filters.status)) query = query.in("status", filters.status);
  else if (filters.status) query = query.eq("status", filters.status);
  if (filters.delivery_date) query = query.eq("delivery_date", filters.delivery_date);
  if (filters.zone_id) query = query.eq("zone_id", filters.zone_id);
  if (filters.time_window) query = query.eq("time_window", filters.time_window);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as DeliveryRow[];
}

function compactDelivery(row: DeliveryRow) {
  return {
    order_ref: row.order_ref,
    customer: row.customer_name,
    address: row.address,
    zone: `${row.zone_id} ${rel(row.zones)?.name ?? ""}`.trim(),
    date: row.delivery_date,
    window: row.time_window,
    parcel: row.parcel_size,
    cod: row.is_cod ? row.cod_amount : 0,
    status: row.status,
    attempts: row.attempts,
    rider: rel(row.riders)?.name ?? null,
  };
}

async function findDeliveryByRef(orderRef: string): Promise<{ id: number; order_ref: string }> {
  const { data, error } = await getSupabase()
    .from("deliveries")
    .select("id, order_ref, status")
    .ilike("order_ref", orderRef.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No delivery found with order reference ${orderRef}`);
  return data as { id: number; order_ref: string };
}

/* ---------------------------------- reads --------------------------------- */

const getPendingDeliveries = defineTool({
  name: "getPendingDeliveries",
  description:
    "Use this when the dispatcher wants to see deliveries that still need a rider. Returns pending deliveries for one date (default today), optionally filtered by zone (name or id) and time window.",
  schema: z.object({
    zone: z
      .string()
      .trim()
      .optional()
      .describe("Zone name like Velachery or zone id like Z1. Leave empty for all zones."),
    delivery_date: isoDate
      .optional()
      .describe("Date in YYYY-MM-DD format. Default is today."),
    time_window: timeWindowSchema.optional().describe("Only deliveries in this window."),
  }),
  run: async ({ zone, delivery_date, time_window }) => {
    const date = delivery_date ?? todayInIndia();
    const zoneRow = zone ? await resolveZone(zone) : null;
    const rows = await loadDeliveries({
      status: "pending",
      delivery_date: date,
      zone_id: zoneRow?.id,
      time_window,
    });
    return {
      date,
      zone: zoneRow ? `${zoneRow.id} ${zoneRow.name}` : "all zones",
      count: rows.length,
      deliveries: rows.map(compactDelivery),
    };
  },
});

const getAvailableRiders = defineTool({
  name: "getAvailableRiders",
  description:
    "Use this when you need real rider ids before assigning. Returns active riders who have a shift on the given date, with their zone, shift hours, current active load, free capacity and whether their shift covers the requested time window. Only riders with available=true can take more deliveries.",
  schema: z.object({
    delivery_date: isoDate
      .optional()
      .describe("Shift date in YYYY-MM-DD format. Default is today."),
    zone: z
      .string()
      .trim()
      .optional()
      .describe("Zone name like Velachery or zone id like Z1. Leave empty for all zones."),
    time_window: timeWindowSchema
      .optional()
      .describe("The window the dispatcher asked for, so shift coverage can be checked."),
  }),
  run: async ({ delivery_date, zone, time_window }) => {
    const date = delivery_date ?? todayInIndia();
    const zoneRow = zone ? await resolveZone(zone) : null;
    const supabase = getSupabase();

    let riderQuery = supabase
      .from("riders")
      .select("id, name, phone, home_zone, vehicle, capacity, is_active, zones(name)")
      .eq("is_active", true)
      .order("id");
    if (zoneRow) riderQuery = riderQuery.eq("home_zone", zoneRow.id);

    const [ridersRes, shiftsRes, loads] = await Promise.all([
      riderQuery,
      supabase
        .from("rider_shifts")
        .select("rider_id, shift_date, start_time, end_time")
        .eq("shift_date", date),
      activeLoadByRider(),
    ]);
    if (ridersRes.error) throw new Error(ridersRes.error.message);
    if (shiftsRes.error) throw new Error(shiftsRes.error.message);

    const shifts = new Map<string, ShiftRow>(
      ((shiftsRes.data ?? []) as ShiftRow[]).map((s) => [s.rider_id, s])
    );
    const windowBounds: Record<string, { start: string; end: string }> = {
      morning: { start: "08:00:00", end: "12:00:00" },
      afternoon: { start: "12:00:00", end: "17:00:00" },
      evening: { start: "17:00:00", end: "21:00:00" },
    };
    const want = time_window ? windowBounds[time_window] : null;

    const rows = ((ridersRes.data ?? []) as RiderRow[])
      .filter((r) => shifts.has(r.id))
      .map((r) => {
        const shift = shifts.get(r.id)!;
        const active = loads.get(r.id) ?? 0;
        const free = r.capacity - active;
        const coversWindow = want
          ? hhmm(shift.start_time) <= hhmm(want.start) && hhmm(shift.end_time) >= hhmm(want.end)
          : null;
        return {
          rider_id: r.id,
          name: r.name,
          zone: `${r.home_zone} ${rel(r.zones)?.name ?? ""}`.trim(),
          vehicle: r.vehicle,
          shift: `${hhmm(shift.start_time)}-${hhmm(shift.end_time)}`,
          covers_window: coversWindow,
          active,
          capacity: r.capacity,
          free_capacity: free,
          available: free > 0,
        };
      })
      .sort((a, b) => b.free_capacity - a.free_capacity);

    return {
      date,
      zone: zoneRow ? `${zoneRow.id} ${zoneRow.name}` : "all zones",
      time_window: time_window ?? null,
      note:
        rows.length === 0
          ? `No active rider has a shift on ${date}${zoneRow ? ` in ${zoneRow.name}` : ""}.`
          : undefined,
      riders: rows,
    };
  },
});

const getRiderLoad = defineTool({
  name: "getRiderLoad",
  description:
    "Use this when the dispatcher asks who has free capacity, who is overloaded, or how the fleet is doing today. Returns every rider's active load, capacity, free capacity, today's shift and deliveries completed today.",
  schema: z.object({
    delivery_date: isoDate.optional().describe("Date in YYYY-MM-DD format. Default is today."),
  }),
  run: async ({ delivery_date }) => {
    const date = delivery_date ?? todayInIndia();
    const supabase = getSupabase();

    const [ridersRes, shiftsRes, loads, deliveredRes] = await Promise.all([
      supabase
        .from("riders")
        .select("id, name, phone, home_zone, vehicle, capacity, is_active, zones(name)")
        .order("id"),
      supabase
        .from("rider_shifts")
        .select("rider_id, shift_date, start_time, end_time")
        .eq("shift_date", date),
      activeLoadByRider(),
      supabase
        .from("deliveries")
        .select("rider_id")
        .eq("status", "delivered")
        .eq("delivery_date", date),
    ]);
    if (ridersRes.error) throw new Error(ridersRes.error.message);
    if (shiftsRes.error) throw new Error(shiftsRes.error.message);
    if (deliveredRes.error) throw new Error(deliveredRes.error.message);

    const shifts = new Map<string, ShiftRow>(
      ((shiftsRes.data ?? []) as ShiftRow[]).map((s) => [s.rider_id, s])
    );
    const delivered = new Map<string, number>();
    for (const row of (deliveredRes.data ?? []) as { rider_id: string | null }[]) {
      if (!row.rider_id) continue;
      delivered.set(row.rider_id, (delivered.get(row.rider_id) ?? 0) + 1);
    }

    const riders = ((ridersRes.data ?? []) as RiderRow[]).map((r) => {
      const shift = shifts.get(r.id);
      const active = loads.get(r.id) ?? 0;
      return {
        rider_id: r.id,
        name: r.name,
        zone: `${r.home_zone} ${rel(r.zones)?.name ?? ""}`.trim(),
        vehicle: r.vehicle,
        is_active: r.is_active,
        on_shift: Boolean(shift),
        shift: shift ? `${hhmm(shift.start_time)}-${hhmm(shift.end_time)}` : "off today",
        active,
        capacity: r.capacity,
        free_capacity: Math.max(r.capacity - active, 0),
        delivered_today: delivered.get(r.id) ?? 0,
      };
    });

    return {
      date,
      riders_on_shift: riders.filter((r) => r.on_shift && r.is_active).length,
      riders_with_free_capacity: riders.filter((r) => r.on_shift && r.is_active && r.free_capacity > 0)
        .length,
      riders,
    };
  },
});

const getFailedDeliveries = defineTool({
  name: "getFailedDeliveries",
  description:
    "Use this when the dispatcher mentions failed deliveries or wants to reschedule them. Returns failed deliveries with the date they were attempted, how many attempts are used, and whether they can still be retried (3 attempts is the maximum).",
  schema: z.object({
    zone: z.string().trim().optional().describe("Optional zone name or id to filter."),
  }),
  run: async ({ zone }) => {
    const zoneRow = zone ? await resolveZone(zone) : null;
    const rows = await loadDeliveries({ status: "failed", zone_id: zoneRow?.id });
    return {
      count: rows.length,
      zone: zoneRow ? `${zoneRow.id} ${zoneRow.name}` : "all zones",
      deliveries: rows.map((row) => ({
        ...compactDelivery(row),
        reschedule_allowed: row.attempts < 3,
        blocked_reason:
          row.attempts >= 3
            ? "Already has 3 attempts, cannot be rescheduled. Mark it returned."
            : undefined,
      })),
    };
  },
});

/* --------------------------------- writes --------------------------------- */

const assignDelivery = defineTool({
  name: "assignDelivery",
  description:
    "Use this to give one pending delivery to one rider. Pass the order reference (like ORD-5006) and the rider id (like R01). The database function assign_delivery() checks the zone, the rider's shift, capacity and attempts, and its error message explains any rule that blocked the assignment.",
  writes: true,
  schema: z.object({
    order_ref: z
      .string()
      .trim()
      .min(3)
      .describe("Delivery reference exactly as returned by the tools, for example ORD-5006"),
    rider_id: z.string().trim().min(2).describe("Rider id exactly as returned, for example R01"),
  }),
  run: async ({ order_ref, rider_id }) => {
    const delivery = await findDeliveryByRef(order_ref);
    const { data, error } = await getSupabase().rpc("assign_delivery", {
      p_delivery_id: delivery.id,
      p_rider_id: rider_id,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

const rescheduleDelivery = defineTool({
  name: "rescheduleDelivery",
  description:
    "Use this to move a failed delivery to a new date and time window. Only failed deliveries can be rescheduled, and a delivery can have at most 3 attempts. The database function reschedule_delivery() clears the rider so the delivery can be assigned again.",
  writes: true,
  schema: z.object({
    order_ref: z
      .string()
      .trim()
      .min(3)
      .describe("Delivery reference exactly as returned, for example ORD-4990"),
    new_date: isoDate.describe("New delivery date in YYYY-MM-DD format. Today or later."),
    time_window: timeWindowSchema,
  }),
  run: async ({ order_ref, new_date, time_window }) => {
    const delivery = await findDeliveryByRef(order_ref);
    const { data, error } = await getSupabase().rpc("reschedule_delivery", {
      p_delivery_id: delivery.id,
      p_new_date: new_date,
      p_time_window: time_window,
    });
    if (error) throw new Error(error.message);
    return data;
  },
});

const batchAssignDeliveries = defineTool({
  name: "batchAssignDeliveries",
  description:
    "Use this when the dispatcher asks to assign several pending deliveries at once, for example 'assign all pending Velachery deliveries for this evening'. It takes every pending delivery for the date that matches the zone and time window, and gives each one to the rider in that zone with the most free capacity, through the database function assign_delivery(). Use dry_run when the dispatcher only wants to see the plan, and report the assigned, the unassigned and the reasons.",
  writes: true,
  schema: z.object({
    zone: z
      .string()
      .trim()
      .optional()
      .describe("Zone name like Velachery or zone id like Z1. Leave empty for all zones."),
    delivery_date: isoDate.optional().describe("Date in YYYY-MM-DD format. Default is today."),
    time_window: timeWindowSchema.optional().describe("Only deliveries in this window."),
    dry_run: z
      .boolean()
      .optional()
      .describe("true to only preview the assignments without writing anything"),
  }),
  run: async ({ zone, delivery_date, time_window, dry_run }) =>
    batchAssign({ zone, delivery_date, time_window, dry_run }),
});

/** Every tool in this list is given to Gemini. */
export const tools: AgentTool[] = [
  getPendingDeliveries,
  getAvailableRiders,
  getRiderLoad,
  getFailedDeliveries,
  assignDelivery,
  batchAssignDeliveries,
  rescheduleDelivery,
];
