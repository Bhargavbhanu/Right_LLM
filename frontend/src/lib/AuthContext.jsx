import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const TOKEN_KEY = "rightllm_token";
const Ctx = createContext({ user: null, loading: true, login: () => {}, register: () => {}, logout: () => {} });

// Register interceptor ONCE — reads token from localStorage every request
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` };
  }
  return cfg;
});

// 401 response interceptor — clears token + lets caller handle redirect
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      const url = err.config?.url || "";
      // Don't auto-clear on login attempts (so we can show the error)
      if (!url.includes("/auth/login") && !url.includes("/auth/register")) {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    return Promise.reject(err);
  }
);

function formatApiError(detail) {
  if (detail == null) return "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join(" · ");
  return String(detail);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, attempt to load /me using the stored token
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (email, password, name, org_id) => {
    try {
      const { data } = await api.post("/auth/register", { email, password, name, org_id });
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
