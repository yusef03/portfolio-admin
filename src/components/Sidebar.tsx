"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, Languages, Bot, FolderKanban, Image,
  MapPinned, ScrollText, PenLine, ShieldAlert, Activity, LogOut, Search,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Übersicht", icon: LayoutDashboard }],
  },
  {
    label: "Inhalte",
    items: [
      { href: "/dashboard/translations", label: "Translations", icon: Languages },
      { href: "/dashboard/projects",     label: "Projects",     icon: FolderKanban },
      { href: "/dashboard/roadmap",      label: "Roadmap",      icon: MapPinned },
      { href: "/dashboard/changelog",    label: "Changelog",    icon: ScrollText },
      { href: "/dashboard/thoughts",     label: "Thoughts",     icon: PenLine },
      { href: "/dashboard/media",        label: "Media",        icon: Image },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/bot-memory",  label: "Bot Memory",   icon: Bot },
      { href: "/dashboard/maintenance", label: "Maintenance",  icon: ShieldAlert },
      { href: "/dashboard/activity",    label: "Activity Log", icon: Activity },
    ],
  },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--color-sidebar-bg)" }}
    >
      {/* ── Brand ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/yb-mark.svg"
            alt="YB"
            width={34}
            height={34}
            className="w-[34px] h-[34px] rounded-[10px] shrink-0 select-none"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
          />
          <div className="min-w-0 leading-tight">
            <p className="text-[var(--color-text-1)] font-semibold text-[13px] truncate">Yusef Bach</p>
            <p className="text-[var(--color-text-3)] text-[10px] uppercase tracking-[0.12em]">Admin Panel</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* ── Search trigger (⌘K) ───────────────────────────────────── */}
      <div className="px-2.5 pb-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
          className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] border text-[13px] transition-colors"
          style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)", color: "var(--color-text-3)" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-border-strong)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; }}
        >
          <Search size={15} strokeWidth={1.9} className="shrink-0" />
          <span className="flex-1 text-left">Suchen…</span>
          <kbd className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: "var(--color-border)" }}>⌘K</kbd>
        </button>
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-3)]">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="group relative flex items-center gap-2.5 px-3 py-[9px] rounded-[10px] text-[13px] font-medium transition-all duration-150"
                    style={
                      isActive
                        ? { background: "var(--color-surface-2)", color: "var(--color-text-1)" }
                        : { color: "var(--color-text-2)" }
                    }
                    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--color-surface-2)"; }}
                    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full"
                        style={{ background: "var(--color-brand)" }}
                      />
                    )}
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.1 : 1.8}
                      style={{ color: isActive ? "var(--color-brand)" : "var(--color-text-3)" }}
                      className="shrink-0 transition-colors group-hover:text-[var(--color-text-2)]"
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Sign out ──────────────────────────────────────────────── */}
      <div className="px-2.5 py-3 border-t" style={{ borderColor: "var(--color-sidebar-border)" }}>
        <button
          onClick={handleSignOut}
          className="group w-full flex items-center gap-2.5 px-3 py-[9px] rounded-[10px] text-[13px] font-medium text-[var(--color-text-3)] transition-all duration-150"
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,69,58,0.08)"; e.currentTarget.style.color = "var(--color-danger)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-text-3)"; }}
        >
          <LogOut size={17} strokeWidth={1.8} className="shrink-0" />
          Abmelden
        </button>
      </div>
    </div>
  );
}
