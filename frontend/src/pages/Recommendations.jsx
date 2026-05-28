import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { Surface, Pill, EmptyState } from "../components/Card";
import { getRecommendations, actOnRecommendation, fmtUsd } from "../lib/api";
import { useOrg } from "../lib/OrgContext";
import { Button } from "../components/ui/button";
import { Lightbulb, Check, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const CATEGORY_COLOR = {
  routing:      { pill: "blue",    label: "Routing" },
  cache:        { pill: "emerald", label: "Cache" },
  optimization: { pill: "violet",  label: "Optimization" },
  governance:   { pill: "amber",   label: "Governance" },
};

export default function Recommendations() {
  const { orgId } = useOrg();
  const [recs, setRecs] = useState([]);

  const load = () => getRecommendations().then(setRecs).catch(() => {});
  useEffect(() => { load(); }, [orgId]);

  const act = async (id, action) => {
    await actOnRecommendation(id, action);
    toast.success(`Recommendation ${action}ed`);
    load();
  };

  const pendingRecs = recs.filter((r) => r.status === "pending");
  const totalPotential = pendingRecs.reduce((s, r) => s + (r.estimated_monthly_savings_usd || 0), 0);

  return (
    <div data-testid="page-recommendations">
      <PageHeader
        title="Recommendations"
        subtitle="AI-driven optimization opportunities ranked by projected monthly savings."
        right={
          <div className="px-3 py-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-xs flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Potential <span className="font-bold mono tabular-nums">{fmtUsd(totalPotential)}/mo</span>
          </div>
        }
        testId="rec-header"
      />

      {recs.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="w-5 h-5" />}
          title="No recommendations yet"
          description="The advisor will surface opportunities once it has at least 24h of routing data."
          testId="rec-empty"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recs.map((r) => {
            const cat = CATEGORY_COLOR[r.category] || CATEGORY_COLOR.routing;
            const isPending = r.status === "pending";
            return (
              <Surface
                key={r.id}
                testId={`rec-${r.id}`}
                className={`transition-opacity ${isPending ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-heading text-base font-semibold leading-snug text-zinc-100">{r.title}</div>
                      <div className="mt-1.5"><Pill color={cat.pill}>{cat.label}</Pill></div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Monthly</div>
                    <div className="font-heading text-xl font-bold text-emerald-400 mono tabular-nums leading-none mt-1">
                      {fmtUsd(r.estimated_monthly_savings_usd)}
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-zinc-400 leading-relaxed mb-4">{r.description}</p>
                {isPending ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      data-testid={`rec-${r.id}-accept`}
                      onClick={() => act(r.id, "accept")}
                      className="bg-zinc-50 text-zinc-900 hover:bg-white h-8"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`rec-${r.id}-dismiss`}
                      onClick={() => act(r.id, "dismiss")}
                      className="border-zinc-800 h-8 hover:bg-zinc-900"
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                    </Button>
                  </div>
                ) : (
                  <Pill color={r.status === "accepted" ? "emerald" : "zinc"}>
                    {r.status}
                  </Pill>
                )}
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
