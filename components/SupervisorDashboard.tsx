"use client";

import { useEffect, useMemo, useState } from "react";
import type { BatchAssignResult, DashboardResponse } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const REASON_LABELS: Record<string, string> = {
  customer_not_home: "Customer not home",
  wrong_address: "Wrong address",
  refused: "Customer refused",
  failed: "Other failure",
  rescheduled: "Rescheduled instead",
};

function rupees(amount: number): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function shortDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

export default function SupervisorDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load the dashboard");
        if (!cancelled) {
          setData(body as DashboardResponse);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the dashboard");
      }
    }

    load();
    const timer = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error && !data) {
    return <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>;
  }

  if (!data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="card h-24 shimmer" />
        ))}
      </div>
    );
  }

  const t = data.totals;
  const loadPct = t.capacityTotal === 0 ? 0 : Math.round((t.capacityInUse / t.capacityTotal) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-slate-400">
        <span className="text-slate-300">Today is {shortDay(t.date)}</span>
        <span className="text-slate-600">·</span>
        <span>{t.deliveries} deliveries scheduled</span>
        <span className="text-slate-600">·</span>
        <span>refreshes every 10 seconds</span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Delivered" value={String(t.delivered)} sub={`${t.successRate}% success rate`} tone="emerald" />
        <Kpi label="Open now" value={String(t.open)} sub={`${t.pending} still unassigned`} tone="sky" />
        <Kpi label="Failed" value={String(t.failed)} sub="failed or returned" tone="rose" />
        <Kpi label="COD collected" value={rupees(t.codCollected)} sub="cash in hand today" tone="emerald" />
        <Kpi label="COD to collect" value={rupees(t.codPending)} sub="on open parcels" tone="amber" />
        <Kpi label="Fleet load" value={`${loadPct}%`} sub={`${t.capacityInUse}/${t.capacityTotal} slots used`} tone="slate" />
      </div>

      <BatchAssignPanel zones={data.zones.map((z) => ({ id: z.zone_id, name: z.zone_name }))} />

      <div className="grid gap-3 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="card-head">
            <div>
              <p className="eyebrow">Seven days</p>
              <h2 className="mt-0.5 text-[15px] font-semibold text-slate-50">Delivered vs failed</h2>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <Legend className="bg-emerald-400" label="delivered" />
              <Legend className="bg-rose-400" label="failed" />
            </div>
          </div>
          <TrendChart trend={data.trend} />
        </section>

        <section className="card lg:col-span-2">
          <div className="card-head">
            <div>
              <p className="eyebrow">Why stops fail</p>
              <h2 className="mt-0.5 text-[15px] font-semibold text-slate-50">Failure reasons</h2>
            </div>
            <span className="pill">last 7 days</span>
          </div>
          <ReasonList reasons={data.reasons} />
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="card-head">
          <div>
            <p className="eyebrow">Zones</p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-slate-50">Today by zone</h2>
          </div>
          <span className="pill">{data.zones.length} zones</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {data.zones.map((z) => {
            const done = z.total === 0 ? 0 : Math.round((z.delivered / z.total) * 100);
            return (
              <li key={z.zone_id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-[110px] text-[13px] text-slate-200">{z.zone_name}</span>
                  <span className="font-mono text-[11px] text-slate-500">{z.total} deliveries</span>
                  <span className="ml-auto flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-300">{z.delivered} done</span>
                    <span className="text-rose-300">{z.failed} failed</span>
                    <span className="text-sky-300">{z.open} open</span>
                    <span className="w-20 text-right text-amber-300/90">{rupees(z.cod_open)}</span>
                  </span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className="h-full bg-emerald-400" style={{ width: `${done}%` }} />
                  <div className="h-full bg-rose-400/80" style={{ width: `${z.total === 0 ? 0 : (z.failed / z.total) * 100}%` }} />
                </div>
              </li>
            );
          })}
          {data.zones.length === 0 && <li className="px-4 py-5 text-[12px] text-slate-500">No deliveries today.</li>}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <div className="card-head">
          <div>
            <p className="eyebrow">Riders</p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-slate-50">Rider performance today</h2>
          </div>
          <span className="pill">{data.riders.length} riders working</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                <th className="px-4 py-2 font-medium">Rider</th>
                <th className="px-2 py-2 font-medium">Zone</th>
                <th className="px-2 py-2 text-right font-medium">Done</th>
                <th className="px-2 py-2 text-right font-medium">Failed</th>
                <th className="px-2 py-2 font-medium">Load</th>
                <th className="px-4 py-2 text-right font-medium">COD collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {data.riders.map((r) => {
                const pct = r.capacity === 0 ? 0 : Math.round((r.active / r.capacity) * 100);
                return (
                  <tr key={r.id} className="text-slate-300">
                    <td className="px-4 py-2 text-slate-100">{r.name}</td>
                    <td className="px-2 py-2 text-slate-500">{r.zone_name}</td>
                    <td className="px-2 py-2 text-right font-mono text-emerald-300">{r.delivered}</td>
                    <td className="px-2 py-2 text-right font-mono text-rose-300">{r.failed}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                          <div
                            className={pct >= 100 ? "h-full bg-rose-400" : pct >= 80 ? "h-full bg-amber-400" : "h-full bg-emerald-400"}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-slate-500">
                          {r.active}/{r.capacity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-200">{rupees(r.cod_collected)}</td>
                  </tr>
                );
              })}
              {data.riders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-slate-500">
                    No rider has deliveries today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "sky" | "rose" | "amber" | "slate";
}) {
  const dot = {
    emerald: "bg-emerald-400",
    sky: "bg-sky-400",
    rose: "bg-rose-400",
    amber: "bg-amber-400",
    slate: "bg-slate-400",
  }[tone];

  return (
    <div className="card px-3.5 py-3">
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      </div>
      <p className="mt-1.5 font-mono text-xl font-semibold text-slate-50 tabular-nums">{value}</p>
      <p className="mt-0.5 truncate text-[10px] text-slate-500">{sub}</p>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function TrendChart({ trend }: { trend: DashboardResponse["trend"] }) {
  const max = Math.max(...trend.map((p) => Math.max(p.delivered, p.failed)), 1);
  const height = (n: number) => (n === 0 ? "2px" : `${Math.max((n / max) * 100, 6)}%`);

  return (
    <div className="p-4">
      <div className="flex h-32 items-end gap-2">
        {trend.map((point, i) => {
          const isToday = i === trend.length - 1;
          return (
            <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex h-full w-full items-end justify-center gap-1">
                <div
                  className="w-2.5 rounded-t bg-emerald-400/85 transition-all"
                  style={{ height: height(point.delivered) }}
                  title={`${point.delivered} delivered`}
                />
                <div
                  className="w-2.5 rounded-t bg-rose-400/80 transition-all"
                  style={{ height: height(point.failed) }}
                  title={`${point.failed} failed`}
                />
              </div>
              <span className={isToday ? "text-[10px] font-semibold text-slate-200" : "text-[10px] text-slate-500"}>
                {shortDay(point.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReasonList({ reasons }: { reasons: DashboardResponse["reasons"] }) {
  const total = reasons.reduce((sum, r) => sum + r.count, 0);
  if (reasons.length === 0) {
    return <p className="px-4 py-6 text-[12px] text-slate-500">No failed attempts in the last 7 days.</p>;
  }
  return (
    <ul className="space-y-2.5 p-4">
      {reasons.map((r) => (
        <li key={r.reason}>
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-slate-300">{REASON_LABELS[r.reason] ?? r.reason}</span>
            <span className="font-mono text-slate-400">{r.count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div className="h-full rounded-full bg-rose-400/80" style={{ width: `${Math.round((r.count / total) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Assign every matching pending delivery in one request (POST /api/batch-assign). */
function BatchAssignPanel({ zones }: { zones: { id: string; name: string }[] }) {
  const [zone, setZone] = useState("all");
  const [window, setWindow] = useState("all");
  const [busy, setBusy] = useState<"preview" | "run" | null>(null);
  const [result, setResult] = useState<BatchAssignResult | null>(null);
  const [error, setError] = useState("");

  const zoneOptions = useMemo(() => zones, [zones]);

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "preview" : "run");
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/batch-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: zone === "all" ? undefined : zone,
          time_window: window === "all" ? undefined : window,
          dry_run: dryRun,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Batch assign failed");
      setResult(body as BatchAssignResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch assign failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <p className="eyebrow">One request</p>
          <h2 className="mt-0.5 text-[15px] font-semibold text-slate-50">Batch assign pending deliveries</h2>
          <p className="text-[11px] text-slate-400">
            Every delivery still goes through <span className="font-mono text-slate-300">assign_delivery()</span>, and the
            rider with the most free capacity in that zone takes it.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center">
        <div className="grid flex-1 grid-cols-2 gap-2">
          <select value={zone} onChange={(e) => setZone(e.target.value)} className="select" aria-label="Zone">
            <option value="all">All zones</option>
            {zoneOptions.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          <select value={window} onChange={(e) => setWindow(e.target.value)} className="select" aria-label="Time window">
            <option value="all">All windows</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => run(true)} disabled={busy !== null} className="btn btn-ghost flex-1 md:flex-none">
            {busy === "preview" ? "Previewing…" : "Preview"}
          </button>
          <button onClick={() => run(false)} disabled={busy !== null} className="btn btn-primary flex-1 md:flex-none">
            {busy === "run" ? "Assigning…" : "Assign now"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mx-3 mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
          {error}
        </p>
      )}

      {result && (
        <div className="mx-3 mb-3 space-y-2 rounded-xl border border-white/[0.08] bg-black/25 p-3">
          <p className="text-[12px] text-slate-200">
            {result.dry_run && <span className="mr-1.5 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-300">preview</span>}
            {result.summary}
          </p>
          {result.assigned.length > 0 && (
            <ul className="grid gap-1 sm:grid-cols-2">
              {result.assigned.map((a) => (
                <li key={a.order_ref} className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                  <span className="font-mono text-slate-200">{a.order_ref}</span>
                  <span className="truncate">
                    → {a.rider_name} <span className="text-slate-600">{a.rider_id}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {result.unassigned.length > 0 && (
            <ul className="space-y-1 border-t border-white/[0.06] pt-2">
              {result.unassigned.map((u) => (
                <li key={u.order_ref} className="text-[11px] text-slate-400">
                  <span className="font-mono text-slate-300">{u.order_ref}</span> — {u.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
