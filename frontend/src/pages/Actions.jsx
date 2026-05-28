import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { Surface, Pill, EmptyState } from "../components/Card";
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

  useEffect(() => {
    getActions().then(setItems).catch(() => {});
  }, [orgId]);

  const activeCount = items.filter((a) => a.status === "active").length;

  return (
    <div data-testid="page-actions">
      <PageHeader
        title="Autonomous Actions"
        subtitle="Monitor → Analyze → Decide → Execute. Every action is logged, reversible and auditable."
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="emerald"><Bot className="w-3 h-3" />{activeCount} active</Pill>
            <Pill color="zinc">{items.length} total</Pill>
          </div>
        }
        testId="actions-header"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Bot className="w-5 h-5" />}
          title="No autonomous actions yet"
          description="The action engine will fire once threshold-based triggers fire (e.g. budget burn ≥ 80%, error rate spike, latency P95 regression)."
        />
      ) : (
        <div className="border-l-2 border-zinc-800 ml-3 pl-6 space-y-5" data-testid="actions-feed">
          {items.map((a) => {
            const Icon = ICON[a.type] || Bot;
            return (
              <div key={a.id} className="relative" data-testid={`action-${a.id}`}>
                <div className="absolute -left-[31px] top-3 w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center shadow-[0_0_0_3px_rgba(9,9,11,1)]">
                  <Icon className="w-3 h-3 text-blue-400" />
                </div>
                <Surface>
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mono">
                      {a.timestamp?.replace("T", " ").slice(0, 19)}
                    </span>
                    <Pill color={a.status === "active" ? "emerald" : "zinc"}>
                      {a.status}
                    </Pill>
                  </div>
                  <div className="font-heading text-base font-semibold text-zinc-100">{a.summary}</div>
                  <div className="text-[13px] text-zinc-400 mt-2 leading-relaxed">↳ {a.outcome}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mt-3 flex items-center gap-3">
                    <span>type: <span className="text-zinc-400 mono">{a.type}</span></span>
                    <span>reversible: <span className="text-zinc-400 mono">{String(a.reversible)}</span></span>
                  </div>
                </Surface>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
