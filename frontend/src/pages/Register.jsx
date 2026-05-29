import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { api } from "../lib/api";
import { Sparkles, ArrowRight, UserPlus } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState("org_acme");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/orgs").then((r) => setOrgs(r.data || [])).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    const res = await register(email, password, name, orgId);
    setBusy(false);
    if (res.ok) nav("/", { replace: true });
    else setError(res.error || "Registration failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center grid-bg p-6" data-testid="page-register">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-white to-zinc-200 flex items-center justify-center shadow-[0_0_24px_-4px_rgba(255,255,255,0.4)]">
            <Sparkles className="w-4 h-4 text-zinc-900" />
          </div>
          <div>
            <div className="font-heading font-bold text-base leading-none tracking-tight">Right LLM</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 mt-1">Gateway · v0.3</div>
          </div>
        </div>

        <div className="mb-7 text-center">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-medium">Create account</div>
          <h2 className="font-heading text-2xl font-semibold mt-2 tracking-tight">Start saving in 60 seconds</h2>
          <p className="text-xs text-zinc-500 mt-1.5">Join an existing workspace or your team to start routing traffic.</p>
        </div>

        <form onSubmit={submit} className="space-y-4" data-testid="register-form">
          <div>
            <Label htmlFor="reg-name" className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 font-medium">Full name</Label>
            <Input id="reg-name" data-testid="register-name" value={name} onChange={(e) => setName(e.target.value)}
              className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-600 mt-1.5 h-10" required />
          </div>
          <div>
            <Label htmlFor="reg-email" className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 font-medium">Work email</Label>
            <Input id="reg-email" type="email" data-testid="register-email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-600 mt-1.5 h-10" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="reg-pw" className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 font-medium">Password</Label>
            <Input id="reg-pw" type="password" data-testid="register-password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-600 mt-1.5 h-10" required minLength={8} autoComplete="new-password" />
            <div className="text-[10px] text-zinc-600 mt-1">Min 8 characters</div>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 font-medium">Workspace</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger data-testid="register-org" className="bg-zinc-950 border-zinc-800 mt-1.5 h-10 hover:border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800">
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name} <span className="text-[10px] text-zinc-500 ml-2">{o.plan}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div data-testid="register-error" className="text-xs text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            data-testid="register-submit"
            disabled={busy}
            className="btn-shine w-full h-10 bg-zinc-50 text-zinc-900 hover:bg-white font-medium"
          >
            {busy ? (
              <>
                <span className="inline-block w-3.5 h-3.5 mr-2 rounded-full border-2 border-zinc-300 border-t-zinc-900 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <UserPlus className="w-3.5 h-3.5 mr-2" /> Create account
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-zinc-500">
          Already have one?{" "}
          <Link to="/login" className="text-zinc-200 hover:text-white underline-offset-4 hover:underline inline-flex items-center gap-1" data-testid="register-to-login">
            Sign in <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
