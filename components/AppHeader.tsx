"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Dispatch chat" },
  { href: "/board", label: "Deliveries" },
  { href: "/dashboard", label: "Dashboard" },
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
    <header className="sticky top-0 z-30 -mx-4 mb-5 border-b border-line bg-header px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold tracking-tight text-fg">RouteWise</h1>
              <span className="pill hidden sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.55)]" />
                live
              </span>
            </div>
            <p className="text-[11px] text-muted">Chennai hub · dispatcher D01 · Anitha V</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "rounded-lg bg-tint-success px-2.5 py-1.5 text-[13px] font-semibold text-success ring-1 ring-inset ring-emerald-400/30"
                    : "rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted transition hover:bg-elev hover:text-fg"
                }
              >
                {link.label}
              </Link>
            );
          })}
          <ThemeToggle className="ml-1" />
          <button
            onClick={logout}
            className="ml-1 rounded-lg px-2 py-1.5 text-[13px] text-muted transition hover:text-fg-soft"
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.9)]">
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
        <path
          d="M5 17.5c0-3 2.4-4 4.6-4h4.8c2.2 0 4.6-1 4.6-4"
          stroke="#04120c"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <circle cx="5" cy="18" r="2.3" fill="#04120c" />
        <circle cx="19" cy="6" r="2.3" fill="#04120c" />
      </svg>
    </span>
  );
}
