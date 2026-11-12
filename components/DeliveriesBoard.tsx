"use client";

import { useEffect, useState } from "react";
import type { BoardDelivery, BoardResponse, BoardRider } from "@/lib/types";

const COLUMNS: { key: string; label: string; dot: string; statuses: BoardDelivery["status"][] }[] = [
  { key: "pending", label: "Pending", dot: "bg-amber-400", statuses: ["pending"] },
  { key: "assigned", label: "Assigned", dot: "bg-sky-400", statuses: ["assigned"] },
  { key: "out_for_delivery", label: "Out for delivery", dot: "bg-indigo-400", statuses: ["out_for_delivery"] },
  { key: "delivered", label: "Delivered", dot: "bg-emerald-400", statuses: ["delivered"] },
  { key: "failed", label: "Failed", dot: "bg-rose-400", statuses: ["failed", "returned"] },
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

export default function DeliveriesBoard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [error, setError] = useState("");

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

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>
          {data ? `${data.deliveries.length} deliveries` : "Loading deliveries…"}
        </span>
        {data && (
          <span className="text-slate-500">
            Today is {dayLabel(data.today)} · refreshes every 5 seconds
          </span>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = (data?.deliveries ?? []).filter((d) => col.statuses.includes(d.status));
          return (
            <section
              key={col.key}
              className="flex min-h-[160px] flex-col rounded-2xl border border-slate-800 bg-slate-900/50"
            >
              <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <h2 className="text-sm font-medium text-slate-200">{col.label}</h2>
                </div>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {items.length}
                </span>
              </header>
              <div className="flex-1 space-y-2 p-2">
                {items.map((d) => (
                  <DeliveryCard key={d.id} delivery={d} />
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-4 text-xs text-slate-600">Nothing here.</p>
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
    <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-slate-100">{d.order_ref}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] ${statusBadge(d.status)}`}>
          {d.status.replace(/_/g, " ")}
        </span>
      </div>
      <p className="mt-1 truncate text-slate-200">{d.customer_name}</p>
      <p className="truncate text-slate-500">{d.address}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
        <span className="rounded bg-slate-800 px-1.5 py-0.5">{d.zone_name}</span>
        <span>
          {dayLabel(d.delivery_date)} · {weekWindow(d.time_window)}
        </span>
        <span className="capitalize">{d.parcel_size}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        {d.is_cod && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
            COD ₹{d.cod_amount}
          </span>
        )}
        {d.attempts > 0 && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">
            {d.attempts}/3 attempts
          </span>
        )}
        <span className={d.rider_name ? "text-slate-300" : "text-slate-600"}>
          {d.rider_name ?? "no rider"}
        </span>
      </div>
    </article>
  );
}

function RiderStrip({ riders }: { riders: BoardRider[] }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
      <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Rider load today</p>
      <div className="flex flex-wrap gap-2">
        {riders.map((r) => (
          <span
            key={r.id}
            className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300"
          >
            {r.name}
            <span className="ml-1.5 text-slate-500">{r.zone_name}</span>
            <span
              className={
                r.free > 0
                  ? "ml-2 font-medium text-emerald-400"
                  : "ml-2 font-medium text-rose-400"
              }
            >
              {r.active}/{r.capacity}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
