import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { StatCard, SectionCard, Pill, EmptyState } from "../components/Card";
import { getUsage, getCacheEntries, postCacheSearch, fmtPct, fmtInt, fmtUsd } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { downloadCsv } from "../lib/csv";
import { Slider } from "../components/ui/slider";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Database, Download, Search, Sparkles, Check, X } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";

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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="page-cache">
      <PageHeader
        title="Semantic Cache"
        subtitle="L1 exact-match + L2 cosine-similarity cache. Tune the threshold to balance recall vs quality."
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="emerald"><Database className="w-3 h-3" />{fmtPct(usage?.totals?.cache_hit_rate || 0)} hit rate</Pill>
            <Pill color="zinc">{entries.length} entries</Pill>
          </div>
        }
        testId="cache-header"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          testId="cache-stat-hitrate"
          label="Hit rate (30d)"
          value={fmtPct(usage?.totals?.cache_hit_rate || 0)}
          sub={`${fmtInt(usage?.totals?.cache_hits || 0)} hits`}
          accent="text-emerald-400"
          icon={<Database className="w-4 h-4" />}
        />
        <StatCard
          testId="cache-stat-savings"
          label="Cache savings"
          value={fmtUsd(usage?.totals?.cache_savings_usd || 0)}
          sub="L1 + L2 combined"
          accent="text-emerald-400"
          icon={<Sparkles className="w-4 h-4" />}
        />
        <StatCard
          testId="cache-stat-entries"
          label="Active cache entries"
          value={fmtInt(entries.length)}
          sub="prompts indexed in L2"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SectionCard
          testId="cache-hitrate-chart"
          className="lg:col-span-2"
          title="Cache hit-rate trend"
          subtitle="Daily L1 + L2 hits over the last 30 days"
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={usage?.by_day || []} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="cache-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1F1F23" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(d) => d?.slice(5)} />
              <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip {...TT} formatter={(v) => `${(v * 100).toFixed(1)}%`} />
              <Area type="monotone" dataKey="hit_rate" stroke="#22C55E" strokeWidth={2} fill="url(#cache-grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard
          testId="cache-tuner"
          title="Threshold tuner"
          subtitle={<>Similarity ≥ <span className="text-blue-400 mono">{threshold[0].toFixed(2)}</span></>}
        >
          <Slider
            data-testid="cache-threshold-slider"
            value={threshold}
            onValueChange={setThreshold}
            min={0.7} max={0.99} step={0.01}
            className="mb-1"
          />
          <div className="flex items-center justify-between text-[10px] text-zinc-600 mono mb-4">
            <span>0.70 · loose</span>
            <span>0.99 · strict</span>
          </div>

          <div className="space-y-2.5">
            <Input
              data-testid="cache-probe-input"
              value={probe}
              onChange={(e) => setProbe(e.target.value)}
              className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-700 text-xs"
              placeholder="Test a prompt against the cache…"
            />
            <Button
              data-testid="cache-probe-btn"
              onClick={runProbe}
              disabled={busy || !probe.trim()}
              className="w-full bg-zinc-50 text-zinc-900 hover:bg-white h-9 font-medium"
            >
              <Search className="w-3.5 h-3.5 mr-2" />
              {busy ? "Searching…" : "Probe semantic cache"}
            </Button>
            {result && (
              <div data-testid="cache-probe-result" className="surface rounded-md p-3 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    {result.hit ? <Check className="w-3 h-3 text-emerald-400" /> : <X className="w-3 h-3 text-rose-400" />}
                    <span className={result.hit ? "text-emerald-400" : "text-rose-400"}>
                      {result.hit ? "HIT" : "MISS"}
                    </span>
                  </span>
                  <span className="mono text-blue-400">{(result.similarity * 100).toFixed(1)}%</span>
                </div>
                {result.entry && (
                  <div className="text-zinc-400 truncate text-[11px] mono">↳ {result.entry.prompt}</div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        testId="cache-entries-table"
        title="Most-hit cached prompts"
        subtitle="Top entries by hit count"
        padding="p-0"
        right={
          <Button
            data-testid="export-cache"
            size="sm"
            variant="outline"
            className="border-zinc-800 text-xs h-8 hover:bg-zinc-900"
            onClick={() => downloadCsv(`cache-entries-${orgId}.csv`, entries)}
          >
            <Download className="w-3 h-3 mr-1.5" /> CSV
          </Button>
        }
      >
        <div className="overflow-auto border-t border-zinc-800/80">
          {entries.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No cached entries yet" description="Cache entries appear after the first stored response. Send a request via the Playground to populate." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                <tr>
                  <th className="text-left px-5 py-3">Prompt</th>
                  <th className="text-left px-5 py-3">Model</th>
                  <th className="text-right px-5 py-3">Hits</th>
                  <th className="text-left px-5 py-3">Last hit</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 20).map((e) => (
                  <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                    <td className="px-5 py-3 text-[12px] text-zinc-300 max-w-xl truncate" title={e.prompt}>{e.prompt}</td>
                    <td className="px-5 py-3 mono text-[11px] text-zinc-400">{e.model}</td>
                    <td className="px-5 py-3 text-right mono text-[11px] text-emerald-400 tabular-nums">{e.hit_count}</td>
                    <td className="px-5 py-3 mono text-[11px] text-zinc-500">{e.last_hit_at?.slice(0, 16).replace("T", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
