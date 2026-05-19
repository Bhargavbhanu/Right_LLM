import React, { useEffect, useState } from "react";
import { getRoutingDecisions, getActions } from "../lib/api";
import { Zap, Bot, Database, ArrowDownCircle, RefreshCw, ShieldOff } from "lucide-react";

const ACTION_ICON = {
  rerouted_traffic: RefreshCw,
  downgraded_model: ArrowDownCircle,
  activated_cache: Database,
  failover: ShieldOff,
};

export default function LiveTicker() {
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const [decs, acts] = await Promise.all([getRoutingDecisions(10), getActions()]);
      const merged = [
        ...acts.slice(0, 3).map(a => ({ type: "action", icon: ACTION_ICON[a.type] || Bot, label: a.summary, ts: a.timestamp })),
        ...decs.slice(0, 12).map(d => ({
          type: "decision", icon: Zap,
          label: `Routed ${d.task} → ${d.provider}/${d.model} · saved $${(d.savings_usd || 0).toFixed(4)}`,
          ts: d.timestamp,
        })),
      ].sort((a, b) => (b.ts || "").localeCompare(a.ts || "")).slice(0, 15);
      setItems(merged);
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  if (!items.length) return null;

  // Duplicate items so the marquee loops seamlessly
  const loop = [...items, ...items];

  return (
    <div className="ticker-wrap border border-zinc-800 rounded-md bg-zinc-950 overflow-hidden" data-testid="live-ticker">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-zinc-800 bg-zinc-950">
        <span className="status-dot" style={{ color: "#22C55E", background: "#22C55E" }} />
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">Live · Gateway activity</span>
        <span className="ml-auto text-[10px] text-zinc-600 mono">refreshes every 8s</span>
      </div>
      <div className="ticker-track flex items-center gap-8 py-2.5 px-4">
        {loop.map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={i} className="flex items-center gap-2 text-xs whitespace-nowrap text-zinc-300">
              <Icon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>{it.label}</span>
              <span className="text-zinc-600 mono">·</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
