"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KpiCard } from "@/components/console/kpi-card";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { AuditLogRow, BillingTenantRow, PaginatedResponse, SupportTicketRow } from "@/lib/super-admin-types";

type PlatformUserRow = {
  id: string;
  name: string;
  email: string;
  status: "Invited" | "Active" | "Suspended";
  tenant?: { id: string; name: string } | null;
  role?: { id: string; name: string } | null;
};

type PaginatedUsers = {
  items: PlatformUserRow[];
  page: number;
  limit: number;
  total: number;
};

type TenantRow = {
  id: string;
  name: string;
  domain: string;
  status: string;
  createdAt: string;
  plan?: { name?: string | null } | null;
  activeUserCount?: number;
  userCount?: number;
};

type BillingListResponse = PaginatedResponse<BillingTenantRow> & {
  summary: {
    mrr: number;
    activeSubscriptions: number;
  };
};

type ScheduledExportJob = {
  id: string;
  name: string;
  dataset: string;
  format: "csv" | "xlsx" | "pdf" | "json";
  cadence: string;
  enabled: boolean;
  recipients: string[];
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string;
  lastRunAt: string | null;
  lastResult: "queued" | "running" | "success" | "failed";
  lastError?: string | null;
  lastArtifactId?: string | null;
  lastArtifactGeneratedAt?: string | null;
  lastAttemptAt?: string | null;
  consecutiveFailures?: number;
  maxArtifacts?: number;
  maxRuns?: number;
};

type ScheduledExportJobsResponse = PaginatedResponse<ScheduledExportJob> & {
  summary?: {
    enabled: number;
    disabled: number;
  };
};

type ScheduledExportRun = {
  id: string;
  jobId: string;
  trigger: "manual" | "scheduled";
  status: "success" | "failed";
  startedAt: string;
  endedAt: string;
  durationMs: number;
  error: string | null;
  artifactId: string | null;
};

type ScheduledExportHistoryResponse = {
  items: ScheduledExportRun[];
  total: number;
};

const EMPTY_USERS: PaginatedUsers = { items: [], page: 1, limit: 25, total: 0 };
const EMPTY_BILLING: BillingListResponse = {
  items: [],
  page: 1,
  limit: 25,
  total: 0,
  summary: {
    mrr: 0,
    activeSubscriptions: 0,
  },
};
const EMPTY_PAGINATED: PaginatedResponse<never> = { items: [], page: 1, limit: 25, total: 0 };
const EMPTY_EXPORT_JOBS: ScheduledExportJobsResponse = {
  items: [],
  page: 1,
  limit: 25,
  total: 0,
  summary: {
    enabled: 0,
    disabled: 0,
  },
};

const DATASET_OPTIONS = [
  { value: "users", label: "Platform Users" },
  { value: "tenants", label: "Tenants" },
  { value: "billing", label: "Billing" },
  { value: "support", label: "Support" },
  { value: "audit", label: "Audit Logs" },
];

