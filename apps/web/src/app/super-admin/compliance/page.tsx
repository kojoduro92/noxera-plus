"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/console/kpi-card";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { AuditLogRow, PaginatedResponse } from "@/lib/super-admin-types";

type PlatformSettingsResponse = {
  auditRetention: {
    auditLogRetentionDays: number;
    outboxRetentionDays: number;
    notificationRetentionDays: number;
  };
};

type ImpersonationRow = {
  id: string;
  action: string;
  createdAt: string;
  tenant: { name: string; domain: string };
  details: {
    superAdminEmail: string;
    startedAt?: string;
    endedAt?: string;
  };
};

type TenantOption = {
  id: string;
  name: string;
};

type ComplianceRequest = {
  id: string;
  type: "DATA_EXPORT" | "DATA_DELETION" | "RETENTION_EXCEPTION" | "ACCESS_REVIEW";
  title: string;
  description: string | null;
  tenantId: string | null;
  tenantName: string | null;
  requestedByEmail: string;
  assigneeEmail: string | null;
  status: "Pending" | "In Review" | "Approved" | "Rejected" | "Completed";
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  notes: string | null;
  workflow?: {
    slaStartedAt: string;
    slaDueAt: string | null;
    completedAt: string | null;
    lastReminderAt: string | null;
    reminderMilestonesSentHours: number[];
    reminderCount: number;
    lastEscalatedAt: string | null;
    escalationMilestonesSentHours: number[];
    escalationCount: number;
  };
};

type ComplianceRequestsResponse = PaginatedResponse<ComplianceRequest> & {
  summary?: {
    pending: number;
    inReview: number;
    completed: number;
  };
};

type ComplianceTimelineEntry = {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  note: string | null;
  status: ComplianceRequest["status"];
  requestId: string;
  requestTitle: string;
  requestType: ComplianceRequest["type"];
  tenantId: string | null;
  tenantName: string | null;
};

type ComplianceTimelineResponse = {
  items: ComplianceTimelineEntry[];
  total: number;
};

type ComplianceAutomationPolicy = {
  enabled: boolean;
  defaultSlaHours: number;
  reminderHoursBeforeDue: number[];
  escalationHoursAfterDue: number[];
  escalationRecipientEmails: string[];
};

const EMPTY_AUDIT: PaginatedResponse<AuditLogRow> = {
  items: [],
  page: 1,
  limit: 25,
  total: 0,
};

const EMPTY_RETENTION = {
  auditLogRetentionDays: 365,
  outboxRetentionDays: 90,
  notificationRetentionDays: 180,
};

const EMPTY_REQUESTS: ComplianceRequestsResponse = {
  items: [],
  page: 1,
  limit: 25,
  total: 0,
  summary: {
    pending: 0,
    inReview: 0,
    completed: 0,
  },
};

const EMPTY_AUTOMATION_POLICY: ComplianceAutomationPolicy = {
  enabled: true,
  defaultSlaHours: 72,
  reminderHoursBeforeDue: [48, 24, 4],
  escalationHoursAfterDue: [0, 24, 72],
  escalationRecipientEmails: ["compliance@noxera.plus"],
};

const REQUEST_TYPES = [
  { value: "DATA_EXPORT", label: "Data Export" },
  { value: "DATA_DELETION", label: "Data Deletion" },
  { value: "RETENTION_EXCEPTION", label: "Retention Exception" },
  { value: "ACCESS_REVIEW", label: "Access Review" },
];

const STATUS_OPTIONS: ComplianceRequest["status"][] = ["Pending", "In Review", "Approved", "Rejected", "Completed"];

