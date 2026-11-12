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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    <div className="flex h-[78vh] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="font-semibold text-slate-100">Dispatch chat</h2>
        <p className="text-xs text-slate-400">
          Ask in plain English. Every tool the agent calls is shown with its result.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Try one of these:</p>
            {SAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="block w-full rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-left text-sm text-slate-200 hover:border-emerald-500/60 hover:text-white"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-emerald-500 px-3 py-2 text-sm text-slate-950"
                  : "max-w-[92%] space-y-2"
              }
            >
              {m.steps && m.steps.length > 0 && <ToolSteps steps={m.steps} />}
              {m.role === "model" ? (
                <div className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100">
                  {m.text}
                </div>
              ) : (
                m.text
              )}
            </div>
          </div>
        ))}

        {loading && (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Agent is working…
          </p>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-slate-800 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "Assign all pending Adyar deliveries for this afternoon."'
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

/** Shows each tool call so users (and judges) can see what the agent did. */
function ToolSteps({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="space-y-1">
      {steps.map((s, i) => (
        <details
          key={i}
          className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-1.5 text-xs"
        >
          <summary className="cursor-pointer select-none text-slate-300">
            <span className={s.ok ? "text-emerald-400" : "text-rose-400"}>
              {s.ok ? "Done" : "Blocked"}
            </span>
            {" · "}
            <span className="font-mono font-medium text-slate-100">{s.tool}</span>
            {s.writes && (
              <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">
                writes data
              </span>
            )}
          </summary>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-slate-400">
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
