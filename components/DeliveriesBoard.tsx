"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardDelivery, BoardResponse, BoardRider } from "@/lib/types";

const COLUMNS: {
  key: string;
  label: string;
  dot: string;
  accent: string;
  statuses: BoardDelivery["status"][];
}[] = [
  { key: "pending", label: "Pending", dot: "bg-amber-400", accent: "from-amber-400/60", statuses: ["pending"] },
  { key: "assigned", label: "Assigned", dot: "bg-sky-400", accent: "from-sky-400/60", statuses: ["assigned"] },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
    dot: "bg-indigo-400",
    accent: "from-indigo-400/60",
    statuses: ["out_for_delivery"],
  },
  {
    key: "delivered",
    label: "Delivered",
    dot: "bg-emerald-400",
    accent: "from-emerald-400/60",
    statuses: ["delivered"],
  },
  {
    key: "failed",
    label: "Failed",
    dot: "bg-rose-400",
    accent: "from-rose-400/60",
    statuses: ["failed", "returned"],
  },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]}`;
}

export function weekWindow(window: string): string {
  return window.charAt(0).toUpperCase() + window.slice(1);
}

function statusBadge(status: BoardDelivery["status"]) {
  const map: Record<BoardDelivery["status"], string> = {
    pending: "bg-amber-500/15 text-amber-300",
    assigned: "bg-sky-500/15 text-sky-300",
    out_for_delivery: "bg-indigo-500/15 text-indigo-300",
    delivered: "bg-emerald-500/15 text-emerald-300",
    failed: "bg-rose-500/15 text-rose-300",
    returned: "bg-slate-500/20 text-slate-300",
  };
  return map[status];
}

function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function DeliveriesBoard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("all");
  const [window, setWindowFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/board");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load the board");
        if (!cancelled) {
          setData(body as BoardResponse);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the board");
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshKey]);

  const deliveries = data?.deliveries ?? [];

  const zones = useMemo(() => {
    const map = new Map<string, string>();
    deliveries.forEach((d) => map.set(d.zone_id, d.zone_name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [deliveries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deliveries.filter((d) => {
      if (zone !== "all" && d.zone_id !== zone) return false;
      if (window !== "all" && d.time_window !== window) return false;
      if (!q) return true;
      return (
        d.order_ref.toLowerCase().includes(q) ||
        d.customer_name.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        (d.rider_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [deliveries, query, zone, window]);

  const codToCollect = useMemo(
    () =>
      deliveries
        .filter((d) => d.is_cod && (d.status === "pending" || d.status === "assigned" || d.status === "out_for_delivery"))
        .reduce((sum, d) => sum + Number(d.cod_amount), 0),
    [deliveries]
  );

  const filtering = Boolean(query.trim()) || zone !== "all" || window !== "all";

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const count = data
            ? col.statuses.reduce((sum, s) => sum + (data.counts[s] ?? 0), 0)
            : null;
          return (
            <div key={col.key} className="card px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                <p className="truncate text-[11px] text-slate-400">{col.label}</p>
              </div>
              <p className="mt-1 font-mono text-xl font-semibold text-slate-50 tabular-nums">
                {count ?? "–"}
              </p>
            </div>
          );
        })}
      </div>

      <div className="card flex flex-col gap-2 p-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500">⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order, customer, address or rider"
            className="input pl-8"
            aria-label="Search deliveries"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="select md:w-40"
            aria-label="Filter by zone"
          >
            <option value="all">All zones</option>
            {zones.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={window}
            onChange={(e) => setWindowFilter(e.target.value)}
            className="select md:w-36"
            aria-label="Filter by time window"
          >
            <option value="all">All windows</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
        <span>
          {data ? `${filtered.length} of ${deliveries.length} deliveries` : "Loading deliveries…"}
          {filtering && (
            <button
              onClick={() => {
                setQuery("");
                setZone("all");
                setWindowFilter("all");
              }}
              className="ml-2 rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-slate-400 hover:text-slate-100"
            >
              clear filters
            </button>
          )}
        </span>
        {data && <span className="text-slate-500">Today is {dayLabel(data.today)} · refreshes every 5 seconds</span>}
        <span className="ml-auto inline-flex items-center gap-1.5 text-amber-300/90">
          COD still to collect <span className="font-mono font-semibold">{rupees(codToCollect)}</span>
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = filtered.filter((d) => col.statuses.includes(d.status));
          return (
            <section key={col.key} className="card flex min-h-[170px] flex-col overflow-hidden">
              <div className={`h-px w-full bg-gradient-to-r ${col.accent} to-transparent`} />
              <header className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${col.dot}`} />
                  <h2 className="truncate text-[13px] font-semibold text-slate-200">{col.label}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 font-mono text-[11px] text-slate-300">
                  {items.length}
                </span>
              </header>
              <div className="flex-1 space-y-2 p-2">
                {items.map((d) => (
                  <DeliveryCard key={d.id} delivery={d} />
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-4 text-[11px] text-slate-600">
                    {filtering ? "No match here." : "Nothing here."}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {data && <RiderStrip riders={data.riders} />}
    </div>
  );
}

function DeliveryCard({ delivery: d }: { delivery: BoardDelivery }) {
  return (
    <article className="rounded-xl border border-white/[0.07] bg-[#080f1c]/80 p-2.5 text-xs transition hover:border-emerald-400/25 hover:bg-[#0a1424]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-slate-100">{d.order_ref}</span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${statusBadge(d.status)}`}>
          {d.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1 truncate text-slate-200">{d.customer_name}</p>
      <p className="truncate text-[11px] text-slate-500">{d.address}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
        <span className="chip">{d.zone_name}</span>
        <span>
          {dayLabel(d.delivery_date)} · {weekWindow(d.time_window)}
        </span>
        <span className="capitalize">{d.parcel_size}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        {d.is_cod && (
          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-medium text-amber-300">
            COD ₹{Number(d.cod_amount).toLocaleString("en-IN")}
          </span>
        )}
        {d.attempts > 0 && (
          <span className="inline-flex items-center gap-1 text-slate-300">
            <span className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={i < d.attempts ? "h-1 w-1 rounded-full bg-rose-400" : "h-1 w-1 rounded-full bg-slate-700"}
                />
              ))}
            </span>
            {d.attempts}/3
          </span>
        )}
        <span className={d.rider_name ? "text-slate-300" : "text-slate-600"}>{d.rider_name ?? "no rider"}</span>
      </div>
    </article>
  );
}

function RiderStrip({ riders }: { riders: BoardRider[] }) {
  return (
    <div className="card p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Rider load today</p>
        <p className="text-[11px] text-slate-500">
          {riders.filter((r) => r.free > 0).length} of {riders.length} with free capacity
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {riders.map((r) => {
          const pct = Math.min(Math.round((r.active / Math.max(r.capacity, 1)) * 100), 100);
          return (
            <div key={r.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] text-slate-200">{r.name}</span>
                <span
                  className={
                    r.free > 0
                      ? "shrink-0 font-mono text-[11px] text-emerald-300"
                      : "shrink-0 font-mono text-[11px] text-rose-300"
                  }
                >
                  {r.active}/{r.capacity}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className={pct >= 100 ? "h-full bg-rose-400" : pct >= 80 ? "h-full bg-amber-400" : "h-full bg-emerald-400"}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                {r.zone_name} · {r.shift ? `${r.shift.start}-${r.shift.end}` : "no shift"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
