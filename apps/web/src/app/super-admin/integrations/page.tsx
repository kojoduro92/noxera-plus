"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/console/kpi-card";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";

type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastDeliveryStatus: string;
  lastDeliveryAt?: string | null;
};

type SystemSettingsResponse = {
  maintenanceMode: boolean;
  statusPageUrl: string;
  backupWindow: string;
  backupRetentionDays: number;
  webhookEndpoints: WebhookEndpoint[];
  providerHealth: Record<string, string>;
};

const EMPTY_SETTINGS: SystemSettingsResponse = {
  maintenanceMode: false,
  statusPageUrl: "",
  backupWindow: "",
  backupRetentionDays: 0,
  webhookEndpoints: [],
  providerHealth: {},
};

function normalizeProviderLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

export default function IntegrationsAndWebhooksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = pathname ?? "/super-admin/integrations";

  const search = searchParams?.get("search") || "";

  const [draftSearch, setDraftSearch] = useState(search);
  const [settings, setSettings] = useState<SystemSettingsResponse>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingWebhookId, setCheckingWebhookId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const payload = await apiFetch<SystemSettingsResponse>("/api/super-admin/settings/system", {
        cache: "no-store",
      });
      setSettings(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load integrations workspace.");
      }
      setSettings(EMPTY_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const filteredWebhooks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return settings.webhookEndpoints;

    return settings.webhookEndpoints.filter((endpoint) =>
      [endpoint.name, endpoint.url, endpoint.lastDeliveryStatus].join(" ").toLowerCase().includes(normalizedSearch),
    );
  }, [search, settings.webhookEndpoints]);

  const providerRows = useMemo(
    () =>
      Object.entries(settings.providerHealth).map(([provider, status]) => ({
        provider,
        status,
      })),
    [settings.providerHealth],
  );

  const summary = useMemo(() => {
    const enabled = settings.webhookEndpoints.filter((endpoint) => endpoint.enabled).length;
    const healthyProviders = providerRows.filter((row) => row.status.toLowerCase() === "healthy").length;
    return {
      totalWebhooks: settings.webhookEndpoints.length,
      enabledWebhooks: enabled,
      providers: providerRows.length,
      healthyProviders,
    };
  }, [providerRows, settings.webhookEndpoints]);

  const applySearch = () => {
    const params = new URLSearchParams();
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    router.replace(params.toString() ? `${currentPath}?${params.toString()}` : currentPath);
  };

  const persistSettings = async (nextSettings: SystemSettingsResponse, successMessage: string) => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiFetch("/api/super-admin/settings/system", {
        method: "PATCH",
        ...withJsonBody(nextSettings),
      });
      setSettings(nextSettings);
      setNotice(successMessage);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to save integration settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggleWebhook = async (endpointId: string) => {
    const next = {
      ...settings,
      webhookEndpoints: settings.webhookEndpoints.map((endpoint) =>
        endpoint.id === endpointId ? { ...endpoint, enabled: !endpoint.enabled } : endpoint,
      ),
    };
    await persistSettings(next, "Webhook configuration updated.");
  };

  const updateStatusPageUrl = async () => {
    await persistSettings(settings, "Status page URL updated.");
  };

  const simulateDeliveryCheck = async (endpoint: WebhookEndpoint) => {
    setCheckingWebhookId(endpoint.id);
    setError("");
    setNotice("");

    try {
      const payload = await apiFetch<{
        webhook: WebhookEndpoint;
        status: string;
        latencyMs: number;
      }>(`/api/super-admin/settings/system/webhooks/${encodeURIComponent(endpoint.id)}/check`, {
        method: "POST",
      });

      setSettings((current) => ({
        ...current,
        webhookEndpoints: current.webhookEndpoints.map((item) => (item.id === payload.webhook.id ? payload.webhook : item)),
      }));
      setNotice(`Delivery check completed for ${endpoint.name}: ${payload.status} (${payload.latencyMs}ms).`);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to run delivery check.");
    } finally {
      setCheckingWebhookId(null);
    }
  };

  const exportWebhooks = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "super-admin-webhooks",
      filteredWebhooks,
      [
        { label: "Webhook", value: (row) => row.name },
        { label: "URL", value: (row) => row.url },
        { label: "Enabled", value: (row) => (row.enabled ? "Yes" : "No") },
        { label: "Last Status", value: (row) => row.lastDeliveryStatus },
        { label: "Last Delivery", value: (row) => (row.lastDeliveryAt ? new Date(row.lastDeliveryAt).toLocaleString() : "Never") },
      ],
      "Integrations Webhooks",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Integrations & Webhooks</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Provider status and webhook operations</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Operate webhook reliability, provider health, and integration governance from one control surface.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Webhooks" value={summary.totalWebhooks} sublabel="Configured endpoints" tone="blue" icon="chart" loading={loading} />
        <KpiCard label="Enabled" value={summary.enabledWebhooks} sublabel="Currently active" tone="teal" icon="heartbeat" loading={loading} />
        <KpiCard label="Providers" value={summary.providers} sublabel="Connected services" tone="violet" icon="users" loading={loading} />
        <KpiCard label="Healthy" value={summary.healthyProviders} sublabel="Provider status healthy" tone="emerald" icon="calendar" loading={loading} />
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search webhook or provider"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <input
            value={settings.statusPageUrl}
            onChange={(event) => setSettings((current) => ({ ...current, statusPageUrl: event.target.value }))}
            placeholder="Status page URL"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <button type="button" onClick={applySearch} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold !text-white">
            Apply
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500">
            Backup window: <span className="font-black text-slate-700">{settings.backupWindow || "N/A"}</span> • Retention: <span className="font-black text-slate-700">{settings.backupRetentionDays} days</span>
          </p>
          <button
            type="button"
            onClick={() => void updateStatusPageUrl()}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Status URL"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Webhook Endpoints</h3>
            <TableExportMenu onExport={exportWebhooks} label="Export" />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Endpoint</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading endpoints...</td>
                  </tr>
                ) : filteredWebhooks.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No webhook endpoints found.</td>
                  </tr>
                ) : (
                  filteredWebhooks.map((endpoint) => (
                    <tr key={endpoint.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-slate-900">{endpoint.name}</p>
                        <p className="text-xs text-slate-500">{endpoint.url}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${endpoint.lastDeliveryStatus === "healthy" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {endpoint.lastDeliveryStatus}
                        </span>
                        <p className="mt-1 text-xs text-slate-500">{endpoint.lastDeliveryAt ? new Date(endpoint.lastDeliveryAt).toLocaleString() : "No delivery yet"}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleWebhook(endpoint.id)}
                            disabled={saving}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${endpoint.enabled ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
                          >
                            {endpoint.enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void simulateDeliveryCheck(endpoint)}
                            disabled={saving || checkingWebhookId === endpoint.id}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            {checkingWebhookId === endpoint.id ? "Checking..." : "Check"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Provider Health</h3>
            <Link href="/super-admin/system" className="text-xs font-black text-indigo-700 hover:text-indigo-600">
              Open System Controls
            </Link>
          </div>

          <ul className="mt-3 space-y-2">
            {providerRows.length === 0 ? (
              <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">No provider health data available.</li>
            ) : (
              providerRows.map((row) => (
                <li key={row.provider} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">{normalizeProviderLabel(row.provider)}</p>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${row.status.toLowerCase() === "healthy" ? "bg-emerald-100 text-emerald-700" : row.status.toLowerCase() === "degraded" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                    {row.status}
                  </span>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </div>
  );
}
