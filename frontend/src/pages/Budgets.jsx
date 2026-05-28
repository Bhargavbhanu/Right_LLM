import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "../components/PageHeader";
import { Surface, Pill } from "../components/Card";
import { getBudgets, fmtUsd, fmtPct } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { Progress } from "../components/ui/progress";
import { ShieldCheck, AlertTriangle, Ban, Wallet } from "lucide-react";

const STATUS_STYLES = {
  healthy:    { pill: "emerald", icon: ShieldCheck,    label: "Healthy",    bar: "bg-emerald-500" },
  warning:    { pill: "amber",   icon: AlertTriangle,  label: "Warning",    bar: "bg-amber-500" },
  soft_limit: { pill: "amber",   icon: AlertTriangle,  label: "Soft limit", bar: "bg-amber-500" },
  blocked:    { pill: "rose",    icon: Ban,            label: "Blocked",    bar: "bg-rose-500" },
};

const SCOPE_LABELS = {
  org:  "Organization budgets",
  team: "Team budgets",
  user: "User budgets",
};

export default function Budgets() {
  const { orgId } = useOrg();
  const [data, setData] = useState({ policies: [] });

  useEffect(() => {
    getBudgets().then(setData).catch(() => {});
  }, [orgId]);

  const byScope = useMemo(() => {
    const out = { org: [], team: [], user: [] };
    data.policies.forEach((p) => out[p.scope]?.push(p));
    return out;
  }, [data]);

  const totalUsed = data.policies.filter((p) => p.scope === "org").reduce((s, p) => s + (p.used_usd || 0), 0);
  const totalLimit = data.policies.filter((p) => p.scope === "org").reduce((s, p) => s + (p.monthly_limit_usd || 0), 0);

  return (
    <div data-testid="page-budgets">
      <PageHeader
        title="Budget Governance"
        subtitle="Organization, team and user budgets with hard & soft limits, RBAC policies and auto-downgrade triggers."
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="zinc"><Wallet className="w-3 h-3" />{fmtUsd(totalUsed)} / {fmtUsd(totalLimit)} org spend</Pill>
          </div>
        }
        testId="budgets-header"
      />

      {["org", "team", "user"].map((scope) => (
        <section key={scope} className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3 font-medium">
            {SCOPE_LABELS[scope]}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(byScope[scope] || []).map((p) => {
              const s = STATUS_STYLES[p.status] || STATUS_STYLES.healthy;
              const Icon = s.icon;
              const burnPct = Math.min(100, (p.burn_pct || 0) * 100);
              return (
                <Surface key={p.id} testId={`budget-${p.id}`} className="relative">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="min-w-0">
                      <div className="font-heading text-base font-semibold text-zinc-100 truncate">{p.name}</div>
                      <div className="text-[11px] text-zinc-500 mono mt-0.5 truncate">{p.scope_id}</div>
                    </div>
                    <Pill color={s.pill}>
                      <Icon className="w-3 h-3" />
                      {s.label}
                    </Pill>
                  </div>

                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="font-heading text-2xl font-bold mono tabular-nums">{fmtUsd(p.used_usd)}</span>
                    <span className="text-xs text-zinc-500">/ {fmtUsd(p.monthly_limit_usd)} mo</span>
                  </div>

                  {/* Custom progress bar — uses status color */}
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden mb-2">
                    <div
                      className={`h-full ${s.bar} transition-all duration-500`}
                      style={{ width: `${burnPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{fmtPct(p.burn_pct)} burned</span>
                    <span>soft @ {fmtPct(p.soft_pct)}</span>
                  </div>

                  {p.rbac_rules?.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-zinc-800/80">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-medium">RBAC policies</div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.rbac_rules.map((r, i) => (
                          <span key={i} className="text-[10px] mono px-2 py-1 rounded-md border border-zinc-800 text-zinc-300 bg-zinc-950">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Surface>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
