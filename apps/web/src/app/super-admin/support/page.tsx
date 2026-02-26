"use client";

import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { PaginatedResponse, SupportTicketRow } from "@/lib/super-admin-types";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

const TICKET_STATUSES = ["Open", "Pending Engineer", "Resolved", "Closed"] as const;
const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

type ImpersonationLogRow = {
  id: string;
  action: string;
  createdAt: string;
  tenant: { name: string; domain: string };
  user?: { email: string; name: string };
  details: {
    superAdminEmail: string;
    startedAt?: string;
    expiresAt?: string;
    endedAt?: string;
  };
};

type TicketsResponse = PaginatedResponse<SupportTicketRow>;
type ImpersonationLogsResponse = PaginatedResponse<ImpersonationLogRow>;

type CreateFormState = {
  tenantId: string;
  subject: string;
  description: string;
  priority: string;
  assignedTo: string;
};

const initialCreateForm: CreateFormState = {
  tenantId: "",
  subject: "",
  description: "",
  priority: "Medium",
  assignedTo: "",
};

type SortOption = "updated" | "priority" | "status" | "subject";

export default function SupportTicketsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [activeTab, setActiveTab] = useState<"tickets" | "impersonation">("tickets");
  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const status = searchParams.get("status") || "";
  const priority = searchParams.get("priority") || "";
  const search = searchParams.get("search") || "";

  const [draftStatus, setDraftStatus] = useState(status);
  const [draftPriority, setDraftPriority] = useState(priority);
  const [draftSearch, setDraftSearch] = useState(search);
  const [data, setData] = useState<TicketsResponse>({
    items: [],
    page: 1,
    limit: 25,
    total: 0,
  });
  const [impersonationLogs, setImpersonationLogs] = useState<ImpersonationLogsResponse>({
    items: [],
    page: 1,
    limit: 25,
    total: 0,
  });
  const [createForm, setCreateForm] = useState<CreateFormState>(initialCreateForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setDraftStatus(status);
    setDraftPriority(priority);
    setDraftSearch(search);
  }, [priority, search, status]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", "25");
    return params.toString();
  }, [page, priority, search, status]);

  const loadTickets = useCallback(async () => {
    try {
      setError("");
      const response = await apiFetch<TicketsResponse>(`/api/super-admin/support/tickets?${queryString}`);
      setData(response);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load support tickets.");
      }
    }
  }, [queryString]);

  const loadImpersonationLogs = useCallback(async () => {
    try {
      setError("");
      const response = await apiFetch<ImpersonationLogsResponse>(`/api/super-admin/audit-logs/platform/impersonation?${queryString}`);
      setImpersonationLogs(response);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to load impersonation logs.");
    }
  }, [queryString]);

  useEffect(() => {
    setLoading(true);
    if (activeTab === "tickets") {
      void loadTickets().finally(() => setLoading(false));
    } else {
      void loadImpersonationLogs().finally(() => setLoading(false));
    }
  }, [activeTab, loadImpersonationLogs, loadTickets]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (draftStatus) params.set("status", draftStatus);
    if (draftPriority) params.set("priority", draftPriority);
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(Math.max(1, nextPage)));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const submitCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");

    try {
      await apiFetch<SupportTicketRow>("/api/super-admin/support/tickets", {
        method: "POST",
        ...withJsonBody(createForm),
      });
      setCreateForm(initialCreateForm);
      setNotice("Support ticket created.");
      await loadTickets();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to create support ticket.");
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (ticketId: string, nextStatus: string) => {
    setUpdatingTicketId(ticketId);
    setError("");
    setNotice("");
    try {
      const updated = await apiFetch<SupportTicketRow>(`/api/super-admin/support/tickets/${ticketId}/status`, {
        method: "PATCH",
        ...withJsonBody({ status: nextStatus }),
      });
      setData((prev) => ({
        ...prev,
        items: prev.items.map((ticket) => (ticket.id === ticketId ? updated : ticket)),
      }));
      setNotice("Ticket status updated.");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update ticket status.");
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const assignTicket = async (ticketId: string, assignedTo: string) => {
    setUpdatingTicketId(ticketId);
    setError("");
    setNotice("");
    try {
      const updated = await apiFetch<SupportTicketRow>(`/api/super-admin/support/tickets/${ticketId}/assign`, {
        method: "PATCH",
        ...withJsonBody({ assignedTo }),
      });
      setData((prev) => ({
        ...prev,
        items: prev.items.map((ticket) => (ticket.id === ticketId ? updated : ticket)),
      }));
      setNotice("Ticket assignment updated.");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to assign ticket.");
    } finally {
      setUpdatingTicketId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  const sortedItems = useMemo(() => {
    const next = [...data.items];
    const direction = sortDirection === "asc" ? 1 : -1;
    next.sort((a, b) => {
      if (sortBy === "updated") return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
      if (sortBy === "priority") return a.priority.localeCompare(b.priority) * direction;
      if (sortBy === "status") return a.status.localeCompare(b.status) * direction;
      return a.subject.localeCompare(b.subject) * direction;
    });
    return next;
  }, [data.items, sortBy, sortDirection]);

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(format, "super-admin-support-tickets", sortedItems, [
      { label: "Subject", value: (row) => row.subject },
      { label: "Tenant", value: (row) => row.tenant?.name ?? row.tenantId },
      { label: "Status", value: (row) => row.status },
      { label: "Priority", value: (row) => row.priority },
      { label: "Assigned To", value: (row) => row.assignedTo ?? "" },
      { label: "Updated", value: (row) => new Date(row.updatedAt).toLocaleString() },
    ], "Super Admin Support Tickets");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("tickets")}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider transition ${
            activeTab === "tickets"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          Support Tickets
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("impersonation")}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider transition ${
            activeTab === "impersonation"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          Impersonation Logs
        </button>
      </div>

      {activeTab === "tickets" && (
        <form onSubmit={submitCreateTicket} className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-bold text-slate-900">Create Support Ticket</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={createForm.tenantId}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, tenantId: event.target.value }))}
            placeholder="Tenant ID"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            required
          />
          <input
            value={createForm.subject}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, subject: event.target.value }))}
            placeholder="Subject"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            required
          />
          <textarea
            value={createForm.description}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Describe the issue..."
            className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2"
            required
          />
          <select
            value={createForm.priority}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, priority: event.target.value }))}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            {TICKET_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <input
            value={createForm.assignedTo}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
            placeholder="Assigned to (optional)"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold transition hover:bg-indigo-700 disabled:opacity-60 !text-white"
        >
          {creating ? "Creating..." : "Create Ticket"}
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-6">
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search subject, tenant, assignee"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <select
            value={draftStatus}
            onChange={(event) => setDraftStatus(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            value={draftPriority}
            onChange={(event) => setDraftPriority(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All priorities</option>
            {TICKET_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold transition hover:bg-indigo-700 !text-white"
          >
            Apply Filters
          </button>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="updated">Sort: Updated</option>
            <option value="priority">Sort: Priority</option>
            <option value="status">Sort: Status</option>
            <option value="subject">Sort: Subject</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
            <TableExportMenu onExport={exportRows} label="Export" />
          </div>
        </div>
      </div>

      {error && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadTickets()}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}

      {activeTab === "tickets" ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Subject</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Tenant</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Priority</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Assigned To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-5 py-4"><div className="h-4 w-36 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-28 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-9 w-40 animate-pulse rounded-xl bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-9 w-32 animate-pulse rounded-xl bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-9 w-40 animate-pulse rounded-xl bg-slate-200" /></td>
                      </tr>
                    ))
                  ) : sortedItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">No support tickets found.</td></tr>
                  ) : (
                    sortedItems.map((ticket) => (
                      <tr key={ticket.id}>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <p className="text-sm font-semibold text-slate-900">{ticket.subject}</p>
                          <p className="text-xs text-slate-500">{new Date(ticket.updatedAt).toLocaleString()}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700 whitespace-nowrap">{ticket.tenant?.name ?? ticket.tenantId}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <select
                            value={ticket.status}
                            onChange={(event) => void updateStatus(ticket.id, event.target.value)}
                            disabled={updatingTicketId === ticket.id}
                            className="w-44 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                          >
                            {TICKET_STATUSES.map((value) => (
                              <option key={value} value={value}>{value}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{ticket.priority}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              const formData = new FormData(event.currentTarget);
                              const assignedTo = String(formData.get("assignedTo") || "");
                              void assignTicket(ticket.id, assignedTo);
                            }}
                            className="flex gap-2"
                          >
                            <input
                              name="assignedTo"
                              defaultValue={ticket.assignedTo ?? ""}
                              placeholder="assignee@email.com"
                              className="w-44 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                            <button
                              type="submit"
                              disabled={updatingTicketId === ticket.id}
                              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            >
                              Save
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <p className="text-xs text-slate-500">Page {data.page} of {Math.ceil(data.total / data.limit) || 1} • {data.total} ticket(s)</p>
              <div className="flex gap-2">
                <button type="button" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Previous</button>
                <button type="button" disabled={data.page >= Math.ceil(data.total / data.limit)} onClick={() => setPage(data.page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        </>
      ) : (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Admin Actor</th>
                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Church Tenant</th>
                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Action Type</th>
                <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-4"><div className="h-4 w-36 animate-pulse rounded bg-slate-200" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-28 animate-pulse rounded bg-slate-200" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /></td>
                    </tr>
                  ))
                ) : impersonationLogs.items.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">No impersonation events found.</td></tr>
                ) : (
                  impersonationLogs.items.map((log) => (
                    <tr key={log.id}>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-sm font-black text-slate-900">{log.details.superAdminEmail}</p>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-slate-700">{log.tenant.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{log.tenant.domain}.noxera.plus</p>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${log.action === "IMPERSONATION_START" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                          {log.action.replace("IMPERSONATION_", "")}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <p className="text-xs text-slate-500">Page {impersonationLogs.page} of {Math.ceil(impersonationLogs.total / impersonationLogs.limit) || 1} • {impersonationLogs.total} log(s)</p>
            <div className="flex gap-2">
              <button type="button" disabled={impersonationLogs.page <= 1} onClick={() => setPage(impersonationLogs.page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Previous</button>
              <button type="button" disabled={impersonationLogs.page >= Math.ceil(impersonationLogs.total / impersonationLogs.limit)} onClick={() => setPage(impersonationLogs.page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
