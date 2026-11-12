"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentResult, AgentStep } from "@/lib/agent/types";

type Message = { role: "user" | "model"; text: string; steps?: AgentStep[] };

const SAMPLE_PROMPTS = [
  "Assign all pending Velachery deliveries for this evening.",
  "Which riders still have free capacity today?",
  "Reschedule yesterday's failed deliveries to tomorrow morning.",
];

export default function AgentChat({ onDataChanged }: { onDataChanged?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Message[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the last 20 messages are sent, to keep requests small.
        body: JSON.stringify({ messages: next.slice(-20).map(({ role, text }) => ({ role, text })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      const result = data as AgentResult;
      setMessages([...next, { role: "model", text: result.reply, steps: result.steps }]);
      if (result.steps.some((s) => s.writes && s.ok)) onDataChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex h-[78vh] min-h-[540px] flex-col overflow-hidden">
      <div className="card-head">
        <div>
          <p className="eyebrow">Agent</p>
          <h2 className="mt-0.5 text-[15px] font-semibold text-slate-50">Dispatch chat</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill hidden sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Gemini · function calling
          </span>
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setError("");
              }}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
              <p className="text-sm font-medium text-slate-100">Tell me what needs dispatching.</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                I read pending deliveries and rider capacity, then assign or reschedule through the database
                functions. Every tool call is shown below the answer, with its arguments and result.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Try one of these</p>
              {SAMPLE_PROMPTS.map((p, i) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left text-[13px] text-slate-200 transition hover:border-emerald-400/45 hover:bg-emerald-400/[0.06] hover:text-white"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] font-mono text-[10px] text-slate-400 group-hover:bg-emerald-400/20 group-hover:text-emerald-200">
                    0{i + 1}
                  </span>
                  <span className="min-w-0 flex-1">{p}</span>
                  <span className="shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-emerald-300">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user" ? "max-w-[85%]" : "max-w-[94%] space-y-2"}>
              {m.steps && m.steps.length > 0 && <ToolSteps steps={m.steps} />}
              {m.role === "model" ? (
                <div className="rounded-2xl rounded-tl-md border border-white/[0.09] bg-[#0b1220]/85 px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-slate-100">
                  {m.text}
                </div>
              ) : (
                <p className="rounded-2xl rounded-br-md bg-gradient-to-br from-emerald-400 to-emerald-500 px-3.5 py-2 text-[13px] leading-relaxed font-medium text-[#04130d] shadow-[0_12px_28px_-18px_rgba(16,185,129,0.95)]">
                  {m.text}
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[13px] text-emerald-300">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400" />
            </span>
            Agent is working…
          </div>
        )}
        {error && (
          <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-300">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.06] p-3">
        {messages.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {SAMPLE_PROMPTS.map((p, i) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={loading}
                className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-40"
              >
                {i === 0 ? "Assign Velachery evening" : i === 1 ? "Free capacity?" : "Reschedule failed"}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='e.g. "Assign all pending Adyar deliveries for this afternoon."'
            className="input min-w-0 flex-1"
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary shrink-0">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

/** Shows each tool call so users (and judges) can see what the agent did. */
function ToolSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <details
          key={i}
          className="group rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[11px]"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 select-none">
            <span
              className={
                s.ok
                  ? "h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                  : "h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"
              }
            />
            <span className="font-mono font-medium text-slate-100">{s.tool}</span>
            <span className={s.ok ? "text-emerald-300/90" : "text-rose-300"}>{s.ok ? "ok" : "blocked"}</span>
            {s.writes && (
              <span className="ml-auto shrink-0 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                writes
              </span>
            )}
            <span className="ml-auto text-slate-600 transition group-open:rotate-90">›</span>
          </summary>
          <pre className="mt-1.5 overflow-x-auto rounded-lg bg-black/30 p-2 whitespace-pre-wrap text-slate-400">
            {JSON.stringify(
              { args: s.args, ...(s.ok ? { result: s.result } : { error: s.error }) },
              null,
              2
            )}
          </pre>
        </details>
      ))}
    </div>
  );
}
