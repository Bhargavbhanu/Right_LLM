import React, { useEffect, useState } from "react";
import PageHeader, { StatCard } from "../components/PageHeader";
import { getRoutingDecisions, getUsage, fmtUsd, fmtInt } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { downloadCsv } from "../lib/csv";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const PIE = ["#FAFAFA", "#A1A1AA", "#52525B", "#3F3F46", "#27272A", "#3B82F6", "#22C55E"];

export default function Routing() {
  const { orgId } = useOrg();
  const [decisions, setDecisions] = useState([]);
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    getRoutingDecisions(200).then(setDecisions).catch(() => {});
    getUsage(30).then(setUsage).catch(() => {});
  }, [orgId]);

  const byComplexity = decisions.reduce((acc, d) => {
    acc[d.complexity] = (acc[d.complexity] || 0) + 1; return acc;
  }, {});
  const pieData = Object.entries(byComplexity).map(([name, value]) => ({ name, value }));
  const totalRoutingSavings = decisions.reduce((s, d) => s + (d.savings_usd || 0), 0);

  return (
    <div data-testid="page-routing">
      <PageHeader title="Routing Intelligence" subtitle="Every request is classified and routed to the cheapest model that meets quality SLAs." testId="routing-header" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard testId="stat-routed" label="Routing decisions (30d)" value={fmtInt(decisions.length)} />
        <StatCard testId="stat-routing-savings" label="Routing savings (30d)" value={fmtUsd(totalRoutingSavings)} accent="text-emerald-400" />
        <StatCard testId="stat-vs-gpt4o" label="Avg saved per request" value={fmtUsd(decisions.length ? totalRoutingSavings / decisions.length : 0)} sub="vs. always-on GPT-4o baseline" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Complexity distribution</div>
          <div className="font-heading text-xl font-semibold mt-1 mb-4">Task complexity mix</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={60} stroke="#09090B" strokeWidth={2}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#09090B", border: "1px solid #27272A", borderRadius: 6, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Requests by model</div>
          <div className="font-heading text-xl font-semibold mt-1 mb-4">Model selection</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={(usage?.by_model || []).slice(0, 8)} layout="vertical">
              <CartesianGrid stroke="#27272A" horizontal={false} />
              <XAxis type="number" stroke="#71717A" fontSize={10} />
              <YAxis type="category" dataKey="model" stroke="#A1A1AA" fontSize={10} width={170} />
              <Tooltip contentStyle={{ background: "#09090B", border: "1px solid #27272A", borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="requests" fill="#3B82F6" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-zinc-800 rounded-md bg-zinc-950" data-testid="routing-table">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Latest decisions</div>
            <div className="font-heading text-lg font-semibold mt-0.5">Routing decision log</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 mono">{decisions.length} entries</span>
            <Button data-testid="export-routing" size="sm" variant="outline" className="border-zinc-700 text-xs h-8"
              onClick={() => downloadCsv(`routing-decisions-${orgId}.csv`, decisions)}>
              <Download className="w-3 h-3 mr-1.5" /> CSV
            </Button>
          </div>
        </div>
        <div className="overflow-auto max-h-[600px]">
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
              {decisions.slice(0, 100).map(d => (
                <tr key={d.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                  <td className="px-5 py-3 mono text-xs text-zinc-500 whitespace-nowrap">{d.timestamp?.slice(11, 19)}</td>
                  <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 rounded-md border border-zinc-700 text-zinc-300">{d.task}</span></td>
                  <td className="px-5 py-3 text-xs">{d.complexity}</td>
                  <td className="px-5 py-3 mono text-xs">{d.provider}/{d.model}</td>
                  <td className="px-5 py-3 text-right mono text-xs">{fmtUsd(d.cost_usd)}</td>
                  <td className="px-5 py-3 text-right mono text-xs text-emerald-400">{fmtUsd(d.savings_usd)}</td>
                  <td className="px-5 py-3 text-xs text-zinc-400 max-w-md truncate">{d.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
