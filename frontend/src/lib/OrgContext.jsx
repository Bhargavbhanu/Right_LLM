import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const Ctx = createContext({ orgId: "org_acme", setOrgId: () => {}, orgs: [] });

export function OrgProvider({ children }) {
  const [orgs, setOrgs] = useState([]);
  const [orgId, setOrgId] = useState(() => localStorage.getItem("rightllm_org") || "org_acme");

  useEffect(() => {
    api.get("/orgs").then(r => setOrgs(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { localStorage.setItem("rightllm_org", orgId); }, [orgId]);

  // Attach as default query param on every axios call
  useEffect(() => {
    const id = api.interceptors.request.use((cfg) => {
      cfg.params = { ...(cfg.params || {}), org_id: orgId };
      if (cfg.data && typeof cfg.data === "object" && !Array.isArray(cfg.data) && !cfg.data.org_id) {
        cfg.data = { ...cfg.data, org_id: orgId };
      }
      return cfg;
    });
    return () => api.interceptors.request.eject(id);
  }, [orgId]);

  return <Ctx.Provider value={{ orgId, setOrgId, orgs }}>{children}</Ctx.Provider>;
}

export const useOrg = () => useContext(Ctx);
