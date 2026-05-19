import React, { useEffect, useRef, useState } from "react";
import { STREAM_URL, fmtUsd } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { MessageSquare, Send, X, Sparkles, Zap } from "lucide-react";

const SYSTEM_PROMPT = `You are the Right LLM Assistant — an expert on the Right LLM enterprise gateway platform. You help engineers and AI leads understand the product.

Right LLM is an intelligent middleware between enterprise apps and LLM providers (OpenAI, Anthropic, Gemini, Groq, Ollama, Bedrock, Azure). It cuts LLM cost 30–60% without quality loss via:
• Semantic Cache (L1 exact + L2 cosine similarity, default threshold 0.92)
• Routing Engine (classifies task complexity, picks cheapest model that meets quality SLA)
• Prompt Optimization (whitespace/filler compression, context pruning, ~20-40% token reduction)
• Budget Governance (org/team/user budgets, soft+hard limits, RBAC like "interns cannot use GPT-4o")
• Decision Engine (orchestrates cache→optimize→policy→route→call→log)
• Continuous Learning (updates routing weights from outcomes)
• Autonomous Action Engine (auto-failover, auto-downgrade on budget burn, auto-activate cache on clusters)

Drop-in OpenAI-compatible endpoint: POST /api/gateway/chat and POST /api/gateway/stream.
The dashboard has 12 pages: Overview, Routing Intelligence, Semantic Cache, Budget Governance, Forecasting, Recommendations, Provider Analytics, Autonomous Actions, Optimization Log, TIPE Analyzer, Advisor Tools, Playground.

Multi-tenant: workspace switcher in sidebar (CloudScore / MutexCorp / ExcelHire).
Be concise (3-6 sentences). Use bullet points when helpful. Never make up features.`;

export default function Chatbot() {
  const { orgId } = useOrg();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi — I'm the Right LLM Assistant. Ask me about routing, semantic cache, budgets, or how to integrate the gateway.", model: "system" },
  ]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [meta, setMeta] = useState(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamText, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setStreamText("");
    setMeta(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...next.filter(m => m.role !== "assistant" || m.model !== "system").map(({ role, content }) => ({ role, content })),
          ],
          use_cache: true,
          org_id: orgId,
        }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let m = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n"); buf = events.pop() || "";
        for (const e of events) {
          const ev = /event: (\w+)/.exec(e)?.[1];
          const data = /data: (.+)/.exec(e)?.[1];
          if (!ev || !data) continue;
          try {
            const parsed = JSON.parse(data);
            if (ev === "meta") { m = parsed; setMeta(parsed); }
            else if (ev === "token") { acc += parsed.text; setStreamText(acc); }
          } catch {}
        }
      }
      setMessages(prev => [...prev, {
        role: "assistant", content: acc,
        model: m?.cache_hit ? `cache (${m.cache_layer})` : `${m?.provider}/${m?.model}`,
        cost: m?.cost_usd, latency: m?.latency_ms,
      }]);
    } catch (e) {
      if (e.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e.message}`, model: "error" }]);
      }
    } finally {
      setStreaming(false);
      setStreamText("");
      setMeta(null);
      abortRef.current = null;
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!open) {
    return (
      <button
        data-testid="chatbot-launcher"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-6 z-50 group flex items-center gap-2 pl-3 pr-4 h-12 rounded-full bg-white text-zinc-900 shadow-[0_8px_32px_rgba(59,130,246,0.25)] hover:shadow-[0_8px_40px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 transition-all duration-200"
      >
        <div className="relative">
          <Sparkles className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <span className="text-sm font-medium">Ask Right LLM</span>
      </button>
    );
  }

  return (
    <div
      data-testid="chatbot-panel"
      className="fixed bottom-20 right-6 z-50 w-[420px] h-[600px] flex flex-col rounded-md border border-zinc-800 bg-zinc-950 shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-fade-up"
    >
      {/* Header */}
      <div className="px-4 h-12 flex items-center justify-between border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
          </div>
          <div>
            <div className="text-sm font-medium leading-none">Right LLM Assistant</div>
            <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
              <span className="status-dot animate-pulse" style={{ color: "#22C55E", background: "#22C55E" }} />
              Powered by our own gateway
            </div>
          </div>
        </div>
        <button
          data-testid="chatbot-close"
          onClick={() => setOpen(false)}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-zinc-900 text-zinc-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-md whitespace-pre-wrap leading-relaxed ${
              m.role === "user"
                ? "bg-white text-zinc-900"
                : m.model === "error"
                ? "bg-red-950/40 border border-red-900 text-red-200"
                : "bg-zinc-900 border border-zinc-800 text-zinc-100"
            }`}>{m.content}</div>
            {m.role === "assistant" && m.model && m.model !== "system" && m.model !== "error" && (
              <div className="text-[10px] mono text-zinc-600 px-1 flex items-center gap-2">
                <Zap className="w-3 h-3" />
                <span>{m.model}</span>
                {m.cost !== undefined && <span>· {fmtUsd(m.cost)}</span>}
                {m.latency !== undefined && <span>· {m.latency}ms</span>}
              </div>
            )}
          </div>
        ))}
        {streaming && (
          <div className="flex flex-col gap-1 items-start" data-testid="chatbot-streaming">
            <div className="max-w-[85%] px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-100 whitespace-pre-wrap leading-relaxed">
              {streamText || <span className="text-zinc-500">thinking…</span>}
              <span className="cursor-blink">▋</span>
            </div>
            {meta && (
              <div className="text-[10px] mono text-zinc-600 px-1 flex items-center gap-2">
                <Zap className="w-3 h-3" />
                <span>{meta.cache_hit ? `cache (${meta.cache_layer})` : `${meta.provider}/${meta.model}`}</span>
              </div>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            data-testid="chatbot-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask anything about Right LLM…"
            rows={1}
            className="flex-1 resize-none bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 max-h-[100px]"
          />
          <button
            data-testid="chatbot-send"
            onClick={send}
            disabled={!input.trim() || streaming}
            className="w-9 h-9 flex items-center justify-center rounded-md bg-white text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-200 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-[10px] text-zinc-600 mt-2 flex items-center justify-between">
          <span>Streams via /api/gateway/stream · routed by our own engine</span>
          <button onClick={() => setMessages(messages.slice(0, 1))} className="hover:text-zinc-400">Clear</button>
        </div>
      </div>
    </div>
  );
}
