import React from "react";

export default function PageHeader({ title, subtitle, right, testId, kicker }) {
  return (
    <div
      className="flex items-end justify-between gap-4 pb-5 mb-6 border-b border-zinc-800/80"
      data-testid={testId}
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-2 font-medium">
          {kicker || `Right LLM / ${title}`}
        </div>
        <h1 className="font-heading text-2xl md:text-3xl lg:text-[2rem] font-bold tracking-tight leading-[1.05]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-zinc-400 mt-2.5 max-w-2xl leading-relaxed">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}

// Back-compat StatCard export — re-export new component
export { StatCard } from "./Card";
