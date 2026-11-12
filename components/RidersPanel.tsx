"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardResponse, BoardRider } from "@/lib/types";

export default function RidersPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [riders, setRiders] = useState<BoardRider[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/board");
        const body = (await res.json()) as BoardResponse & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not load riders");
        if (!cancelled) {
          setRiders(body.riders);
          setError("");
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load riders");
      }
    }

    load();
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refreshKey]);

  const onShift = useMemo(() => riders.filter((r) => r.shift && r.is_active), [riders]);
  const free = useMemo(() => onShift.filter((r) => r.free > 0), [onShift]);
  const shown = onlyFree ? free : riders;
  const totalFree = onShift.reduce((sum, r) => sum + r.free, 0);

  return (
    <div className="card overflow-hidden">
      <div className="card-head">
        <div>
          <p className="eyebrow">Fleet</p>
          <h2 className="mt-0.5 text-[15px] font-semibold text-slate-50">Riders and load</h2>
          <p className="text-[11px] text-slate-400">
            {loaded
              ? `${onShift.length} on shift · ${free.length} with free capacity · ${totalFree} slots open`
              : "Loading riders…"}
          </p>
        </div>
        {loaded && (
          <button
            onClick={() => setOnlyFree((v) => !v)}
            className={
              onlyFree
                ? "rounded-lg bg-emerald-400/15 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
                : "rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-100"
            }
          >
            Free only
          </button>
        )}
      </div>

      <ul className="max-h-[calc(78vh-92px)] divide-y divide-white/[0.05] overflow-y-auto">
        {error && <li className="p-4 text-sm text-rose-400">{error}</li>}
        {!error && loaded && shown.length === 0 && (
          <li className="p-4 text-sm text-slate-400">
            {onlyFree ? "Every rider is at full capacity." : "No riders found."}
          </li>
        )}
        {shown.map((r) => {
          const pct = Math.min(Math.round((r.active / Math.max(r.capacity, 1)) * 100), 100);
          const idle = !r.is_active || !r.shift;
          return (
            <li key={r.id} className="px-4 py-2.5 text-sm transition hover:bg-white/[0.03]">
              <div className="flex items-center gap-2.5">
                <span
                  className={
                    idle
                      ? "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[11px] font-semibold text-slate-500"
                      : "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-400/12 text-[11px] font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/25"
                  }
                >
                  {initials(r.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-medium text-slate-100">
                      {r.name}
                      <span className="ml-1.5 font-mono text-[10px] text-slate-500">{r.id}</span>
                    </p>
                    <span
                      className={
                        idle
                          ? "shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-slate-400"
                          : r.free > 0
                            ? "shrink-0 rounded bg-emerald-400/15 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300"
                            : "shrink-0 rounded bg-rose-400/15 px-1.5 py-0.5 font-mono text-[11px] text-rose-300"
                      }
                    >
                      {r.active}/{r.capacity}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-500">
                    {r.zone_name} · {r.vehicle} ·{" "}
                    {r.is_active
                      ? r.shift
                        ? `${r.shift.start}-${r.shift.end}`
                        : "no shift today"
                      : "inactive"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className={
                          pct >= 100 ? "h-full bg-rose-400" : pct >= 80 ? "h-full bg-amber-400" : "h-full bg-emerald-400"
                        }
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {r.free > 0 ? `${r.free} free` : "full"} · {r.delivered_today} done
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
