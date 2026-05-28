import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { StatCard, SectionCard } from "../components/Card";
import { getForecast, fmtUsd } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import { LineChart as LineChartIcon, TrendingUp } from "lucide-react";

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

export default function Forecasting() {
  const { orgId } = useOrg();
  const [d, setD] = useState(null);

  useEffect(() => {
    getForecast().then(setD).catch(() => {});
  }, [orgId]);

  const growthDailyPct = ((d?.growth_factor_daily || 1) * 100 - 100);

  return (
    <div data-testid="page-forecasting">
      <PageHeader
        title="Forecasting"
        subtitle="Projected AI spend over the next 90 days with daily growth-factor and confidence intervals."
        testId="forecasting-header"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          testId="fc-runrate"
          label="Daily run rate"
          value={fmtUsd(d?.current_run_rate_usd_per_day || 0)}
          sub={`growth ${growthDailyPct.toFixed(2)}%/day`}
          icon={<LineChartIcon className="w-4 h-4" />}
        />
        <StatCard
          testId="fc-30d"
          label="30-day forecast"
          value={fmtUsd(d?.forecast_30d_total_usd || 0)}
          accent="text-blue-400"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          testId="fc-60d"
          label="60-day forecast"
          value={fmtUsd(d?.forecast_60d_total_usd || 0)}
          accent="text-blue-400"
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          testId="fc-90d"
          label="90-day forecast"
          value={fmtUsd(d?.forecast_90d_total_usd || 0)}
          accent="text-blue-400"
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      <SectionCard
        testId="fc-chart"
        title="Spend forecast · 90 days"
        subtitle="Predicted daily spend with ~95% confidence band"
      >
        <ResponsiveContainer width="100%" height={420}>
          <ComposedChart data={d?.forecast || []} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="ci-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1F1F23" vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="date" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(x) => x?.slice(5)} />
            <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(0)}`} />
            <Tooltip {...TT} formatter={(v) => fmtUsd(v)} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#A1A1AA", paddingTop: 8 }} />
            <Area type="monotone" dataKey="ci_high" stroke="none" fill="url(#ci-grad)" name="CI band" />
            <Area type="monotone" dataKey="ci_low" stroke="none" fill="#0A0A0C" name="CI low" legendType="none" />
            <Line type="monotone" dataKey="predicted_usd" stroke="#FAFAFA" strokeWidth={2} dot={false} name="Predicted" />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}
