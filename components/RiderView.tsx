"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardDelivery, RiderSummary, RiderViewResponse } from "@/lib/types";

function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function RiderView() {
  const [data, setData] = useState<RiderViewResponse | null>(null);
  const [riderId, setRiderId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/rider");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load the rider view");
      setData(body as RiderViewResponse);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the rider view");
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const riders = data?.riders ?? [];
  const rider = useMemo(() => {
    if (!riderId) return riders.find((r) => r.active.length > 0) ?? riders[0] ?? null;
    return riders.find((r) => r.id === riderId) ?? null;
  }, [riders, riderId]);

  async function mark(delivery: BoardDelivery, outcome: "delivered" | "failed") {
    if (!rider || busyId) return;
    setBusyId(delivery.id);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/rider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_id: delivery.id,
          rider_id: rider.id,
          outcome,
          reason: outcome === "failed" ? "customer_not_home" : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update the delivery");
      setNotice(
        outcome === "delivered"
          ? `${delivery.order_ref} marked delivered.`
          : `${delivery.order_ref} marked failed (${body.attempts_left ?? 0} attempts left).`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the delivery");
    } finally {
      setBusyId(null);
    }
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <label htmlFor="rider" className="text-xs uppercase tracking-wider text-slate-500">
          Riding as
        </label>
        <select
          id="rider"
          value={rider?.id ?? ""}
          onChange={(e) => {
            setRiderId(e.target.value);
            setNotice("");
          }}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none sm:max-w-sm"
        >
          {riders.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.zone_name}
              {r.shift ? ` · ${r.shift.start}-${r.shift.end}` : " · no shift today"}
            </option>
          ))}
        </select>
        {rider && (
          <p className="mt-2 text-xs text-slate-400">
            {rider.id} · {rider.vehicle} · {rider.zone_name}
            {rider.shift ? ` · shift ${rider.shift.start}-${rider.shift.end}` : " · no shift today"}
          </p>
        )}
      </div>

      {rider && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-3">
            <p className="text-[11px] uppercase tracking-wider text-emerald-400">COD collected</p>
            <p className="mt-1 text-xl font-semibold text-slate-50">{rupees(rider.cod_collected)}</p>
            <p className="text-[11px] text-slate-400">{rider.delivered_count} delivered today</p>
          </div>
          <div className="rounded-2xl border border-amber-900/50 bg-amber-950/20 p-3">
            <p className="text-[11px] uppercase tracking-wider text-amber-400">COD to collect</p>
            <p className="mt-1 text-xl font-semibold text-slate-50">{rupees(rider.cod_pending)}</p>
            <p className="text-[11px] text-slate-400">{rider.active.length} open stops</p>
          </div>
        </div>
      )}

      {notice && (
        <p className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
        <header className="border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Today&rsquo;s stops</h2>
          <p className="text-[11px] text-slate-400">
            {rider ? "Mark each stop delivered or failed. Updates the deliveries board." : "Pick a rider."}
          </p>
        </header>

        <ul className="divide-y divide-slate-800">
          {rider?.active.map((d) => (
            <li key={d.id} className="px-3 py-3 sm:px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-slate-100">{d.order_ref}</p>
                  <p className="truncate text-sm text-slate-200">{d.customer_name}</p>
                  <p className="truncate text-[11px] text-slate-500">{d.address}</p>
                </div>
                <span
                  className={
                    d.is_cod
                      ? "shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300"
                      : "shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400"
                  }
                >
                  {d.is_cod ? `COD ${rupees(d.cod_amount)}` : "prepaid"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                <span className="rounded bg-slate-800 px-1.5 py-0.5">{d.zone_name}</span>
                <span className="capitalize">{d.time_window}</span>
                <span className="capitalize">{d.parcel_size}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5">{d.attempts}/3 attempts</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => mark(d, "delivered")}
                  disabled={busyId === d.id}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-slate-950 disabled:opacity-40"
                >
                  {busyId === d.id ? "Saving…" : "Delivered"}
                </button>
                <button
                  onClick={() => mark(d, "failed")}
                  disabled={busyId === d.id}
                  className="rounded-lg border border-rose-800/70 px-3 py-2 text-xs font-medium text-rose-300 disabled:opacity-40"
                >
                  Failed
                </button>
              </div>
            </li>
          ))}

          {rider && rider.active.length === 0 && (
            <li className="px-4 py-5 text-sm text-slate-400">
              No open stops for {rider.name} today.
            </li>
          )}
        </ul>
      </section>

      <CodSummary riders={riders} />
    </div>
  );
}

/** Daily cash-on-delivery totals for every rider, for the hub supervisor. */
function CodSummary({ riders }: { riders: RiderSummary[] }) {
  const total = riders.reduce((sum, r) => sum + r.cod_collected, 0);
  const rows = [...riders].sort((a, b) => b.cod_collected - a.cod_collected);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Cash on delivery today</h2>
          <p className="text-[11px] text-slate-400">Collected per rider, from delivered COD parcels</p>
        </div>
        <p className="text-sm font-semibold text-emerald-300">{rupees(total)}</p>
      </header>
      <ul className="divide-y divide-slate-800">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
            <span className="min-w-0 truncate text-slate-200">
              {r.name}
              <span className="ml-1.5 text-[10px] text-slate-500">{r.zone_name}</span>
            </span>
            <span className="shrink-0 text-slate-300">
              {rupees(r.cod_collected)}
              <span className="ml-1.5 text-[10px] text-slate-500">{r.delivered_count} done</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
