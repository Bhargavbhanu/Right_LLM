import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { getRecommendations, actOnRecommendation, fmtUsd } from "../lib/api";
import { Button } from "../components/ui/button";
import { Lightbulb, Check, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const CATEGORY = {
  routing:      { color: "text-blue-400 border-blue-900",       label: "Routing" },
  cache:        { color: "text-emerald-400 border-emerald-900", label: "Cache" },
  optimization: { color: "text-purple-400 border-purple-900",   label: "Optimization" },
  governance:   { color: "text-orange-400 border-orange-900",   label: "Governance" },
};

export default function Recommendations() {
  const [recs, setRecs] = useState([]);
  const load = () => getRecommendations().then(setRecs).catch(() => {});
  useEffect(() => { load(); }, []);

  const act = async (id, action) => {
    await actOnRecommendation(id, action);
    toast.success(`Recommendation ${action}ed`);
    load();
  };

  const totalPotential = recs.filter(r => r.status === "pending").reduce((s, r) => s + (r.estimated_monthly_savings_usd || 0), 0);

  return (
    <div data-testid="page-recommendations">
      <PageHeader
        title="Recommendations"
        subtitle="AI-driven optimization opportunities ranked by projected monthly savings."
        right={
          <div className="px-3 py-1.5 rounded-md border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" /> Potential: <span className="font-bold mono">{fmtUsd(totalPotential)}/mo</span>
          </div>
        }
        testId="rec-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {recs.map(r => {
          const cat = CATEGORY[r.category] || CATEGORY.routing;
          return (
            <div key={r.id} data-testid={`rec-${r.id}`}
              className={`border rounded-md p-5 bg-zinc-950 transition-colors duration-200 ${
                r.status === "pending" ? "border-zinc-800 hover:border-zinc-600" : "border-zinc-900 opacity-60"
              }`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div>
                    <div className="font-heading text-lg font-semibold leading-tight">{r.title}</div>
                    <span className={`text-[10px] uppercase tracking-[0.2em] mt-1 inline-block px-2 py-0.5 rounded border ${cat.color}`}>
                      {cat.label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">monthly</div>
                  <div className="font-heading text-2xl font-bold text-emerald-400 mono">{fmtUsd(r.estimated_monthly_savings_usd)}</div>
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">{r.description}</p>
              {r.status === "pending" ? (
                <div className="flex gap-2">
                  <Button size="sm" data-testid={`rec-${r.id}-accept`} onClick={() => act(r.id, "accept")} className="bg-white text-zinc-900 hover:bg-zinc-200">
                    <Check className="w-3.5 h-3.5 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" data-testid={`rec-${r.id}-dismiss`} onClick={() => act(r.id, "dismiss")} className="border-zinc-700">
                    <X className="w-3.5 h-3.5 mr-1" /> Dismiss
                  </Button>
                </div>
              ) : (
                <div className="text-xs text-zinc-500 mono uppercase tracking-[0.2em]">{r.status}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