export default function ComplianceCenterPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = pathname ?? "/super-admin/compliance";

  const page = Math.max(1, Number(searchParams?.get("page") || "1"));
  const search = searchParams?.get("search") || "";
  const action = searchParams?.get("action") || "";

  const [draftSearch, setDraftSearch] = useState(search);
  const [draftAction, setDraftAction] = useState(action);

  const [auditData, setAuditData] = useState<PaginatedResponse<AuditLogRow>>(EMPTY_AUDIT);
  const [impersonation, setImpersonation] = useState<ImpersonationRow[]>([]);
  const [retention, setRetention] = useState(EMPTY_RETENTION);
  const [automationPolicy, setAutomationPolicy] = useState<ComplianceAutomationPolicy>(EMPTY_AUTOMATION_POLICY);
  const [requestsData, setRequestsData] = useState<ComplianceRequestsResponse>(EMPTY_REQUESTS);
  const [timeline, setTimeline] = useState<ComplianceTimelineEntry[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState("all");

  const [requestForm, setRequestForm] = useState({
    type: "DATA_EXPORT",
    title: "",
    description: "",
    tenantId: "",
    assigneeEmail: "",
    dueAt: "",
    notes: "",
  });

  const [loading, setLoading] = useState(true);
  const [savingRetention, setSavingRetention] = useState(false);
  const [savingAutomationPolicy, setSavingAutomationPolicy] = useState(false);
  const [runningAutomationNow, setRunningAutomationNow] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDraftSearch(search);
    setDraftAction(action);
  }, [search, action]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (action.trim()) params.set("action", action.trim());
      params.set("page", String(page));
      params.set("limit", "25");

      const complianceParams = new URLSearchParams({ page: "1", limit: "50" });
      if (search.trim()) complianceParams.set("search", search.trim());
      const timelineParams = new URLSearchParams({ limit: "20" });
      if (search.trim()) timelineParams.set("search", search.trim());

      const [settingsPayload, automationPayload, auditPayload, impersonationPayload, requestsPayload, timelinePayload, tenantPayload] = await Promise.all([
        apiFetch<PlatformSettingsResponse>("/api/super-admin/settings/platform", { cache: "no-store" }),
        apiFetch<ComplianceAutomationPolicy>("/api/super-admin/settings/compliance/automation", { cache: "no-store" }),
        apiFetch<PaginatedResponse<AuditLogRow>>(`/api/super-admin/audit-logs?${params.toString()}`, { cache: "no-store" }),
        apiFetch<PaginatedResponse<ImpersonationRow>>("/api/super-admin/audit-logs/platform/impersonation?page=1&limit=10", { cache: "no-store" }),
        apiFetch<ComplianceRequestsResponse>(`/api/super-admin/settings/compliance/requests?${complianceParams.toString()}`, { cache: "no-store" }),
        apiFetch<ComplianceTimelineResponse>(`/api/super-admin/settings/compliance/timeline?${timelineParams.toString()}`, { cache: "no-store" }),
        apiFetch<Array<{ id: string; name: string }>>("/api/super-admin/tenants", { cache: "no-store" }),
      ]);

      setRetention(settingsPayload.auditRetention ?? EMPTY_RETENTION);
      setAutomationPolicy(automationPayload ?? EMPTY_AUTOMATION_POLICY);
      setAuditData(auditPayload);
      setImpersonation(impersonationPayload.items ?? []);
      setRequestsData(requestsPayload);
      setTimeline(timelinePayload.items ?? []);
      setTenants(tenantPayload.map((tenant) => ({ id: tenant.id, name: tenant.name })));
      setRequestForm((current) => {
        if (current.tenantId || tenantPayload.length === 0) return current;
        return { ...current, tenantId: tenantPayload[0].id };
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load compliance data.");
      }
      setAuditData(EMPTY_AUDIT);
      setImpersonation([]);
      setAutomationPolicy(EMPTY_AUTOMATION_POLICY);
      setRequestsData(EMPTY_REQUESTS);
      setTimeline([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [action, page, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    if (draftAction.trim()) params.set("action", draftAction.trim());
    params.set("page", "1");
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(Math.max(1, nextPage)));
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const saveRetention = async () => {
    setSavingRetention(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("/api/super-admin/settings/platform", {
        method: "PATCH",
        ...withJsonBody({
          auditRetention: {
            auditLogRetentionDays: Number(retention.auditLogRetentionDays) || 0,
            outboxRetentionDays: Number(retention.outboxRetentionDays) || 0,
            notificationRetentionDays: Number(retention.notificationRetentionDays) || 0,
          },
        }),
      });
      setNotice("Compliance retention policy updated.");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to save retention policy.");
    } finally {
      setSavingRetention(false);
    }
  };

  const saveAutomationPolicy = async () => {
    setSavingAutomationPolicy(true);
    setError("");
    setNotice("");
    try {
      const payload = await apiFetch<ComplianceAutomationPolicy>("/api/super-admin/settings/compliance/automation", {
        method: "PATCH",
        ...withJsonBody({
          enabled: automationPolicy.enabled,
          defaultSlaHours: Number(automationPolicy.defaultSlaHours) || 0,
          reminderHoursBeforeDue: automationPolicy.reminderHoursBeforeDue,
          escalationHoursAfterDue: automationPolicy.escalationHoursAfterDue,
          escalationRecipientEmails: automationPolicy.escalationRecipientEmails,
        }),
      });
      setAutomationPolicy(payload);
      setNotice("Compliance automation policy updated.");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to save automation policy.");
    } finally {
      setSavingAutomationPolicy(false);
    }
  };

  const runAutomationNow = async () => {
    setRunningAutomationNow(true);
    setError("");
    setNotice("");
    try {
      const result = await apiFetch<{
        processed: number;
        remindersSent: number;
        escalationsSent: number;
        completedAudits: number;
      }>("/api/super-admin/settings/compliance/automation/run", {
        method: "POST",
      });
      setNotice(
        `Automation run complete: ${result.processed} processed, ${result.remindersSent} reminders, ${result.escalationsSent} escalations, ${result.completedAudits} completion audits.`,
      );
      await loadData();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to run automation cycle.");
    } finally {
      setRunningAutomationNow(false);
    }
  };

  const createRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingRequest(true);
    setError("");
    setNotice("");

    try {
      const tenant = tenants.find((item) => item.id === requestForm.tenantId);
      await apiFetch("/api/super-admin/settings/compliance/requests", {
        method: "POST",
        ...withJsonBody({
          type: requestForm.type,
          title: requestForm.title,
          description: requestForm.description || null,
          tenantId: requestForm.tenantId || null,
          tenantName: tenant?.name ?? null,
          assigneeEmail: requestForm.assigneeEmail || null,
          dueAt: requestForm.dueAt ? new Date(requestForm.dueAt).toISOString() : null,
          notes: requestForm.notes || null,
        }),
      });

      setNotice("Compliance request created.");
      setRequestForm((current) => ({
        ...current,
        title: "",
        description: "",
        assigneeEmail: "",
        dueAt: "",
        notes: "",
      }));
      await loadData();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to create compliance request.");
    } finally {
      setCreatingRequest(false);
    }
  };

  const updateRequest = async (requestId: string, payload: { status?: string; assigneeEmail?: string | null; notes?: string | null }) => {
    setRequestBusyId(requestId);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/settings/compliance/requests/${requestId}`, {
        method: "PATCH",
        ...withJsonBody(payload),
      });
      setNotice("Compliance request updated.");
      await loadData();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update compliance request.");
    } finally {
      setRequestBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(auditData.total / auditData.limit));

  const filteredRequests = useMemo(() => {
    let items = [...requestsData.items];
    if (requestStatusFilter !== "all") {
      items = items.filter((item) => item.status === requestStatusFilter);
    }
    if (requestTypeFilter !== "all") {
      items = items.filter((item) => item.type === requestTypeFilter);
    }
    return items;
  }, [requestStatusFilter, requestTypeFilter, requestsData.items]);

  const auditSummary = useMemo(() => {
    const exportActions = auditData.items.filter((item) => item.action.toLowerCase().includes("export")).length;
    const deletionActions = auditData.items.filter((item) => item.action.toLowerCase().includes("delete")).length;
    const pendingRequests = requestsData.summary?.pending ?? requestsData.items.filter((item) => item.status === "Pending").length;
    const completedRequests = requestsData.summary?.completed ?? requestsData.items.filter((item) => item.status === "Completed").length;

    return {
      totalEvents: auditData.total,
      exportActions,
      deletionActions,
      pendingRequests,
      completedRequests,
      impersonationEvents: impersonation.length,
    };
  }, [auditData.items, auditData.total, impersonation.length, requestsData.items, requestsData.summary]);

  const exportAuditRows = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "super-admin-compliance-audit",
      auditData.items,
      [
        { label: "Timestamp", value: (row) => new Date(row.createdAt).toLocaleString() },
        { label: "Tenant", value: (row) => row.tenant?.name ?? "Unknown" },
        { label: "Actor", value: (row) => row.user?.email ?? row.user?.name ?? "System" },
        { label: "Action", value: (row) => row.action },
        { label: "Resource", value: (row) => row.resource },
      ],
      "Compliance Audit Logs",
    );
  };

  const exportRequestRows = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "super-admin-compliance-requests",
      filteredRequests,
      [
        { label: "ID", value: (row) => row.id },
        { label: "Type", value: (row) => row.type },
        { label: "Title", value: (row) => row.title },
        { label: "Tenant", value: (row) => row.tenantName ?? row.tenantId ?? "Platform" },
        { label: "Status", value: (row) => row.status },
        { label: "Assignee", value: (row) => row.assigneeEmail ?? "" },
        { label: "Requested By", value: (row) => row.requestedByEmail },
        { label: "SLA Due", value: (row) => (row.workflow?.slaDueAt ? new Date(row.workflow.slaDueAt).toLocaleString() : "") },
        { label: "Reminders", value: (row) => row.workflow?.reminderCount ?? 0 },
        { label: "Escalations", value: (row) => row.workflow?.escalationCount ?? 0 },
        { label: "Created", value: (row) => new Date(row.createdAt).toLocaleString() },
      ],
      "Compliance Requests",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Compliance Center</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Retention policy and governance timeline</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Manage retention controls and monitor export/deletion/impersonation-sensitive activity.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Audit Events" value={auditSummary.totalEvents} sublabel="Filtered dataset total" tone="blue" icon="chart" loading={loading} />
        <KpiCard label="Export Actions" value={auditSummary.exportActions} sublabel="Current audit page" tone="teal" icon="wallet" loading={loading} />
        <KpiCard label="Deletion Actions" value={auditSummary.deletionActions} sublabel="Current audit page" tone="orange" icon="calendar" loading={loading} />
        <KpiCard label="Pending Requests" value={auditSummary.pendingRequests} sublabel="Compliance queue" tone="violet" icon="users" loading={loading} />
        <KpiCard label="Completed" value={auditSummary.completedRequests} sublabel="Resolved workflows" tone="emerald" icon="heartbeat" loading={loading} />
        <KpiCard label="Impersonation" value={auditSummary.impersonationEvents} sublabel="Recent governance timeline" tone="pink" icon="users" loading={loading} />
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <form onSubmit={createRequest} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Create Compliance Request</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Track export/deletion/retention workflows with explicit status transitions.</p>
          <div className="mt-4 grid gap-3">
            <select
              value={requestForm.type}
              onChange={(event) => setRequestForm((current) => ({ ...current, type: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {REQUEST_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <input
              value={requestForm.title}
              onChange={(event) => setRequestForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Request title"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <textarea
              value={requestForm.description}
              onChange={(event) => setRequestForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Request details"
              className="min-h-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={requestForm.tenantId}
              onChange={(event) => setRequestForm((current) => ({ ...current, tenantId: event.target.value }))}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Platform-wide request</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
            <input
              value={requestForm.assigneeEmail}
              onChange={(event) => setRequestForm((current) => ({ ...current, assigneeEmail: event.target.value }))}
              placeholder="Assignee email (optional)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
              Due date
              <input
                type="datetime-local"
                value={requestForm.dueAt}
                onChange={(event) => setRequestForm((current) => ({ ...current, dueAt: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              />
            </label>
            <input
              value={requestForm.notes}
              onChange={(event) => setRequestForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Initial notes"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={creatingRequest}
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold !text-white disabled:opacity-60"
          >
            {creatingRequest ? "Creating..." : "Create Request"}
          </button>
        </form>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-black text-slate-900">Compliance Requests</h3>
            <TableExportMenu onExport={exportRequestRows} label="Export" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              value={requestStatusFilter}
              onChange={(event) => setRequestStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              value={requestTypeFilter}
              onChange={(event) => setRequestTypeFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All request types</option>
              {REQUEST_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Request</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading requests...</td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No compliance requests found.</td>
                  </tr>
                ) : (
                  filteredRequests.map((request) => {
                    const busy = requestBusyId === request.id;
                    return (
                      <tr key={request.id}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-slate-900">{request.title}</p>
                          <p className="text-xs text-slate-600">{request.type} • {request.tenantName ?? "Platform"}</p>
                          <p className="text-[11px] text-slate-500">{request.assigneeEmail ?? "Unassigned"}</p>
                          <p className="text-[11px] text-slate-500">
                            SLA Due: {request.workflow?.slaDueAt ? new Date(request.workflow.slaDueAt).toLocaleString() : "Not set"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={request.status}
                            onChange={(event) => void updateRequest(request.id, { status: event.target.value })}
                            disabled={busy}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-slate-500">Updated {new Date(request.updatedAt).toLocaleString()}</p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Reminders {request.workflow?.reminderCount ?? 0} • Escalations {request.workflow?.escalationCount ?? 0}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void updateRequest(request.id, { status: "Completed", notes: "Marked complete from compliance console." })}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            Complete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">Audit Governance Feed</h3>
            <TableExportMenu onExport={exportAuditRows} label="Export" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Search actor, action, resource"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <input
              value={draftAction}
              onChange={(event) => setDraftAction(event.target.value)}
              placeholder="Action filter (e.g. EXPORT)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={applyFilters} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold !text-white">
              Apply
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading governance feed...</td>
                  </tr>
                ) : auditData.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No audit records found.</td>
                  </tr>
                ) : (
                  auditData.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-xs text-slate-600">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{item.tenant?.name ?? "Unknown"}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.user?.email ?? item.user?.name ?? "System"}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">{item.action}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Page {auditData.page} of {totalPages} • {auditData.total} event(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage(auditData.page - 1)}
                disabled={auditData.page <= 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(auditData.page + 1)}
                disabled={auditData.page >= totalPages}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Workflow Automation</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Configure SLA timers, reminder milestones, escalation thresholds, and on-demand automation runs.
            </p>
            <div className="mt-4 space-y-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={automationPolicy.enabled}
                  onChange={(event) =>
                    setAutomationPolicy((current) => ({
                      ...current,
                      enabled: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Enable workflow automation
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Default SLA (hours)
                <input
                  type="number"
                  min={1}
                  value={automationPolicy.defaultSlaHours}
                  onChange={(event) =>
                    setAutomationPolicy((current) => ({
                      ...current,
                      defaultSlaHours: Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Reminder Hours Before Due (comma-separated)
                <input
                  value={automationPolicy.reminderHoursBeforeDue.join(", ")}
                  onChange={(event) =>
                    setAutomationPolicy((current) => ({
                      ...current,
                      reminderHoursBeforeDue: event.target.value
                        .split(",")
                        .map((entry) => Number.parseInt(entry.trim(), 10))
                        .filter((entry) => Number.isFinite(entry) && entry >= 0),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Escalation Hours After Due (comma-separated)
                <input
                  value={automationPolicy.escalationHoursAfterDue.join(", ")}
                  onChange={(event) =>
                    setAutomationPolicy((current) => ({
                      ...current,
                      escalationHoursAfterDue: event.target.value
                        .split(",")
                        .map((entry) => Number.parseInt(entry.trim(), 10))
                        .filter((entry) => Number.isFinite(entry) && entry >= 0),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Escalation Recipients (comma-separated emails)
                <input
                  value={automationPolicy.escalationRecipientEmails.join(", ")}
                  onChange={(event) =>
                    setAutomationPolicy((current) => ({
                      ...current,
                      escalationRecipientEmails: event.target.value
                        .split(",")
                        .map((entry) => entry.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void saveAutomationPolicy()}
                disabled={savingAutomationPolicy}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold !text-white disabled:opacity-60"
              >
                {savingAutomationPolicy ? "Saving..." : "Save Automation"}
              </button>
              <button
                type="button"
                onClick={() => void runAutomationNow()}
                disabled={runningAutomationNow}
                className="rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
              >
                {runningAutomationNow ? "Running..." : "Run Now"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Retention Policy</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Control record retention windows used by platform governance.</p>
            <div className="mt-4 space-y-3">
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Audit logs (days)
                <input
                  type="number"
                  value={retention.auditLogRetentionDays}
                  onChange={(event) =>
                    setRetention((current) => ({
                      ...current,
                      auditLogRetentionDays: Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Outbox events (days)
                <input
                  type="number"
                  value={retention.outboxRetentionDays}
                  onChange={(event) =>
                    setRetention((current) => ({
                      ...current,
                      outboxRetentionDays: Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Notifications (days)
                <input
                  type="number"
                  value={retention.notificationRetentionDays}
                  onChange={(event) =>
                    setRetention((current) => ({
                      ...current,
                      notificationRetentionDays: Number.parseInt(event.target.value, 10) || 0,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => void saveRetention()}
              disabled={savingRetention}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold !text-white disabled:opacity-60"
            >
              {savingRetention ? "Saving..." : "Save Retention Policy"}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Compliance Timeline</h3>
              <Link href="/super-admin/support?tab=impersonation" className="text-xs font-black text-indigo-700 hover:text-indigo-600">
                Open impersonation log
              </Link>
            </div>
            <ul className="mt-3 space-y-2">
              {timeline.length === 0 ? (
                <li className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  No workflow events yet.
                </li>
              ) : (
                timeline.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs font-black text-slate-900">{entry.requestTitle}</p>
                    <p className="text-xs text-slate-600">{entry.action} • {entry.actorEmail} • {entry.status}</p>
                    <p className="text-[11px] text-slate-500">{new Date(entry.at).toLocaleString()}</p>
                  </li>
                ))
              )}
            </ul>
            {impersonation.length > 0 && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Recent impersonation</p>
                <p className="mt-1 text-xs text-slate-600">{impersonation[0]?.details.superAdminEmail} • {impersonation[0]?.tenant.name}</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
