"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dispatch chat" },
  { href: "/board", label: "Deliveries" },
  { href: "/riders", label: "Riders" },
  { href: "/rider", label: "Rider view" },
];

export default function AppHeader() {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="mb-5 flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-400">
          RouteWise · Chennai hub
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Delivery dispatch</h1>
        <p className="text-sm text-slate-400">Dispatcher D01 · Anitha V</p>
      </div>
      <nav className="flex flex-wrap items-center gap-1 text-sm">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "rounded-lg bg-emerald-500/15 px-3 py-1.5 font-medium text-emerald-300"
                  : "rounded-lg px-3 py-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              }
            >
              {link.label}
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="ml-2 rounded-lg px-2 py-1.5 text-slate-500 hover:text-slate-200"
        >
          Log out
        </button>
      </nav>
    </header>
  );
}
