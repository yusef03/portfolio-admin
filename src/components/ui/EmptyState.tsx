import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, hint, action }: {
  icon: LucideIcon; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 gap-4 rounded-[18px] border border-dashed text-center"
      style={{ borderColor: "var(--color-border-strong)", background: "var(--color-surface-1)" }}
    >
      <div className="w-14 h-14 rounded-[16px] flex items-center justify-center" style={{ background: "var(--color-surface-2)" }}>
        <Icon size={24} strokeWidth={1.5} className="text-[var(--color-text-3)]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-1)]">{title}</p>
        {hint && <p className="text-[13px] text-[var(--color-text-3)] mt-1 max-w-xs">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
