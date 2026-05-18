import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Route as RouteIcon, Database, Wallet, LineChart,
  Lightbulb, Server, Bot, ScrollText, Play, Sparkles, Flame,
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
];

export default function Layout() {
  return (
    <div className="min-h-screen flex grid-bg" data-testid="app-shell">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950/60 backdrop-blur-sm sticky top-0 h-screen flex flex-col">
        <div className="px-5 h-16 flex items-center gap-2 border-b border-zinc-800">
          <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-zinc-900" />
          </div>
          <div>
            <div className="font-heading font-bold text-base leading-none">Right LLM</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-1">Gateway · Acme</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1" data-testid="sidebar-nav">
          {NAV.map(({ to, label, icon: Icon, end, testId }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={testId}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-200 ${
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
        <div className="p-4 border-t border-zinc-800 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          v0.1.0 · production
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="max-w-[1600px] mx-auto p-6 lg:p-8 animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
