import React, { useState } from "react";
import PageHeader from "../components/PageHeader";
import { postGatewayChat, fmtUsd } from "../lib/api";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Play, Zap, Database } from "lucide-react";
import { toast } from "sonner";

export default function Playground() {
  const [prompt, setPrompt] = useState("Summarize this customer support email and propose a polite reply.\n\nDear team, I have been waiting for my refund for 12 days...");
  const [useCache, setUseCache] = useState(true);
  const [threshold, setThreshold] = useState([0.92]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    setBusy(true);
    try {
      const r = await postGatewayChat({
        messages: [{ role: "user", content: prompt }],
        use_cache: useCache,
        similarity_threshold: threshold[0],
      });
      setResult(r);
      if (r.cache_hit) toast.success(`Cache hit (${r.cache_layer}) — $0 cost`);
      else if (r.status === "error") toast.error(r.error || "LLM call failed");
      else toast.success(`Routed to ${r.provider}/${r.model}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="page-playground">
      <PageHeader title="Playground" subtitle="Drop-in OpenAI-compatible /gateway/chat endpoint. Watch routing, cache and optimization in action." testId="pg-header" />

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
            <Button data-testid="pg-send" disabled={busy} onClick={send} className="w-full bg-white text-zinc-900 hover:bg-zinc-200">
              {busy ? "Routing…" : <><Play className="w-3.5 h-3.5 mr-2" />Send via Right LLM Gateway</>}
            </Button>
          </div>
        </div>

        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950" data-testid="pg-result">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Decision & response</div>
          {!result && (
            <div className="text-sm text-zinc-500 py-12 text-center">
              <Zap className="w-6 h-6 mx-auto mb-3 text-zinc-700" />
              Send a request to see routing, cache & optimization decisions.
            </div>
          )}
          {result && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Cache</div>
                  <div className={`mono font-bold text-base mt-1 ${result.cache_hit ? "text-emerald-400" : "text-zinc-300"}`}>
                    {result.cache_hit ? `HIT (${result.cache_layer})` : "MISS"}
                  </div>
                </div>
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Cost</div>
                  <div className="mono font-bold text-base mt-1">{fmtUsd(result.cost_usd || 0)}</div>
                </div>
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Latency</div>
                  <div className="mono font-bold text-base mt-1">{result.latency_ms}ms</div>
                </div>
              </div>

              {result.decision && (
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Routing decision</div>
                  <div className="mono text-xs">
                    <div>task: <span className="text-blue-400">{result.decision.task}</span></div>
                    <div>complexity: <span className="text-blue-400">{result.decision.complexity}</span></div>
                    <div>→ <span className="text-emerald-400">{result.decision.provider}/{result.decision.model}</span></div>
                  </div>
                  <div className="text-xs text-zinc-400 mt-2 leading-relaxed">{result.decision.reasoning}</div>
                </div>
              )}

              {result.optimization && (
                <div className="border border-zinc-800 rounded-md p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Prompt optimization</div>
                  <div className="mono text-xs">
                    {result.optimization.before_tokens} → {result.optimization.after_tokens} tokens
                    {" "}(<span className="text-emerald-400">-{result.optimization.saved_tokens}</span>,
                    {" "}{(result.optimization.compression_ratio * 100).toFixed(1)}%)
                  </div>
                </div>
              )}

              <div className="border border-zinc-800 rounded-md p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Response</div>
                <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-auto">
                  {result.response || <span className="text-red-400">{result.error}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
