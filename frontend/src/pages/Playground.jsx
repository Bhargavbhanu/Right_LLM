import React, { useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import { STREAM_URL, fmtUsd, getProviders } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { SectionCard, Pill, EmptyState } from "../components/Card";
import {
  Play, Zap, Database, Square, Sparkles, Cpu, Clock, DollarSign,
  ArrowRight, Layers, FileText, BadgeAlert,
} from "lucide-react";
import { toast } from "sonner";

// Curated prompt presets — quick way to see the gateway in action
const PRESETS = [
  {
    label: "Support reply",
    icon: FileText,
    text:
      "Summarize this customer support email and propose a polite reply.\n\nDear team, I have been waiting for my refund for 12 days and have not received any update. The order number is #41892 and I paid via credit card on May 4. Please respond ASAP.",
  },
  {
    label: "Classify intent",
    icon: Layers,
    text:
      "Classify the following user message into one of: billing, technical, sales, account, other. Respond with just the label.\n\n\"My password reset link expired before I could click it and now I'm locked out.\"",
  },
  {
    label: "Code review",
    icon: Cpu,
    text:
      "Review this Python function for bugs and suggest a fix:\n\ndef divide(a, b):\n    return a / b\n\nIt sometimes throws ZeroDivisionError in production.",
  },
  {
    label: "TL;DR research",
    icon: Sparkles,
    text:
      "Give me a 3-bullet TL;DR of the following research abstract:\n\nWe introduce mixture-of-experts routing at the gateway layer, achieving 47% cost reduction while maintaining task accuracy within 1.2% of the GPT-4o baseline across 12 enterprise workloads…",
  },
];

// Provider colors for the model badge
const PROVIDER_COLORS = {
  openai: "emerald",
  anthropic: "violet",
  gemini: "blue",
  groq: "amber",
  ollama: "zinc",
  bedrock: "amber",
  azure: "blue",
};

// Configurable providers (no live key in MVP) — flagged as demo mode in UI
const DEMO_PROVIDERS = new Set(["groq", "ollama", "bedrock", "azure"]);

function StatTile({ label, value, accent, icon, testId }) {
  return (
    <div className="surface rounded-md px-3 py-2.5 flex-1 min-w-0" data-testid={testId}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mono font-bold text-[15px] leading-tight tabular-nums ${accent || "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}

export default function Playground() {
  const { orgId } = useOrg();
  const [prompt, setPrompt] = useState(PRESETS[0].text);
  const [useCache, setUseCache] = useState(true);
  const [threshold, setThreshold] = useState([0.92]);
  const [forcedModel, setForcedModel] = useState("auto");
  const [models, setModels] = useState([]);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [costMeter, setCostMeter] = useState(0);
  const [history, setHistory] = useState([]); // last 5 runs in this session
  const abortRef = useRef(null);

  useEffect(() => {
    getProviders().then((d) => setModels(d?.models || [])).catch(() => {});
  }, []);

  const send = async () => {
    setBusy(true);
    setMeta(null);
    setResponseText("");
    setCostMeter(0);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const startedAt = Date.now();

    try {
      const res = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          use_cache: useCache,
          similarity_threshold: threshold[0],
          org_id: orgId,
          ...(forcedModel !== "auto" ? { model: forcedModel } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalCost = 0;
      let totalChars = 0;
      let finalText = "";
      let finalMeta = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const e of events) {
          if (!e.trim()) continue;
          const ev = /event: (\w+)/.exec(e)?.[1];
          const data = /data: (.+)/.exec(e)?.[1];
          if (!ev || !data) continue;
          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }
          if (ev === "meta") {
            finalMeta = parsed;
            setMeta(parsed);
            totalCost = parsed.cost_usd || 0;
            if (parsed.cache_hit) toast.success(`Cache HIT (${parsed.cache_layer}) · $0 cost`);
            else if (parsed.status === "error") toast.error(parsed.error || "LLM error");
            else toast.success(`Routed → ${parsed.provider}/${parsed.model}`);
          } else if (ev === "token") {
            finalText += parsed.text;
            setResponseText((prev) => prev + parsed.text);
            totalChars += parsed.text.length;
            const expected = totalChars || 1;
            setCostMeter(totalCost * (totalChars / Math.max(totalChars, expected)));
          } else if (ev === "done") {
            setCostMeter(totalCost);
          }
        }
      }
      if (finalMeta) {
        setHistory((h) => [
          {
            id: finalMeta.id || `${startedAt}`,
            provider: finalMeta.provider,
            model: finalMeta.model,
            cache_hit: finalMeta.cache_hit,
            cost_usd: finalMeta.cost_usd,
            latency_ms: finalMeta.latency_ms,
            prompt_preview: prompt.slice(0, 60),
          },
          ...h,
        ].slice(0, 5));
      }
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => { abortRef.current?.abort(); };

  const isDemoForced = forcedModel !== "auto" &&
    DEMO_PROVIDERS.has(models.find((m) => m.model === forcedModel)?.provider || "");

  const providerColor = meta?.provider ? PROVIDER_COLORS[meta.provider] || "zinc" : "zinc";

  // Sort models: live first, demo after; keep providers grouped
  const sortedModels = useMemo(() => {
    return [...models].sort((a, b) => {
      const da = DEMO_PROVIDERS.has(a.provider) ? 1 : 0;
      const db = DEMO_PROVIDERS.has(b.provider) ? 1 : 0;
      if (da !== db) return da - db;
      return (a.provider + a.model).localeCompare(b.provider + b.model);
    });
  }, [models]);

  return (
    <div data-testid="page-playground">
      <PageHeader
        title="Playground"
        subtitle="Drop-in OpenAI-compatible /gateway/stream endpoint. Real-time streaming with live routing, cache trace and cost meter."
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="emerald"><span className="status-dot" style={{ color: "#22C55E", background: "#22C55E" }} />SSE live</Pill>
            <Pill color="zinc"><Cpu className="w-3 h-3" />{models.length} models</Pill>
          </div>
        }
        testId="pg-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── REQUEST PANEL ─────────────────────────────────────────── */}
        <SectionCard
          testId="pg-request-card"
          className="lg:col-span-2"
          title="Request"
          subtitle="Compose a prompt — the gateway optimizes, routes and caches it."
          right={<Pill color="blue"><Zap className="w-3 h-3" />POST /gateway/stream</Pill>}
        >
          {/* Preset chips */}
          <div className="flex flex-wrap gap-1.5 mb-3" data-testid="pg-presets">
            {PRESETS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.label}
                  data-testid={`pg-preset-${p.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setPrompt(p.text)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-md border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700 transition-colors"
                >
                  <Icon className="w-3 h-3" />
                  {p.label}
                </button>
              );
            })}
          </div>

          <Textarea
            data-testid="pg-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-700 min-h-[220px] mono text-[13px] leading-relaxed"
            placeholder="Type a prompt — try summarization, classification, code…"
          />

          {/* Controls row */}
          <div className="mt-4 space-y-4">
            {/* Model picker */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-zinc-300 inline-flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-500" /> Force model
                </span>
                <span className="text-[10px] text-zinc-500">leave on Auto for smart routing</span>
              </div>
              <Select value={forcedModel} onValueChange={setForcedModel}>
                <SelectTrigger
                  data-testid="pg-model-select"
                  className="bg-zinc-950 border-zinc-800 text-xs h-9 hover:border-zinc-700"
                >
                  <SelectValue placeholder="Auto (smart routing)" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 max-h-72">
                  <SelectItem value="auto" data-testid="pg-model-auto">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      Auto — let the router decide
                    </span>
                  </SelectItem>
                  {sortedModels.map((m) => (
                    <SelectItem key={m.model} value={m.model} data-testid={`pg-model-${m.model}`}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span className="mono text-xs">{m.provider}/{m.model}</span>
                        {DEMO_PROVIDERS.has(m.provider) && (
                          <span className="text-[9px] uppercase tracking-wider text-amber-400">demo</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isDemoForced && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-300/90 bg-amber-500/5 border border-amber-500/15 rounded-md px-2.5 py-1.5">
                  <BadgeAlert className="w-3 h-3 mt-[1px] shrink-0" />
                  <span>Demo mode — this provider needs an API key in <span className="mono">backend/.env</span>. It still appears in routing & advisor based on public pricing.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 inline-flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-zinc-500" /> Semantic cache
              </span>
              <Switch data-testid="pg-cache-switch" checked={useCache} onCheckedChange={setUseCache} />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-zinc-300">Similarity threshold</span>
                <span className="mono text-blue-400 tabular-nums">{threshold[0].toFixed(2)}</span>
              </div>
              <Slider
                data-testid="pg-threshold"
                value={threshold} onValueChange={setThreshold}
                min={0.7} max={0.99} step={0.01}
              />
              <div className="flex items-center justify-between text-[10px] text-zinc-600 mt-1 mono">
                <span>0.70 · loose</span>
                <span>0.99 · strict</span>
              </div>
            </div>

            {busy ? (
              <Button
                data-testid="pg-stop"
                onClick={stop}
                variant="outline"
                className="w-full border-rose-900 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 h-10"
              >
                <Square className="w-3.5 h-3.5 mr-2" /> Stop streaming
              </Button>
            ) : (
              <Button
                data-testid="pg-send"
                onClick={send}
                disabled={!prompt.trim() || busy}
                className="btn-shine w-full bg-zinc-50 text-zinc-900 hover:bg-white h-10 font-medium"
              >
                {busy ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 mr-2 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin" />
                    Streaming…
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-2" />
                    Stream via Right LLM Gateway
                  </>
                )}
              </Button>
            )}
          </div>
        </SectionCard>

        {/* ── RESPONSE PANEL ────────────────────────────────────────── */}
        <SectionCard
          testId="pg-result"
          className="lg:col-span-3"
          title="Decision & live response"
          subtitle="Routing reasoning, optimization stats and streamed LLM output."
          right={
            meta?.provider && meta?.model ? (
              <Pill color={providerColor}>
                <ArrowRight className="w-3 h-3" />
                {meta.provider}/{meta.model}
              </Pill>
            ) : null
          }
        >
          {!meta && !busy ? (
            <EmptyState
              icon={<Zap className="w-5 h-5" />}
              title="No request yet"
              description="Click Stream to send a request — you'll see the routing decision, prompt compression and live response here."
              testId="pg-empty"
            />
          ) : (
            <div className="space-y-4">
              {/* Stat strip */}
              <div className="flex flex-wrap gap-2">
                <StatTile
                  testId="pg-stat-cache"
                  label="Cache"
                  icon={<Database className="w-3 h-3" />}
                  value={meta ? (meta.cache_hit ? `HIT (${meta.cache_layer})` : "MISS") : "—"}
                  accent={meta?.cache_hit ? "text-emerald-400" : "text-zinc-300"}
                />
                <StatTile
                  testId="pg-stat-cost"
                  label="Cost (live)"
                  icon={<DollarSign className="w-3 h-3" />}
                  value={fmtUsd(costMeter)}
                  accent="text-blue-400"
                />
                <StatTile
                  testId="pg-stat-latency"
                  label="Latency"
                  icon={<Clock className="w-3 h-3" />}
                  value={meta?.latency_ms != null ? `${meta.latency_ms} ms` : (busy ? "…" : "—")}
                />
                <StatTile
                  testId="pg-stat-savings"
                  label="Savings"
                  icon={<Sparkles className="w-3 h-3" />}
                  value={fmtUsd(meta?.savings_usd || 0)}
                  accent="text-emerald-400"
                />
              </div>

              {/* Routing decision */}
              {meta?.decision && (
                <div className="surface rounded-md p-3.5" data-testid="pg-decision">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-medium">Routing decision</div>
                    {meta.decision.downgraded_due_to_budget && (
                      <Pill color="amber"><BadgeAlert className="w-3 h-3" />budget downgrade</Pill>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-md border border-zinc-800 text-zinc-300 mono">
                      task: <span className="text-blue-400">{meta.decision.task}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md border border-zinc-800 text-zinc-300 mono">
                      complexity: <span className="text-blue-400">{meta.decision.complexity}</span>
                    </span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className="px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 text-emerald-300 mono">
                      {meta.decision.provider}/{meta.decision.model}
                    </span>
                  </div>
                  <p className="text-[12px] text-zinc-400 mt-2.5 leading-relaxed">{meta.decision.reasoning}</p>
                </div>
              )}

              {/* Optimization */}
              {meta?.optimization && meta.optimization.saved_tokens > 0 && (
                <div className="surface rounded-md p-3.5" data-testid="pg-optimization">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-medium">Prompt optimization</div>
                    <Pill color="emerald">
                      −{meta.optimization.saved_tokens} tokens · {(meta.optimization.compression_ratio * 100).toFixed(1)}%
                    </Pill>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="mono">
                      <span className="text-zinc-500">before </span>
                      <span className="text-zinc-200">{meta.optimization.before_tokens} tok</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <div className="mono">
                      <span className="text-zinc-500">after </span>
                      <span className="text-emerald-300">{meta.optimization.after_tokens} tok</span>
                    </div>
                  </div>
                  {/* Compression bar */}
                  <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-zinc-900">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-blue-500"
                      style={{ width: `${Math.max(4, (1 - meta.optimization.compression_ratio) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Streaming response */}
              <div className="surface rounded-md p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-medium">Response</div>
                  {busy ? (
                    <Pill color="emerald">
                      <span className="status-dot animate-pulse" style={{ color: "#22C55E", background: "#22C55E" }} />
                      streaming…
                    </Pill>
                  ) : meta && !meta.cache_hit && responseText ? (
                    <Pill color="zinc">complete · {responseText.length} chars</Pill>
                  ) : meta?.cache_hit ? (
                    <Pill color="emerald">served from cache</Pill>
                  ) : null}
                </div>
                <div
                  data-testid="pg-response"
                  className="text-[13px] text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[360px] overflow-auto mono"
                >
                  {responseText ||
                    (meta?.error && <span className="text-rose-400">{meta.error}</span>) ||
                    (busy && <span className="text-zinc-500">waiting for first token…</span>)}
                  {busy && responseText && <span className="cursor-blink">▋</span>}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── SESSION HISTORY ─────────────────────────────────────────── */}
      {history.length > 0 && (
        <SectionCard
          className="mt-6"
          testId="pg-history"
          title="Session history"
          subtitle={`Last ${history.length} run${history.length > 1 ? "s" : ""} in this tab`}
        >
          <ul className="divide-y divide-zinc-900">
            {history.map((h) => (
              <li key={h.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                <Pill color={h.cache_hit ? "emerald" : PROVIDER_COLORS[h.provider] || "zinc"}>
                  {h.cache_hit ? "cache" : `${h.provider}`}
                </Pill>
                <span className="mono text-xs text-zinc-300 truncate flex-1 min-w-0">
                  {h.prompt_preview}
                  {h.prompt_preview.length >= 60 ? "…" : ""}
                </span>
                <span className="mono text-[11px] text-zinc-500 hidden sm:inline">{h.model}</span>
                <span className="mono text-[11px] text-zinc-400 tabular-nums w-16 text-right">{fmtUsd(h.cost_usd)}</span>
                <span className="mono text-[11px] text-zinc-500 tabular-nums w-16 text-right">{h.latency_ms}ms</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
