"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("admin-theme") as Theme | null;
    const resolved = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(resolved);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("admin-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={toggle}
      aria-label={theme === "light" ? "Zu Dark Mode wechseln" : "Zu Light Mode wechseln"}
      className={`
        relative w-8 h-8 rounded-lg flex items-center justify-center
        transition-all duration-200
        text-[var(--color-text-2)] hover:text-[var(--color-text-1)]
        hover:bg-[var(--color-surface-2)]
        ${className}
      `}
    >
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: theme === "light" ? 1 : 0, transform: theme === "light" ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(90deg)" }}
      >
        <Sun size={16} strokeWidth={2} />
      </span>
      <span
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{ opacity: theme === "dark" ? 1 : 0, transform: theme === "dark" ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(-90deg)" }}
      >
        <Moon size={16} strokeWidth={2} />
      </span>
    </button>
  );
}
