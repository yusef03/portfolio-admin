"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CommandPalette } from "@/components/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <ToastProvider>
      <CommandPalette />
      <div className="relative min-h-screen" style={{ background: "var(--color-surface-0)" }}>
        {/* Ambient depth glow — top */}
        <div
          className="pointer-events-none fixed inset-x-0 top-0 h-72 z-0"
          style={{ background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(10,132,255,0.05), transparent 70%)" }}
        />

        <div className="relative z-10 flex min-h-screen lg:p-3 lg:gap-3">

          {/* ── Desktop: floating sidebar ──────────────────────────── */}
          <aside className="hidden lg:block w-[248px] shrink-0">
            <div
              className="sticky top-3 h-[calc(100vh-1.5rem)] rounded-[20px] overflow-hidden border"
              style={{
                borderColor: "var(--color-sidebar-border)",
                boxShadow: "0 10px 40px -12px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.02) inset",
              }}
            >
              <Sidebar />
            </div>
          </aside>

          {/* ── Mobile: topbar ─────────────────────────────────────── */}
          <div
            className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4 border-b backdrop-blur-xl"
            style={{ background: "var(--color-glass)", borderColor: "var(--color-border)" }}
          >
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/yb-mark.svg" alt="YB" width={28} height={28} className="w-7 h-7 rounded-lg select-none" />
              <span className="text-sm font-semibold text-[var(--color-text-1)]">Yusef Bach</span>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] transition-colors"
              aria-label="Menü öffnen"
            >
              <Menu size={20} strokeWidth={1.75} />
            </button>
          </div>

          {/* ── Mobile: drawer ─────────────────────────────────────── */}
          <AnimatePresence>
            {drawerOpen && (
              <>
                <motion.div
                  className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setDrawerOpen(false)}
                />
                <motion.div
                  className="lg:hidden fixed left-2 top-2 bottom-2 z-50 w-[260px] rounded-[20px] overflow-hidden shadow-2xl"
                  initial={{ x: "-110%" }} animate={{ x: 0 }} exit={{ x: "-110%" }}
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                >
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={() => setDrawerOpen(false)}
                      className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--color-text-3)] hover:bg-[var(--color-surface-2)] transition-colors"
                      aria-label="Menü schließen"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <Sidebar onClose={() => setDrawerOpen(false)} />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* ── Main content ───────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <div className="lg:hidden h-14" />
            <div className="mx-auto max-w-[1100px] px-5 lg:px-8 py-6 lg:py-8">
              <ErrorBoundary context="dashboard">
                {children}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
