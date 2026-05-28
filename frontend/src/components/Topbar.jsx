import React, { useEffect, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { Bell, Command as CmdIcon, RefreshCw, Search, Menu, Activity, ChevronRight, LogOut, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { Button } from "./ui/button";
import { useOrg } from "../lib/OrgContext";
import { useAuth } from "../lib/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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
  "/settings": "Settings",
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
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const now = useNow();
  const label = ROUTE_LABELS[pathname] || "Page";
  const currentOrg = orgs.find((o) => o.id === orgId);
  const [spinning, setSpinning] = useState(false);

  const handleLogout = async () => {
    await logout();
    nav("/login", { replace: true });
  };

  const initials = (user?.name || user?.email || "U")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-testid="topbar-user"
            className="ml-1 h-9 px-1.5 inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900 transition-colors"
            aria-label="User menu"
          >
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-200 tracking-wide">
              {initials}
            </span>
            <span className="hidden xl:inline text-xs text-zinc-300 max-w-[100px] truncate">{user?.name || user?.email}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800 min-w-[220px]">
          <DropdownMenuLabel className="text-zinc-400">
            <div className="text-[11px] font-medium text-zinc-100 truncate">{user?.name || "User"}</div>
            <div className="text-[10px] text-zinc-500 mono truncate">{user?.email}</div>
            <div className="mt-1 inline-block text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-800 text-zinc-400">
              {user?.role}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-zinc-800" />
          {user?.role === "admin" && (
            <DropdownMenuItem
              data-testid="topbar-settings"
              onClick={() => nav("/settings")}
              className="text-xs cursor-pointer focus:bg-zinc-900"
            >
              <SettingsIcon className="w-3.5 h-3.5 mr-2 text-zinc-500" /> Settings
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            data-testid="topbar-logout"
            onClick={handleLogout}
            className="text-xs cursor-pointer focus:bg-zinc-900 text-rose-300 focus:text-rose-200"
          >
            <LogOut className="w-3.5 h-3.5 mr-2" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
