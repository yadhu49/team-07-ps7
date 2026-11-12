"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardDelivery, RiderSummary, RiderViewResponse } from "@/lib/types";

function rupees(amount: number): string {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

const FAIL_REASONS = [
  { value: "customer_not_home", label: "Customer not home" },
  { value: "wrong_address", label: "Wrong address" },
  { value: "refused", label: "Customer refused" },
] as const;

type FailReason = (typeof FAIL_REASONS)[number]["value"];

export default function RiderView() {
  const [data, setData] = useState<RiderViewResponse | null>(null);
  const [riderId, setRiderId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [failReason, setFailReason] = useState<FailReason>("customer_not_home");

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
          reason: outcome === "failed" ? failReason : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update the delivery");
      setNotice(
        outcome === "delivered"
          ? `${delivery.order_ref} marked delivered${delivery.is_cod ? ` · ${rupees(delivery.cod_amount)} collected` : ""}.`
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
    return <div className="rounded-2xl border border-danger-line bg-tint-danger p-4 text-sm text-danger">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-tint-success text-sm font-semibold text-success ring-1 ring-inset ring-emerald-400/25">
            {rider ? initials(rider.name) : "–"}
          </span>
          <div className="min-w-0 flex-1">
            <label htmlFor="rider" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Riding as
            </label>
            <select
              id="rider"
              value={rider?.id ?? ""}
              onChange={(e) => {
                setRiderId(e.target.value);
                setNotice("");
                setError("");
              }}
              className="select mt-1"
            >
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.zone_name}
                  {r.shift ? ` · ${r.shift.start}-${r.shift.end}` : " · no shift today"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {rider && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="chip font-mono">{rider.id}</span>
            <span className="chip capitalize">{rider.vehicle}</span>
            <span className="chip">{rider.zone_name}</span>
            <span className="chip">
              {rider.shift ? `shift ${rider.shift.start}-${rider.shift.end}` : "no shift today"}
            </span>
            <span className="chip">{rider.active.length} open stops</span>
          </div>
        )}
      </div>

      {rider && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card border-success-line p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success">COD collected</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-fg tabular-nums">
              {rupees(rider.cod_collected)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">{rider.delivered_count} delivered today</p>
          </div>
          <div className="card border-warn-line p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-warn">COD to collect</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-fg tabular-nums">
              {rupees(rider.cod_pending)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">{rider.active.length} open stops</p>
          </div>
        </div>
      )}

      {notice && (
        <p className="flex items-start gap-2 rounded-xl border border-success-line bg-tint-success px-3 py-2 text-[12px] text-success">
          <span aria-hidden="true">✓</span>
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-danger-line bg-tint-danger px-3 py-2 text-[12px] text-danger">{error}</p>
      )}

      <section className="card overflow-hidden">
        <div className="card-head flex-wrap">
          <div>
            <h2 className="text-[15px] font-semibold text-fg">Today&rsquo;s stops</h2>
            <p className="text-[11px] text-muted">Mark each stop. The deliveries board updates within 5 seconds.</p>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-muted">
            If failed
            <select
              value={failReason}
              onChange={(e) => setFailReason(e.target.value as FailReason)}
              className="select w-auto py-1 text-[11px]"
              aria-label="Failure reason"
            >
              {FAIL_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="divide-y divide-line">
          {rider?.active.map((d) => (
            <li key={d.id} className="px-3 py-3 transition hover:bg-elev sm:px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-semibold text-fg">{d.order_ref}</p>
                  <p className="truncate text-[13px] text-fg-soft">{d.customer_name}</p>
                  <p className="truncate text-[11px] text-muted">{d.address}</p>
                </div>
                <span
                  className={
                    d.is_cod
                      ? "shrink-0 rounded bg-tint-warn px-1.5 py-0.5 text-[10px] font-medium text-warn"
                      : "shrink-0 rounded bg-elev px-1.5 py-0.5 text-[10px] text-muted"
                  }
                >
                  {d.is_cod ? `COD ${rupees(d.cod_amount)}` : "prepaid"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                <span className="chip">{d.zone_name}</span>
                <span className="capitalize">{d.time_window}</span>
                <span className="capitalize">{d.parcel_size}</span>
                <span className="inline-flex items-center gap-1">
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={i < d.attempts ? "h-1 w-1 rounded-full bg-amber-400" : "h-1 w-1 rounded-full bg-track-strong"}
                      />
                    ))}
                  </span>
                  {d.attempts}/3
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => mark(d, "delivered")}
                  disabled={busyId === d.id}
                  className="btn btn-primary py-2 text-[12px]"
                >
                  {busyId === d.id ? "Saving…" : "Delivered"}
                </button>
                <button
                  onClick={() => mark(d, "failed")}
                  disabled={busyId === d.id}
                  className="btn btn-danger py-2 text-[12px]"
                >
                  Failed
                </button>
              </div>
            </li>
          ))}

          {rider && rider.active.length === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-muted">
              No open stops for {rider.name} today.
            </li>
          )}
          {!rider && !error && <li className="px-4 py-6 skeleton h-16" />}
        </ul>
      </section>

      <CodSummary riders={riders} today={data?.today ?? ""} />
    </div>
  );
}

/** Daily cash-on-delivery totals for every rider, for the hub supervisor. */
function CodSummary({ riders, today }: { riders: RiderSummary[]; today: string }) {
  const total = riders.reduce((sum, r) => sum + r.cod_collected, 0);
  const rows = [...riders].sort((a, b) => b.cod_collected - a.cod_collected);
  const max = Math.max(...rows.map((r) => r.cod_collected), 1);

  return (
    <section className="card overflow-hidden">
      <div className="card-head flex-wrap">
        <div>
          <p className="eyebrow">Cash</p>
          <h2 className="mt-0.5 text-[15px] font-semibold text-fg">Cash on delivery today</h2>
          <p className="text-[11px] text-muted">Collected per rider, from delivered COD parcels</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-mono text-[15px] font-semibold text-success">{rupees(total)}</p>
          <button
            onClick={() => exportCsv(rows, today)}
            disabled={rows.length === 0}
            className="btn btn-ghost px-2.5 py-1 text-[11px]"
          >
            Export CSV
          </button>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2">
            <span className="w-28 shrink-0 truncate text-[12px] text-fg-soft sm:w-40">{r.name}</span>
            <div className="hidden h-1 flex-1 overflow-hidden rounded-full bg-elev sm:block">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400/70 to-emerald-400"
                style={{ width: `${Math.round((r.cod_collected / max) * 100)}%` }}
              />
            </div>
            <span className="ml-auto shrink-0 font-mono text-[12px] text-fg-soft tabular-nums">
              {rupees(r.cod_collected)}
            </span>
            <span className="w-16 shrink-0 text-right text-[10px] text-muted">{r.delivered_count} done</span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-5 text-[12px] text-muted">No riders yet.</li>}
      </ul>
    </section>
  );
}

function exportCsv(riders: RiderSummary[], today: string) {
  const header = ["rider_id", "name", "zone", "delivered_today", "cod_collected", "cod_pending"];
  const lines = [
    header.join(","),
    ...riders.map((r) =>
      [r.id, r.name, r.zone_name, r.delivered_count, r.cod_collected, r.cod_pending].map(csvCell).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `routewise-cod-${today || "today"}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
