"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[var(--color-surface-0)]">

        {/* ── Desktop Sidebar (fixed) ──────────────────────────────── */}
        <div className="hidden lg:flex w-64 min-h-screen flex-col fixed left-0 top-0 bottom-0 z-30">
          <Sidebar />
        </div>

        {/* ── Mobile: Topbar ────────────────────────────────────────── */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4 bg-[var(--color-sidebar-bg)] border-b border-[var(--color-sidebar-border)]">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/yb-mark.svg" alt="YB" width={28} height={28} className="w-7 h-7 rounded-[var(--radius-sm)] shrink-0 select-none" />
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

        {/* ── Mobile: Drawer + Backdrop ────────────────────────────── */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setDrawerOpen(false)}
              />

              {/* Drawer */}
              <motion.div
                className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 flex flex-col shadow-2xl"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Close button inside drawer */}
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

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main className="flex-1 lg:ml-64 overflow-auto">
          {/* Mobile top spacing */}
          <div className="lg:hidden h-14" />

          <div className="p-6 lg:p-8">
            <ErrorBoundary context="dashboard">
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
