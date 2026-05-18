import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { getProviders } from "../lib/api";

const HEALTH = {
  healthy:      { color: "#22C55E", label: "Healthy" },
  degraded:     { color: "#EAB308", label: "Degraded" },
  down:         { color: "#EF4444", label: "Down" },
  unconfigured: { color: "#71717A", label: "Unconfigured" },
};

export default function Providers() {
  const [data, setData] = useState({ providers: [], models: [] });
  useEffect(() => { getProviders().then(setData).catch(() => {}); }, []);

  return (
    <div data-testid="page-providers">
      <PageHeader title="Provider Analytics" subtitle="Cost, latency P95, error rate and health across all connected LLM providers." testId="providers-header" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {data.providers.map(p => {
          const h = HEALTH[p.health] || HEALTH.healthy;
          return (
            <div key={p.id} className="border border-zinc-800 rounded-md p-5 bg-zinc-950" data-testid={`provider-${p.id}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="font-heading text-lg font-semibold">{p.name}</div>
                <span className="status-dot" style={{ color: h.color, background: h.color }} />
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{h.label}</div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">P95 latency</div>
                  <div className="font-heading text-xl font-bold mono mt-1">{p.p95_latency_ms}ms</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Error rate</div>
                  <div className={`font-heading text-xl font-bold mono mt-1 ${p.error_rate > 2 ? "text-yellow-400" : "text-emerald-400"}`}>{p.error_rate}%</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border border-zinc-800 rounded-md bg-zinc-950">
        <div className="px-5 py-4 border-b border-zinc-800">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Models</div>
          <div className="font-heading text-lg font-semibold mt-0.5">Connected models & pricing</div>
        </div>
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
            {data.models.map(m => (
              <tr key={m.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="px-5 py-3 text-sm">{m.provider}</td>
                <td className="px-5 py-3 mono text-xs">{m.model}</td>
                <td className="px-5 py-3 text-xs"><span className="px-2 py-0.5 rounded-md border border-zinc-700 text-zinc-300">{m.tier}</span></td>
                <td className="px-5 py-3 text-right mono text-xs">${m.input_cost_per_1k.toFixed(5)}</td>
                <td className="px-5 py-3 text-right mono text-xs">${m.output_cost_per_1k.toFixed(5)}</td>
                <td className="px-5 py-3 text-right mono text-xs">{m.p95_latency_ms}</td>
                <td className="px-5 py-3 text-right mono text-xs text-emerald-400">{(m.quality_score * 100).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
