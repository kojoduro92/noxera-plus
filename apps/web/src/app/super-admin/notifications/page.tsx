"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { downloadRowsAsCsv } from "@/lib/export-utils";
import { ConfirmActionModal } from "@/components/super-admin/confirm-action-modal";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical" | "success";
  readAt?: string | null;
  createdAt: string;
};

type NotificationResponse = {
  items: NotificationRow[];
  unreadCount: number;
  page: number;
  limit: number;
  total: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

const severityStyles: Record<string, string> = {
  info: "bg-blue-100 text-blue-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

export default function SuperAdminNotificationsPage() {
  const [payload, setPayload] = useState<NotificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [severity, setSeverity] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [confirmMarkAllOpen, setConfirmMarkAllOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (severity !== "all") params.set("severity", severity);
    if (unreadOnly) params.set("unreadOnly", "1");
    const query = params.toString() ? `?${params.toString()}` : "";

    try {
      const response = await apiFetch<NotificationResponse>(`/api/super-admin/platform/notifications${query}`, { cache: "no-store" });
      setPayload(response);
    } catch (err) {
      setPayload(null);
      setError(getErrorMessage(err, "Unable to load platform notifications."));
    } finally {
      setLoading(false);
    }
  }, [severity, unreadOnly]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id: string) => {
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/platform/notifications/${id}/read`, { method: "PATCH" });
      setNotice("Notification marked as read.");
      await loadNotifications();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to mark notification as read."));
    }
  };

  const markAllRead = async () => {
    setError("");
    setNotice("");
    setMarkingAllRead(true);
    try {
      await apiFetch(`/api/super-admin/platform/notifications/read-all`, { method: "PATCH" });
      setNotice("All platform notifications marked as read.");
      await loadNotifications();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to mark all notifications as read."));
    } finally {
      setMarkingAllRead(false);
      setConfirmMarkAllOpen(false);
    }
  };

  const unreadCount = useMemo(() => payload?.unreadCount ?? 0, [payload?.unreadCount]);
  const exportRows = () => {
    downloadRowsAsCsv("super-admin-notifications.csv", payload?.items ?? [], [
      { label: "Created", value: (row) => new Date(row.createdAt).toLocaleString() },
      { label: "Type", value: (row) => row.type },
      { label: "Title", value: (row) => row.title },
      { label: "Severity", value: (row) => row.severity },
      { label: "Read", value: (row) => (row.readAt ? "Yes" : "No") },
      { label: "Body", value: (row) => row.body },
    ]);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Platform Notifications</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Operational alerts and lifecycle reminders</h2>
        <p className="mt-2 text-sm text-slate-600">
          Unread alerts: <span className="font-black text-slate-900">{unreadCount}</span>
        </p>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Unread only
          </label>
          <button type="button" onClick={() => void loadNotifications()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">Refresh</button>
          <button type="button" onClick={exportRows} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">Download CSV</button>
          <button type="button" onClick={() => setConfirmMarkAllOpen(true)} disabled={unreadCount === 0} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50">Mark all read</button>
        </div>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded bg-slate-100" />)}</div>
        ) : (payload?.items.length ?? 0) === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-slate-500">No platform notifications match your filter.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {(payload?.items ?? []).map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-slate-900">{item.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${severityStyles[item.severity] ?? severityStyles.info}`}>{item.severity}</span>
                    {!item.readAt && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">Unread</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{item.body}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                {!item.readAt && (
                  <button type="button" onClick={() => void markRead(item.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmActionModal
        open={confirmMarkAllOpen}
        busy={markingAllRead}
        title="Mark all notifications as read?"
        description="This clears unread badges for all currently scoped platform notifications."
        confirmLabel="Mark all read"
        onCancel={() => {
          if (!markingAllRead) {
            setConfirmMarkAllOpen(false);
          }
        }}
        onConfirm={() => void markAllRead()}
      />
    </div>
  );
}
