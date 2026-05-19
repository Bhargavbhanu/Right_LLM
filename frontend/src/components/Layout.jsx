import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useOrg } from "../lib/OrgContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  LayoutDashboard, Route as RouteIcon, Database, Wallet, LineChart,
  Lightbulb, Server, Bot, ScrollText, Play, Sparkles, Flame, Building2, Command as CmdIcon, BookOpen,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true, testId: "nav-overview" },
  { to: "/routing", label: "Routing Intelligence", icon: RouteIcon, testId: "nav-routing" },
  { to: "/cache", label: "Semantic Cache", icon: Database, testId: "nav-cache" },
  { to: "/budgets", label: "Budget Governance", icon: Wallet, testId: "nav-budgets" },
  { to: "/forecasting", label: "Forecasting", icon: LineChart, testId: "nav-forecasting" },
  { to: "/recommendations", label: "Recommendations", icon: Lightbulb, testId: "nav-recommendations" },
  { to: "/providers", label: "Provider Analytics", icon: Server, testId: "nav-providers" },
  { to: "/actions", label: "Autonomous Actions", icon: Bot, testId: "nav-actions" },
  { to: "/optimization", label: "Optimization Log", icon: ScrollText, testId: "nav-optimization" },
  { to: "/tipe", label: "TIPE Analyzer", icon: Flame, testId: "nav-tipe" },
  { to: "/advisor", label: "Advisor Tools", icon: Sparkles, testId: "nav-advisor" },
  { to: "/playground", label: "Playground", icon: Play, testId: "nav-playground" },
  { to: "/guide", label: "Guide", icon: BookOpen, testId: "nav-guide" },
];

export default function Layout({ onPaletteOpen }) {
  const { orgs, orgId, setOrgId } = useOrg();
  const currentOrg = orgs.find(o => o.id === orgId);

  return (
    <div className="min-h-screen flex grid-bg" data-testid="app-shell">
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950/60 backdrop-blur-sm sticky top-0 h-screen flex flex-col">
        <div className="px-5 h-16 flex items-center gap-2 border-b border-zinc-800">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-zinc-900" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-heading font-bold text-base leading-none">Right LLM</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">Gateway</div>
          </div>
        </div>

        {/* Workspace switcher */}
        <div className="px-3 pt-4 pb-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2 px-1">Workspace</div>
          <Select value={orgId} onValueChange={setOrgId}>
            <SelectTrigger
              data-testid="workspace-switcher"
              className="bg-zinc-950 border-zinc-800 text-sm hover:border-zinc-600 transition-colors h-10"
            >
              <Building2 className="w-3.5 h-3.5 mr-2 text-zinc-400 shrink-0" />
              <SelectValue placeholder="Choose…">
                {currentOrg?.name || "Loading…"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-zinc-950 border-zinc-800">
              {orgs.map(o => (
                <SelectItem key={o.id} value={o.id} data-testid={`org-${o.id}`}>
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span>{o.name}</span>
                    <span className="text-[10px] uppercase text-zinc-500 mono">{o.plan}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <nav className="flex-1 py-2 px-3 space-y-1 overflow-auto" data-testid="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon, end, testId }, i) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={testId}
              style={{ animationDelay: `${i * 30}ms` }}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-200 animate-fade-up ${
                  isActive
                    ? "bg-white text-zinc-900 font-medium"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={onPaletteOpen}
          data-testid="open-palette"
          className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900 text-xs text-zinc-400 transition-colors"
        >
          <CmdIcon className="w-3.5 h-3.5" /> Quick jump
          <span className="ml-auto mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">⌘K</span>
        </button>

        <div className="p-4 border-t border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          v0.2.0 · production
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-[1600px] mx-auto p-6 lg:p-8 animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
