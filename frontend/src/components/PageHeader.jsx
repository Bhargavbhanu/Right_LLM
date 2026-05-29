import React from "react";

export default function PageHeader({ title, subtitle, right, testId, kicker }) {
  return (
    <div
      className="relative flex items-end justify-between gap-4 pb-5 mb-6 border-b border-zinc-800/80"
      data-testid={testId}
    >
      {/* Subtle gradient accent on bottom border (left-aligned) */}
      <div
        className="absolute left-0 bottom-0 h-px w-40 pointer-events-none"
        style={{ background: "linear-gradient(90deg, rgba(99,102,241,0.5), rgba(59,130,246,0.25), transparent)" }}
      />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-2 font-medium inline-flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(99,102,241,0.7)]" />
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
