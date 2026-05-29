import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { StatCard, SectionCard, Pill, EmptyState } from "../components/Card";
import { getOptimizationLog, fmtInt, fmtPct } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { downloadCsv } from "../lib/csv";
import { Button } from "../components/ui/button";
import { Download, Zap, Sparkles } from "lucide-react";

export default function OptimizationLog() {
  const { orgId } = useOrg();
  const [items, setItems] = useState([]);

  useEffect(() => {
    getOptimizationLog(200).then(setItems).catch(() => {});
  }, [orgId]);

  const totalBefore = items.reduce((s, x) => s + x.before_tokens, 0);
  const totalAfter = items.reduce((s, x) => s + x.after_tokens, 0);
  const avgRatio = items.length ? items.reduce((s, x) => s + x.compression_ratio, 0) / items.length : 0;
  const saved = totalBefore - totalAfter;

  return (
    <div data-testid="page-optimization">
      <PageHeader
        title="Optimization Log"
        subtitle="Before / after token counts, compression ratio and quality delta for every optimized request."
        right={
          <Button
            data-testid="export-opt"
            size="sm"
            variant="outline"
            className="border-zinc-800 text-xs h-8 hover:bg-zinc-900"
            onClick={() => downloadCsv(`optimization-log-${orgId}.csv`, items)}
          >
            <Download className="w-3 h-3 mr-1.5" /> Export CSV
          </Button>
        }
        testId="opt-header"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 stagger">
        <StatCard
          testId="opt-stat-before"
          label="Tokens before"
          value={fmtInt(totalBefore)}
          icon={<Zap className="w-4 h-4" />}
        />
        <StatCard
          testId="opt-stat-after"
          label="Tokens after"
          value={fmtInt(totalAfter)}
          sub={`saved ${fmtInt(saved)} tokens`}
          accent="text-emerald-400"
          icon={<Sparkles className="w-4 h-4" />}
        />
        <StatCard
          testId="opt-stat-ratio"
          label="Avg compression"
          value={fmtPct(avgRatio)}
          sub="across all optimized requests"
          accent="text-blue-400"
        />
      </div>

      <SectionCard
        testId="opt-log-table"
        title="Optimization events"
        subtitle={`Latest ${Math.min(100, items.length)} entries`}
        padding="p-0"
      >
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No optimization log yet" description="Send a request to see compression stats appear here." />
          </div>
        ) : (
          <div className="overflow-auto border-t border-zinc-800/80 max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                <tr>
                  <th className="text-left px-5 py-3">Time</th>
                  <th className="text-right px-5 py-3">Before</th>
                  <th className="text-right px-5 py-3">After</th>
                  <th className="text-right px-5 py-3">Saved</th>
                  <th className="text-right px-5 py-3">Ratio</th>
                  <th className="text-right px-5 py-3">Quality Δ</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 100).map((o) => (
                  <tr key={o.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                    <td className="px-5 py-3 mono text-[11px] text-zinc-500">{o.timestamp?.slice(0, 19).replace("T", " ")}</td>
                    <td className="px-5 py-3 text-right mono text-[11px] tabular-nums">{fmtInt(o.before_tokens)}</td>
                    <td className="px-5 py-3 text-right mono text-[11px] tabular-nums">{fmtInt(o.after_tokens)}</td>
                    <td className="px-5 py-3 text-right mono text-[11px] text-emerald-400 tabular-nums">-{fmtInt(o.saved_tokens)}</td>
                    <td className="px-5 py-3 text-right mono text-[11px] tabular-nums">{fmtPct(o.compression_ratio)}</td>
                    <td className={`px-5 py-3 text-right mono text-[11px] tabular-nums ${o.quality_delta < 0 ? "text-amber-400" : "text-zinc-400"}`}>
                      {o.quality_delta > 0 ? "+" : ""}{(o.quality_delta * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
