import React, { useState } from "react";
import PageHeader from "../components/PageHeader";
import { postTipeAnalyze, fmtUsd } from "../lib/api";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Slider } from "../components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Flame, Play } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { toast } from "sonner";

const TASKS = [
  { id: "rca_summary", label: "RCA Summary" },
  { id: "classification", label: "Classification" },
  { id: "code_generation", label: "Code Generation" },
  { id: "extraction", label: "Extraction" },
  { id: "qa", label: "Q & A" },
  { id: "summarization", label: "Summarization" },
];

const BASELINES = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini · $0.15/$0.60 per M" },
  { id: "gpt-4o", label: "GPT-4o · $2.50/$10.00 per M" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 · $1.00/$5.00 per M" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 · $3.00/$15.00 per M" },
  { id: "claude-opus-4-5-20251101", label: "Claude Opus 4.5 · $15.00/$75.00 per M" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash · $0.075/$0.30 per M" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro · $1.25/$5.00 per M" },
];

const TT = { contentStyle: { background: "#09090B", border: "1px solid #27272A", borderRadius: 6, fontSize: 12 } };

export default function TipeAnalyzer() {
  const [task, setTask] = useState("rca_summary");
  const [baseline, setBaseline] = useState("gpt-4o-mini");
  const [volume, setVolume] = useState([2400]);
  const [prompt, setPrompt] = useState(
    "Write a 5-line root-cause summary for a BigQuery slot exhaustion incident affecting the prod-data-platform ETL pipeline."
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const inputTokenEst = Math.max(1, Math.floor(prompt.length / 4));

  const run = async () => {
    setBusy(true);
    try {
      const r = await postTipeAnalyze({
        prompt, task_type: task, baseline_model: baseline, monthly_volume: volume[0],
      });
      setResult(r);
      toast.success(`Recommendation: ${r.recommended.provider}/${r.recommended.model}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="page-tipe">
      <PageHeader
        title="TIPE Analyzer"
        subtitle="Token-Impact & Price Estimator — paste a prompt, predict output tokens and total cost across the full provider catalog."
        right={<div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800 text-xs text-zinc-400"><Flame className="w-3.5 h-3.5 text-orange-400" /> 15 models</div>}
        testId="tipe-header"
      />

      <div className="border border-zinc-800 rounded-md p-6 bg-zinc-950 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Workload profile</div>
            <div className="font-heading text-xl font-semibold mt-1">Paste prompt → predicted tokens & total cost</div>
          </div>
          <div className="flex gap-1 flex-wrap" data-testid="tipe-task-tabs">
            {TASKS.map(t => (
              <button
                key={t.id}
                data-testid={`tipe-task-${t.id}`}
                onClick={() => setTask(t.id)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors duration-200 ${
                  task === t.id ? "bg-white text-zinc-900 border-white" : "border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          data-testid="tipe-prompt"
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          className="bg-zinc-900 border-zinc-800 min-h-[160px] mono text-sm"
        />
        <div className="flex items-center justify-between text-xs text-zinc-500 mt-2">
          <span>{prompt.length} chars · ≈{inputTokenEst} input tokens</span>
          <button onClick={() => setPrompt("")} className="hover:text-zinc-300">Clear</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Baseline model</div>
            <Select value={baseline} onValueChange={setBaseline}>
              <SelectTrigger data-testid="tipe-baseline" className="bg-zinc-900 border-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800">
                {BASELINES.map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">
              <span>Monthly volume</span>
              <span className="mono text-blue-400">{volume[0].toLocaleString()} / mo</span>
            </div>
            <Slider data-testid="tipe-volume" value={volume} onValueChange={setVolume} min={100} max={500000} step={100} />
          </div>
          <div className="flex items-end">
            <Button data-testid="tipe-run" onClick={run} disabled={busy || !prompt.trim()} className="w-full bg-white text-zinc-900 hover:bg-zinc-200">
              <Play className="w-3.5 h-3.5 mr-2" /> {busy ? "Analyzing…" : "Run TIPE Analysis"}
            </Button>
          </div>
        </div>
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="tipe-result">
          <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Cost summary · {result.monthly_volume.toLocaleString()} runs / month</div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Baseline / mo</div>
                <div className="font-heading text-2xl font-bold mono mt-2">{fmtUsd(result.baseline.monthly_cost)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Recommended / mo</div>
                <div className="font-heading text-2xl font-bold mono mt-2 text-blue-400">{fmtUsd(result.recommended.monthly_cost)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Savings / mo</div>
                <div className="font-heading text-2xl font-bold mono mt-2 text-emerald-400">{fmtUsd(result.monthly_savings)}</div>
                <div className="text-xs text-emerald-400 mt-0.5">{((result.savings_pct || 0) * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-400 leading-relaxed">
              <span className="font-medium text-zinc-200">{TASKS.find(t => t.id === result.task_type)?.label || result.task_type}</span> task ·
              baseline <span className="mono text-blue-400">{result.baseline.model}</span> →
              recommended <span className="mono text-emerald-400">{result.recommended.model}</span>.
              Predicted output: <span className="mono">{result.predicted_output_tokens}</span> tokens / call.
            </div>
          </div>

          <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Total cost per call</div>
            <div className="font-heading text-xl font-semibold mt-1 mb-4">Sorted cheapest → most expensive</div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={result.rows} layout="vertical">
                <CartesianGrid stroke="#27272A" horizontal={false} />
                <XAxis type="number" stroke="#71717A" fontSize={10} tickFormatter={(v) => `$${v.toFixed(4)}`} />
                <YAxis type="category" dataKey="model" stroke="#A1A1AA" fontSize={9} width={170} />
                <Tooltip {...TT} formatter={(v) => `$${Number(v).toFixed(6)}`} />
                <Bar dataKey="cost_per_call" radius={[0, 2, 2, 0]}>
                  {result.rows.map((r, i) => (
                    <Cell key={i} fill={r.model === result.recommended.model ? "#22C55E" : r.configurable ? "#52525B" : "#FAFAFA"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-2 border border-zinc-800 rounded-md bg-zinc-950">
            <div className="px-5 py-4 border-b border-zinc-800">
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">All models</div>
              <div className="font-heading text-lg font-semibold mt-0.5">Per-model cost · quality · latency</div>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                <tr>
                  <th className="text-left px-5 py-3">Provider</th>
                  <th className="text-left px-5 py-3">Model</th>
                  <th className="text-left px-5 py-3">Tier</th>
                  <th className="text-right px-5 py-3">Per call</th>
                  <th className="text-right px-5 py-3">Monthly</th>
                  <th className="text-right px-5 py-3">Quality</th>
                  <th className="text-right px-5 py-3">P95 ms</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map(r => (
                  <tr key={r.model} className={`border-b border-zinc-900 hover:bg-zinc-900/50 ${r.model === result.recommended.model ? "bg-emerald-950/20" : ""}`}>
                    <td className="px-5 py-2.5 text-xs">{r.provider}{r.configurable && <span className="ml-2 text-[10px] uppercase text-zinc-500">configurable</span>}</td>
                    <td className="px-5 py-2.5 mono text-xs">{r.model}</td>
                    <td className="px-5 py-2.5 text-xs">{r.tier}</td>
                    <td className="px-5 py-2.5 text-right mono text-xs">${r.cost_per_call.toFixed(6)}</td>
                    <td className="px-5 py-2.5 text-right mono text-xs">{fmtUsd(r.monthly_cost)}</td>
                    <td className="px-5 py-2.5 text-right mono text-xs text-emerald-400">{(r.quality * 100).toFixed(0)}</td>
                    <td className="px-5 py-2.5 text-right mono text-xs">{r.p95_latency_ms}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
