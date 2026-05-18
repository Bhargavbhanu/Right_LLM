import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 60000 });

export const getUsage = (days = 30) => api.get(`/analytics/usage`, { params: { days } }).then(r => r.data);
export const getForecast = () => api.get(`/forecast/predict`).then(r => r.data);
export const getRecommendations = () => api.get(`/advisor/recommend`).then(r => r.data);
export const actOnRecommendation = (id, action) =>
  api.post(`/advisor/recommend/${id}/action`, null, { params: { action } }).then(r => r.data);
export const getBudgets = () => api.get(`/budgets/status`).then(r => r.data);
export const getActions = () => api.get(`/actions/history`).then(r => r.data);
export const getProviders = () => api.get(`/providers/health`).then(r => r.data);
export const getRoutingDecisions = (limit = 100) => api.get(`/routing/decisions`, { params: { limit } }).then(r => r.data);
export const getCacheEntries = (limit = 100) => api.get(`/cache/entries`, { params: { limit } }).then(r => r.data);
export const getOptimizationLog = (limit = 100) => api.get(`/optimization/log`, { params: { limit } }).then(r => r.data);
export const postGatewayChat = (body) => api.post(`/gateway/chat`, body).then(r => r.data);
export const postRoutingDecision = (body) => api.post(`/routing/decision`, body).then(r => r.data);
export const postCacheSearch = (body) => api.post(`/cache/search`, body).then(r => r.data);

export const fmtUsd = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 10 ? 4 : 0 }).format(n || 0);
export const fmtPct = (n) => `${((n || 0) * 100).toFixed(1)}%`;
export const fmtInt = (n) => new Intl.NumberFormat("en-US").format(Math.round(n || 0));
