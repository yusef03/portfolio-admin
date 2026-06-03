import { HTMLAttributes } from "react";

type Accent = "none" | "brand" | "accent" | "success" | "warning" | "danger";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  accent?: Accent;
  glass?: boolean;
  hover?: boolean;
}

const accentBorder: Record<Accent, string> = {
  none:    "border-[var(--color-border)]",
  brand:   "border-l-[var(--color-brand)] border-l-2",
  accent:  "border-l-[var(--color-accent)] border-l-2",
  success: "border-l-[var(--color-success)] border-l-2",
  warning: "border-l-[var(--color-warning)] border-l-2",
  danger:  "border-l-[var(--color-danger)] border-l-2",
};

export function Card({
  accent = "none",
  glass = false,
  hover = false,
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-[var(--radius-lg)] border p-4
        ${glass
          ? "bg-[var(--color-glass)] backdrop-blur-md border-[var(--color-glass-border)]"
          : "bg-[var(--color-surface-1)] border-[var(--color-border)]"
        }
        ${accentBorder[accent]}
        ${hover
          ? "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--glow-brand)] hover:border-[var(--color-border-strong)] cursor-pointer"
          : ""
        }
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
