"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, LayoutDashboard, Languages, FolderKanban, MapPinned,
  ScrollText, PenLine, Image, Bot, ShieldAlert, Activity,
  Sun, Moon, CornerDownLeft, ArrowUp, ArrowDown, Command,
} from "lucide-react";

type CmdItem = {
  id: string;
  label: string;
  hint: string;
  group: "Navigation" | "Aktionen";
  icon: typeof Search;
  keywords: string;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => { setOpen(false); setQuery(""); setActive(0); }, []);

  const toggleTheme = useCallback(() => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("admin-theme", next); } catch {}
  }, []);

  const items: CmdItem[] = useMemo(() => {
    const nav = (id: string, label: string, hint: string, icon: typeof Search, href: string, keywords = ""): CmdItem => ({
      id, label, hint, group: "Navigation", icon, keywords,
      run: () => { router.push(href); close(); },
    });
    return [
      nav("dash", "Übersicht", "Dashboard", LayoutDashboard, "/dashboard", "home start"),
      nav("trans", "Translations", "DE / EN / AR Texte", Languages, "/dashboard/translations", "sprache i18n übersetzung"),
      nav("proj", "Projects", "Projektkarten & Hero", FolderKanban, "/dashboard/projects", "projekte"),
      nav("road", "Roadmap", "Roadmap-Einträge", MapPinned, "/dashboard/roadmap", "plan"),
      nav("change", "Changelog", "Releases", ScrollText, "/dashboard/changelog", "release version"),
      nav("thoughts", "Thoughts", "Blog-Posts", PenLine, "/dashboard/thoughts", "blog gedanken post"),
      nav("media", "Media", "Bilder, CV, Docs", Image, "/dashboard/media", "bilder dateien"),
      nav("bot", "Bot Memory", "AI-Twin Prompt", Bot, "/dashboard/bot-memory", "ki ai prompt brain"),
      nav("maint", "Maintenance", "Wartungsmodus", ShieldAlert, "/dashboard/maintenance", "wartung notfall"),
      nav("act", "Activity Log", "Historie", Activity, "/dashboard/activity", "log verlauf"),
      {
        id: "theme", label: "Theme wechseln", hint: "Dark / Light", group: "Aktionen",
        icon: typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark" ? Sun : Moon,
        keywords: "dark light mode dunkel hell", run: () => { toggleTheme(); close(); },
      },
    ];
  }, [router, close, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it => (it.label + " " + it.hint + " " + it.keywords).toLowerCase().includes(q));
  }, [items, query]);

  // Group for render
  const groups = useMemo(() => {
    const g: Record<string, CmdItem[]> = {};
    filtered.forEach(it => { (g[it.group] ??= []).push(it); });
    return g;
  }, [filtered]);

  const flatOrder = filtered;

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === "Escape" && open) {
        close();
      }
    };
    const onCustom = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onCustom);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("open-command-palette", onCustom); };
  }, [open, close]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 40); }, [open]);
  useEffect(() => { setActive(0); }, [query]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, flatOrder.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); flatOrder[active]?.run(); }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted) return null;

  let idx = -1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={close}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-[560px] overflow-hidden rounded-[16px] border"
            style={{
              background: "var(--color-glass)",
              backdropFilter: "blur(24px) saturate(1.6)",
              WebkitBackdropFilter: "blur(24px) saturate(1.6)",
              borderColor: "var(--color-glass-border)",
              boxShadow: "0 24px 60px -12px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
            }}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={e => e.stopPropagation()}
            onKeyDown={onListKey}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 h-14 border-b" style={{ borderColor: "var(--color-border)" }}>
              <Search size={18} className="text-[var(--color-text-3)] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Springe zu… oder Aktion ausführen"
                className="flex-1 bg-transparent text-[15px] text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] focus:outline-none"
              />
              <kbd className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-[var(--color-text-3)] px-1.5 py-0.5 rounded border" style={{ borderColor: "var(--color-border)" }}>ESC</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[340px] overflow-y-auto p-2">
              {flatOrder.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--color-text-3)]">Nichts gefunden für „{query}"</div>
              ) : (
                Object.entries(groups).map(([groupName, groupItems]) => (
                  <div key={groupName} className="mb-1">
                    <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-3)]">{groupName}</p>
                    {groupItems.map(it => {
                      idx++;
                      const i = idx;
                      const isActive = i === active;
                      const Icon = it.icon;
                      return (
                        <button
                          key={it.id}
                          data-idx={i}
                          onClick={it.run}
                          onMouseMove={() => setActive(i)}
                          className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] text-left transition-colors"
                          style={{ background: isActive ? "var(--color-surface-2)" : "transparent" }}
                        >
                          <div className="w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0"
                            style={{ background: isActive ? "rgba(10,132,255,0.14)" : "var(--color-surface-2)" }}>
                            <Icon size={15} strokeWidth={1.9} style={{ color: isActive ? "var(--color-brand)" : "var(--color-text-2)" }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13.5px] font-medium text-[var(--color-text-1)] truncate">{it.label}</p>
                            <p className="text-[11px] text-[var(--color-text-3)] truncate">{it.hint}</p>
                          </div>
                          {isActive && <CornerDownLeft size={13} className="text-[var(--color-text-3)] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 h-9 border-t text-[10px] text-[var(--color-text-3)]" style={{ borderColor: "var(--color-border)" }}>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><ArrowUp size={10} /><ArrowDown size={10} /> Navigieren</span>
                <span className="flex items-center gap-1"><CornerDownLeft size={10} /> Öffnen</span>
              </div>
              <span className="flex items-center gap-1"><Command size={10} /> K</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
