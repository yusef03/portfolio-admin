type Variant = "default" | "brand" | "accent" | "success" | "warning" | "danger" | "info";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const styles: Record<Variant, string> = {
  default: "bg-[var(--color-surface-2)] text-[var(--color-text-2)] border-[var(--color-border)]",
  brand:   "bg-[var(--color-brand)]/10 text-[var(--color-brand)] border-[var(--color-brand)]/25",
  accent:  "bg-[var(--color-accent)]/10 text-[var(--color-accent-dark)] border-[var(--color-accent)]/25",
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/25",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/25",
  danger:  "bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/25",
  info:    "bg-[var(--color-info)]/10 text-[var(--color-info)] border-[var(--color-info)]/25",
};

const dotColors: Record<Variant, string> = {
  default: "bg-[var(--color-text-3)]",
  brand:   "bg-[var(--color-brand)]",
  accent:  "bg-[var(--color-accent)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger:  "bg-[var(--color-danger)]",
  info:    "bg-[var(--color-info)]",
};

export function Badge({ variant = "default", children, className = "", dot = false }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5
        text-xs font-medium rounded-full border
        ${styles[variant]} ${className}
      `}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      {children}
    </span>
  );
}
