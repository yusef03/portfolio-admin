import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className = "" }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 flex-wrap mb-6 ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-1)] tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[var(--color-text-2)] mt-1">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
