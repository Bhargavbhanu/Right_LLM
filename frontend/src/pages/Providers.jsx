import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { Surface, SectionCard, Pill } from "../components/Card";
import { getProviders } from "../lib/api";
import { Server } from "lucide-react";

const HEALTH = {
  healthy:      { color: "#22C55E", label: "Healthy",      pill: "emerald" },
  degraded:     { color: "#F59E0B", label: "Degraded",     pill: "amber" },
  down:         { color: "#EF4444", label: "Down",         pill: "rose" },
  unconfigured: { color: "#71717A", label: "Unconfigured", pill: "zinc" },
};

const TIER_COLOR = {
  simple:   "emerald",
  moderate: "blue",
  complex:  "violet",
  critical: "rose",
};

export default function Providers() {
  const [data, setData] = useState({ providers: [], models: [] });

  useEffect(() => {
    getProviders().then(setData).catch(() => {});
  }, []);

  const summary = useMemo(() => {
    const healthy = data.providers.filter((p) => p.health === "healthy").length;
    const total = data.providers.length;
    return { healthy, total };
  }, [data.providers]);

  return (
    <div data-testid="page-providers">
      <PageHeader
        title="Provider Analytics"
        subtitle="Cost, latency P95, error rate and health across all connected LLM providers."
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="emerald"><Server className="w-3 h-3" />{summary.healthy}/{summary.total} healthy</Pill>
            <Pill color="zinc">{data.models.length} models</Pill>
          </div>
        }
        testId="providers-header"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 stagger">
        {data.providers.map((p) => {
          const h = HEALTH[p.health] || HEALTH.healthy;
          return (
            <Surface key={p.id} testId={`provider-${p.id}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-heading text-base font-semibold text-zinc-100">{p.name}</div>
                <Pill color={h.pill}>
                  <span className="status-dot" style={{ color: h.color, background: h.color }} />
                  {h.label}
                </Pill>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">P95 latency</div>
                  <div className="font-heading text-xl font-bold mono tabular-nums mt-1">{p.p95_latency_ms}<span className="text-zinc-500 text-xs ml-0.5">ms</span></div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Error rate</div>
                  <div className={`font-heading text-xl font-bold mono tabular-nums mt-1 ${p.error_rate > 2 ? "text-amber-400" : "text-emerald-400"}`}>
                    {p.error_rate}<span className="text-zinc-500 text-xs ml-0.5">%</span>
                  </div>
                </div>
              </div>
            </Surface>
          );
        })}
      </div>

      <SectionCard
        testId="providers-models-table"
        title="Connected models & pricing"
        subtitle={`${data.models.length} models across ${data.providers.length} providers`}
        padding="p-0"
      >
        <div className="overflow-auto border-t border-zinc-800/80">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <tr>
                <th className="text-left px-5 py-3">Provider</th>
                <th className="text-left px-5 py-3">Model</th>
                <th className="text-left px-5 py-3">Tier</th>
                <th className="text-right px-5 py-3">$/1K in</th>
                <th className="text-right px-5 py-3">$/1K out</th>
                <th className="text-right px-5 py-3">P95 ms</th>
                <th className="text-right px-5 py-3">Quality</th>
              </tr>
            </thead>
            <tbody>
              {data.models.map((m) => (
                <tr key={m.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                  <td className="px-5 py-3 text-[12px] text-zinc-300 capitalize">{m.provider}</td>
                  <td className="px-5 py-3 mono text-[11px] text-zinc-200">{m.model}</td>
                  <td className="px-5 py-3"><Pill color={TIER_COLOR[m.tier] || "zinc"}>{m.tier}</Pill></td>
                  <td className="px-5 py-3 text-right mono text-[11px] tabular-nums">${m.input_cost_per_1k.toFixed(5)}</td>
                  <td className="px-5 py-3 text-right mono text-[11px] tabular-nums">${m.output_cost_per_1k.toFixed(5)}</td>
                  <td className="px-5 py-3 text-right mono text-[11px] tabular-nums">{m.p95_latency_ms}</td>
                  <td className="px-5 py-3 text-right mono text-[11px] text-emerald-400 tabular-nums">{(m.quality_score * 100).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
