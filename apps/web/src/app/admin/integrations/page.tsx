"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";

type IntegrationRow = {
  id: string;
  name: string;
  status: string;
};

type ActivityLogRow = {
  id: string;
  action: string;
  status: "Success" | "Failed";
  detail: string;
  createdAt: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function statusTone(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("connected") || normalized.includes("healthy") || normalized.includes("success")) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (normalized.includes("degraded") || normalized.includes("warning") || normalized.includes("pending")) {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch<IntegrationRow[]>("/api/admin/integrations/active", { cache: "no-store" });
      setIntegrations(payload);
    } catch (err) {
      setIntegrations([]);
      setError(getErrorMessage(err, "Unable to load integration status."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  const appendLog = useCallback((entry: Omit<ActivityLogRow, "id" | "createdAt">) => {
    setActivityLog((previous) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        ...entry,
      },
      ...previous,
    ].slice(0, 30));
  }, []);

  const connectedCount = useMemo(
    () => integrations.filter((integration) => integration.status.toLowerCase().includes("connected")).length,
    [integrations],
  );

  const syncGoogleCalendar = async () => {
    setBusyAction("google-sync");
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch<{ status: string; message: string }>("/api/admin/integrations/google-calendar/sync", {
        method: "POST",
      });
      setNotice(payload.message || "Google Calendar sync started.");
      appendLog({ action: "Google Calendar Sync", status: "Success", detail: payload.message || "Sync initiated." });
    } catch (err) {
      const message = getErrorMessage(err, "Unable to start Google Calendar sync.");
      setError(message);
      appendLog({ action: "Google Calendar Sync", status: "Failed", detail: message });
    } finally {
      setBusyAction(null);
    }
  };

  const exportAccounting = async (format: ExportFormat) => {
    setBusyAction(`accounting-${format}`);
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch<{ status: string; downloadUrl?: string }>("/api/admin/integrations/accounting/export", {
        method: "POST",
        ...withJsonBody({ format }),
      });
      const detail = payload.downloadUrl ? `Export ready (${format.toUpperCase()}).` : `Export requested (${format.toUpperCase()}).`;
      setNotice(detail);
      appendLog({ action: `Accounting Export (${format.toUpperCase()})`, status: "Success", detail });
    } catch (err) {
      const message = getErrorMessage(err, "Unable to export accounting records.");
      setError(message);
      appendLog({ action: `Accounting Export (${format.toUpperCase()})`, status: "Failed", detail: message });
    } finally {
      setBusyAction(null);
    }
  };

  const exportTable = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `integrations-${new Date().toISOString().slice(0, 10)}`,
      integrations,
      [
        { label: "Integration", value: (row) => row.name },
        { label: "Status", value: (row) => row.status },
      ],
      "Admin Integrations",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Integrations</p>
        <h2 className="mt-2 text-2xl font-black">Provider health, synchronization, and accounting exports.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Control external dependencies without leaving the admin console.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Providers</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{loading ? "--" : integrations.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Connected</p>
          <p className="mt-2 text-3xl font-black text-emerald-600">{loading ? "--" : connectedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Actions Logged</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{activityLog.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Control Actions</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Run sync and export flows with audit-friendly log entries.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => void syncGoogleCalendar()}
              disabled={busyAction === "google-sync"}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {busyAction === "google-sync" ? "Syncing..." : "Sync Google Calendar"}
            </button>
            <TableExportMenu onExport={exportAccounting} label="Export Accounting" />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Integration Directory</h3>
          <div className="mt-4 space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />)
            ) : integrations.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-medium text-slate-500">No integration providers configured yet.</p>
            ) : (
              integrations.map((integration) => (
                <div key={integration.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-sm font-bold text-slate-800">{integration.name}</span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusTone(integration.status)}`}>{integration.status}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">Recent Activity</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void loadIntegrations()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">
              Refresh
            </button>
            <TableExportMenu onExport={exportTable} label="Download List" />
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {activityLog.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm font-medium text-slate-500">Run any sync/export action to populate this log.</td>
                </tr>
              ) : (
                activityLog.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.action}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${row.status === "Success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{row.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{row.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
