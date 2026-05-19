import React from "react";
import PageHeader from "../components/PageHeader";
import {
  Sparkles, Database, Route as RouteIcon, Wand2, Shield, Brain, Bot, Repeat,
  Zap, Building2, Code2, BookOpen, ArrowRight, CheckCircle2, Server, BarChart3,
} from "lucide-react";

const ENGINES = [
  { icon: Database, title: "Semantic Cache",
    desc: "L1 exact-match (in-memory) + L2 cosine-similarity (256-dim embeddings). Default threshold 0.92. Repeated or near-duplicate prompts never hit a paid LLM. Saves ~$3–$15K/mo per large workload.",
    perks: ["L1 + L2 layered cache", "Confidence-scored hits", "Adjustable similarity slider", "Per-prompt hit-count analytics"] },
  { icon: RouteIcon, title: "Intelligent Routing",
    desc: "Classifies every request by task (summarization, classification, extraction, reasoning, coding, RAG, conversational) and complexity (simple → critical), then routes to the cheapest model that meets your quality floor.",
    perks: ["7 task types · 4 complexity tiers", "Quality-floor + cost-aware selection", "Provider failover + weighted splits", "Auto-skips unconfigured providers"] },
  { icon: Wand2, title: "Prompt Optimization",
    desc: "Strips filler tokens ('please', 'as an AI…'), collapses whitespace, prunes context beyond relevance window, summarizes long history. 20–40% token reduction per request with no quality loss.",
    perks: ["Filler / boilerplate removal", "Whitespace + repetition collapse", "Context pruning", "Quality-delta tracking"] },
  { icon: Shield, title: "Budget Governance",
    desc: "Hard + soft monthly limits at org, team and user scope. RBAC rules block specific models per role (e.g. 'interns cannot use GPT-4o', 'max 2K tokens for free tier').",
    perks: ["Org · Team · User scopes", "Soft → downgrade · Hard → block", "RBAC model deny-lists", "Real-time burn tracking"] },
  { icon: Brain, title: "Decision Engine",
    desc: "The orchestrator. Every request runs: cache lookup → task classify → optimize prompt → check policy → select provider → call LLM → log. Every decision is auditable with full reasoning.",
    perks: ["End-to-end orchestration", "Per-request reasoning trail", "OpenAI-compatible interface", "Multi-turn aware"] },
  { icon: Repeat, title: "Continuous Learning",
    desc: "Tracks outcomes — quality, latency, cost, cache hit-rate. Re-weights routing decisions in real time. Detects anomalies (latency spikes, error surges) and pre-warms cache for likely repeated prompts.",
    perks: ["Per-model success scoring", "Latency-anomaly detection", "Predictive cache pre-warm", "Routing weight updates"] },
  { icon: Bot, title: "Autonomous Actions",
    desc: "Monitor → analyze → decide → execute, no human in the loop. Auto-reroutes on provider degradation, auto-downgrades on budget burn, auto-activates cache when clusters detected. All actions reversible + audited.",
    perks: ["Provider auto-failover", "Auto model downgrade", "Auto cache activation", "Full reversible audit trail"] },
];

