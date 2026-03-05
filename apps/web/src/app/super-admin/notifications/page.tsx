"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { ConfirmActionModal } from "@/components/super-admin/confirm-action-modal";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

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

const EMPTY_PAYLOAD: NotificationResponse = {
  items: [],
  unreadCount: 0,
  page: 1,
  limit: 25,
  total: 0,
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "/super-admin/notifications";

  const page = Math.max(1, Number(searchParams?.get("page") || "1"));
  const severity = searchParams?.get("severity") || "all";
  const unreadOnly = ["1", "true", "yes"].includes((searchParams?.get("unreadOnly") || "").toLowerCase());
  const search = searchParams?.get("search") || "";

  const [payload, setPayload] = useState<NotificationResponse>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draftSeverity, setDraftSeverity] = useState(severity);
  const [draftUnreadOnly, setDraftUnreadOnly] = useState(unreadOnly);
  const [draftSearch, setDraftSearch] = useState(search);
  const [confirmMarkAllOpen, setConfirmMarkAllOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  useEffect(() => {
    setDraftSeverity(severity);
    setDraftUnreadOnly(unreadOnly);
    setDraftSearch(search);
  }, [severity, unreadOnly, search]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (severity !== "all") params.set("severity", severity);
    if (unreadOnly) params.set("unreadOnly", "1");
    params.set("page", String(page));
    params.set("limit", "25");

    try {
      const response = await apiFetch<NotificationResponse>(`/api/super-admin/platform/notifications?${params.toString()}`, { cache: "no-store" });
      setPayload(response);
    } catch (err) {
      setPayload(EMPTY_PAYLOAD);
      setError(getErrorMessage(err, "Unable to load platform notifications."));
    } finally {
      setLoading(false);
    }
  }, [page, severity, unreadOnly]);

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

  const unreadCount = useMemo(() => payload.unreadCount ?? 0, [payload.unreadCount]);
  const filteredItems = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    if (!searchText) return payload.items;
    return payload.items.filter((item) => {
      const haystack = `${item.title} ${item.body} ${item.type}`.toLowerCase();
      return haystack.includes(searchText);
    });
  }, [payload.items, search]);

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "super-admin-notifications",
      filteredItems,
      [
        { label: "Created", value: (row) => new Date(row.createdAt).toLocaleString() },
        { label: "Type", value: (row) => row.type },
        { label: "Title", value: (row) => row.title },
        { label: "Severity", value: (row) => row.severity },
        { label: "Read", value: (row) => (row.readAt ? "Yes" : "No") },
        { label: "Body", value: (row) => row.body },
      ],
      "Super Admin Notifications",
    );
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (draftSeverity !== "all") params.set("severity", draftSeverity);
    if (draftUnreadOnly) params.set("unreadOnly", "1");
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    params.set("page", "1");
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(Math.max(1, nextPage)));
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(payload.total / payload.limit));

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
        <div className="grid gap-3 md:grid-cols-6">
          <select value={draftSeverity} onChange={(event) => setDraftSeverity(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={draftUnreadOnly} onChange={(event) => setDraftUnreadOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Unread only
          </label>
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search title or body"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-black uppercase tracking-wider text-white"
          >
            Apply
          </button>
          <div className="flex items-center justify-end gap-2">
            <TableExportMenu onExport={exportRows} label="Download" />
            <button type="button" onClick={() => setConfirmMarkAllOpen(true)} disabled={unreadCount === 0} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50">Mark all read</button>
          </div>
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
        ) : filteredItems.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-slate-500">No platform notifications match your filter.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filteredItems.map((item) => (
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

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500">
            Page {payload.page} of {totalPages} • {payload.total} notification(s)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={payload.page <= 1}
              onClick={() => setPage(payload.page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={payload.page >= totalPages}
              onClick={() => setPage(payload.page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
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
