"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

interface MaintenanceSetting {
  enabled: boolean;
  emergency?: boolean;
  message: string;
}

const EMERGENCY_CONFIRM_PHRASE = "NOTFALL";

export default function MaintenancePage() {
  const [setting, setSetting] = useState<MaintenanceSetting>({
    enabled: false,
    emergency: false,
    message: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Emergency-Modal State
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyTyped, setEmergencyTyped] = useState("");
  const [emergencyMessage, setEmergencyMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("settings")
      .select("value, updated_at")
      .eq("key", "maintenance_mode")
      .single()
      .then(({ data, error }) => {
        if (error) {
          setError("Fehler beim Laden: " + error.message);
        } else {
          const val = data.value as MaintenanceSetting;
          setSetting({
            enabled: val.enabled ?? false,
            emergency: val.emergency ?? false,
            message: val.message ?? "",
          });
          setSavedAt(data.updated_at);
        }
        setLoading(false);
      });
  }, []);

  async function saveSettings(next: MaintenanceSetting) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("settings")
      .update({ value: next, updated_at: now })
      .eq("key", "maintenance_mode");

    if (error) {
      setError("Fehler beim Speichern: " + error.message);
    } else {
      setSetting(next);
      setSavedAt(now);
    }
    setSaving(false);
  }

  async function save() {
    // Beim normalen Speichern: emergency immer false (Notfall geht nur über den roten Button)
    await saveSettings({ ...setting, emergency: false });
  }

  async function activateEmergency() {
    if (emergencyTyped !== EMERGENCY_CONFIRM_PHRASE) return;
    const next: MaintenanceSetting = {
      enabled: true,
      emergency: true,
      message: emergencyMessage.trim(),
    };
    await saveSettings(next);
    setEmergencyOpen(false);
    setEmergencyTyped("");
    setEmergencyMessage("");
  }

  async function deactivateEmergency() {
    await saveSettings({ enabled: false, emergency: false, message: "" });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
        Lädt...
      </div>
    );
  }

  const isEmergencyActive = setting.enabled && setting.emergency;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Maintenance Mode</h2>
      <p className="text-gray-400 mb-8">
        Steuert ob das Portfolio online, im Wartungsmodus oder im Notfall-Modus
        ist — in Echtzeit, kein Rebuild nötig.
      </p>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* === Normaler Wartungsmodus === */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">Wartungsmodus</p>
            <p className="text-gray-500 text-sm mt-0.5">
              {setting.enabled && !setting.emergency
                ? "Besucher werden auf maintenance.html weitergeleitet"
                : setting.enabled && setting.emergency
                ? "Notfall-Modus aktiv (siehe unten)"
                : "Portfolio ist normal erreichbar"}
            </p>
          </div>
          <button
            onClick={() =>
              setSetting((s) => ({ ...s, enabled: !s.enabled, emergency: false }))
            }
            disabled={isEmergencyActive}
            className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
              setting.enabled && !setting.emergency
                ? "bg-red-500"
                : "bg-gray-700"
            }`}
            aria-label="Wartungsmodus umschalten"
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                setting.enabled && !setting.emergency
                  ? "translate-x-7"
                  : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Status Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
            isEmergencyActive
              ? "bg-red-700/20 text-red-300 border-red-700/40"
              : setting.enabled
              ? "bg-red-500/10 text-red-400 border-red-500/20"
              : "bg-green-500/10 text-green-400 border-green-500/20"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              setting.enabled
                ? isEmergencyActive
                  ? "bg-red-500 animate-pulse"
                  : "bg-red-400 animate-pulse"
                : "bg-green-400"
            }`}
          />
          {isEmergencyActive
            ? "🚨 NOTFALL-MODUS AKTIV"
            : setting.enabled
            ? "WARTUNGSMODUS AKTIV"
            : "PORTFOLIO ONLINE"}
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Nachricht für Besucher{" "}
            <span className="text-gray-600">
              (optional — wird auf maintenance.html angezeigt)
            </span>
          </label>
          <textarea
            value={setting.message}
            onChange={(e) =>
              setSetting((s) => ({ ...s, message: e.target.value }))
            }
            placeholder="Wir sind gleich zurück..."
            rows={3}
            disabled={isEmergencyActive}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
          />
        </div>

        <button
          onClick={save}
          disabled={saving || isEmergencyActive}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {saving ? "Speichert..." : "Speichern & aktivieren"}
        </button>

        {savedAt && !error && (
          <p className="text-xs text-gray-600 text-center">
            Zuletzt gespeichert:{" "}
            {new Date(savedAt).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* === NOTFALL-BEREICH === */}
      <div className="mt-8 max-w-lg">
        <div
          className={`border-2 rounded-xl p-6 transition-colors ${
            isEmergencyActive
              ? "border-red-500 bg-red-950/30"
              : "border-red-900/40 bg-red-950/10"
          }`}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="text-3xl">🚨</div>
            <div>
              <p className="text-red-300 font-bold text-lg">Notfall-Modus</p>
              <p className="text-red-200/70 text-sm mt-1">
                Für echte Notfälle (Sicherheitsvorfall, Hacker-Angriff,
                Kompromittierung). Die Seite zeigt sofort eine rote
                Warnvariante statt der freundlichen Wartungsseite.
              </p>
            </div>
          </div>

          {isEmergencyActive ? (
            <button
              onClick={deactivateEmergency}
              disabled={saving}
              className="w-full bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {saving ? "Wird beendet..." : "Notfall-Modus beenden"}
            </button>
          ) : (
            <button
              onClick={() => setEmergencyOpen(true)}
              disabled={saving}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors uppercase tracking-wide"
            >
              🚨 Notfall-Modus aktivieren
            </button>
          )}
        </div>
      </div>

      {/* === Info Box === */}
      <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4 max-w-lg">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">Wie es funktioniert: </span>
          status.js auf dem Portfolio fragt Supabase alle 30 Sek. Bei AN →
          Weiterleitung auf maintenance.html, bei AUS → zurück zur Startseite.
          Tab im Hintergrund pausiert das Polling. Bei Netzwerkfehler bleibt
          die Seite normal (fail-open).
        </p>
      </div>

      {/* === Emergency Confirmation Modal === */}
      {emergencyOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border-2 border-red-500 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-4xl">🚨</div>
              <div>
                <h3 className="text-red-400 font-bold text-xl">
                  Notfall-Modus aktivieren?
                </h3>
                <p className="text-gray-400 text-sm mt-2">
                  Das Portfolio wird sofort mit der roten Notfall-Variante
                  angezeigt. Alle Besucher sehen die Warnseite. Du kannst es
                  jederzeit wieder deaktivieren.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Nachricht (optional){" "}
                <span className="text-gray-600">— sonst Standard-Text</span>
              </label>
              <textarea
                value={emergencyMessage}
                onChange={(e) => setEmergencyMessage(e.target.value)}
                placeholder="z.B.: Sicherheitsvorfall — Seite vorübergehend geschlossen."
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Tippe{" "}
                <span className="text-red-400 font-mono font-bold">
                  {EMERGENCY_CONFIRM_PHRASE}
                </span>{" "}
                zur Bestätigung:
              </label>
              <input
                type="text"
                value={emergencyTyped}
                onChange={(e) => setEmergencyTyped(e.target.value)}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEmergencyOpen(false);
                  setEmergencyTyped("");
                  setEmergencyMessage("");
                }}
                disabled={saving}
                className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white py-2.5 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={activateEmergency}
                disabled={
                  emergencyTyped !== EMERGENCY_CONFIRM_PHRASE || saving
                }
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors"
              >
                {saving ? "Aktiviert..." : "🚨 Aktivieren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
