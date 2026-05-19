import React, { useRef, useState } from "react";
import PageHeader from "../components/PageHeader";
import { STREAM_URL, fmtUsd } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Play, Zap, Database, Square } from "lucide-react";
import { toast } from "sonner";

export default function Playground() {
  const { orgId } = useOrg();
  const [prompt, setPrompt] = useState(
    "Summarize this customer support email and propose a polite reply.\n\nDear team, I have been waiting for my refund for 12 days and have not received any update..."
  );
  const [useCache, setUseCache] = useState(true);
  const [threshold, setThreshold] = useState([0.92]);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [costMeter, setCostMeter] = useState(0);
  const abortRef = useRef(null);

  const send = async () => {
    setBusy(true);
    setMeta(null);
    setResponseText("");
    setCostMeter(0);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          use_cache: useCache,
          similarity_threshold: threshold[0],
          org_id: orgId,
        }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalCost = 0;
      let totalChars = 0;

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
          let parsed; try { parsed = JSON.parse(data); } catch { continue; }
          if (ev === "meta") {
            setMeta(parsed);
            totalCost = parsed.cost_usd || 0;
            if (parsed.cache_hit) toast.success(`Cache HIT (${parsed.cache_layer}) · $0 cost`);
            else if (parsed.status === "error") toast.error(parsed.error || "LLM error");
            else toast.success(`Routed → ${parsed.provider}/${parsed.model}`);
          } else if (ev === "token") {
            setResponseText(prev => prev + parsed.text);
            totalChars += parsed.text.length;
            // amortize cost over the streamed response
            const expected = (meta?.response?.length || totalChars) || 1;
            setCostMeter(totalCost * (totalChars / Math.max(totalChars, expected)));
          } else if (ev === "done") {
            setCostMeter(totalCost);
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") toast.error(e.message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => { abortRef.current?.abort(); };

  return (
    <div data-testid="page-playground">
      <PageHeader
        title="Playground"
        subtitle="Drop-in OpenAI-compatible /gateway/stream endpoint. Real-time streaming with live decision, optimization & cost meter."
        testId="pg-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Request</div>
          <Textarea
            data-testid="pg-prompt"
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            className="bg-zinc-900 border-zinc-800 min-h-[220px] mono text-sm"
          />
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2"><Database className="w-3.5 h-3.5" /> Use semantic cache</label>
              <Switch data-testid="pg-cache-switch" checked={useCache} onCheckedChange={setUseCache} />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span>Similarity threshold</span>
                <span className="mono text-blue-400">{threshold[0].toFixed(2)}</span>
              </div>
              <Slider data-testid="pg-threshold" value={threshold} onValueChange={setThreshold} min={0.7} max={0.99} step={0.01} className="mt-2" />
            </div>
            {busy ? (
              <Button data-testid="pg-stop" onClick={stop} variant="outline" className="w-full border-red-900 text-red-400 hover:bg-red-950">
                <Square className="w-3.5 h-3.5 mr-2" /> Stop streaming
              </Button>
            ) : (
              <Button data-testid="pg-send" onClick={send} className="w-full bg-white text-zinc-900 hover:bg-zinc-200">
                <Play className="w-3.5 h-3.5 mr-2" />Stream via Right LLM Gateway
              </Button>
            )}
          </div>
        </div>

        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950" data-testid="pg-result">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Decision & live response</div>
          {!meta && !busy && (
            <div className="text-sm text-zinc-500 py-12 text-center">
              <Zap className="w-6 h-6 mx-auto mb-3 text-zinc-700" />
              Send a request to stream a routing decision, cache trace and live LLM response.
            </div>
          )}

          {(meta || busy) && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Cache</div>
                  <div className={`mono font-bold text-base mt-1 ${meta?.cache_hit ? "text-emerald-400" : "text-zinc-300"}`}>
                    {meta ? (meta.cache_hit ? `HIT (${meta.cache_layer})` : "MISS") : "—"}
                  </div>
                </div>
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Cost (live)</div>
                  <div className="mono font-bold text-base mt-1 text-blue-400">{fmtUsd(costMeter)}</div>
                </div>
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Latency</div>
                  <div className="mono font-bold text-base mt-1">{meta?.latency_ms ?? "…"}{meta ? "ms" : ""}</div>
                </div>
              </div>

              {meta?.decision && (
                <div className="border border-zinc-800 rounded-md p-3" data-testid="pg-decision">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Routing decision</div>
                  <div className="mono text-xs">
                    <div>task: <span className="text-blue-400">{meta.decision.task}</span></div>
                    <div>complexity: <span className="text-blue-400">{meta.decision.complexity}</span></div>
                    <div>→ <span className="text-emerald-400">{meta.decision.provider}/{meta.decision.model}</span></div>
                  </div>
                  <div className="text-xs text-zinc-400 mt-2 leading-relaxed">{meta.decision.reasoning}</div>
                </div>
              )}

              {meta?.optimization && (
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Prompt optimization</div>
                  <div className="mono text-xs">
                    {meta.optimization.before_tokens} → {meta.optimization.after_tokens} tokens
                    {" "}(<span className="text-emerald-400">-{meta.optimization.saved_tokens}</span>,
                    {" "}{(meta.optimization.compression_ratio * 100).toFixed(1)}%)
                  </div>
                </div>
              )}

              <div className="border border-zinc-800 rounded-md p-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">
                  <span>Streaming response</span>
                  {busy && <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="status-dot animate-pulse" style={{ color: "#22C55E", background: "#22C55E" }} /> typing…
                  </span>}
                </div>
                <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[320px] overflow-auto mono">
                  {responseText || (meta?.error && <span className="text-red-400">{meta.error}</span>) || (busy && <span className="text-zinc-500">waiting…</span>)}
                  {busy && responseText && <span className="cursor-blink">▋</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
