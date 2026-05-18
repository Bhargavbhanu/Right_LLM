import React from "react";

export default function PageHeader({ title, subtitle, right, testId }) {
  return (
    <div className="flex items-end justify-between gap-4 pb-6 mb-6 border-b border-zinc-800" data-testid={testId}>
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">
          Right LLM / {title}
        </div>
        <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-zinc-400 mt-3 max-w-2xl">{subtitle}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, accent, testId }) {
  return (
    <div
      data-testid={testId}
      className="border border-zinc-800 bg-zinc-950 rounded-md p-5 transition-colors duration-200 hover:border-zinc-600"
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div className={`mt-3 font-heading text-3xl font-bold tracking-tight ${accent || "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-1.5">{sub}</div>}
    </div>
  );
}
