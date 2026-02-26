"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiFetch, withJsonBody } from "@/lib/api-client";

type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastDeliveryStatus?: string | null;
  lastDeliveryAt?: string | null;
};

type SystemSettings = {
  maintenanceMode: boolean;
  statusPageUrl: string;
  backupWindow: string;
  backupRetentionDays: number;
  webhookEndpoints: WebhookEndpoint[];
  providerHealth: Record<string, string>;
};

export default function SystemControlsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    setError("");

    try {
      const payload = await apiFetch<SystemSettings>("/api/super-admin/settings/system", { cache: "no-store" });
      setSettings(payload);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to load system controls.");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiFetch("/api/super-admin/settings/system", {
        method: "PATCH",
        ...withJsonBody(settings),
      });
      setMessage("System controls saved.");
      await loadSettings();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to save system controls.");
    } finally {
      setSaving(false);
    }
  };

  const providerSummary = useMemo(() => {
    if (!settings) return [];
    return Object.entries(settings.providerHealth);
  }, [settings]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">System Management</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">System Controls</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Track provider health, webhook reliability, and backup policy from one place.</p>
      </section>

      {(error || message) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      {loading || !settings ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : (
        <form onSubmit={saveSettings} className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Platform Runtime</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(event) => setSettings((current) => current ? ({ ...current, maintenanceMode: event.target.checked }) : current)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Maintenance mode
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Status page URL
                <input
                  value={settings.statusPageUrl}
                  onChange={(event) => setSettings((current) => current ? ({ ...current, statusPageUrl: event.target.value }) : current)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Backup window
                <input
                  value={settings.backupWindow}
                  onChange={(event) => setSettings((current) => current ? ({ ...current, backupWindow: event.target.value }) : current)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500 sm:col-span-2">
                Backup retention (days)
                <input
                  type="number"
                  value={settings.backupRetentionDays}
                  onChange={(event) => setSettings((current) => current ? ({ ...current, backupRetentionDays: Number.parseInt(event.target.value, 10) || 0 }) : current)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Provider Health</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {providerSummary.map(([key, status]) => (
                <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{key}</p>
                  <p className={`mt-2 text-sm font-black ${status === "healthy" ? "text-emerald-600" : status === "degraded" ? "text-amber-600" : "text-red-600"}`}>
                    {status}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Webhook Endpoints</h3>
            <div className="mt-4 space-y-3">
              {settings.webhookEndpoints.map((endpoint, index) => (
                <div key={endpoint.id} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1.2fr_2fr_auto_auto]">
                  <input
                    value={endpoint.name}
                    onChange={(event) => setSettings((current) => {
                      if (!current) return current;
                      const next = [...current.webhookEndpoints];
                      next[index] = { ...next[index], name: event.target.value };
                      return { ...current, webhookEndpoints: next };
                    })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  />
                  <input
                    value={endpoint.url}
                    onChange={(event) => setSettings((current) => {
                      if (!current) return current;
                      const next = [...current.webhookEndpoints];
                      next[index] = { ...next[index], url: event.target.value };
                      return { ...current, webhookEndpoints: next };
                    })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  />
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={endpoint.enabled}
                      onChange={(event) => setSettings((current) => {
                        if (!current) return current;
                        const next = [...current.webhookEndpoints];
                        next[index] = { ...next[index], enabled: event.target.checked };
                        return { ...current, webhookEndpoints: next };
                      })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Enabled
                  </label>
                  <span className={`rounded-full px-2 py-1 text-center text-[10px] font-black uppercase tracking-wider ${endpoint.lastDeliveryStatus === "healthy" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {endpoint.lastDeliveryStatus ?? "unknown"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-60">
            {saving ? "Saving..." : "Save System Controls"}
          </button>
        </form>
      )}
    </div>
  );
}
