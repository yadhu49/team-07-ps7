"use client";

import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.href = "/";
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
    }
  }

  return (
    <main className="relative z-10 flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_14px_30px_-14px_rgba(16,185,129,0.95)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
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
          <div>
            <p className="text-lg font-semibold tracking-tight text-slate-50">RouteWise</p>
            <p className="text-[11px] text-slate-500">Chennai hub · Team 07</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card p-6">
          <h1 className="text-[15px] font-semibold text-slate-50">Enter team passcode</h1>
          <p className="mt-1 text-[12px] text-slate-400">
            This keeps your dispatch data and your Gemini quota to the team.
          </p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="input mt-4"
            placeholder="Passcode"
            autoFocus
            aria-label="Team passcode"
          />
          {error && <p className="mt-2 text-[12px] text-rose-400">{error}</p>}
          <button type="submit" disabled={loading || !passcode} className="btn btn-primary mt-4 w-full">
            {loading ? "Checking…" : "Enter dispatch"}
          </button>
          <p className="mt-3 text-center text-[11px] text-slate-600">
            Demo passcode: <span className="font-mono text-slate-400">routewise2026</span>
          </p>
        </form>
      </div>
    </main>
  );
}
