import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { getProviders, postAdvisorMigration, postAdvisorBestModel, fmtUsd } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { ArrowLeftRight, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";

const OBJECTIVES = [
  { id: "balanced", label: "Balanced" },
  { id: "cost", label: "Lowest cost" },
  { id: "quality", label: "Highest quality" },
  { id: "latency", label: "Lowest latency" },
];

const TASKS = [
  { id: "general", label: "General Assistant" },
  { id: "classification", label: "Classification" },
  { id: "summarization", label: "Summarization" },
  { id: "extraction", label: "Extraction" },
  { id: "code_generation", label: "Code Generation" },
  { id: "qa", label: "Q & A" },
  { id: "reasoning", label: "Reasoning / Analysis" },
];

const VERDICT_STYLE = {
  improvement: { color: "text-emerald-400 border-emerald-900", Icon: TrendingDown, label: "Improvement" },
  "trade-off": { color: "text-yellow-400 border-yellow-900", Icon: Minus, label: "Trade-off" },
  regression:  { color: "text-red-400 border-red-900", Icon: TrendingUp, label: "Regression" },
};

export default function AdvisorTools() {
  const [models, setModels] = useState([]);
  useEffect(() => { getProviders().then(p => setModels(p.models || [])).catch(() => {}); }, []);

  // Migration sim state
  const [fromModel, setFromModel] = useState("gpt-4o");
  const [toModel, setToModel] = useState("claude-sonnet-4-5-20250929");
  const [migVolume, setMigVolume] = useState(10000);
  const [migBusy, setMigBusy] = useState(false);
  const [migResult, setMigResult] = useState(null);

  // Advisor state
  const [objective, setObjective] = useState("balanced");
  const [task, setTask] = useState("general");
  const [budget, setBudget] = useState(500);
  const [advBusy, setAdvBusy] = useState(false);
  const [advResult, setAdvResult] = useState(null);

  const runMigration = async () => {
    setMigBusy(true);
    try {
      const r = await postAdvisorMigration({
        from_model: fromModel, to_model: toModel, monthly_volume: migVolume,
      });
      setMigResult(r);
      toast.success(`Verdict: ${r.verdict}`);
    } catch (e) { toast.error(e?.response?.data?.detail || e.message); }
    finally { setMigBusy(false); }
  };

  const runAdvisor = async () => {
    setAdvBusy(true);
    try {
      const r = await postAdvisorBestModel({
        objective, primary_task: task, monthly_budget_usd: Number(budget),
      });
      setAdvResult(r);
      toast.success(`Recommended ${r.recommended.provider}/${r.recommended.model}`);
    } catch (e) { toast.error(e?.response?.data?.detail || e.message); }
    finally { setAdvBusy(false); }
  };

  return (
    <div data-testid="page-advisor">
      <PageHeader
        title="Advisor Tools"
        subtitle="Simulate migrations, compare providers and let the advisor pick the best model for your workload constraints."
        testId="advisor-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Migration Simulation */}
        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950" data-testid="migration-card">
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-4 h-4 text-blue-400" />
            <div className="font-heading text-xl font-semibold">Migration Simulation</div>
          </div>
          <p className="text-sm text-zinc-400 mb-5">Estimate cost, quality and latency impact of switching models</p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">From model</div>
              <Select value={fromModel} onValueChange={setFromModel}>
                <SelectTrigger data-testid="mig-from" className="bg-zinc-900 border-zinc-800">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 max-h-72">
                  {models.map(m => <SelectItem key={m.model} value={m.model}>{m.provider}/{m.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">To model</div>
              <Select value={toModel} onValueChange={setToModel}>
                <SelectTrigger data-testid="mig-to" className="bg-zinc-900 border-zinc-800">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 max-h-72">
                  {models.map(m => <SelectItem key={m.model} value={m.model}>{m.provider}/{m.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Monthly volume</div>
            <Input data-testid="mig-volume" type="number" value={migVolume} onChange={(e) => setMigVolume(Number(e.target.value) || 0)}
              className="bg-zinc-900 border-zinc-800 mono" />
          </div>

          <Button data-testid="mig-run" onClick={runMigration} disabled={migBusy} className="w-full bg-white text-zinc-900 hover:bg-zinc-200">
            {migBusy ? "Simulating…" : "Run Simulation"}
          </Button>

          {migResult && (() => {
            const v = VERDICT_STYLE[migResult.verdict] || VERDICT_STYLE["trade-off"];
            const Icon = v.Icon;
            return (
              <div className="mt-5 pt-5 border-t border-zinc-800 space-y-3" data-testid="mig-result">
                <div className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border ${v.color}`}>
                  <Icon className="w-3 h-3" /> {v.label}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Cost / mo</div>
                    <div className={`font-heading text-xl font-bold mono mt-1 ${migResult.monthly_savings > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {migResult.monthly_savings > 0 ? "-" : "+"}{fmtUsd(Math.abs(migResult.monthly_savings))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Quality Δ</div>
                    <div className={`font-heading text-xl font-bold mono mt-1 ${migResult.quality_delta >= 0 ? "text-emerald-400" : "text-yellow-400"}`}>
                      {migResult.quality_delta >= 0 ? "+" : ""}{(migResult.quality_delta * 100).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Latency Δ</div>
                    <div className={`font-heading text-xl font-bold mono mt-1 ${migResult.latency_delta_ms <= 0 ? "text-emerald-400" : "text-yellow-400"}`}>
                      {migResult.latency_delta_ms > 0 ? "+" : ""}{migResult.latency_delta_ms}ms
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{migResult.summary}</p>
              </div>
            );
          })()}
        </div>

        {/* AI Model Advisor */}
        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950" data-testid="advisor-card">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <div className="font-heading text-xl font-semibold">AI Model Advisor</div>
          </div>
          <p className="text-sm text-zinc-400 mb-5">Recommend the best model for your workload</p>

          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Objective</div>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger data-testid="adv-objective" className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800">
                  {OBJECTIVES.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Primary task</div>
              <Select value={task} onValueChange={setTask}>
                <SelectTrigger data-testid="adv-task" className="bg-zinc-900 border-zinc-800"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800">
                  {TASKS.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Monthly budget (USD)</div>
              <Input data-testid="adv-budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                className="bg-zinc-900 border-zinc-800 mono" />
            </div>
          </div>

          <Button data-testid="adv-run" onClick={runAdvisor} disabled={advBusy} className="w-full mt-5 bg-white text-zinc-900 hover:bg-zinc-200">
            {advBusy ? "Recommending…" : "Run Advisor"}
          </Button>

          {advResult && (
            <div className="mt-5 pt-5 border-t border-zinc-800 space-y-3" data-testid="adv-result">
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Recommended</div>
              <div className="font-heading text-xl font-bold mono text-emerald-400">
                {advResult.recommended.provider}/{advResult.recommended.model}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">$ / call</div>
                  <div className="font-heading text-base mono mt-1">${advResult.recommended.cost_per_call.toFixed(5)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Monthly</div>
                  <div className="font-heading text-base mono mt-1">{fmtUsd(advResult.recommended.monthly_cost)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Quality</div>
                  <div className="font-heading text-base mono mt-1 text-emerald-400">{(advResult.recommended.quality * 100).toFixed(0)}</div>
                </div>
              </div>
              <p className="text-xs text-zinc-400">{advResult.reasoning}</p>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Alternates</div>
                <div className="space-y-1.5">
                  {advResult.alternates.slice(0, 4).map(a => (
                    <div key={a.model} className="flex items-center justify-between text-xs border-b border-zinc-900 py-1.5">
                      <span className="mono text-zinc-300">{a.provider}/{a.model}</span>
                      <span className="mono text-zinc-500">{fmtUsd(a.monthly_cost)}/mo · q{(a.quality * 100).toFixed(0)} · {a.p95_ms}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
