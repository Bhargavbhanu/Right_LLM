import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { getActions } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { Bot, RefreshCw, ArrowDownCircle, Database, ShieldOff } from "lucide-react";

const ICON = {
  rerouted_traffic: RefreshCw,
  downgraded_model: ArrowDownCircle,
  activated_cache: Database,
  failover: ShieldOff,
};

export default function Actions() {
  const { orgId } = useOrg();
  const [items, setItems] = useState([]);
  useEffect(() => { getActions().then(setItems).catch(() => {}); }, [orgId]);
  return (
    <div data-testid="page-actions">
      <PageHeader title="Autonomous Actions" subtitle="Monitor → Analyze → Decide → Execute. Every action is logged, reversible, and auditable." testId="actions-header" />
      <div className="border-l-2 border-zinc-800 ml-3 pl-6 space-y-6" data-testid="actions-feed">
        {items.map(a => {
          const Icon = ICON[a.type] || Bot;
          return (
            <div key={a.id} className="relative" data-testid={`action-${a.id}`}>
              <div className="absolute -left-[31px] top-1 w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center">
                <Icon className="w-3 h-3 text-blue-400" />
              </div>
              <div className="border border-zinc-800 rounded-md p-5 bg-zinc-950">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mono">{a.timestamp?.replace("T", " ").slice(0, 19)}</span>
                  <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border ${
                    a.status === "active" ? "border-emerald-900 text-emerald-400" : "border-zinc-700 text-zinc-400"
                  }`}>{a.status}</span>
                </div>
                <div className="font-heading text-base font-semibold">{a.summary}</div>
                <div className="text-sm text-zinc-400 mt-2">↳ {a.outcome}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mt-3">
                  type: {a.type} · reversible: {String(a.reversible)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
