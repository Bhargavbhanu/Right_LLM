import React, { useEffect, useState } from "react";
import { getUsage, getActions, fmtUsd, fmtPct, fmtInt } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import PageHeader from "../components/PageHeader";
import AnimatedNumber from "../components/AnimatedNumber";
import LiveTicker from "../components/LiveTicker";
import { StatCardSkeleton, ChartSkeleton } from "../components/Skeletons";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowUpRight, Activity } from "lucide-react";

const CHART_TT = {
  contentStyle: { background: "#09090B", border: "1px solid #27272A", borderRadius: 6, fontSize: 12 },
  labelStyle: { color: "#A1A1AA", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" },
  itemStyle: { color: "#FAFAFA" },
};

function StatCard({ label, value, sub, accent, testId, format }) {
  return (
    <div
      data-testid={testId}
      className="border border-zinc-800 bg-zinc-950 rounded-md p-5 transition-all duration-200 hover:border-zinc-600 hover:-translate-y-0.5 hover:shadow-[0_0_24px_rgba(59,130,246,0.06)] animate-fade-up"
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div className={`mt-3 font-heading text-3xl font-bold tracking-tight ${accent || "text-white"}`}>
        <AnimatedNumber value={value} format={format} />
      </div>
      {sub && <div className="text-xs text-zinc-500 mt-1.5">{sub}</div>}
    </div>
  );
}

export default function Overview() {
  const { orgId, orgs } = useOrg();
  const [usage, setUsage] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getUsage(30), getActions()])
      .then(([u, a]) => { setUsage(u); setActions(a); })
      .finally(() => setLoading(false));
  }, [orgId]);

  const t = usage?.totals || {};
  const activeAuto = actions.filter(a => a.status === "active").length;
  const orgName = orgs.find(o => o.id === orgId)?.name || "your workspace";

  return (
    <div data-testid="page-overview">
      <PageHeader
        title="Overview"
        subtitle={`Real-time cost optimization across the LLM stack for ${orgName}. Last 30 days.`}
        right={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800 text-xs text-zinc-400">
            <span className="status-dot animate-pulse" style={{ color: "#22C55E", background: "#22C55E" }} />
            <Activity className="w-3.5 h-3.5 text-emerald-400" /> Gateway live
          </div>
        }
        testId="overview-header"
      />

      <div className="mb-6">
        <LiveTicker />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <>
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard testId="stat-savings" label="Total Savings (30d)"
              value={t.total_savings_usd || 0}
              format={(v) => fmtUsd(v)}
              sub={`Routing ${fmtUsd(t.routing_savings_usd || 0)} · Cache ${fmtUsd(t.cache_savings_usd || 0)}`}
              accent="text-emerald-400" />
            <StatCard testId="stat-hitrate" label="Cache Hit Rate"
              value={(t.cache_hit_rate || 0) * 100}
              format={(v) => `${v.toFixed(1)}%`}
              sub={`${fmtInt(t.cache_hits || 0)} / ${fmtInt(t.requests || 0)} requests`} />
            <StatCard testId="stat-tokenreduce" label="Token Reduction"
              value={(t.token_reduction_pct || 0) * 100}
              format={(v) => `${v.toFixed(1)}%`}
              sub={`${fmtInt(t.input_tokens || 0)} in · ${fmtInt(t.output_tokens || 0)} out`} />
            <StatCard testId="stat-autonomous" label="Active Autonomous Actions"
              value={activeAuto}
              format={(v) => fmtInt(v)}
              sub={`${actions.length} total in audit log`}
              accent="text-blue-400" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <div className="lg:col-span-2 border border-zinc-800 rounded-md p-5 bg-zinc-950 animate-fade-up" data-testid="chart-spend">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Daily spend & savings</div>
                  <div className="font-heading text-xl font-semibold mt-1">Cost trend</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-zinc-500" />
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={usage?.by_day || []}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272A" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis stroke="#71717A" fontSize={10} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                  <Tooltip {...CHART_TT} />
                  <Area type="monotone" dataKey="cost" stroke="#3B82F6" fill="url(#grad1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950 animate-fade-up" data-testid="chart-hitrate">
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Cache hit-rate trend</div>
              <div className="font-heading text-xl font-semibold mt-1 mb-4">Hit rate (%)</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={usage?.by_day || []}>
                  <CartesianGrid stroke="#27272A" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={(d) => d?.slice(5)} />
                  <YAxis stroke="#71717A" fontSize={10} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip {...CHART_TT} formatter={(v) => `${(v * 100).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="hit_rate" stroke="#22C55E" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950 animate-fade-up" data-testid="chart-by-model">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Cost by model</div>
          <div className="font-heading text-xl font-semibold mt-1 mb-4">Model distribution</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={(usage?.by_model || []).slice(0, 8)} layout="vertical">
              <CartesianGrid stroke="#27272A" horizontal={false} />
              <XAxis type="number" stroke="#71717A" fontSize={10} />
              <YAxis type="category" dataKey="model" stroke="#A1A1AA" fontSize={10} width={170} />
              <Tooltip {...CHART_TT} />
              <Bar dataKey="cost" fill="#FAFAFA" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950 animate-fade-up" data-testid="recent-actions">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Recent autonomous actions</div>
          <div className="font-heading text-xl font-semibold mt-1 mb-4">Live feed</div>
          <ul className="space-y-3">
            {(actions.slice(0, 5)).map(a => (
              <li key={a.id} className="border-l-2 border-blue-500 pl-3">
                <div className="text-xs text-zinc-500 mono">{a.timestamp?.replace("T", " ").slice(0, 19)}</div>
                <div className="text-sm font-medium">{a.summary}</div>
                <div className="text-xs text-zinc-500 mt-1">{a.outcome}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
