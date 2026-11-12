"use client";

import { useState } from "react";
import AgentChat from "@/components/AgentChat";
import AppHeader from "@/components/AppHeader";
import RidersPanel from "@/components/RidersPanel";

/*
 * DISPATCH CHAT
 * Left: the agent the dispatcher talks to.
 * Right: live rider load, so the dispatcher can see the fleet change.
 */
export default function DispatchPage() {
  // Changes every time the agent writes data, so the rider panel reloads.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <AppHeader />
      <div className="grid gap-4 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <AgentChat onDataChanged={() => setRefreshKey((k) => k + 1)} />
        </section>
        <section className="lg:col-span-2">
          <RidersPanel refreshKey={refreshKey} />
        </section>
      </div>
    </main>
  );
}
