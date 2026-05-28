import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { StatCard, SectionCard, Pill, EmptyState } from "../components/Card";
import { getRoutingDecisions, getUsage, fmtUsd, fmtInt } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { downloadCsv } from "../lib/csv";
import { Button } from "../components/ui/button";
import { Download, Route as RouteIcon, Sparkles } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

const PIE = ["#3B82F6", "#22C55E", "#A78BFA", "#F59E0B", "#EC4899", "#06B6D4"];

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
  cursor: { fill: "rgba(255,255,255,0.03)" },
};

const COMPLEXITY_COLOR = {
  simple: "emerald",
  moderate: "blue",
  complex: "violet",
  critical: "rose",
};

export default function Routing() {
  const { orgId } = useOrg();
  const [decisions, setDecisions] = useState([]);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    getRoutingDecisions(200).then(setDecisions).catch(() => {});
    getUsage(30).then(setUsage).catch(() => {});
  }, [orgId]);

  const byComplexity = useMemo(() => decisions.reduce((acc, d) => {
    acc[d.complexity] = (acc[d.complexity] || 0) + 1; return acc;
  }, {}), [decisions]);

  const pieData = Object.entries(byComplexity).map(([name, value]) => ({ name, value }));
  const totalRoutingSavings = useMemo(
    () => decisions.reduce((s, d) => s + (d.savings_usd || 0), 0),
    [decisions]
  );

  return (
    <div data-testid="page-routing">
      <PageHeader
        title="Routing Intelligence"
        subtitle="Every request is classified and routed to the cheapest model that meets quality SLAs."
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="emerald"><Sparkles className="w-3 h-3" />{fmtUsd(totalRoutingSavings)} saved (30d)</Pill>
            <Pill color="zinc"><RouteIcon className="w-3 h-3" />{decisions.length} decisions</Pill>
          </div>
        }
        testId="routing-header"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          testId="stat-routed"
          label="Routing decisions (30d)"
          value={fmtInt(decisions.length)}
          icon={<RouteIcon className="w-4 h-4" />}
        />
        <StatCard
          testId="stat-routing-savings"
          label="Routing savings (30d)"
          value={fmtUsd(totalRoutingSavings)}
          accent="text-emerald-400"
          sub="vs. always-on GPT-4o baseline"
          icon={<Sparkles className="w-4 h-4" />}
        />
        <StatCard
          testId="stat-vs-gpt4o"
          label="Avg saved / request"
          value={fmtUsd(decisions.length ? totalRoutingSavings / decisions.length : 0)}
          sub="amortized across all routed traffic"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <SectionCard
          testId="routing-complexity-chart"
          title="Task complexity mix"
          subtitle="Distribution of classified complexity over the period"
        >
          {pieData.length === 0 ? (
            <EmptyState title="No decisions yet" description="Make a request via /gateway/chat to populate the routing log." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="#0A0A0C"
                    strokeWidth={2}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip {...TT} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                {pieData.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE[i % PIE.length] }} />
                    <span className="text-zinc-300 capitalize flex-1 truncate">{p.name}</span>
                    <span className="text-zinc-500 mono">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard
          testId="routing-model-chart"
          title="Model selection"
          subtitle="Requests by destination model"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={(usage?.by_model || []).slice(0, 8)} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1F1F23" horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="model" stroke="#A1A1AA" fontSize={10} width={170} tickLine={false} axisLine={false} />
              <Tooltip {...TT} />
              <defs>
                <linearGradient id="bar-routing" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#A78BFA" />
                </linearGradient>
              </defs>
              <Bar dataKey="requests" fill="url(#bar-routing)" radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <SectionCard
        testId="routing-table"
        title="Routing decision log"
        subtitle={`Latest ${Math.min(100, decisions.length)} decisions across this workspace`}
        padding="p-0"
        bodyClassName=""
        right={
          <Button
            data-testid="export-routing"
            size="sm"
            variant="outline"
            className="border-zinc-800 text-xs h-8 hover:bg-zinc-900"
            onClick={() => downloadCsv(`routing-decisions-${orgId}.csv`, decisions)}
          >
            <Download className="w-3 h-3 mr-1.5" /> CSV
          </Button>
        }
      >
        <div className="overflow-auto max-h-[560px] border-t border-zinc-800/80">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <tr>
                <th className="text-left px-5 py-3">Time</th>
                <th className="text-left px-5 py-3">Task</th>
                <th className="text-left px-5 py-3">Complexity</th>
                <th className="text-left px-5 py-3">Model</th>
                <th className="text-right px-5 py-3">Cost</th>
                <th className="text-right px-5 py-3">Saved</th>
                <th className="text-left px-5 py-3">Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {decisions.slice(0, 100).map((d) => (
                <tr key={d.id} className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors">
                  <td className="px-5 py-3 mono text-[11px] text-zinc-500 whitespace-nowrap">{d.timestamp?.slice(11, 19)}</td>
                  <td className="px-5 py-3"><Pill color="zinc">{d.task}</Pill></td>
                  <td className="px-5 py-3"><Pill color={COMPLEXITY_COLOR[d.complexity] || "zinc"}>{d.complexity}</Pill></td>
                  <td className="px-5 py-3 mono text-[11px] text-zinc-300">{d.provider}/{d.model}</td>
                  <td className="px-5 py-3 text-right mono text-[11px] tabular-nums">{fmtUsd(d.cost_usd)}</td>
                  <td className="px-5 py-3 text-right mono text-[11px] text-emerald-400 tabular-nums">{fmtUsd(d.savings_usd)}</td>
                  <td className="px-5 py-3 text-[11px] text-zinc-400 max-w-md truncate" title={d.reasoning}>{d.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
