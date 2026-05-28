import React, { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import { SectionCard, Pill, EmptyState } from "../components/Card";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Settings as SettingsIcon, Key, Check, AlertTriangle, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const PROVIDER_META = {
  groq:    { name: "Groq",                docs: "https://console.groq.com/keys",   color: "amber" },
  ollama:  { name: "Ollama (self-hosted)",docs: "https://ollama.com/",             color: "zinc" },
  bedrock: { name: "AWS Bedrock",         docs: "https://aws.amazon.com/bedrock/", color: "amber" },
  azure:   { name: "Azure OpenAI",        docs: "https://azure.microsoft.com/products/ai-services/openai-service", color: "blue" },
};

function ProviderCard({ data, onSaved }) {
  const meta = PROVIDER_META[data.provider] || { name: data.provider, color: "zinc" };
  const [values, setValues] = useState(() => Object.fromEntries(data.fields.map((f) => [f.key, ""])));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValues(Object.fromEntries(data.fields.map((f) => [f.key, ""])));
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      // Only send non-empty values; backend treats empty string as "no change to that key"
      const payload = { provider: data.provider, values: {} };
      for (const [k, v] of Object.entries(values)) if ((v || "").trim()) payload.values[k] = v.trim();
      if (Object.keys(payload.values).length === 0) {
        toast.error("Enter at least one value to save.");
        return;
      }
      const res = await api.put("/settings/providers", payload);
      toast.success(`${meta.name} ${res.data.configured ? "configured" : "saved"} ✓`);
      setEditing(false);
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm(`Remove all credentials for ${meta.name}?`)) return;
    setBusy(true);
    try {
      await api.delete(`/settings/providers/${data.provider}`);
      toast.success(`${meta.name} credentials cleared`);
      onSaved?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      testId={`provider-settings-${data.provider}`}
      title={
        <span className="inline-flex items-center gap-2">
          <Key className="w-4 h-4 text-zinc-500" />
          {meta.name}
        </span>
      }
      subtitle={
        <span className="inline-flex items-center gap-2">
          {data.configured ? (
            <Pill color="emerald"><Check className="w-3 h-3" />Live</Pill>
          ) : (
            <Pill color="amber"><AlertTriangle className="w-3 h-3" />Not configured</Pill>
          )}
          {data.updated_at && <span className="text-[11px] text-zinc-600">Updated {data.updated_at.slice(0, 10)}</span>}
        </span>
      }
      right={
        <div className="flex items-center gap-2">
          {data.configured && !editing && (
            <Button size="sm" variant="outline"
              className="border-zinc-800 text-zinc-300 text-xs h-8 hover:bg-zinc-900"
              onClick={clear} disabled={busy}
              data-testid={`provider-${data.provider}-clear`}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
          {!editing ? (
            <Button size="sm"
              className="bg-zinc-50 text-zinc-900 hover:bg-white text-xs h-8 font-medium"
              onClick={() => setEditing(true)}
              data-testid={`provider-${data.provider}-edit`}
            >
              {data.configured ? "Update" : "Add credentials"}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        {data.fields.map((field) => (
          <div key={field.key}>
            <Label className="text-[11px] uppercase tracking-[0.18em] text-zinc-400 font-medium">
              {field.label}
            </Label>
            {editing ? (
              <Input
                data-testid={`provider-${data.provider}-${field.key}`}
                type={field.key.toLowerCase().includes("key") || field.key.toLowerCase().includes("secret") ? "password" : "text"}
                placeholder={field.hint}
                value={values[field.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                className="bg-zinc-950 border-zinc-800 focus-visible:border-zinc-700 mt-1.5 h-9 mono text-xs"
                autoComplete="off"
              />
            ) : (
              <div className="mt-1.5 px-3 h-9 flex items-center rounded-md border border-zinc-900 bg-zinc-950 mono text-xs">
                {field.has_value ? (
                  <>
                    <span className="text-zinc-200">{field.masked}</span>
                    {field.source === "env" && (
                      <span className="ml-auto text-[9px] uppercase tracking-wider text-zinc-500">via env</span>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-600">{field.hint || "—"}</span>
                )}
              </div>
            )}
          </div>
        ))}

        {editing && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={save}
              disabled={busy}
              className="bg-zinc-50 text-zinc-900 hover:bg-white text-xs h-8 font-medium"
              data-testid={`provider-${data.provider}-save`}
            >
              {busy ? "Saving…" : <><Save className="w-3 h-3 mr-1" /> Save credentials</>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={busy}
              className="border-zinc-800 text-xs h-8 hover:bg-zinc-900"
            >
              Cancel
            </Button>
            {meta.docs && (
              <a
                href={meta.docs}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300 underline-offset-4 hover:underline"
              >
                Where do I get this? ↗
              </a>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [data, setData] = useState({ providers: [] });
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/settings/providers")
      .then((r) => setData(r.data))
      .catch((e) => toast.error(e?.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (user?.role !== "admin") {
    return (
      <div data-testid="page-settings">
        <PageHeader title="Settings" subtitle="Manage live provider API keys, identity and workspace." testId="settings-header" />
        <EmptyState
          icon={<SettingsIcon className="w-5 h-5" />}
          title="Admin only"
          description="Only admin users can view & manage provider API keys. Contact your platform admin."
        />
      </div>
    );
  }

  const configuredCount = data.providers.filter((p) => p.configured).length;

  return (
    <div data-testid="page-settings">
      <PageHeader
        title="Settings"
        subtitle="Paste live provider API keys to activate Groq · Ollama · Bedrock · Azure in the routing engine."
        right={
          <div className="hidden md:flex items-center gap-2">
            <Pill color="emerald"><Check className="w-3 h-3" />{configuredCount} / {data.providers.length} live</Pill>
          </div>
        }
        testId="settings-header"
      />

      <div className="mb-6 surface rounded-md px-4 py-3 text-[12px] text-zinc-400 leading-relaxed">
        <div className="text-zinc-200 font-medium mb-1">How this works</div>
        Keys are encrypted with AES-128 (Fernet) and stored in MongoDB. The routing engine consults
        this store every request — once a provider is "Live", it joins the cheapest-model-that-fits
        selection automatically. Clear keys to remove a provider from routing.
      </div>

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.providers.map((p) => (
            <ProviderCard key={p.provider} data={p} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  );
}
