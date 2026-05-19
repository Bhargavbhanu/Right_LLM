import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "../components/ui/command";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { useOrg } from "../lib/OrgContext";
import {
  LayoutDashboard, Route as RouteIcon, Database, Wallet, LineChart,
  Lightbulb, Server, Bot, ScrollText, Play, Flame, Sparkles, Building2, BookOpen,
} from "lucide-react";

const ITEMS = [
  { icon: LayoutDashboard, label: "Overview", to: "/" },
  { icon: RouteIcon, label: "Routing Intelligence", to: "/routing" },
  { icon: Database, label: "Semantic Cache", to: "/cache" },
  { icon: Wallet, label: "Budget Governance", to: "/budgets" },
  { icon: LineChart, label: "Forecasting", to: "/forecasting" },
  { icon: Lightbulb, label: "Recommendations", to: "/recommendations" },
  { icon: Server, label: "Provider Analytics", to: "/providers" },
  { icon: Bot, label: "Autonomous Actions", to: "/actions" },
  { icon: ScrollText, label: "Optimization Log", to: "/optimization" },
  { icon: Flame, label: "TIPE Analyzer", to: "/tipe" },
  { icon: Sparkles, label: "Advisor Tools", to: "/advisor" },
  { icon: Play, label: "Playground", to: "/playground" },
  { icon: BookOpen, label: "Guide", to: "/guide" },
];

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const { orgs, setOrgId } = useOrg();

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  const go = (to) => { onOpenChange(false); navigate(to); };
  const switchOrg = (id) => { setOrgId(id); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl bg-zinc-950 border-zinc-800" data-testid="command-palette">
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">Jump to a page or switch workspace</DialogDescription>
        <Command className="bg-zinc-950">
          <CommandInput placeholder="Jump to page · switch workspace · search…" autoFocus className="text-sm" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Navigate">
              {ITEMS.map(it => (
                <CommandItem key={it.to} onSelect={() => go(it.to)} className="text-sm">
                  <it.icon className="w-3.5 h-3.5 mr-2 text-zinc-400" /> {it.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Switch workspace">
              {orgs.map(o => (
                <CommandItem key={o.id} onSelect={() => switchOrg(o.id)} className="text-sm">
                  <Building2 className="w-3.5 h-3.5 mr-2 text-zinc-400" /> {o.name}
                  <span className="ml-auto text-xs text-zinc-500 mono">{o.plan}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
