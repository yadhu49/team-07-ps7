"use client";

import { useEffect, useState } from "react";
import type { BoardResponse, BoardRider } from "@/lib/types";

export default function RidersPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [riders, setRiders] = useState<BoardRider[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

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

  const onShift = riders.filter((r) => r.shift && r.is_active);
  const free = onShift.filter((r) => r.free > 0);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-100">Riders and load</h2>
        <p className="text-xs text-slate-400">
          {loaded
            ? `${onShift.length} on shift · ${free.length} with free capacity`
            : "Loading riders…"}
        </p>
      </div>

      <ul className="divide-y divide-slate-800">
        {error && <li className="p-4 text-sm text-rose-400">{error}</li>}
        {!error && loaded && riders.length === 0 && (
          <li className="p-4 text-sm text-slate-400">No riders found.</li>
        )}
        {riders.map((r) => {
          const pct = Math.min(Math.round((r.active / r.capacity) * 100), 100);
          const idle = !r.is_active || !r.shift;
          return (
            <li key={r.id} className="px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-slate-100">
                    {r.name}
                    <span className="ml-1.5 font-mono text-[10px] text-slate-500">{r.id}</span>
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {r.zone_name} · {r.vehicle} ·{" "}
                    {r.is_active
                      ? r.shift
                        ? `shift ${r.shift.start}-${r.shift.end}`
                        : "no shift today"
                      : "inactive"}
                  </p>
                </div>
                <span
                  className={
                    idle
                      ? "shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
                      : r.free > 0
                        ? "shrink-0 rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                        : "shrink-0 rounded bg-rose-500/15 px-2 py-0.5 text-xs text-rose-300"
                  }
                >
                  {r.active}/{r.capacity}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={
                    pct >= 100 ? "h-full bg-rose-500" : pct >= 80 ? "h-full bg-amber-400" : "h-full bg-emerald-500"
                  }
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {r.free > 0 ? `${r.free} free` : "full"} · {r.delivered_today} delivered today
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