const PAGES = [
  { name: "Overview",            what: "Real-time savings, cache hit rate, token reduction, autonomous-action count, daily spend chart, model distribution, live feed." },
  { name: "Routing Intelligence",what: "Every routing decision with reasoning. Complexity-distribution pie + model-selection bar chart. CSV export." },
  { name: "Semantic Cache",      what: "Hit-rate trend, similarity-threshold tuner, live cache probe, top-hit prompts. CSV export." },
  { name: "Budget Governance",   what: "Org / team / user budgets with burn %, status badges, RBAC rules." },
  { name: "Forecasting",         what: "30 / 60 / 90-day spend forecast with confidence intervals + daily run rate + growth trend." },
  { name: "Recommendations",     what: "AI-driven cost-saving actions (move workload, enable cache, tighten prompts, downgrade tier). Accept / dismiss CTA mutates routing." },
  { name: "Provider Analytics",  what: "Live health grid for 7 providers. Full 15-model pricing table with quality / latency / tier." },
  { name: "Autonomous Actions",  what: "Live timeline feed of decisions the system made on its own (reroutes, downgrades, failovers)." },
  { name: "Optimization Log",    what: "Every before / after token count, compression ratio, quality delta. CSV export." },
  { name: "TIPE Analyzer",       what: "Paste any prompt → predicted output tokens + per-model cost grid across 15 models. Highlights recommended replacement." },
  { name: "Advisor Tools",       what: "Migration Simulation (from→to: cost · quality · latency delta) + AI Model Advisor (objective + task + budget → ranked picks)." },
  { name: "Playground",          what: "OpenAI-compatible drop-in. Live streaming tokens, real-time cost meter, full routing-decision trace." },
];

const BENEFITS = [
  { icon: Zap,         title: "30–60% cost cut",                desc: "Without re-architecting your app. Drop-in compatible with the OpenAI API." },
  { icon: Shield,      title: "Hard governance, soft ceilings", desc: "Stop overruns before they happen. Per-team caps, per-role model deny-lists, full audit trail." },
  { icon: BarChart3,   title: "Forecast-grade observability",   desc: "30 / 60 / 90-day spend predictions with confidence bands. Attribution per org / team / user / model." },
  { icon: Server,      title: "Multi-provider failover",        desc: "One vendor goes down → traffic auto-reroutes inside 90 seconds. Zero downtime risk." },
  { icon: Building2,   title: "Multi-tenant, day one",          desc: "Workspace isolation, org-scoped budgets, RBAC. Built for the enterprise control plane." },
  { icon: CheckCircle2,title: "Compliance & auditability",      desc: "Every decision logged with reasoning. Every autonomous action reversible. SOC2-ready trail." },
];

