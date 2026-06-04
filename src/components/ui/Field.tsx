import { ReactNode } from "react";

export function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-3)]">
        {label}
        {required && <span className="text-[var(--color-danger)] normal-case">*</span>}
        {hint && <span className="text-[var(--color-text-3)] font-normal normal-case tracking-normal lowercase">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/* DE / EN / AR (oder beliebige) Sprach-Tabs */
export function LangTabs<T extends string>({ value, onChange, langs }: {
  value: T; onChange: (l: T) => void; langs: { id: T; label: string; required?: boolean; done?: boolean }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-[10px] border" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>
      {langs.map((l) => {
        const active = value === l.id;
        return (
          <button
            key={l.id}
            onClick={() => onChange(l.id)}
            className="relative flex items-center gap-1.5 px-3 py-1 rounded-[7px] text-xs font-medium transition-all"
            style={{
              background: active ? "var(--color-surface-1)" : "transparent",
              color: active ? "var(--color-text-1)" : "var(--color-text-3)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.18)" : "none",
            }}
          >
            {l.label}
            {l.required && <span className="text-[var(--color-danger)]">*</span>}
            {l.done && !l.required && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-success)" }} />}
          </button>
        );
      })}
    </div>
  );
}

/* Segmented control — generische Auswahl (z.B. Kategorie, Status) */
export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-[10px] border" style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}>
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className="flex-1 px-3 py-1.5 rounded-[7px] text-xs font-medium transition-all"
            style={{
              background: active ? "var(--color-surface-1)" : "transparent",
              color: active ? "var(--color-text-1)" : "var(--color-text-3)",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.18)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
