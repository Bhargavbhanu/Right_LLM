import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useOrg } from "../lib/OrgContext";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  LayoutDashboard, Route as RouteIcon, Database, Wallet, LineChart,
  Lightbulb, Server, Bot, ScrollText, Play, Sparkles, Flame, Building2,
  Command as CmdIcon, BookOpen, X, CircleDot, Settings as SettingsIcon,
} from "lucide-react";
import Topbar from "./Topbar";
import { useAuth } from "../lib/AuthContext";

const NAV_SECTIONS = [
  {
    title: "Insights",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard, end: true, testId: "nav-overview" },
      { to: "/forecasting", label: "Forecasting", icon: LineChart, testId: "nav-forecasting" },
      { to: "/providers", label: "Provider Analytics", icon: Server, testId: "nav-providers" },
      { to: "/optimization", label: "Optimization Log", icon: ScrollText, testId: "nav-optimization" },
    ],
  },
  {
    title: "Optimize",
    items: [
      { to: "/routing", label: "Routing Intelligence", icon: RouteIcon, testId: "nav-routing" },
      { to: "/cache", label: "Semantic Cache", icon: Database, testId: "nav-cache" },
      { to: "/recommendations", label: "Recommendations", icon: Lightbulb, testId: "nav-recommendations" },
      { to: "/actions", label: "Autonomous Actions", icon: Bot, testId: "nav-actions" },
    ],
  },
  {
    title: "Govern",
    items: [
      { to: "/budgets", label: "Budget Governance", icon: Wallet, testId: "nav-budgets" },
      { to: "/tipe", label: "TIPE Analyzer", icon: Flame, testId: "nav-tipe" },
    ],
  },
  {
    title: "Tools",
    items: [
      { to: "/advisor", label: "Advisor Tools", icon: Sparkles, testId: "nav-advisor" },
      { to: "/playground", label: "Playground", icon: Play, testId: "nav-playground" },
      { to: "/guide", label: "Guide", icon: BookOpen, testId: "nav-guide" },
      { to: "/settings", label: "Settings", icon: SettingsIcon, testId: "nav-settings", adminOnly: true },
    ],
  },
];

function SidebarContent({ onPaletteOpen, onItemClick }) {
  const { orgs, orgId, setOrgId } = useOrg();
  const { user } = useAuth();
  const currentOrg = orgs.find((o) => o.id === orgId);
  const isAdmin = user?.role === "admin";
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 h-14 flex items-center gap-2.5 border-b border-zinc-800/80">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-white to-zinc-200 flex items-center justify-center shadow-[0_0_24px_-4px_rgba(255,255,255,0.4)]">
          <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-bold text-[15px] leading-none tracking-tight">Right LLM</div>
          <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 mt-1">Gateway · v0.3</div>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pt-4 pb-2">
        <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 mb-2 px-1 font-medium">Workspace</div>
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger
            data-testid="workspace-switcher"
            className="bg-zinc-950 border-zinc-800 text-sm hover:border-zinc-700 transition-colors h-10"
          >
            <Building2 className="w-3.5 h-3.5 mr-2 text-zinc-400 shrink-0" />
            <SelectValue placeholder="Choose…">{currentOrg?.name || "Loading…"}</SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-zinc-950 border-zinc-800">
            {orgs.map((o) => (
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

      <nav className="flex-1 py-2 px-3 space-y-5 overflow-y-auto no-scrollbar" data-testid="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 mb-1.5 px-2 font-medium">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items
                .filter((item) => !item.adminOnly || isAdmin)
                .map(({ to, label, icon: Icon, end, testId }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  data-testid={testId}
                  onClick={onItemClick}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-all duration-150 ${
                      isActive
                        ? "bg-zinc-800/80 text-zinc-50 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-gradient-to-b from-blue-400 to-violet-500" />
                      )}
                      <Icon className={`w-3.5 h-3.5 ${isActive ? "text-zinc-100" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                      <span className="truncate">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={onPaletteOpen}
        data-testid="open-palette"
        className="mx-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-xs text-zinc-400 transition-colors"
      >
        <CmdIcon className="w-3.5 h-3.5" /> Quick jump
        <span className="ml-auto kbd">⌘K</span>
      </button>

      <div className="px-4 py-3 border-t border-zinc-800/80 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        <span className="status-dot" style={{ color: "#22C55E", background: "#22C55E" }} />
        <span>All systems operational</span>
      </div>
    </div>
  );
}

export default function Layout({ onPaletteOpen }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  // close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen flex grid-bg" data-testid="app-shell">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-60 shrink-0 border-r border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md sticky top-0 h-screen flex-col"
        data-testid="sidebar"
      >
        <SidebarContent onPaletteOpen={onPaletteOpen} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in" data-testid="mobile-sidebar">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-zinc-950 border-r border-zinc-800 shadow-2xl flex flex-col animate-fade-up">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 z-10 w-8 h-8 inline-flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent
              onPaletteOpen={() => {
                setMobileOpen(false);
                onPaletteOpen();
              }}
              onItemClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          onPaletteOpen={onPaletteOpen}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />
        <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
