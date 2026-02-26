"use client";

import { ApiError, apiFetch } from "@/lib/api-client";
import { AuditLogRow, PaginatedResponse } from "@/lib/super-admin-types";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

type AuditFilters = {
  search: string;
  action: string;
  tenantId: string;
  from: string;
  to: string;
};

function toQueryString(filters: AuditFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.action) params.set("action", filters.action);
  if (filters.tenantId) params.set("tenantId", filters.tenantId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(page));
  params.set("limit", "25");
  return params.toString();
}

const initialPageState: PaginatedResponse<AuditLogRow> = {
  items: [],
  page: 1,
  limit: 25,
  total: 0,
};

type SortOption = "timestamp" | "action" | "resource" | "tenant";

export default function AuditLogsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const activeFilters = useMemo<AuditFilters>(
    () => ({
      search: searchParams.get("search") || "",
      action: searchParams.get("action") || "",
      tenantId: searchParams.get("tenantId") || "",
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
    }),
    [searchParams],
  );

  const [draftFilters, setDraftFilters] = useState<AuditFilters>(activeFilters);
  const [data, setData] = useState<PaginatedResponse<AuditLogRow>>(initialPageState);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setDraftFilters(activeFilters);
  }, [activeFilters]);

  const fetchLogs = useCallback(async () => {
    const queryString = toQueryString(activeFilters, page);
    try {
      setError("");
      const response = await apiFetch<PaginatedResponse<AuditLogRow>>(`/api/super-admin/audit-logs?${queryString}`);
      setData(response);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Super-admin access is required to view audit logs.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load audit logs.");
      }
      setData(initialPageState);
    }
  }, [activeFilters, page]);

  useEffect(() => {
    setLoading(true);
    void fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  const applyFilters = () => {
    const queryString = toQueryString(draftFilters, 1);
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const setPage = (nextPage: number) => {
    const safePage = Math.max(1, nextPage);
    const queryString = toQueryString(activeFilters, safePage);
    router.replace(`${pathname}?${queryString}`);
  };

  const retry = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  const sortedItems = useMemo(() => {
    const next = [...data.items];
    const direction = sortDirection === "asc" ? 1 : -1;

    next.sort((a, b) => {
      if (sortBy === "timestamp") return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
      if (sortBy === "action") return a.action.localeCompare(b.action) * direction;
      if (sortBy === "resource") return a.resource.localeCompare(b.resource) * direction;
      return (a.tenant?.name ?? "").localeCompare(b.tenant?.name ?? "") * direction;
    });

    return next;
  }, [data.items, sortBy, sortDirection]);

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(format, "super-admin-audit-logs", sortedItems, [
      { label: "Timestamp", value: (row) => new Date(row.createdAt).toLocaleString() },
      { label: "Tenant", value: (row) => row.tenant?.name ?? "Unknown tenant" },
      { label: "Actor", value: (row) => row.user?.email ?? row.user?.name ?? "System" },
      { label: "Action", value: (row) => row.action },
      { label: "Resource", value: (row) => row.resource },
    ], "Super Admin Audit Logs");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Search</span>
            <input
              value={draftFilters.search}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, search: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Action, resource, tenant..."
              aria-label="Search audit logs"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Action</span>
            <input
              value={draftFilters.action}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, action: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="CREATE, UPDATE..."
              aria-label="Filter by action"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tenant ID</span>
            <input
              value={draftFilters.tenantId}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, tenantId: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Optional tenant id"
              aria-label="Filter by tenant id"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">From</span>
            <input
              type="date"
              value={draftFilters.from}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, from: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              aria-label="Filter from date"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">To</span>
            <input
              type="date"
              value={draftFilters.to}
              onChange={(event) => setDraftFilters((prev) => ({ ...prev, to: event.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              aria-label="Filter to date"
            />
          </label>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:w-[460px]">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <option value="timestamp">Sort: Timestamp</option>
            <option value="action">Sort: Action</option>
            <option value="resource">Sort: Resource</option>
            <option value="tenant">Sort: Tenant</option>
          </select>
          <select
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          <TableExportMenu onExport={exportRows} />
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 !text-white"
          >
            Apply Filters
          </button>
          <button
            type="button"
            onClick={retry}
            disabled={refreshing}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Retry"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Timestamp</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Tenant</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">User</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Resource</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-5 py-4">
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-6 w-28 animate-pulse rounded-full bg-slate-200" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                    </td>
                  </tr>
                ))
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                    No audit logs match the current filters.
                  </td>
                </tr>
              ) : (
                sortedItems.map((log) => (
                  <tr key={log.id}>
                    <td className="px-5 py-4 text-sm text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">{log.tenant?.name ?? "Unknown tenant"}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{log.user?.email ?? log.user?.name ?? "System"}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{log.action}</span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{log.resource}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Page {data.page} of {totalPages} • {data.total} log(s)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setPage(data.page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.page >= totalPages}
              onClick={() => setPage(data.page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
