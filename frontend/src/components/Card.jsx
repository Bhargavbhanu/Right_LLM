import React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

/**
 * Surface — the canonical card container used across the platform.
 * Refined dark enterprise look (Vercel + Datadog + Retool inspired).
 */
export function Surface({ className = "", children, hoverable = true, testId, padding = "p-5" }) {
  return (
    <div
      data-testid={testId}
      className={`surface ${hoverable ? "surface-hover" : ""} rounded-lg ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * StatCard — KPI card with optional delta, trend, sparkline children.
 * Props:
 *  - label, value, sub, accent
 *  - delta: number (e.g. 0.12 -> "+12%"). Direction inferred from sign unless `direction` provided
 *  - direction: "up" | "down" | "flat" — also controls color
 *  - positiveIsGood: bool (default true) — invert color for cost-like metrics if false
 *  - children: optional sparkline / extra slot below value
 */
export function StatCard({
  label,
  value,
  sub,
  accent,
  delta,
  direction,
  positiveIsGood = true,
  icon,
  testId,
  children,
  loading,
}) {
  const dir = direction || (typeof delta === "number" ? (delta > 0 ? "up" : delta < 0 ? "down" : "flat") : null);
  const good = dir === "up" ? positiveIsGood : dir === "down" ? !positiveIsGood : null;
  const deltaColor =
    good === true ? "text-emerald-400" : good === false ? "text-rose-400" : "text-zinc-400";
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;

  return (
    <Surface testId={testId} className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-medium">{label}</div>
        {icon ? <div className="text-zinc-600">{icon}</div> : null}
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        {loading ? (
          <div className="h-8 w-32 rounded shimmer" />
        ) : (
          <div
            data-testid={testId ? `${testId}-value` : undefined}
            className={`font-heading text-[1.75rem] leading-none font-bold tracking-tight ${accent || "text-white"}`}
          >
            {value}
          </div>
        )}
        {dir && typeof delta === "number" && !loading ? (
          <div className={`mono text-xs font-medium ${deltaColor} inline-flex items-center gap-0.5`}>
            <Icon className="w-3 h-3" />
            {Math.abs(delta * 100).toFixed(1)}%
          </div>
        ) : null}
      </div>
      {sub && <div className="text-xs text-zinc-500 mt-2">{sub}</div>}
      {children && <div className="mt-3">{children}</div>}
    </Surface>
  );
}

/**
 * SectionCard — a card with a header (title/subtitle) and body.
 * Used for charts, tables, lists.
 */
export function SectionCard({
  title,
  subtitle,
  right,
  children,
  className = "",
  bodyClassName = "",
  testId,
  padding = "p-5",
}) {
  return (
    <Surface testId={testId} padding="p-0" className={`overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div className="min-w-0">
          {title && (
            <div className="font-heading text-[15px] font-semibold text-zinc-100 tracking-tight">{title}</div>
          )}
          {subtitle && <div className="text-xs text-zinc-500 mt-1">{subtitle}</div>}
        </div>
        {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
      </div>
      <div className={`${padding === "p-0" ? "" : "px-5 pb-5"} ${bodyClassName}`}>{children}</div>
    </Surface>
  );
}

/**
 * EmptyState — consistent empty/idle state component with ambient gradient glow.
 */
export function EmptyState({ icon, title, description, action, testId }) {
  return (
    <div
      data-testid={testId}
      className="relative flex flex-col items-center justify-center text-center px-6 py-14 border border-dashed border-zinc-800 rounded-lg bg-zinc-950/40 overflow-hidden"
    >
      {/* Ambient gradient blob behind icon */}
      <div
        className="absolute inset-0 pointer-events-none ambient-blob"
        style={{
          background:
            "radial-gradient(360px 200px at 50% 30%, rgba(99,102,241,0.10), transparent 70%)",
        }}
      />
      {icon && (
        <div className="relative w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mb-4 float-soft shadow-[0_0_24px_-8px_rgba(99,102,241,0.4)]">
          {icon}
        </div>
      )}
      {title && <div className="relative font-heading text-sm font-semibold text-zinc-200">{title}</div>}
      {description && <div className="relative text-xs text-zinc-500 mt-1.5 max-w-sm leading-relaxed">{description}</div>}
      {action && <div className="relative mt-4">{action}</div>}
    </div>
  );
}

/**
 * Pill — small status / tag pill.
 */
export function Pill({ children, color = "zinc", className = "" }) {
  const colors = {
    zinc: "bg-zinc-900 text-zinc-300 border-zinc-800",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border ${colors[color] || colors.zinc} ${className}`}
    >
      {children}
    </span>
  );
}
