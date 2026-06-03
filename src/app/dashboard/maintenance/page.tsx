"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { PageHeader, Card, Button, Switch, Textarea, Modal, Input, Badge, PageTransition } from "@/components/ui";
import { ShieldAlert, ShieldOff, ShieldCheck } from "lucide-react";

async function log(payload: { action: string; status: "success" | "warning" | "error" | "info"; message?: string; details?: Record<string, unknown>; error?: string }) {
  try { await fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, category: "maintenance" }) }) } catch { /* silent */ }
}

interface MaintenanceSetting { enabled: boolean; emergency?: boolean; message: string }

const EMERGENCY_CONFIRM_PHRASE = "NOTFALL";

export default function MaintenancePage() {
  const [setting, setSetting] = useState<MaintenanceSetting>({ enabled: false, emergency: false, message: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyTyped, setEmergencyTyped] = useState("");
  const [emergencyMessage, setEmergencyMessage] = useState("");
  const toast = useToast();

  useEffect(() => {
    const supabase = createClient();
    supabase.from("settings").select("value, updated_at").eq("key", "maintenance_mode").single()
      .then(({ data, error }) => {
        if (error) { setError("Fehler beim Laden: " + error.message); }
        else {
          const val = data.value as MaintenanceSetting;
          setSetting({ enabled: val.enabled ?? false, emergency: val.emergency ?? false, message: val.message ?? "" });
          setSavedAt(data.updated_at);
        }
        setLoading(false);
      });
  }, []);

  async function saveSettings(next: MaintenanceSetting) {
    setSaving(true); setError(null);
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from("settings").update({ value: next, updated_at: now }).eq("key", "maintenance_mode");
    if (error) {
      setError("Fehler: " + error.message);
      toast.error("Konnte nicht gespeichert werden", { detail: error.message });
      log({ action: "maintenance_save_failed", status: "error", error: error.message });
    } else {
      setSetting(next); setSavedAt(now);
      const desc = next.emergency ? "🚨 NOTFALL-MODUS aktiviert" : next.enabled ? "Wartungsmodus AN" : "Wartungsmodus AUS";
      toast.success(desc);
      log({ action: next.emergency ? "maintenance_emergency_on" : next.enabled ? "maintenance_enabled" : "maintenance_disabled", status: next.emergency ? "warning" : "success", message: desc, details: { enabled: next.enabled, emergency: next.emergency } });
    }
    setSaving(false);
  }

  const isEmergencyActive = setting.enabled && setting.emergency;

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-text-3)]">
      <span className="w-4 h-4 rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)] animate-spin" />
      Lädt…
    </div>
  );

  return (
    <PageTransition>
      <PageHeader
        title="Maintenance Mode"
        subtitle="Steuert ob das Portfolio online, im Wartungsmodus oder im Notfall-Modus ist — kein Rebuild nötig."
      />

      {error && (
        <div className="mb-6 p-3 rounded-[var(--radius-md)] border text-sm text-[var(--color-danger)]"
          style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)' }}>
          {error}
        </div>
      )}

      {/* Status Banner */}
      <div className="mb-6 flex items-center gap-3">
        {isEmergencyActive
          ? <Badge variant="danger" dot>🚨 NOTFALL-MODUS AKTIV</Badge>
          : setting.enabled
          ? <Badge variant="danger" dot>WARTUNGSMODUS AKTIV</Badge>
          : <Badge variant="success" dot>PORTFOLIO ONLINE</Badge>
        }
        {savedAt && <span className="text-xs text-[var(--color-text-3)]">· gespeichert {new Date(savedAt).toLocaleString("de-DE", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" })}</span>}
      </div>

      {/* Normal Maintenance */}
      <Card className="max-w-lg mb-6 space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-[var(--color-text-1)]">Wartungsmodus</p>
            <p className="text-[var(--color-text-3)] text-xs mt-0.5">
              {setting.enabled && !isEmergencyActive ? "Besucher werden auf maintenance.html geleitet" : isEmergencyActive ? "Notfall-Modus aktiv (siehe unten)" : "Portfolio normal erreichbar"}
            </p>
          </div>
          <Switch
            checked={setting.enabled && !isEmergencyActive}
            onChange={(v) => setSetting(s => ({ ...s, enabled: v, emergency: false }))}
            disabled={isEmergencyActive || saving}
            variant="danger"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--color-text-2)] mb-1.5">
            Nachricht für Besucher <span className="text-[var(--color-text-3)]">(optional)</span>
          </label>
          <Textarea
            value={setting.message}
            onChange={(e) => setSetting(s => ({ ...s, message: e.target.value }))}
            placeholder="Wir sind gleich zurück..."
            rows={3}
            disabled={isEmergencyActive}
          />
        </div>

        <Button
          variant="primary" size="md"
          onClick={() => saveSettings({ ...setting, emergency: false })}
          loading={saving}
          disabled={isEmergencyActive}
          className="w-full justify-center"
        >
          Speichern & aktivieren
        </Button>
      </Card>

      {/* Emergency Zone */}
      <div className="max-w-lg">
        <div
          className="rounded-[var(--radius-lg)] border-2 p-6 transition-colors"
          style={{
            borderColor: isEmergencyActive ? 'var(--color-danger)' : 'rgba(239,68,68,.25)',
            background: isEmergencyActive ? 'rgba(239,68,68,.08)' : 'rgba(239,68,68,.04)',
          }}
        >
          <div className="flex items-start gap-3 mb-5">
            <ShieldAlert size={22} strokeWidth={1.75} className="text-[var(--color-danger)] mt-0.5 shrink-0" />
            <div>
              <p className="text-[var(--color-danger)] font-bold">Notfall-Modus</p>
              <p className="text-[var(--color-text-2)] text-xs mt-1">
                Für echte Notfälle (Sicherheitsvorfall, Kompromittierung). Die Seite zeigt sofort eine rote Warnvariante.
              </p>
            </div>
          </div>

          {isEmergencyActive ? (
            <Button variant="secondary" size="md" loading={saving} onClick={() => saveSettings({ enabled: false, emergency: false, message: "" })} className="w-full justify-center">
              <ShieldCheck size={14} />
              Notfall-Modus beenden
            </Button>
          ) : (
            <Button variant="danger" size="md" loading={saving} onClick={() => setEmergencyOpen(true)} className="w-full justify-center font-bold uppercase tracking-wide">
              🚨 Notfall-Modus aktivieren
            </Button>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-4 max-w-lg">
        <Card className="p-3">
          <p className="text-xs text-[var(--color-text-3)] leading-relaxed">
            <span className="text-[var(--color-text-2)] font-medium">Wie es funktioniert: </span>
            status.js auf dem Portfolio fragt Supabase alle 30s. Bei AN → Weiterleitung auf maintenance.html. Bei Netzwerkfehler bleibt die Seite normal (fail-open).
          </p>
        </Card>
      </div>

      {/* Emergency Confirmation Modal */}
      <Modal open={emergencyOpen} onClose={() => { setEmergencyOpen(false); setEmergencyTyped(""); setEmergencyMessage(""); }} title="Notfall-Modus aktivieren?" width="md">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] border" style={{ borderColor: 'rgba(239,68,68,.3)', background: 'rgba(239,68,68,.06)' }}>
            <ShieldAlert size={18} className="text-[var(--color-danger)] shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--color-text-2)]">Das Portfolio wird sofort mit der roten Notfall-Variante angezeigt. Alle Besucher sehen die Warnseite.</p>
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1.5">Nachricht <span className="text-[var(--color-text-3)]">(optional)</span></label>
            <Textarea value={emergencyMessage} onChange={e => setEmergencyMessage(e.target.value)} placeholder="z.B.: Sicherheitsvorfall — Seite vorübergehend geschlossen." rows={2} />
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-2)] mb-1.5">
              Tippe <span className="font-mono font-bold text-[var(--color-danger)]">{EMERGENCY_CONFIRM_PHRASE}</span> zur Bestätigung:
            </label>
            <Input value={emergencyTyped} onChange={e => setEmergencyTyped(e.target.value)} autoFocus className="font-mono" />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => { setEmergencyOpen(false); setEmergencyTyped(""); setEmergencyMessage(""); }}>Abbrechen</Button>
            <Button variant="danger" size="sm" loading={saving} disabled={emergencyTyped !== EMERGENCY_CONFIRM_PHRASE} onClick={async () => {
              if (emergencyTyped !== EMERGENCY_CONFIRM_PHRASE) return;
              await saveSettings({ enabled: true, emergency: true, message: emergencyMessage.trim() });
              setEmergencyOpen(false); setEmergencyTyped(""); setEmergencyMessage("");
            }}>
              🚨 Aktivieren
            </Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
