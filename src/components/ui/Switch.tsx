"use client";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  variant?: "brand" | "accent" | "success" | "danger";
  className?: string;
}

const trackColors = {
  brand:   "bg-[var(--color-brand)]   shadow-[var(--glow-brand)]",
  accent:  "bg-[var(--color-accent)]  shadow-[var(--glow-accent)]",
  success: "bg-[var(--color-success)]",
  danger:  "bg-[var(--color-danger)]",
};

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  variant = "brand",
  className = "",
}: SwitchProps) {
  return (
    <label
      className={`inline-flex items-center gap-3 cursor-pointer select-none ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`}
    >
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative w-10 h-6 rounded-full border transition-all duration-300
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50
          ${checked
            ? `${trackColors[variant]} border-transparent`
            : "bg-[var(--color-surface-3)] border-[var(--color-border)]"
          }
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm
            transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            ${checked ? "translate-x-4" : "translate-x-0"}
          `}
        />
      </button>
      {label && (
        <span className="text-sm font-medium text-[var(--color-text-1)]">{label}</span>
      )}
    </label>
  );
}
