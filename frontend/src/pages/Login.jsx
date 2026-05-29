import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Sparkles, ArrowRight, Lock } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const next = loc.state?.from || "/";

  const [email, setEmail] = useState("admin@right-llm.dev");
  const [password, setPassword] = useState("RightLLM2026!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) nav(next, { replace: true });
    else setError(res.error || "Login failed");
  };

  return (
    <div className="min-h-screen flex grid-bg" data-testid="page-login">
      {/* Marketing/brand side */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 border-r border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ background: "radial-gradient(800px 400px at 0% 20%, rgba(99,102,241,0.18), transparent), radial-gradient(600px 320px at 100% 80%, rgba(34,197,94,0.10), transparent)" }} />
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-white to-zinc-200 flex items-center justify-center shadow-[0_0_24px_-4px_rgba(255,255,255,0.4)]">
              <Sparkles className="w-4 h-4 text-zinc-900" />
            </div>
            <div>
              <div className="font-heading font-bold text-base leading-none tracking-tight">Right LLM</div>
              <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 mt-1">Gateway · v0.3</div>
            </div>
          </div>

          <h1 className="font-heading text-3xl xl:text-4xl font-bold leading-tight tracking-tight max-w-md">
            The enterprise control plane for every LLM call.
          </h1>
          <p className="text-zinc-400 text-sm mt-4 max-w-md leading-relaxed">
            Smart routing, semantic caching and budget governance cut your AI bill 30–60%
            without re-architecting a line of your app.
          </p>

          <ul className="mt-8 space-y-2.5 text-sm text-zinc-300 max-w-md">
            {[
              "15 models across 7 providers — routed per request",
              "L1 + L2 semantic cache with similarity tuning",
              "Hard / soft budget caps · RBAC · audit trail",
              "Forecasting · TIPE analyzer · migration sims",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-[11px] text-zinc-500 mono">
          $ curl /api/gateway/stream — OpenAI-compatible · drop-in
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-white to-zinc-200 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
            </div>
            <div className="font-heading font-bold text-[15px] tracking-tight">Right LLM</div>
          </div>

          <div className="mb-7">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Sign in</div>
            <h2 className="font-heading text-2xl font-semibold mt-2 tracking-tight">Welcome back</h2>
            <p className="text-xs text-zinc-500 mt-1.5">Enter your credentials to access the gateway.</p>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email"
                className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-600 mt-1.5 h-10"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-600 mt-1.5 h-10"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div data-testid="login-error" className="text-xs text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              data-testid="login-submit"
              disabled={busy}
              className="btn-shine w-full h-10 bg-zinc-50 text-zinc-900 hover:bg-white font-medium"
            >
              {busy ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 mr-2 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 mr-2" /> Sign in
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-zinc-500">
            New here?{" "}
            <Link to="/register" className="text-zinc-200 hover:text-white underline-offset-4 hover:underline inline-flex items-center gap-1" data-testid="login-to-register">
              Create an account <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-800/80 text-[11px] text-zinc-600 leading-relaxed">
            <div className="text-zinc-400 font-medium mb-1">Demo credentials (pre-filled)</div>
            <div className="mono">admin@right-llm.dev · RightLLM2026!</div>
            <div className="mono mt-0.5">demo@right-llm.dev · DemoUser2026!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
