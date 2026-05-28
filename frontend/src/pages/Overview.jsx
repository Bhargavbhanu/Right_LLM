import React, { useEffect, useMemo, useState } from "react";
import { getUsage, getActions, getProviders, fmtUsd, fmtPct, fmtInt } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import PageHeader from "../components/PageHeader";
import AnimatedNumber from "../components/AnimatedNumber";
import LiveTicker from "../components/LiveTicker";
import { StatCardSkeleton, ChartSkeleton } from "../components/Skeletons";
import { StatCard, SectionCard, EmptyState, Pill } from "../components/Card";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { ArrowUpRight, Activity, Bot, Cpu, Database, DollarSign, Sparkles, Zap } from "lucide-react";

const TT_STYLE = {
  contentStyle: {
    background: "rgba(9, 9, 11, 0.95)",
    border: "1px solid #27272A",
    borderRadius: 8,
    fontSize: 11,
    padding: "8px 10px",
    boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)",
  },
  labelStyle: { color: "#A1A1AA", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 },
  itemStyle: { color: "#FAFAFA", padding: 0 },
  cursor: { fill: "rgba(255,255,255,0.03)" },
};

const PIE_COLORS = ["#3B82F6", "#22C55E", "#A78BFA", "#F59E0B", "#EC4899", "#06B6D4", "#F97316", "#EF4444"];

function Sparkline({ data, dataKey = "cost", color = "#3B82F6", height = 36 }) {
  if (!data || data.length === 0) return <div style={{ height }} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#spark-${color})`} strokeWidth={1.5} dot={false} isAnimationActive />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function pctDelta(arr, key) {
  if (!arr || arr.length < 4) return null;
  const half = Math.floor(arr.length / 2);
  const first = arr.slice(0, half).reduce((s, x) => s + (x[key] || 0), 0) / half;
  const second = arr.slice(half).reduce((s, x) => s + (x[key] || 0), 0) / (arr.length - half);
  if (first === 0) return null;
  return (second - first) / first;
}

