"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Languages,
  Bot,
  FolderKanban,
  Image,
  MapPinned,
  ScrollText,
  PenLine,
  ShieldAlert,
  Activity,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui";

const navItems = [
  { href: "/dashboard",              label: "Übersicht",    icon: LayoutDashboard },
  { href: "/dashboard/translations", label: "Translations", icon: Languages },
  { href: "/dashboard/bot-memory",   label: "Bot Memory",   icon: Bot },
  { href: "/dashboard/projects",     label: "Projects",     icon: FolderKanban },
  { href: "/dashboard/media",        label: "Media",        icon: Image },
  { href: "/dashboard/roadmap",      label: "Roadmap",      icon: MapPinned },
  { href: "/dashboard/changelog",    label: "Changelog",    icon: ScrollText },
  { href: "/dashboard/thoughts",     label: "Thoughts",     icon: PenLine },
  { href: "/dashboard/maintenance",  label: "Maintenance",  icon: ShieldAlert },
  { href: "/dashboard/activity",     label: "Activity Log", icon: Activity },
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
    <aside className="flex flex-col h-full bg-[var(--color-sidebar-bg)] border-r border-[var(--color-sidebar-border)]">

      {/* ── Logo / Branding ───────────────────────────────────────────── */}
      <div className="px-5 py-5 border-b border-[var(--color-sidebar-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* YB Logo Mark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/yb-mark.svg"
            alt="YB"
            width={32}
            height={32}
            className="w-8 h-8 rounded-[var(--radius-sm)] shrink-0 select-none"
          />
          <div className="min-w-0">
            <p className="text-[var(--color-text-1)] font-semibold text-sm leading-tight truncate">
              Yusef Bach
            </p>
            <p className="text-[var(--color-text-3)] text-[10px] uppercase tracking-widest">
              Admin
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* ── Navigation ────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
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
              className={`
                group relative flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)]
                text-sm font-medium transition-all duration-150
                ${isActive
                  ? "text-[var(--color-text-1)]"
                  : "text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-1)]"
                }
              `}
              style={isActive ? { background: 'rgba(10,132,255,0.10)' } : undefined}
            >
              {/* Aktive Kante links — Cyan */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ background: "var(--color-accent)" }}
                />
              )}

              <Icon
                size={16}
                strokeWidth={isActive ? 2 : 1.75}
                className={`shrink-0 transition-colors ${
                  isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-3)] group-hover:text-[var(--color-text-2)]"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer / Sign Out ─────────────────────────────────────────── */}
      <div className="px-3 py-4 border-t border-[var(--color-sidebar-border)]">
        <button
          onClick={handleSignOut}
          className="
            group w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)]
            text-sm font-medium text-[var(--color-text-3)]
            hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/8
            transition-all duration-150
          "
        >
          <LogOut size={16} strokeWidth={1.75} className="shrink-0 transition-colors group-hover:text-[var(--color-danger)]" />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
