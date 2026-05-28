import React, { useState } from "react";
import PageHeader from "../components/PageHeader";
import { SectionCard, Pill, EmptyState } from "../components/Card";
import { postTipeAnalyze, fmtUsd } from "../lib/api";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Slider } from "../components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Flame, Play, ArrowRight } from "lucide-react";
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

const TT = {
  contentStyle: {
    background: "rgba(9,9,11,0.95)",
    border: "1px solid #27272A",
    borderRadius: 8,
    fontSize: 11,
    padding: "8px 10px",
  },
  labelStyle: { color: "#A1A1AA", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 },
  itemStyle: { color: "#FAFAFA", padding: 0 },
};

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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="page-tipe">
      <PageHeader
        title="TIPE Analyzer"
        subtitle="Token-Impact & Price Estimator — paste a prompt, predict output tokens and total cost across the full provider catalog."
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="amber"><Flame className="w-3 h-3" />15 models</Pill>
          </div>
        }
        testId="tipe-header"
      />

      <SectionCard
        testId="tipe-workload"
        title="Workload profile"
        subtitle="Paste prompt → predicted tokens & total cost"
        className="mb-6"
      >
        <div className="flex flex-wrap gap-1.5 mb-3" data-testid="tipe-task-tabs">
          {TASKS.map((t) => (
            <button
              key={t.id}
              data-testid={`tipe-task-${t.id}`}
              onClick={() => setTask(t.id)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors duration-200 ${
                task === t.id
                  ? "bg-zinc-50 text-zinc-900 border-zinc-50 font-medium"
                  : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Textarea
          data-testid="tipe-prompt"
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-700 min-h-[160px] mono text-[13px]"
        />
        <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-2 mono">
          <span>{prompt.length} chars · ≈{inputTokenEst} input tokens</span>
          <button onClick={() => setPrompt("")} className="hover:text-zinc-300">Clear</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">Baseline model</div>
            <Select value={baseline} onValueChange={setBaseline}>
              <SelectTrigger data-testid="tipe-baseline" className="bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800">
                {BASELINES.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">
              <span>Monthly volume</span>
              <span className="mono text-blue-400 tabular-nums normal-case tracking-normal">{volume[0].toLocaleString()} / mo</span>
            </div>
            <Slider data-testid="tipe-volume" value={volume} onValueChange={setVolume} min={100} max={500000} step={100} className="mt-3" />
          </div>
          <div className="flex items-end">
            <Button
              data-testid="tipe-run"
              onClick={run}
              disabled={busy || !prompt.trim()}
              className="w-full bg-zinc-50 text-zinc-900 hover:bg-white h-9 font-medium"
            >
              <Play className="w-3.5 h-3.5 mr-2" /> {busy ? "Analyzing…" : "Run TIPE Analysis"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {!result ? (
        <EmptyState
          title="No analysis yet"
          description="Click 'Run TIPE Analysis' to compare cost across all providers for your workload."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="tipe-result">
          <SectionCard
            title="Cost summary"
            subtitle={`${result.monthly_volume.toLocaleString()} runs / month`}
          >
            <div className="grid grid-cols-3 gap-4 mt-1">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Baseline / mo</div>
                <div className="font-heading text-xl font-bold mono tabular-nums mt-1.5">{fmtUsd(result.baseline.monthly_cost)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Recommended</div>
                <div className="font-heading text-xl font-bold mono tabular-nums mt-1.5 text-blue-400">{fmtUsd(result.recommended.monthly_cost)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Savings</div>
                <div className="font-heading text-xl font-bold mono tabular-nums mt-1.5 text-emerald-400">{fmtUsd(result.monthly_savings)}</div>
                <div className="text-xs text-emerald-400 mt-0.5">{((result.savings_pct || 0) * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800/80 text-[12px] text-zinc-400 leading-relaxed">
              <Pill color="zinc">{TASKS.find((t) => t.id === result.task_type)?.label || result.task_type}</Pill>
              <span className="ml-2">baseline </span>
              <span className="mono text-blue-300">{result.baseline.model}</span>
              <ArrowRight className="inline w-3 h-3 mx-1 text-zinc-600" />
              <span className="mono text-emerald-300">{result.recommended.model}</span>
              <span className="block mt-1.5">Predicted output: <span className="mono text-zinc-200">{result.predicted_output_tokens}</span> tokens / call.</span>
            </div>
          </SectionCard>

          <SectionCard
            title="Cost per call"
            subtitle="Sorted cheapest → most expensive"
          >
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={result.rows} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1F1F23" horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(4)}`} />
                <YAxis type="category" dataKey="model" stroke="#A1A1AA" fontSize={9} width={170} tickLine={false} axisLine={false} />
                <Tooltip {...TT} formatter={(v) => `$${Number(v).toFixed(6)}`} />
                <Bar dataKey="cost_per_call" radius={[0, 4, 4, 0]} barSize={11}>
                  {result.rows.map((r, i) => (
                    <Cell key={i} fill={r.model === result.recommended.model ? "#22C55E" : r.configurable ? "#52525B" : "#A1A1AA"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard
            className="lg:col-span-2"
            title="All models"
            subtitle="Per-model cost · quality · latency"
            padding="p-0"
          >
            <div className="overflow-auto border-t border-zinc-800/80">
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
                  {result.rows.map((r) => (
                    <tr key={r.model} className={`border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors ${r.model === result.recommended.model ? "bg-emerald-500/5" : ""}`}>
                      <td className="px-5 py-2.5 text-[12px] capitalize">
                        {r.provider}
                        {r.configurable && <span className="ml-2 text-[9px] uppercase tracking-wider text-amber-400">configurable</span>}
                      </td>
                      <td className="px-5 py-2.5 mono text-[11px] text-zinc-200">{r.model}</td>
                      <td className="px-5 py-2.5 text-[11px] text-zinc-400">{r.tier}</td>
                      <td className="px-5 py-2.5 text-right mono text-[11px] tabular-nums">${r.cost_per_call.toFixed(6)}</td>
                      <td className="px-5 py-2.5 text-right mono text-[11px] tabular-nums">{fmtUsd(r.monthly_cost)}</td>
                      <td className="px-5 py-2.5 text-right mono text-[11px] text-emerald-400 tabular-nums">{(r.quality * 100).toFixed(0)}</td>
                      <td className="px-5 py-2.5 text-right mono text-[11px] tabular-nums">{r.p95_latency_ms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
