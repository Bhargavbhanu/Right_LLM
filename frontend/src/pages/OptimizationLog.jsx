import React, { useEffect, useState } from "react";
import PageHeader, { StatCard } from "../components/PageHeader";
import { getOptimizationLog, fmtInt, fmtPct } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { downloadCsv } from "../lib/csv";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";

export default function OptimizationLog() {
  const { orgId } = useOrg();
  const [items, setItems] = useState([]);
  useEffect(() => { getOptimizationLog(200).then(setItems).catch(() => {}); }, [orgId]);
  const totalBefore = items.reduce((s, x) => s + x.before_tokens, 0);
  const totalAfter = items.reduce((s, x) => s + x.after_tokens, 0);
  const avgRatio = items.length ? items.reduce((s, x) => s + x.compression_ratio, 0) / items.length : 0;

  return (
    <div data-testid="page-optimization">
      <PageHeader title="Optimization Log" subtitle="Before / after token counts, compression ratio, and quality delta for every optimized request."
        right={
          <Button data-testid="export-opt" size="sm" variant="outline" className="border-zinc-700 text-xs h-8"
            onClick={() => downloadCsv(`optimization-log-${orgId}.csv`, items)}>
            <Download className="w-3 h-3 mr-1.5" /> Export CSV
          </Button>
        }
        testId="opt-header" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard testId="opt-stat-before" label="Tokens before" value={fmtInt(totalBefore)} />
        <StatCard testId="opt-stat-after" label="Tokens after" value={fmtInt(totalAfter)} sub={`saved ${fmtInt(totalBefore - totalAfter)}`} accent="text-emerald-400" />
        <StatCard testId="opt-stat-ratio" label="Avg compression" value={fmtPct(avgRatio)} sub="across all optimized requests" />
      </div>

      <div className="border border-zinc-800 rounded-md bg-zinc-950">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
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
            {items.slice(0, 100).map(o => (
              <tr key={o.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="px-5 py-3 mono text-xs text-zinc-500">{o.timestamp?.slice(0, 19).replace("T", " ")}</td>
                <td className="px-5 py-3 text-right mono text-xs">{fmtInt(o.before_tokens)}</td>
                <td className="px-5 py-3 text-right mono text-xs">{fmtInt(o.after_tokens)}</td>
                <td className="px-5 py-3 text-right mono text-xs text-emerald-400">-{fmtInt(o.saved_tokens)}</td>
                <td className="px-5 py-3 text-right mono text-xs">{fmtPct(o.compression_ratio)}</td>
                <td className={`px-5 py-3 text-right mono text-xs ${o.quality_delta < 0 ? "text-yellow-400" : "text-zinc-400"}`}>
                  {o.quality_delta > 0 ? "+" : ""}{(o.quality_delta * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
