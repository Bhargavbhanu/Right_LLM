import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const STORAGE_KEY = "rightllm_org";
const Ctx = createContext({ orgId: "org_acme", setOrgId: () => {}, orgs: [] });

// Register the interceptor ONCE at module load. It reads orgId from localStorage
// every request, so it always uses the current value (no stale closure).
api.interceptors.request.use((cfg) => {
  const orgId = localStorage.getItem(STORAGE_KEY) || "org_acme";
  cfg.params = { ...(cfg.params || {}), org_id: orgId };
  if (cfg.data && typeof cfg.data === "object" && !Array.isArray(cfg.data) && !cfg.data.org_id) {
    cfg.data = { ...cfg.data, org_id: orgId };
  }
  return cfg;
});

export function OrgProvider({ children }) {
  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgIdState] = useState(() => localStorage.getItem(STORAGE_KEY) || "org_acme");

  useEffect(() => {
    api.get("/orgs").then(r => setOrgs(r.data || [])).catch(() => {});
  }, []);

  const setOrgId = (id) => {
    localStorage.setItem(STORAGE_KEY, id);
    setOrgIdState(id);
  };

  return <Ctx.Provider value={{ orgId, setOrgId, orgs }}>{children}</Ctx.Provider>;
}

export const useOrg = () => useContext(Ctx);
