"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { ShieldAlert } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  no_session:              "Bitte einloggen.",
  wrong_provider:          "Zugang nur mit GitHub-Login erlaubt.",
  email_not_verified:      "Die verknüpfte GitHub-Email ist nicht verifiziert.",
  email_not_whitelisted:   "Dieser GitHub-Account hat keinen Zugriff.",
  username_not_whitelisted:"Dieser GitHub-Account hat keinen Zugriff.",
  oauth_access_denied:     "GitHub-Login abgebrochen.",
  missing_code:            "OAuth-Callback unvollständig.",
  exchange_failed:         "Login fehlgeschlagen. Bitte erneut versuchen.",
  forbidden:               "Zugang verweigert.",
};

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function LoginInner() {
  const supabase = createClient();
  const params = useSearchParams();
  const errorKey = params.get("error");
  const errorMsg = errorKey
    ? ERROR_MESSAGES[errorKey] ?? "Anmeldung nicht möglich."
    : null;

  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "read:user user:email",
      },
    });
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
          className="rounded-[var(--radius-2xl)] border p-8 flex flex-col items-center gap-7"
          style={{
            background: "var(--color-glass)",
            backdropFilter: "blur(24px) saturate(1.5)",
            WebkitBackdropFilter: "blur(24px) saturate(1.5)",
            borderColor: "var(--color-glass-border)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.05) inset",
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] }}
              style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.40))" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/yb-mark.svg" alt="YB" width={64} height={64} className="w-16 h-16 rounded-[var(--radius-lg)] select-none" />
            </motion.div>
            <div className="text-center">
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--color-text-1)" }}>
                Portfolio Admin
              </h1>
              <p className="text-sm mt-0.5" style={{ color: "var(--color-text-2)" }}>
                Yusef Bach
              </p>
            </div>
          </div>

          {errorMsg && (
            <div
              className="w-full flex items-start gap-2.5 rounded-[12px] border px-3 py-2.5"
              style={{
                background: "rgba(255,69,58,0.08)",
                borderColor: "rgba(255,69,58,0.35)",
              }}
              role="alert"
            >
              <ShieldAlert size={15} className="shrink-0 mt-0.5" style={{ color: "var(--color-danger)" }} />
              <p className="text-[12.5px] leading-snug" style={{ color: "var(--color-danger)" }}>
                {errorMsg}
              </p>
            </div>
          )}

          <div className="w-full h-px" style={{ background: "var(--color-border)" }} />

          <div className="w-full flex flex-col gap-3">
            <Button variant="primary" size="md" onClick={signInWithGitHub} icon={<GithubIcon />} className="w-full justify-center">
              Mit GitHub anmelden
            </Button>
            <p className="text-xs text-center" style={{ color: "var(--color-text-3)" }}>
              Zugang nur für autorisierte Nutzer
            </p>
          </div>
        </div>
        <div className="flex justify-center gap-4 mt-5">
          <a href="/impressum" className="text-xs" style={{ color: "var(--color-text-3)" }}>
            Impressum
          </a>
          <a href="/datenschutz" className="text-xs" style={{ color: "var(--color-text-3)" }}>
            Datenschutz
          </a>
        </div>
      </motion.div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
