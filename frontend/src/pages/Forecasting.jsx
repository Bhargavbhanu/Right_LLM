import React, { useEffect, useState } from "react";
import PageHeader, { StatCard } from "../components/PageHeader";
import { getForecast, fmtUsd } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const TT = { contentStyle: { background: "#09090B", border: "1px solid #27272A", borderRadius: 6, fontSize: 12 } };

export default function Forecasting() {
  const { orgId } = useOrg();
  const [d, setD] = useState(null);
  useEffect(() => { getForecast().then(setD).catch(() => {}); }, [orgId]);
  return (
    <div data-testid="page-forecasting">
      <PageHeader title="Forecasting" subtitle="Projected AI spend over the next 90 days with 95% confidence intervals." testId="forecasting-header" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard testId="fc-runrate" label="Daily run rate" value={fmtUsd(d?.current_run_rate_usd_per_day || 0)} sub={`growth ${((d?.growth_factor_daily || 1) * 100 - 100).toFixed(2)}%/day`} />
        <StatCard testId="fc-30d" label="30-day forecast" value={fmtUsd(d?.forecast_30d_total_usd || 0)} accent="text-blue-400" />
        <StatCard testId="fc-60d" label="60-day forecast" value={fmtUsd(d?.forecast_60d_total_usd || 0)} accent="text-blue-400" />
        <StatCard testId="fc-90d" label="90-day forecast" value={fmtUsd(d?.forecast_90d_total_usd || 0)} accent="text-blue-400" />
      </div>

      <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Spend forecast · 90 days</div>
        <div className="font-heading text-xl font-semibold mt-1 mb-4">Predicted daily spend with confidence band</div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={d?.forecast || []}>
            <defs>
              <linearGradient id="ci" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#27272A" vertical={false} />
            <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={(x) => x?.slice(5)} />
            <YAxis stroke="#71717A" fontSize={10} tickFormatter={(v) => `$${v.toFixed(0)}`} />
            <Tooltip {...TT} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#A1A1AA" }} />
            <Area type="monotone" dataKey="ci_high" stroke="none" fill="url(#ci)" name="CI high" />
            <Area type="monotone" dataKey="ci_low" stroke="none" fill="#09090B" name="CI low" />
            <Line type="monotone" dataKey="predicted_usd" stroke="#FAFAFA" strokeWidth={2} dot={false} name="Predicted" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
