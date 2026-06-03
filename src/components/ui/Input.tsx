import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

const fieldBase = `
  w-full rounded-[var(--radius-md)] border border-[var(--color-border)]
  bg-[var(--color-surface-2)] text-[var(--color-text-1)]
  placeholder:text-[var(--color-text-3)]
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/50
  focus:border-[var(--color-accent)]
  disabled:opacity-50 disabled:cursor-not-allowed
  font-[var(--font-sans)] text-sm
`;

/* ── Input ────────────────────────────────────────────────────────────── */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`${fieldBase} px-3 py-2 ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";

/* ── Textarea ─────────────────────────────────────────────────────────── */
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  mono?: boolean;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", mono = false, ...props }, ref) => (
    <textarea
      ref={ref}
      className={`${fieldBase} px-3 py-2 resize-y min-h-[100px] ${mono ? "font-mono text-xs" : ""} ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

/* ── Select ───────────────────────────────────────────────────────────── */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => (
    <select
      ref={ref}
      className={`${fieldBase} px-3 py-2 cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
