"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

interface MaintenanceSetting {
  enabled: boolean;
  message: string;
}

export default function MaintenancePage() {
  const [setting, setSetting] = useState<MaintenanceSetting>({ enabled: false, message: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          setSetting(data.value as MaintenanceSetting);
          setSavedAt(data.updated_at);
        }
        setLoading(false);
      });
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("settings")
      .update({ value: setting, updated_at: now })
      .eq("key", "maintenance_mode");

    if (error) {
      setError("Fehler beim Speichern: " + error.message);
    } else {
      setSavedAt(now);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-600 border-t-violet-500 rounded-full animate-spin" />
        Lädt...
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-1">Maintenance Mode</h2>
      <p className="text-gray-400 mb-8">
        Steuert ob das Portfolio online oder im Wartungsmodus ist — in Echtzeit, kein Rebuild nötig.
      </p>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-lg space-y-6">

        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">Wartungsmodus</p>
            <p className="text-gray-500 text-sm mt-0.5">
              {setting.enabled
                ? "Besucher werden auf maintenance.html weitergeleitet"
                : "Portfolio ist normal erreichbar"}
            </p>
          </div>
          <button
            onClick={() => setSetting((s) => ({ ...s, enabled: !s.enabled }))}
            className={`relative w-14 h-7 rounded-full transition-colors duration-200 focus:outline-none ${
              setting.enabled ? "bg-red-500" : "bg-gray-700"
            }`}
            aria-label="Wartungsmodus umschalten"
          >
            <span
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                setting.enabled ? "translate-x-7" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Status Badge */}
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
            setting.enabled
              ? "bg-red-500/10 text-red-400 border-red-500/20"
              : "bg-green-500/10 text-green-400 border-green-500/20"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              setting.enabled ? "bg-red-400 animate-pulse" : "bg-green-400"
            }`}
          />
          {setting.enabled ? "WARTUNGSMODUS AKTIV" : "PORTFOLIO ONLINE"}
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Nachricht für Besucher{" "}
            <span className="text-gray-600">(optional — wird auf maintenance.html angezeigt)</span>
          </label>
          <textarea
            value={setting.message}
            onChange={(e) => setSetting((s) => ({ ...s, message: e.target.value }))}
            placeholder="Wir sind gleich zurück..."
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
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

      {/* Info Box */}
      <div className="mt-4 bg-gray-900/50 border border-gray-800 rounded-xl p-4 max-w-lg">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="text-gray-400 font-medium">Wie es funktioniert: </span>
          status.js auf dem Portfolio fragt Supabase beim Seitenaufruf an (max. 2 Sek. Timeout).
          Wenn aktiv → sofortige Weiterleitung auf maintenance.html, kein Rebuild nötig.
          Bei Netzwerkfehler wird die Seite normal angezeigt (fail-open).
        </p>
      </div>
    </div>
  );
}
