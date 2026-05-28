import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Bell, Command as CmdIcon, RefreshCw, Search, Menu, Activity, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { useOrg } from "../lib/OrgContext";

const ROUTE_LABELS = {
  "/": "Overview",
  "/routing": "Routing Intelligence",
  "/cache": "Semantic Cache",
  "/budgets": "Budget Governance",
  "/forecasting": "Forecasting",
  "/recommendations": "Recommendations",
  "/providers": "Provider Analytics",
  "/actions": "Autonomous Actions",
  "/optimization": "Optimization Log",
  "/tipe": "TIPE Analyzer",
  "/advisor": "Advisor Tools",
  "/playground": "Playground",
  "/guide": "Guide",
};

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Topbar({ onPaletteOpen, onMobileMenuOpen, onRefresh }) {
  const { pathname } = useLocation();
  const { orgs, orgId } = useOrg();
  const now = useNow();
  const label = ROUTE_LABELS[pathname] || "Page";
  const currentOrg = orgs.find((o) => o.id === orgId);
  const [spinning, setSpinning] = useState(false);

  const handleRefresh = () => {
    setSpinning(true);
    if (onRefresh) onRefresh();
    else window.location.reload();
    setTimeout(() => setSpinning(false), 700);
  };

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-30 h-14 border-b border-zinc-800/80 glass flex items-center px-4 lg:px-6 gap-3"
    >
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden -ml-1 w-9 h-9 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
        aria-label="Open menu"
        data-testid="topbar-menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm min-w-0" data-testid="topbar-breadcrumb">
        <Link to="/" className="text-zinc-500 hover:text-zinc-200 transition-colors hidden sm:inline">
          {currentOrg?.name || "Workspace"}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-700 hidden sm:inline shrink-0" />
        <span className="text-zinc-100 font-medium truncate">{label}</span>
      </nav>

      <div className="flex-1" />

      {/* Search / command palette */}
      <button
        onClick={onPaletteOpen}
        data-testid="topbar-search"
        className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900 text-xs text-zinc-400 transition-colors min-w-[240px]"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">Search pages, models, actions…</span>
        <span className="kbd">⌘K</span>
      </button>
      <button
        onClick={onPaletteOpen}
        className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
        aria-label="Search"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Live status pill */}
      <div
        className="hidden lg:flex items-center gap-2 h-9 px-3 rounded-md border border-zinc-800 bg-zinc-950/50 text-xs text-zinc-400"
        data-testid="topbar-status"
      >
        <span className="status-dot" style={{ color: "#22C55E", background: "#22C55E" }} />
        <Activity className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-medium text-zinc-200">Gateway live</span>
        <span className="text-zinc-600 mono">·</span>
        <span className="mono text-zinc-500">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      <button
        onClick={handleRefresh}
        data-testid="topbar-refresh"
        className="w-9 h-9 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
        aria-label="Refresh"
      >
        <RefreshCw className={`w-4 h-4 ${spinning ? "spin-slow" : ""}`} />
      </button>
      <button
        className="w-9 h-9 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors relative"
        aria-label="Notifications"
        data-testid="topbar-notifications"
      >
        <Bell className="w-4 h-4" />
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
      </button>
    </header>
  );
}
