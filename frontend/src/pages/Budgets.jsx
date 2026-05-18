import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { getBudgets, fmtUsd, fmtPct } from "../lib/api";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { ShieldCheck, AlertTriangle, Ban } from "lucide-react";

const STATUS_STYLES = {
  healthy:    { color: "text-emerald-400", icon: ShieldCheck, label: "Healthy" },
  warning:    { color: "text-yellow-400", icon: AlertTriangle, label: "Warning" },
  soft_limit: { color: "text-orange-400", icon: AlertTriangle, label: "Soft limit" },
  blocked:    { color: "text-red-400",    icon: Ban,           label: "Blocked" },
};

export default function Budgets() {
  const [data, setData] = useState({ policies: [] });
  useEffect(() => { getBudgets().then(setData).catch(() => {}); }, []);
  const byScope = { org: [], team: [], user: [] };
  data.policies.forEach(p => byScope[p.scope]?.push(p));

  return (
    <div data-testid="page-budgets">
      <PageHeader title="Budget Governance" subtitle="Org / team / user budgets with hard & soft limits and RBAC policies." testId="budgets-header" />

      {["org", "team", "user"].map(scope => (
        <section key={scope} className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">{scope} budgets</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(byScope[scope] || []).map(p => {
              const s = STATUS_STYLES[p.status] || STATUS_STYLES.healthy;
              const Icon = s.icon;
              return (
                <div key={p.id} className="border border-zinc-800 rounded-md p-5 bg-zinc-950" data-testid={`budget-${p.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-heading text-lg font-semibold">{p.name}</div>
                      <div className="text-xs text-zinc-500 mono mt-1">{p.scope_id}</div>
                    </div>
                    <Badge variant="outline" className={`border-zinc-700 ${s.color}`}>
                      <Icon className="w-3 h-3 mr-1" /> {s.label}
                    </Badge>
                  </div>
                  <div className="text-2xl font-heading font-bold mono">{fmtUsd(p.used_usd)} <span className="text-sm text-zinc-500 font-normal">/ {fmtUsd(p.monthly_limit_usd)}</span></div>
                  <div className="mt-3 mb-2"><Progress value={Math.min(100, p.burn_pct * 100)} className="h-2 bg-zinc-900" /></div>
                  <div className="text-xs text-zinc-500">{fmtPct(p.burn_pct)} burned · soft limit at {fmtPct(p.soft_pct)}</div>
                  {p.rbac_rules?.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-800">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">RBAC policies</div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.rbac_rules.map((r, i) => (
                          <span key={i} className="text-[10px] mono px-2 py-1 rounded-md border border-zinc-700 text-zinc-300 bg-zinc-900">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
