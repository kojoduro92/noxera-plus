"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/components/console/kpi-card";
import { ConfirmActionModal } from "@/components/super-admin/confirm-action-modal";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";

type TenantRow = {
  id: string;
  name: string;
  domain: string;
  status: "Active" | "Suspended" | string;
  createdAt: string;
  plan?: {
    id?: string;
    name?: string | null;
    price?: number | null;
  } | null;
  branchCount?: number;
  activeBranchCount?: number;
  userCount?: number;
  activeUserCount?: number;
  invitedUserCount?: number;
  ownerEmail?: string | null;
  ownerName?: string | null;
  country?: string | null;
};

type SortOption = "name" | "status" | "created" | "users";

const PAGE_SIZE = 25;

function getOnboardingState(tenant: TenantRow) {
  if (tenant.status === "Suspended") return "Paused";
  if ((tenant.invitedUserCount ?? 0) > 0) return "Owner Invite Pending";
  if ((tenant.activeUserCount ?? 0) === 0) return "Workspace Setup";
  return "Operational";
}

function getOnboardingClass(value: string) {
  if (value === "Operational") return "bg-emerald-100 text-emerald-700";
  if (value === "Owner Invite Pending") return "bg-amber-100 text-amber-700";
  if (value === "Paused") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function TenantLifecyclePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = pathname ?? "/super-admin/tenant-lifecycle";

  const page = Math.max(1, Number(searchParams?.get("page") || "1"));
  const search = searchParams?.get("search") || "";
  const statusFilter = searchParams?.get("status") || "";

  const [draftSearch, setDraftSearch] = useState(search);
  const [draftStatusFilter, setDraftStatusFilter] = useState(statusFilter);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("created");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [confirmTenant, setConfirmTenant] = useState<TenantRow | null>(null);
  const [busyTenantId, setBusyTenantId] = useState<string | null>(null);

  useEffect(() => {
    setDraftSearch(search);
    setDraftStatusFilter(statusFilter);
  }, [search, statusFilter]);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch<TenantRow[]>("/api/super-admin/tenants", { cache: "no-store" });
      setTenants(response);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load tenant lifecycle data.");
      }
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const filteredAndSorted = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = tenants.filter((tenant) => {
      if (statusFilter && tenant.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      return [tenant.name, tenant.domain, tenant.ownerEmail ?? "", tenant.ownerName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

    const direction = sortDirection === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * direction;
      if (sortBy === "status") return a.status.localeCompare(b.status) * direction;
      if (sortBy === "users") return ((a.userCount ?? 0) - (b.userCount ?? 0)) * direction;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
    });

    return filtered;
  }, [search, sortBy, sortDirection, statusFilter, tenants]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, safePage]);

  const summary = useMemo(() => {
    const active = tenants.filter((tenant) => tenant.status === "Active").length;
    const suspended = tenants.filter((tenant) => tenant.status === "Suspended").length;
    const trials = tenants.filter((tenant) => (tenant.plan?.name ?? "").toLowerCase() === "trial").length;
    return {
      total: tenants.length,
      active,
      suspended,
      trials,
    };
  }, [tenants]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    if (draftStatusFilter) params.set("status", draftStatusFilter);
    params.set("page", "1");
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(Math.max(1, nextPage)));
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const updateStatus = async (tenant: TenantRow, nextStatus: "Active" | "Suspended") => {
    setBusyTenantId(tenant.id);
    setError("");
    setNotice("");

    try {
      const updated = await apiFetch<TenantRow>(`/api/super-admin/tenants/${tenant.id}/status`, {
        method: "PUT",
        ...withJsonBody({ status: nextStatus }),
      });
      setTenants((current) => current.map((item) => (item.id === tenant.id ? { ...item, status: updated.status } : item)));
      setNotice(`${tenant.name} moved to ${nextStatus} state.`);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update tenant status.");
    } finally {
      setBusyTenantId(null);
      setConfirmTenant(null);
    }
  };

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "super-admin-tenant-lifecycle",
      filteredAndSorted,
      [
        { label: "Tenant", value: (row) => row.name },
        { label: "Domain", value: (row) => `${row.domain}.noxera.plus` },
        { label: "Plan", value: (row) => row.plan?.name ?? "Trial" },
        { label: "Status", value: (row) => row.status },
        { label: "Onboarding", value: (row) => getOnboardingState(row) },
        { label: "Users", value: (row) => row.userCount ?? 0 },
        { label: "Branches", value: (row) => row.branchCount ?? 0 },
        { label: "Created", value: (row) => new Date(row.createdAt).toLocaleDateString() },
      ],
      "Tenant Lifecycle",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Tenant Lifecycle</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Activation, suspension, and onboarding health</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Centralize tenant state transitions, owner activation readiness, and lifecycle visibility.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiCard label="Total Tenants" value={summary.total} sublabel="All workspaces" tone="blue" icon="users" loading={loading} />
        <KpiCard label="Active" value={summary.active} sublabel="Serving live churches" tone="emerald" icon="heartbeat" loading={loading} />
        <KpiCard label="Suspended" value={summary.suspended} sublabel="Requires intervention" tone="orange" icon="chart" loading={loading} />
        <KpiCard label="Trial Plan" value={summary.trials} sublabel="Onboarding cohorts" tone="violet" icon="calendar" loading={loading} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search tenant, domain, owner"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={draftStatusFilter}
            onChange={(event) => setDraftStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="created">Sort: Created</option>
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
            <option value="users">Sort: Users</option>
          </select>
          <select
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold !text-white"
            >
              Apply
            </button>
            <TableExportMenu onExport={exportRows} label="Export" />
          </div>
        </div>
      </section>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Lifecycle State</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Onboarding State</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Activity</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                    Loading tenant lifecycle data...
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                    No tenants match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((tenant) => {
                  const onboarding = getOnboardingState(tenant);
                  const isBusy = busyTenantId === tenant.id;
                  const nextStatus = tenant.status === "Active" ? "Suspended" : "Active";

                  return (
                    <tr key={tenant.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-slate-900">{tenant.name}</p>
                        <p className="text-xs font-semibold text-slate-500">{tenant.domain}.noxera.plus</p>
                        <p className="text-xs text-slate-500">{tenant.ownerEmail ?? "No owner email"}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{tenant.plan?.name ?? "Trial"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${tenant.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {tenant.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${getOnboardingClass(onboarding)}`}>
                          {onboarding}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                        {(tenant.activeUserCount ?? 0)}/{tenant.userCount ?? 0} users active
                        <br />
                        {(tenant.activeBranchCount ?? 0)}/{tenant.branchCount ?? 0} branches live
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{new Date(tenant.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/super-admin/churches/${tenant.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            Details
                          </Link>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmTenant(tenant)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                              tenant.status === "Active"
                                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {isBusy ? "Updating..." : nextStatus === "Active" ? "Activate" : "Suspend"}
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

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500">
            Page {safePage} of {totalPages} • {filteredAndSorted.length} tenant(s)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <ConfirmActionModal
        open={Boolean(confirmTenant)}
        busy={Boolean(confirmTenant && busyTenantId === confirmTenant.id)}
        title={confirmTenant?.status === "Active" ? "Suspend tenant?" : "Activate tenant?"}
        description={
          confirmTenant?.status === "Active"
            ? "Suspending this tenant blocks workspace access until reactivation."
            : "Reactivation restores access for the tenant workspace."
        }
        confirmLabel={confirmTenant?.status === "Active" ? "Suspend tenant" : "Activate tenant"}
        tone={confirmTenant?.status === "Active" ? "danger" : "primary"}
        onCancel={() => {
          if (!busyTenantId) {
            setConfirmTenant(null);
          }
        }}
        onConfirm={() => {
          if (!confirmTenant) return;
          void updateStatus(confirmTenant, confirmTenant.status === "Active" ? "Suspended" : "Active");
        }}
      />
    </div>
  );
}
