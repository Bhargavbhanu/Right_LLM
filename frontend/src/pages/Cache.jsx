import React, { useEffect, useState } from "react";
import PageHeader, { StatCard } from "../components/PageHeader";
import { getUsage, getCacheEntries, postCacheSearch, fmtPct, fmtInt, fmtUsd } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { downloadCsv } from "../lib/csv";
import { Slider } from "../components/ui/slider";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const TT = { contentStyle: { background: "#09090B", border: "1px solid #27272A", borderRadius: 6, fontSize: 12 } };

export default function Cache() {
  const { orgId } = useOrg();
  const [usage, setUsage] = useState(null);
  const [entries, setEntries] = useState([]);
  const [threshold, setThreshold] = useState([0.92]);
  const [probe, setProbe] = useState("Summarize this support email and propose a reply");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getUsage(30).then(setUsage).catch(() => {});
    getCacheEntries(60).then(setEntries).catch(() => {});
  }, [orgId]);

  const runProbe = async () => {
    setBusy(true);
    try {
      const r = await postCacheSearch({ prompt: probe, similarity_threshold: threshold[0] });
      setResult(r);
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="page-cache">
      <PageHeader title="Semantic Cache" subtitle="L1 exact-match + L2 cosine-similarity cache. Tune the threshold to balance recall and quality." testId="cache-header" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard testId="cache-stat-hitrate" label="Hit rate (30d)" value={fmtPct(usage?.totals?.cache_hit_rate || 0)}
          sub={`${fmtInt(usage?.totals?.cache_hits || 0)} hits`} accent="text-emerald-400" />
        <StatCard testId="cache-stat-savings" label="Cache savings" value={fmtUsd(usage?.totals?.cache_savings_usd || 0)} sub="L1 + L2 combined" />
        <StatCard testId="cache-stat-entries" label="Active cache entries" value={fmtInt(entries.length)} sub="prompts indexed in L2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 border border-zinc-800 rounded-md p-5 bg-zinc-950">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Hit-rate trend</div>
          <div className="font-heading text-xl font-semibold mt-1 mb-4">Cache hits over time</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={usage?.by_day || []}>
              <CartesianGrid stroke="#27272A" vertical={false} />
              <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={(d) => d?.slice(5)} />
              <YAxis stroke="#71717A" fontSize={10} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip {...TT} formatter={(v) => `${(v * 100).toFixed(1)}%`} />
              <Line type="monotone" dataKey="hit_rate" stroke="#22C55E" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Threshold tuner</div>
          <div className="font-heading text-xl font-semibold mt-1 mb-4">Similarity ≥ <span className="text-blue-400 mono">{threshold[0].toFixed(2)}</span></div>
          <Slider
            data-testid="cache-threshold-slider"
            value={threshold}
            onValueChange={setThreshold}
            min={0.7} max={0.99} step={0.01}
            className="mb-6"
          />
          <div className="space-y-3">
            <Input data-testid="cache-probe-input" value={probe} onChange={(e) => setProbe(e.target.value)}
              className="bg-zinc-900 border-zinc-800" placeholder="Test a prompt against the cache..." />
            <Button data-testid="cache-probe-btn" onClick={runProbe} disabled={busy} className="w-full bg-white text-zinc-900 hover:bg-zinc-200">
              {busy ? "Searching…" : "Probe semantic cache"}
            </Button>
            {result && (
              <div data-testid="cache-probe-result" className="border border-zinc-800 rounded-md p-3 text-xs mono">
                <div>Hit: <span className={result.hit ? "text-emerald-400" : "text-red-400"}>{String(result.hit)}</span></div>
                <div>Similarity: <span className="text-blue-400">{result.similarity}</span></div>
                {result.entry && <div className="mt-2 text-zinc-400 truncate">↳ {result.entry.prompt}</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-zinc-800 rounded-md bg-zinc-950">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Top entries</div>
            <div className="font-heading text-lg font-semibold mt-0.5">Most-hit cached prompts</div>
          </div>
          <Button data-testid="export-cache" size="sm" variant="outline" className="border-zinc-700 text-xs h-8"
            onClick={() => downloadCsv(`cache-entries-${orgId}.csv`, entries)}>
            <Download className="w-3 h-3 mr-1.5" /> CSV
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            <tr><th className="text-left px-5 py-3">Prompt</th><th className="text-left px-5 py-3">Model</th><th className="text-right px-5 py-3">Hits</th><th className="text-left px-5 py-3">Last hit</th></tr>
          </thead>
          <tbody>
            {entries.slice(0, 20).map(e => (
              <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                <td className="px-5 py-3 text-xs text-zinc-300 max-w-xl truncate">{e.prompt}</td>
                <td className="px-5 py-3 mono text-xs">{e.model}</td>
                <td className="px-5 py-3 text-right mono text-xs">{e.hit_count}</td>
                <td className="px-5 py-3 mono text-xs text-zinc-500">{e.last_hit_at?.slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
