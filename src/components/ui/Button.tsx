"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary: `
    text-white
    bg-[var(--color-brand)]
    hover:bg-[var(--color-brand-dark)]
    hover:scale-[1.01]
    active:scale-[0.99]
    active:bg-[var(--color-brand-dark)]
  `,
  secondary: `
    bg-[var(--color-surface-2)]
    text-[var(--color-text-1)]
    border border-[var(--color-border)]
    hover:bg-[var(--color-surface-3)]
    hover:border-[var(--color-border-strong)]
    active:scale-[0.98]
  `,
  ghost: `
    bg-transparent
    text-[var(--color-text-2)]
    hover:bg-[var(--color-surface-2)]
    hover:text-[var(--color-text-1)]
    active:scale-[0.98]
  `,
  danger: `
    bg-[var(--color-danger)]/10
    text-[var(--color-danger)]
    border border-[var(--color-danger)]/25
    hover:bg-[var(--color-danger)]/20
    hover:border-[var(--color-danger)]/40
    active:scale-[0.98]
  `,
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", loading, icon, children, className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
