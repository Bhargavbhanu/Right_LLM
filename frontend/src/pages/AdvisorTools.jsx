import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { SectionCard, Pill } from "../components/Card";
import { getProviders, postAdvisorMigration, postAdvisorBestModel, fmtUsd } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { ArrowLeftRight, Sparkles, TrendingUp, TrendingDown, Minus, Play } from "lucide-react";
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
  improvement: { pill: "emerald", Icon: TrendingDown, label: "Improvement" },
  "trade-off": { pill: "amber",   Icon: Minus,        label: "Trade-off" },
  regression:  { pill: "rose",    Icon: TrendingUp,   label: "Regression" },
};

export default function AdvisorTools() {
  const [models, setModels] = useState([]);
  useEffect(() => {
    getProviders().then((p) => setModels(p.models || [])).catch(() => {});
  }, []);

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
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally {
      setMigBusy(false);
    }
  };

  const runAdvisor = async () => {
    setAdvBusy(true);
    try {
      const r = await postAdvisorBestModel({
        objective, primary_task: task, monthly_budget_usd: Number(budget),
      });
      setAdvResult(r);
      toast.success(`Recommended ${r.recommended.provider}/${r.recommended.model}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally {
      setAdvBusy(false);
    }
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
        <SectionCard
          testId="migration-card"
          title={<span className="inline-flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-blue-400" />Migration Simulation</span>}
          subtitle="Estimate cost, quality & latency impact of switching models"
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5 font-medium">From model</div>
              <Select value={fromModel} onValueChange={setFromModel}>
                <SelectTrigger data-testid="mig-from" className="bg-zinc-950 border-zinc-800 text-xs h-9 hover:border-zinc-700">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 max-h-72">
                  {models.map((m) => <SelectItem key={m.model} value={m.model}>{m.provider}/{m.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5 font-medium">To model</div>
              <Select value={toModel} onValueChange={setToModel}>
                <SelectTrigger data-testid="mig-to" className="bg-zinc-950 border-zinc-800 text-xs h-9 hover:border-zinc-700">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 max-h-72">
                  {models.map((m) => <SelectItem key={m.model} value={m.model}>{m.provider}/{m.model}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5 font-medium">Monthly volume</div>
            <Input
              data-testid="mig-volume"
              type="number"
              value={migVolume}
              onChange={(e) => setMigVolume(Number(e.target.value) || 0)}
              className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-700 mono text-xs h-9"
            />
          </div>

          <Button
            data-testid="mig-run"
            onClick={runMigration}
            disabled={migBusy}
            className="w-full bg-zinc-50 text-zinc-900 hover:bg-white h-9 font-medium"
          >
            <Play className="w-3.5 h-3.5 mr-2" />
            {migBusy ? "Simulating…" : "Run Simulation"}
          </Button>

          {migResult && (() => {
            const v = VERDICT_STYLE[migResult.verdict] || VERDICT_STYLE["trade-off"];
            const Icon = v.Icon;
            return (
              <div className="mt-5 pt-5 border-t border-zinc-800/80 space-y-3" data-testid="mig-result">
                <Pill color={v.pill}>
                  <Icon className="w-3 h-3" /> {v.label}
                </Pill>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Cost / mo</div>
                    <div className={`font-heading text-lg font-bold mono tabular-nums mt-1 ${migResult.monthly_savings > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {migResult.monthly_savings > 0 ? "−" : "+"}{fmtUsd(Math.abs(migResult.monthly_savings))}
                    </div>
                    {migResult.baseline?.monthly_cost > 0 && (
                      <div className="text-[10px] text-zinc-500 mono mt-0.5 tabular-nums">
                        {((migResult.monthly_savings / migResult.baseline.monthly_cost) * 100).toFixed(1)}% vs baseline
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Quality Δ <span className="text-zinc-600 normal-case tracking-normal">(pts)</span></div>
                    <div className={`font-heading text-lg font-bold mono tabular-nums mt-1 ${migResult.quality_delta >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                      {migResult.quality_delta >= 0 ? "+" : ""}{(migResult.quality_delta * 100).toFixed(1)}
                    </div>
                    <div className="text-[10px] text-zinc-500 mono mt-0.5">on 0–100 scale</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Latency Δ</div>
                    <div className={`font-heading text-lg font-bold mono tabular-nums mt-1 ${migResult.latency_delta_ms <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                      {migResult.latency_delta_ms > 0 ? "+" : ""}{migResult.latency_delta_ms}<span className="text-zinc-500 text-sm ml-0.5">ms</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 mono mt-0.5">P95 estimate</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{migResult.summary}</p>
              </div>
            );
          })()}
        </SectionCard>

        {/* AI Model Advisor */}
        <SectionCard
          testId="advisor-card"
          title={<span className="inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-400" />AI Model Advisor</span>}
          subtitle="Recommend the best model for your workload"
        >
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5 font-medium">Objective</div>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger data-testid="adv-objective" className="bg-zinc-950 border-zinc-800 text-xs h-9 hover:border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800">
                  {OBJECTIVES.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5 font-medium">Primary task</div>
              <Select value={task} onValueChange={setTask}>
                <SelectTrigger data-testid="adv-task" className="bg-zinc-950 border-zinc-800 text-xs h-9 hover:border-zinc-700"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800">
                  {TASKS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1.5 font-medium">Monthly budget (USD)</div>
              <Input
                data-testid="adv-budget"
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-700 mono text-xs h-9"
              />
            </div>
          </div>

          <Button
            data-testid="adv-run"
            onClick={runAdvisor}
            disabled={advBusy}
            className="w-full mt-4 bg-zinc-50 text-zinc-900 hover:bg-white h-9 font-medium"
          >
            <Play className="w-3.5 h-3.5 mr-2" />
            {advBusy ? "Recommending…" : "Run Advisor"}
          </Button>

          {advResult && (
            <div className="mt-5 pt-5 border-t border-zinc-800/80 space-y-3" data-testid="adv-result">
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Recommended</div>
              <div className="font-heading text-lg font-bold mono text-emerald-400 flex items-center gap-2 flex-wrap">
                <span>{advResult.recommended.provider}/{advResult.recommended.model}</span>
                {["groq", "ollama", "bedrock", "azure"].includes(advResult.recommended.provider) && (
                  <Pill color="amber">demo · needs API key</Pill>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">$ / call</div>
                  <div className="font-heading text-sm mono tabular-nums mt-1">${advResult.recommended.cost_per_call.toFixed(5)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Monthly</div>
                  <div className="font-heading text-sm mono tabular-nums mt-1">{fmtUsd(advResult.recommended.monthly_cost)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Quality</div>
                  <div className="font-heading text-sm mono tabular-nums mt-1 text-emerald-400">{(advResult.recommended.quality * 100).toFixed(0)}</div>
                </div>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{advResult.reasoning}</p>
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">Alternates</div>
                <div className="space-y-1.5">
                  {advResult.alternates.slice(0, 4).map((a) => {
                    const isDemo = ["groq", "ollama", "bedrock", "azure"].includes(a.provider);
                    return (
                      <div key={a.model} className="flex items-center justify-between text-xs border-b border-zinc-900 py-1.5 gap-2">
                        <span className="mono text-zinc-300 truncate flex items-center gap-2 min-w-0">
                          <span className="truncate">{a.provider}/{a.model}</span>
                          {isDemo && <span className="text-[9px] uppercase tracking-wider text-amber-400 shrink-0">demo</span>}
                        </span>
                        <span className="mono text-zinc-500 tabular-nums whitespace-nowrap shrink-0">{fmtUsd(a.monthly_cost)}/mo · q{(a.quality * 100).toFixed(0)} · {a.p95_ms}ms</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
