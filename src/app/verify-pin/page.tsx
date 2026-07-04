"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { ShieldCheck } from "lucide-react";

/**
 * Zweiter Faktor: statischer Admin-PIN.
 * Sichtbar nur, wenn ADMIN_PIN in ENV gesetzt ist (der Proxy schickt sonst durch).
 *
 * Nach 5 Fehlversuchen sperrt der Server (Rate-Limit auf /api/verify-pin).
 */
export default function VerifyPinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pin.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      if (res.status === 429) setError("Zu viele Versuche. Warte 15 Minuten.");
      else if (res.status === 401) setError("Falscher PIN.");
      else setError("Fehler bei der Verifikation.");
      setPin("");
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--color-surface-0)" }}
    >
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-3xl pointer-events-none opacity-30"
        style={{ background: "radial-gradient(ellipse, rgba(10,132,255,0.08) 0%, transparent 70%)" }}
      />
      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="rounded-[var(--radius-2xl)] border p-8 flex flex-col items-center gap-6"
          style={{
            background: "var(--color-glass)",
            backdropFilter: "blur(24px) saturate(1.5)",
            WebkitBackdropFilter: "blur(24px) saturate(1.5)",
            borderColor: "var(--color-glass-border)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.05) inset",
          }}
        >
          <div
            className="w-14 h-14 rounded-[16px] flex items-center justify-center"
            style={{ background: "rgba(10,132,255,0.12)" }}
          >
            <ShieldCheck size={26} strokeWidth={1.8} style={{ color: "var(--color-brand)" }} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-text-1)" }}>
              Zweiter Faktor
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-2)" }}>
              Bitte Admin-PIN eingeben.
            </p>
          </div>
          <form onSubmit={onSubmit} className="w-full flex flex-col gap-3">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-lg tracking-[0.4em] font-mono px-4 py-3 rounded-[12px] border outline-none"
              style={{
                background: "var(--color-surface-1)",
                borderColor: error ? "var(--color-danger)" : "var(--color-border)",
                color: "var(--color-text-1)",
              }}
              placeholder="••••••"
              disabled={submitting}
            />
            {error && (
              <p className="text-xs text-center" style={{ color: "var(--color-danger)" }}>
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!pin.trim() || submitting}
              className="w-full justify-center"
            >
              {submitting ? "Prüfe…" : "Weiter"}
            </Button>
          </form>
        </div>
      </motion.div>
    </main>
  );
}