export default function Overview() {
  const { orgId, orgs } = useOrg();
  const [usage, setUsage] = useState(null);
  const [actions, setActions] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getUsage(30), getActions(), getProviders()])
      .then(([u, a, p]) => { setUsage(u); setActions(a || []); setProviders(p || []); })
      .finally(() => setLoading(false));
  }, [orgId]);

  const t = usage?.totals || {};
  const byDay = usage?.by_day || [];
  const byModel = usage?.by_model || [];
  const activeAuto = actions.filter((a) => a.status === "active").length;
  const orgName = orgs.find((o) => o.id === orgId)?.name || "your workspace";

  const costDelta = useMemo(() => pctDelta(byDay, "cost"), [byDay]);
  const hitDelta = useMemo(() => pctDelta(byDay, "hit_rate"), [byDay]);

  // Provider mix data from by_model -> group by provider prefix
  const providerMix = useMemo(() => {
    const map = {};
    for (const m of byModel) {
      const provider = (m.model || "").split("/")[0] || "unknown";
      map[provider] = (map[provider] || 0) + (m.cost || 0);
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [byModel]);

  const totalSpend = useMemo(() => byDay.reduce((s, d) => s + (d.cost || 0), 0), [byDay]);

  return (
    <div data-testid="page-overview">
      <PageHeader
        title="Overview"
        subtitle={`Real-time cost optimization across the LLM stack for ${orgName}. Last 30 days of activity.`}
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="emerald">
              <Sparkles className="w-3 h-3" /> {fmtUsd(t.total_savings_usd || 0)} saved
            </Pill>
            <Pill color="zinc">
              <Cpu className="w-3 h-3" /> {providers.length} providers
            </Pill>
          </div>
        }
        testId="overview-header"
      />

      <div className="mb-6">
        <LiveTicker />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          <>
            <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              testId="stat-savings"
              label="Total Savings (30d)"
              value={<AnimatedNumber value={t.total_savings_usd || 0} format={(v) => fmtUsd(v)} />}
              sub={`Routing ${fmtUsd(t.routing_savings_usd || 0)} · Cache ${fmtUsd(t.cache_savings_usd || 0)}`}
              accent="text-emerald-400"
              icon={<DollarSign className="w-4 h-4" />}
              delta={costDelta != null ? -costDelta : null}
              positiveIsGood
            >
              <Sparkline data={byDay} dataKey="savings" color="#22C55E" />
            </StatCard>
            <StatCard
              testId="stat-hitrate"
              label="Cache Hit Rate"
              value={<AnimatedNumber value={(t.cache_hit_rate || 0) * 100} format={(v) => `${v.toFixed(1)}%`} />}
              sub={`${fmtInt(t.cache_hits || 0)} / ${fmtInt(t.requests || 0)} requests`}
              icon={<Database className="w-4 h-4" />}
              delta={hitDelta}
              positiveIsGood
            >
              <Sparkline data={byDay} dataKey="hit_rate" color="#A78BFA" />
            </StatCard>
            <StatCard
              testId="stat-tokenreduce"
              label="Token Reduction"
              value={<AnimatedNumber value={(t.token_reduction_pct || 0) * 100} format={(v) => `${v.toFixed(1)}%`} />}
              sub={`${fmtInt(t.input_tokens || 0)} in · ${fmtInt(t.output_tokens || 0)} out`}
              icon={<Zap className="w-4 h-4" />}
            >
              <Sparkline data={byDay} dataKey="tokens_in" color="#F59E0B" />
            </StatCard>
            <StatCard
              testId="stat-autonomous"
              label="Active Autonomous Actions"
              value={<AnimatedNumber value={activeAuto} format={(v) => fmtInt(v)} />}
              sub={`${actions.length} total in audit log`}
              accent="text-blue-400"
              icon={<Bot className="w-4 h-4" />}
            >
              <div className="flex items-center gap-1.5 mt-1">
                <span className="status-dot" style={{ color: "#3B82F6", background: "#3B82F6" }} />
                <span className="text-[11px] text-zinc-500">Auto-optimization enabled</span>
              </div>
            </StatCard>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {loading ? (
          <>
            <div className="lg:col-span-2"><ChartSkeleton height={300} /></div>
            <ChartSkeleton height={300} />
          </>
        ) : (
          <>
            <SectionCard
              testId="chart-spend"
              className="lg:col-span-2"
              title="Cost trend"
              subtitle={`Daily spend & savings · ${fmtUsd(totalSpend)} total · ${byDay.length} days`}
              right={
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" />Spend</span>
                  <span className="inline-flex items-center gap-1 ml-2"><span className="w-2 h-2 rounded-sm bg-emerald-500/80" />Savings</span>
                </div>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={byDay} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cost-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="save-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1F1F23" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false}
                         tickFormatter={(d) => d?.slice(5)} />
                  <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false}
                         tickFormatter={(v) => `$${v.toFixed(0)}`} />
                  <Tooltip {...TT_STYLE}
                           formatter={(v, n) => [fmtUsd(v), n === "cost" ? "Spend" : "Savings"]} />
                  <Area type="monotone" dataKey="savings" stroke="#22C55E" fill="url(#save-grad)" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="cost" stroke="#3B82F6" fill="url(#cost-grad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard
              testId="chart-providermix"
              title="Provider mix"
              subtitle="Share of spend by provider"
            >
              {providerMix.length === 0 ? (
                <EmptyState title="No data yet" description="Provider analytics will appear after the first request." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={providerMix}
                        innerRadius={55}
                        outerRadius={88}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        stroke="#0A0A0C"
                        strokeWidth={2}
                      >
                        {providerMix.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...TT_STYLE} formatter={(v) => fmtUsd(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                    {providerMix.slice(0, 6).map((p, i) => (
                      <div key={p.name} className="flex items-center gap-2 text-xs">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-zinc-300 truncate flex-1">{p.name}</span>
                        <span className="text-zinc-500 mono">{fmtUsd(p.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {loading ? (
          <>
            <div className="lg:col-span-2"><ChartSkeleton height={300} /></div>
            <ChartSkeleton height={300} />
          </>
        ) : (
          <>
            <SectionCard
              testId="chart-by-model"
              className="lg:col-span-2"
              title="Model distribution"
              subtitle="Cost by model (top 8)"
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={byModel.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1F1F23" horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false}
                         tickFormatter={(v) => `$${v.toFixed(0)}`} />
                  <YAxis type="category" dataKey="model" stroke="#A1A1AA" fontSize={10} width={180}
                         tickLine={false} axisLine={false} />
                  <Tooltip {...TT_STYLE} formatter={(v) => fmtUsd(v)} />
                  <defs>
                    <linearGradient id="bar-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#A78BFA" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                  <Bar dataKey="cost" fill="url(#bar-grad)" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard
              testId="chart-hitrate"
              title="Cache hit rate"
              subtitle="Trend across last 30 days"
            >
              <div className="mb-3 flex items-baseline gap-2">
                <div className="font-heading text-2xl font-bold text-emerald-400">
                  {fmtPct(t.cache_hit_rate || 0)}
                </div>
                <div className="text-xs text-zinc-500">avg</div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={byDay}>
                  <CartesianGrid stroke="#1F1F23" vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false}
                         tickFormatter={(d) => d?.slice(5)} />
                  <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false}
                         tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip {...TT_STYLE} formatter={(v) => `${(v * 100).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="hit_rate" stroke="#22C55E" strokeWidth={2} dot={false}
                        activeDot={{ r: 4, fill: "#22C55E", stroke: "#0A0A0C", strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          </>
        )}
      </div>

      <SectionCard
        testId="recent-actions"
        title="Recent autonomous actions"
        subtitle="Latest auto-optimization decisions executed by the platform"
        right={<Pill color="blue"><Bot className="w-3 h-3" />{activeAuto} active</Pill>}
      >
        {actions.length === 0 ? (
          <EmptyState
            icon={<Bot className="w-5 h-5" />}
            title="No autonomous actions yet"
            description="Once the optimizer takes its first action, it will appear here with a full audit trail."
          />
        ) : (
          <ul className="divide-y divide-zinc-900">
            {actions.slice(0, 6).map((a, i) => (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-4 group">
                <div className="shrink-0 mt-1 w-8 h-8 rounded-md border border-zinc-800 bg-zinc-950 flex items-center justify-center text-blue-400">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-100 leading-snug">{a.summary}</div>
                  <div className="text-xs text-zinc-500 mt-1">{a.outcome}</div>
                </div>
                <div className="text-[11px] text-zinc-600 mono whitespace-nowrap shrink-0">
                  {a.timestamp?.replace("T", " ").slice(0, 16)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