export default function DataReportsHubPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = pathname ?? "/super-admin/data-reports";

  const page = Math.max(1, Number(searchParams?.get("page") || "1"));
  const search = searchParams?.get("search") || "";

  const [draftSearch, setDraftSearch] = useState(search);
  const [usersData, setUsersData] = useState<PaginatedUsers>(EMPTY_USERS);
  const [billingData, setBillingData] = useState<BillingListResponse>(EMPTY_BILLING);
  const [supportData, setSupportData] = useState<PaginatedResponse<SupportTicketRow>>(EMPTY_PAGINATED);
  const [auditData, setAuditData] = useState<PaginatedResponse<AuditLogRow>>(EMPTY_PAGINATED);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [jobsData, setJobsData] = useState<ScheduledExportJobsResponse>(EMPTY_EXPORT_JOBS);

  const [jobForm, setJobForm] = useState({
    name: "",
    dataset: "users",
    format: "csv",
    cadence: "Weekly Monday 08:00",
    recipients: "",
    nextRunAt: "",
    maxArtifacts: "25",
    maxRuns: "50",
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [jobBusyId, setJobBusyId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyJob, setHistoryJob] = useState<ScheduledExportJob | null>(null);
  const [historyRows, setHistoryRows] = useState<ScheduledExportRun[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const commonSearch = search.trim();
      const usersParams = new URLSearchParams({ page: String(page), limit: "25" });
      const billingParams = new URLSearchParams({ page: String(page), limit: "25" });
      const supportParams = new URLSearchParams({ page: String(page), limit: "25" });
      const auditParams = new URLSearchParams({ page: String(page), limit: "25" });
      const jobsParams = new URLSearchParams({ page: "1", limit: "100" });

      if (commonSearch) {
        usersParams.set("search", commonSearch);
        billingParams.set("search", commonSearch);
        supportParams.set("search", commonSearch);
        auditParams.set("search", commonSearch);
        jobsParams.set("search", commonSearch);
      }

      const [usersPayload, billingPayload, supportPayload, auditPayload, tenantPayload, jobsPayload] = await Promise.all([
        apiFetch<PaginatedUsers>(`/api/super-admin/platform/users?${usersParams.toString()}`, { cache: "no-store" }),
        apiFetch<BillingListResponse>(`/api/super-admin/billing/tenants?${billingParams.toString()}`, { cache: "no-store" }),
        apiFetch<PaginatedResponse<SupportTicketRow>>(`/api/super-admin/support/tickets?${supportParams.toString()}`, { cache: "no-store" }),
        apiFetch<PaginatedResponse<AuditLogRow>>(`/api/super-admin/audit-logs?${auditParams.toString()}`, { cache: "no-store" }),
        apiFetch<TenantRow[]>("/api/super-admin/tenants", { cache: "no-store" }),
        apiFetch<ScheduledExportJobsResponse>(`/api/super-admin/settings/export-jobs?${jobsParams.toString()}`, { cache: "no-store" }),
      ]);

      setUsersData(usersPayload);
      setBillingData(billingPayload);
      setSupportData(supportPayload);
      setAuditData(auditPayload);
      setTenants(tenantPayload);
      setJobsData(jobsPayload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load report datasets.");
      }
      setUsersData(EMPTY_USERS);
      setBillingData(EMPTY_BILLING);
      setSupportData(EMPTY_PAGINATED as PaginatedResponse<SupportTicketRow>);
      setAuditData(EMPTY_PAGINATED as PaginatedResponse<AuditLogRow>);
      setTenants([]);
      setJobsData(EMPTY_EXPORT_JOBS);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredTenants = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return tenants;
    return tenants.filter((tenant) =>
      [tenant.name, tenant.domain, tenant.plan?.name ?? ""].join(" ").toLowerCase().includes(normalizedSearch),
    );
  }, [search, tenants]);

  const reconciliation = useMemo(() => {
    const activeTenants = tenants.filter((tenant) => tenant.status === "Active").length;
    const activeUsers = usersData.items.filter((user) => user.status === "Active").length;
    const openTickets = supportData.items.filter((ticket) => ticket.status.toLowerCase() !== "closed").length;
    return {
      activeTenants,
      activeUsers,
      openTickets,
    };
  }, [supportData.items, tenants, usersData.items]);

  const scheduledSummary = useMemo(() => {
    const enabled = jobsData.summary?.enabled ?? jobsData.items.filter((job) => job.enabled).length;
    const disabled = jobsData.summary?.disabled ?? jobsData.items.filter((job) => !job.enabled).length;
    return { enabled, disabled };
  }, [jobsData.items, jobsData.summary]);

  const applySearch = () => {
    const params = new URLSearchParams();
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    params.set("page", "1");
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(Math.max(1, nextPage)));
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const refresh = async () => {
    setRefreshing(true);
    setNotice("");
    await loadData();
    setRefreshing(false);
  };

  const createJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingJob(true);
    setError("");
    setNotice("");

    try {
      await apiFetch("/api/super-admin/settings/export-jobs", {
        method: "POST",
        ...withJsonBody({
          name: jobForm.name,
          dataset: jobForm.dataset,
          format: jobForm.format,
          cadence: jobForm.cadence,
          recipients: jobForm.recipients
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
          nextRunAt: jobForm.nextRunAt ? new Date(jobForm.nextRunAt).toISOString() : undefined,
          maxArtifacts: Number.parseInt(jobForm.maxArtifacts, 10),
          maxRuns: Number.parseInt(jobForm.maxRuns, 10),
        }),
      });

      setNotice("Scheduled export job created.");
      setJobForm((current) => ({ ...current, name: "", recipients: "", nextRunAt: "" }));
      await loadData();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to create scheduled export job.");
    } finally {
      setCreatingJob(false);
    }
  };

  const toggleJobStatus = async (job: ScheduledExportJob) => {
    setJobBusyId(job.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/settings/export-jobs/${job.id}`, {
        method: "PATCH",
        ...withJsonBody({ enabled: !job.enabled }),
      });
      setNotice(`${job.name} ${job.enabled ? "paused" : "enabled"}.`);
      await loadData();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update job status.");
    } finally {
      setJobBusyId(null);
    }
  };

  const runJobNow = async (job: ScheduledExportJob) => {
    setJobBusyId(job.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/settings/export-jobs/${job.id}`, {
        method: "PATCH",
        ...withJsonBody({ runNow: true }),
      });
      setNotice(`${job.name} executed and refreshed.`);
      await loadData();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to queue export job.");
    } finally {
      setJobBusyId(null);
    }
  };

  const downloadLatestArtifact = async (job: ScheduledExportJob) => {
    if (typeof window === "undefined") return;
    try {
      const signed = await apiFetch<{ url: string | null }>(
        `/api/super-admin/settings/export-jobs/${job.id}/download-url${job.lastArtifactId ? `?artifactId=${encodeURIComponent(job.lastArtifactId)}` : ""}`,
      );
      if (signed.url) {
        window.open(signed.url, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      // Fall back to API streaming endpoint.
    }

    const query = job.lastArtifactId ? `?artifactId=${encodeURIComponent(job.lastArtifactId)}` : "";
    window.open(`/api/super-admin/settings/export-jobs/${job.id}/download${query}`, "_blank", "noopener,noreferrer");
  };

  const updateJobRetention = async (job: ScheduledExportJob) => {
    const artifactsRaw = window.prompt(
      "Set artifact retention count (files kept per job):",
      String(job.maxArtifacts ?? 25),
    );
    if (artifactsRaw === null) return;

    const runsRaw = window.prompt(
      "Set run history retention count (runs kept per job):",
      String(job.maxRuns ?? 50),
    );
    if (runsRaw === null) return;

    const maxArtifacts = Number.parseInt(artifactsRaw, 10);
    const maxRuns = Number.parseInt(runsRaw, 10);
    if (!Number.isFinite(maxArtifacts) || maxArtifacts < 1 || !Number.isFinite(maxRuns) || maxRuns < 1) {
      setError("Retention values must be whole numbers greater than 0.");
      return;
    }

    setJobBusyId(job.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/settings/export-jobs/${job.id}`, {
        method: "PATCH",
        ...withJsonBody({ maxArtifacts, maxRuns }),
      });
      setNotice(`${job.name} retention updated.`);
      await loadData();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update retention.");
    } finally {
      setJobBusyId(null);
    }
  };

  const openJobHistory = async (job: ScheduledExportJob) => {
    setHistoryJob(job);
    setHistoryRows([]);
    setHistoryTotal(0);
    setHistoryLoading(true);
    setError("");
    try {
      const payload = await apiFetch<ScheduledExportHistoryResponse>(
        `/api/super-admin/settings/export-jobs/${job.id}/history?limit=25`,
        { cache: "no-store" },
      );
      setHistoryRows(payload.items);
      setHistoryTotal(payload.total);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to load job history.");
      setHistoryJob(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportUsers = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "report-users",
      usersData.items,
      [
        { label: "Name", value: (row) => row.name },
        { label: "Email", value: (row) => row.email },
        { label: "Tenant", value: (row) => row.tenant?.name ?? "Unlinked" },
        { label: "Role", value: (row) => row.role?.name ?? "Unassigned" },
        { label: "Status", value: (row) => row.status },
      ],
      "Users Dataset",
    );
  };

  const exportTenants = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "report-tenants",
      filteredTenants,
      [
        { label: "Tenant", value: (row) => row.name },
        { label: "Domain", value: (row) => `${row.domain}.noxera.plus` },
        { label: "Plan", value: (row) => row.plan?.name ?? "Trial" },
        { label: "Status", value: (row) => row.status },
        { label: "Members", value: (row) => row.userCount ?? 0 },
        { label: "Active Members", value: (row) => row.activeUserCount ?? 0 },
      ],
      "Tenants Dataset",
    );
  };

  const exportBilling = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "report-billing",
      billingData.items,
      [
        { label: "Tenant", value: (row) => row.name },
        { label: "Domain", value: (row) => (row.domain ? `${row.domain}.noxera.plus` : "") },
        { label: "Plan", value: (row) => row.plan?.name ?? "No plan" },
        { label: "Status", value: (row) => row.status },
        { label: "Created", value: (row) => new Date(row.createdAt).toLocaleDateString() },
      ],
      "Billing Dataset",
    );
  };

  const exportSupport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "report-support",
      supportData.items,
      [
        { label: "Subject", value: (row) => row.subject },
        { label: "Tenant", value: (row) => row.tenant?.name ?? row.tenantId },
        { label: "Status", value: (row) => row.status },
        { label: "Priority", value: (row) => row.priority },
        { label: "Updated", value: (row) => new Date(row.updatedAt).toLocaleString() },
      ],
      "Support Dataset",
    );
  };

  const exportAudit = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "report-audit",
      auditData.items,
      [
        { label: "Timestamp", value: (row) => new Date(row.createdAt).toLocaleString() },
        { label: "Tenant", value: (row) => row.tenant?.name ?? "Unknown" },
        { label: "Actor", value: (row) => row.user?.email ?? row.user?.name ?? "System" },
        { label: "Action", value: (row) => row.action },
        { label: "Resource", value: (row) => row.resource },
      ],
      "Audit Dataset",
    );
  };

  const exportJobs = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "report-scheduled-jobs",
      jobsData.items,
      [
        { label: "Name", value: (row) => row.name },
        { label: "Dataset", value: (row) => row.dataset },
        { label: "Format", value: (row) => row.format },
        { label: "Cadence", value: (row) => row.cadence },
        { label: "Enabled", value: (row) => (row.enabled ? "Yes" : "No") },
        { label: "Recipients", value: (row) => row.recipients.join(", ") },
        { label: "Next Run", value: (row) => new Date(row.nextRunAt).toLocaleString() },
        { label: "Last Run", value: (row) => (row.lastRunAt ? new Date(row.lastRunAt).toLocaleString() : "") },
      ],
      "Scheduled Export Jobs",
    );
  };

  const totalPages = Math.max(1, Math.ceil(Math.max(usersData.total, billingData.total, supportData.total, auditData.total) / 25));
  const formatDuration = (durationMs: number) => {
    if (durationMs < 1_000) return `${durationMs}ms`;
    const seconds = durationMs / 1_000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60);
    return `${minutes}m ${remainder}s`;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Data & Reporting Hub</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Cross-module exports and reconciliation</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Build consistent exports across users, tenants, billing, support, and governance datasets.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Users" value={usersData.total} sublabel="Platform directory" tone="blue" icon="users" loading={loading} />
        <KpiCard label="Tenants" value={filteredTenants.length} sublabel="Lifecycle inventory" tone="teal" icon="chart" loading={loading} />
        <KpiCard label="Billing" value={billingData.total} sublabel={`${billingData.summary.activeSubscriptions} active subscriptions`} tone="violet" icon="wallet" loading={loading} />
        <KpiCard label="Support" value={supportData.total} sublabel="Tickets in scope" tone="orange" icon="calendar" loading={loading} />
        <KpiCard label="Audit" value={auditData.total} sublabel="Governance events" tone="emerald" icon="heartbeat" loading={loading} />
        <KpiCard label="Schedules" value={jobsData.total} sublabel={`${scheduledSummary.enabled} enabled`} tone="pink" icon="chart" loading={loading} />
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
            placeholder="Search datasets and schedules"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <button type="button" onClick={applySearch} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold !text-white">
            Apply
          </button>
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Previous Page
          </button>
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Next Page
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">Shared page cursor: {page} of {totalPages}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh Snapshots"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <form onSubmit={createJob} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Schedule Export Job</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Create recurring CSV/XLSX/PDF data packs for operations.</p>
          <div className="mt-4 grid gap-3">
            <input
              value={jobForm.name}
              onChange={(event) => setJobForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Job name"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={jobForm.dataset}
                onChange={(event) => setJobForm((current) => ({ ...current, dataset: event.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {DATASET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={jobForm.format}
                onChange={(event) => setJobForm((current) => ({ ...current, format: event.target.value }))}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">XLSX</option>
                <option value="pdf">PDF</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <input
              value={jobForm.cadence}
              onChange={(event) => setJobForm((current) => ({ ...current, cadence: event.target.value }))}
              placeholder="Cadence (for example: Weekly Monday 08:00)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            />
            <input
              value={jobForm.recipients}
              onChange={(event) => setJobForm((current) => ({ ...current, recipients: event.target.value }))}
              placeholder="Recipients (comma-separated emails)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Keep artifacts
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={jobForm.maxArtifacts}
                  onChange={(event) => setJobForm((current) => ({ ...current, maxArtifacts: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Keep run history
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={jobForm.maxRuns}
                  onChange={(event) => setJobForm((current) => ({ ...current, maxRuns: event.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                />
              </label>
            </div>
            <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
              First run
              <input
                type="datetime-local"
                value={jobForm.nextRunAt}
                onChange={(event) => setJobForm((current) => ({ ...current, nextRunAt: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={creatingJob}
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold !text-white disabled:opacity-60"
          >
            {creatingJob ? "Scheduling..." : "Create Schedule"}
          </button>
        </form>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-black text-slate-900">Scheduled Export Jobs</h3>
            <TableExportMenu onExport={exportJobs} label="Export" />
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Job</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Next / Last Run</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading schedules...</td>
                  </tr>
                ) : jobsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No scheduled jobs configured.</td>
                  </tr>
                ) : (
                  jobsData.items.map((job) => {
                    const busy = jobBusyId === job.id;
                    return (
                      <tr key={job.id}>
                        <td className="px-4 py-3">
                          <p className="text-sm font-black text-slate-900">{job.name}</p>
                          <p className="text-xs text-slate-600">{job.dataset} • {job.format.toUpperCase()} • {job.cadence}</p>
                          <p className="text-xs text-slate-500">{job.recipients.join(", ") || "No recipients"}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          Next: {new Date(job.nextRunAt).toLocaleString()}
                          <br />
                          Last: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString() : "Never"}
                          {job.lastArtifactGeneratedAt ? (
                            <>
                              <br />
                              Artifact: {new Date(job.lastArtifactGeneratedAt).toLocaleString()}
                            </>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${job.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                            {job.enabled ? "Enabled" : "Paused"}
                          </span>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">Last result: {job.lastResult}</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">Failures: {job.consecutiveFailures ?? 0}</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">Retention: {job.maxArtifacts ?? 25} artifacts / {job.maxRuns ?? 50} runs</p>
                          {job.lastError ? <p className="mt-1 text-[11px] font-semibold text-rose-600">{job.lastError}</p> : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy || !job.lastArtifactId}
                              onClick={() => void downloadLatestArtifact(job)}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void openJobHistory(job)}
                              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            >
                              History
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void updateJobRetention(job)}
                              className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
                            >
                              Retention
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void runJobNow(job)}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                            >
                              Run now
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void toggleJobStatus(job)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-60 ${job.enabled ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                            >
                              {job.enabled ? "Pause" : "Enable"}
                            </button>
                          </div>
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

      {historyJob && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900">Run History: {historyJob.name}</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">{historyTotal} total runs tracked</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setHistoryJob(null);
                setHistoryRows([]);
                setHistoryTotal(0);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Run</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Trigger</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Started</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {historyLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading run history...</td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No runs recorded for this job yet.</td>
                  </tr>
                ) : (
                  historyRows.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 text-xs text-slate-700">{run.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{run.trigger}</td>
                      <td className="px-4 py-3 text-xs text-slate-700">{new Date(run.startedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">{formatDuration(run.durationMs)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${run.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {run.status}
                        </span>
                        {run.error ? <p className="mt-1 text-[11px] font-semibold text-rose-600">{run.error}</p> : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Users Dataset</h3>
            <TableExportMenu onExport={exportUsers} label="Export" />
          </div>
          <ul className="mt-3 space-y-2">
            {usersData.items.slice(0, 5).map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-black text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-600">{row.email} • {row.tenant?.name ?? "Unlinked"}</p>
              </li>
            ))}
            {usersData.items.length === 0 && <li className="text-sm text-slate-500">No users for this slice.</li>}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Tenants Dataset</h3>
            <TableExportMenu onExport={exportTenants} label="Export" />
          </div>
          <ul className="mt-3 space-y-2">
            {filteredTenants.slice(0, 5).map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-black text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-600">{row.domain}.noxera.plus • {row.plan?.name ?? "Trial"} • {row.status}</p>
              </li>
            ))}
            {filteredTenants.length === 0 && <li className="text-sm text-slate-500">No tenants for this slice.</li>}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Billing Dataset</h3>
            <TableExportMenu onExport={exportBilling} label="Export" />
          </div>
          <ul className="mt-3 space-y-2">
            {billingData.items.slice(0, 5).map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-black text-slate-900">{row.name}</p>
                <p className="text-xs text-slate-600">{row.plan?.name ?? "No plan"} • {row.status}</p>
              </li>
            ))}
            {billingData.items.length === 0 && <li className="text-sm text-slate-500">No billing rows for this slice.</li>}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Support Dataset</h3>
            <TableExportMenu onExport={exportSupport} label="Export" />
          </div>
          <ul className="mt-3 space-y-2">
            {supportData.items.slice(0, 5).map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-black text-slate-900">{row.subject}</p>
                <p className="text-xs text-slate-600">{row.status} • {row.priority} • {row.tenant?.name ?? row.tenantId}</p>
              </li>
            ))}
            {supportData.items.length === 0 && <li className="text-sm text-slate-500">No support rows for this slice.</li>}
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Audit Dataset</h3>
            <TableExportMenu onExport={exportAudit} label="Export" />
          </div>
          <ul className="mt-3 space-y-2">
            {auditData.items.slice(0, 6).map((row) => (
              <li key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm font-black text-slate-900">{row.action}</p>
                <p className="text-xs text-slate-600">{row.tenant?.name ?? "Unknown"} • {new Date(row.createdAt).toLocaleString()}</p>
              </li>
            ))}
            {auditData.items.length === 0 && <li className="text-sm text-slate-500">No audit rows for this slice.</li>}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Reconciliation Snapshot</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Tenants</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{reconciliation.activeTenants}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Users (Page)</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{reconciliation.activeUsers}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Open Tickets (Page)</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{reconciliation.openTickets}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