const Section = ({ title, kicker, children, testId }) => (
  <section className="mb-12" data-testid={testId}>
    {kicker && <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">{kicker}</div>}
    <h2 className="font-heading text-2xl font-semibold tracking-tight mb-5">{title}</h2>
    {children}
  </section>
);

export default function Guide() {
  return (
    <div data-testid="page-guide">
      <PageHeader
        title="Guide"
        subtitle="Everything Right LLM does, why it matters to enterprise customers, and how to plug it in."
        right={
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-800 text-xs text-zinc-400">
            <BookOpen className="w-3.5 h-3.5" /> v0.2.0 · last updated today
          </div>
        }
        testId="guide-header"
      />

      {/* HERO */}
      <div className="relative border border-zinc-800 rounded-md bg-gradient-to-br from-zinc-950 via-zinc-950 to-blue-950/20 p-8 md:p-12 mb-12 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-blue-400">Right LLM · Enterprise Gateway</span>
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
            Cut your LLM bill in half.<br/>
            <span className="text-blue-400">Without changing a line of business logic.</span>
          </h1>
          <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-3xl">
            Right LLM sits between your apps and the LLM providers. It caches repeat prompts, routes every call to the cheapest model that meets your quality floor, compresses tokens, enforces budgets, and reverses provider outages on its own — all behind an OpenAI-compatible endpoint.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-950 text-xs mono text-zinc-300">POST /api/gateway/chat</div>
            <div className="px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-950 text-xs mono text-zinc-300">POST /api/gateway/stream</div>
            <div className="px-3 py-1.5 rounded-md border border-emerald-900 bg-emerald-950/30 text-xs text-emerald-300">SOC2-ready audit</div>
            <div className="px-3 py-1.5 rounded-md border border-blue-900 bg-blue-950/30 text-xs text-blue-300">15 models · 7 providers</div>
          </div>
        </div>
      </div>

      {/* ENTERPRISE VALUE */}
      <Section kicker="Why it matters" title="What enterprise teams get out of it" testId="guide-benefits">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BENEFITS.map((b, i) => (
            <div key={i} className="border border-zinc-800 rounded-md p-5 bg-zinc-950 hover:border-zinc-600 transition-colors duration-200">
              <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
                <b.icon className="w-4 h-4 text-blue-400" />
              </div>
              <div className="font-heading text-lg font-semibold mb-1.5">{b.title}</div>
              <p className="text-sm text-zinc-400 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* THE 7 ENGINES */}
      <Section kicker="Under the hood" title="The 7 engines that do the work" testId="guide-engines">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ENGINES.map((e, i) => (
            <div key={i} className="border border-zinc-800 rounded-md p-5 bg-zinc-950" data-testid={`guide-engine-${i}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                  <e.icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Engine 0{i + 1}</div>
                  <div className="font-heading text-lg font-semibold mt-0.5">{e.title}</div>
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">{e.desc}</p>
              <ul className="space-y-1.5">
                {e.perks.map((p, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-zinc-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* REQUEST PIPELINE */}
      <Section kicker="How a request flows" title="The Decision Engine pipeline" testId="guide-pipeline">
        <div className="border border-zinc-800 rounded-md p-6 bg-zinc-950">
          <ol className="space-y-3">
            {[
              ["Ingest", "Your app calls POST /api/gateway/chat — same shape as OpenAI's /v1/chat/completions. Multi-turn aware."],
              ["Semantic Cache check", "L1 exact-match, then L2 cosine-similarity against the prompt store. If similarity ≥ threshold → return cached response. Zero LLM call."],
              ["Prompt Optimization", "Filler stripping, whitespace collapse, context pruning. Token count typically drops 20-40%."],
              ["Budget & Policy", "Check org/team/user budgets. If burn > soft limit → auto-downgrade tier. If RBAC blocks model → switch."],
              ["Routing decision", "Classify task complexity, pick cheapest model that clears the quality floor. Logged with full reasoning."],
              ["Provider call", "Async LiteLLM-style call. Failover ready. Latency-bound."],
              ["Persist + learn", "Token usage, decision, optimization stats, and outcome go to MongoDB. Cache entry indexed for L2."],
              ["Stream back", "SSE response with token chunks, live cost meter, and a metadata header you can use for in-app cost UI."],
            ].map(([title, desc], i) => (
              <li key={i} className="flex items-start gap-4 group">
                <div className="font-heading text-2xl font-bold text-zinc-700 group-hover:text-blue-400 mono w-10 shrink-0 transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="border-l border-zinc-800 pl-4 pb-2 flex-1">
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="text-xs text-zinc-400 leading-relaxed mt-1">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* THE 12 DASHBOARD PAGES */}
      <Section kicker="Inside the dashboard" title="What each of the 12 pages does" testId="guide-pages">
        <div className="border border-zinc-800 rounded-md bg-zinc-950 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              <tr>
                <th className="text-left px-5 py-3 w-48">Page</th>
                <th className="text-left px-5 py-3">What it shows</th>
              </tr>
            </thead>
            <tbody>
              {PAGES.map((p, i) => (
                <tr key={i} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/50">
                  <td className="px-5 py-3 font-medium">{p.name}</td>
                  <td className="px-5 py-3 text-zinc-400 leading-relaxed">{p.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* INTEGRATION */}
      <Section kicker="Get started" title="Drop-in integration in 30 seconds" testId="guide-integration">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-zinc-800 rounded-md bg-zinc-950 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">cURL</span>
              <Code2 className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <pre className="p-5 text-xs mono text-zinc-300 overflow-auto leading-relaxed">
{`curl -X POST https://your-gateway/api/gateway/chat \\
  -H 'Content-Type: application/json' \\
  -d '{
    "messages": [
      {"role": "user", "content": "Classify: I love this product!"}
    ],
    "use_cache": true,
    "similarity_threshold": 0.92,
    "quality_floor": 0.78
  }'`}
            </pre>
          </div>

          <div className="border border-zinc-800 rounded-md bg-zinc-950 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Python (OpenAI-compatible)</span>
              <Code2 className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <pre className="p-5 text-xs mono text-zinc-300 overflow-auto leading-relaxed">
{`from openai import OpenAI

# point any OpenAI SDK at the Right LLM gateway
client = OpenAI(
  base_url="https://your-gateway/api/gateway",
  api_key="rightllm-…",
)

resp = client.chat.completions.create(
  model="auto",  # Right LLM picks the right model
  messages=[{"role":"user","content":"…"}],
)`}
            </pre>
          </div>

          <div className="border border-zinc-800 rounded-md bg-zinc-950 overflow-hidden lg:col-span-2">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">JavaScript · Streaming (SSE)</span>
              <Code2 className="w-3.5 h-3.5 text-zinc-500" />
            </div>
            <pre className="p-5 text-xs mono text-zinc-300 overflow-auto leading-relaxed">
{`const res = await fetch('/api/gateway/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Write a haiku.' }],
    use_cache: true,
  }),
});
const reader = res.body.getReader();
const dec = new TextDecoder();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log(dec.decode(value));  // 'event: token\\ndata: {"text":"…"}\\n\\n'
}`}
            </pre>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section kicker="Common questions" title="FAQ" testId="guide-faq">
        <div className="space-y-3">
          {[
            ["Is this a drop-in for the OpenAI API?",
              "Yes. /api/gateway/chat accepts the same body shape as POST /v1/chat/completions. Point any OpenAI SDK at it and you're done."],
            ["What happens to my data?",
              "Prompts and responses are stored only for cache + analytics inside your tenant. Nothing is sent to third parties beyond the LLM provider you selected. Full audit log per request."],
            ["How do you guarantee quality won't drop?",
              "Every model has a quality score, and routing respects a configurable quality_floor. Optimization tracks a quality_delta — if compression ever degrades output, the engine learns and backs off."],
            ["What's the latency overhead?",
              "Typically 3–8 ms for cache lookup + routing + optimization. Network call to provider dominates everything else. SSE streaming means TTFB is no worse than the provider."],
            ["Can we self-host?",
              "Yes. Helm chart + Docker Compose are in /app/deploy. MongoDB + a single container per service. Horizontal scaling via the included HPA."],
            ["Which providers are supported?",
              "Live today via Emergent Universal Key: OpenAI, Anthropic, Gemini. Adapter stubs (need keys) for Groq, Ollama, AWS Bedrock, Azure OpenAI. All 7 appear in TIPE Analyzer + Advisor with public pricing."],
            ["How is multi-tenancy enforced?",
              "Every collection is scoped by org_id. The workspace switcher in the sidebar swaps the active org; every API call carries the org_id in query + body. RBAC and budgets enforce per-team + per-user limits."],
          ].map(([q, a], i) => (
            <details key={i} className="border border-zinc-800 rounded-md bg-zinc-950 group" data-testid={`faq-${i}`}>
              <summary className="px-5 py-4 cursor-pointer text-sm font-medium flex items-center justify-between hover:bg-zinc-900/50 transition-colors">
                <span>{q}</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-open:rotate-90 transition-transform" />
              </summary>
              <div className="px-5 pb-5 pt-1 text-sm text-zinc-400 leading-relaxed">{a}</div>
            </details>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <div className="border border-zinc-800 rounded-md bg-zinc-950 p-8 text-center">
        <Sparkles className="w-6 h-6 text-blue-400 mx-auto mb-3" />
        <h3 className="font-heading text-xl font-semibold mb-2">Ready to wire it in?</h3>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto mb-5">
          Open the Playground, fire a real request, and watch the routing decision, cache check, optimization stats and live token stream all in one pane.
        </p>
        <a href="/playground" data-testid="guide-cta-playground"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition-colors">
          Go to Playground <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}
