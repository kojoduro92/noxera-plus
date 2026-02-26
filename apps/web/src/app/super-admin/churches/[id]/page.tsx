"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { PageBackButton } from "@/components/console/page-back-button";
import { PageBreadcrumbs } from "@/components/console/page-breadcrumbs";
import { ConfirmActionModal } from "@/components/super-admin/confirm-action-modal";

type TabKey = "overview" | "branches" | "users" | "roles" | "audit";

type TenantOverviewDetail = {
  id: string;
  name: string;
  domain: string;
  status: string;
  branchCount: number;
  activeBranchCount: number;
  userCount: number;
  activeUserCount: number;
  roleCount: number;
  ownerEmail: string | null;
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: { name?: string | null; price?: number | null } | null;
  profile?: {
    ownerName: string;
    ownerPhone: string | null;
    country: string | null;
    timezone: string;
    currency: string;
    denomination: string | null;
    sizeRange: string | null;
  };
  userStatusDistribution?: {
    invited: number;
    active: number;
    suspended: number;
  };
};

type TenantBranchDetailRow = {
  id: string;
  name: string;
  location?: string | null;
  isActive: boolean;
  createdAt: string;
  stats: {
    members: number;
    services: number;
    attendance: number;
    users: number;
  };
};

type TenantUserDetailRow = {
  id: string;
  name: string;
  email: string;
  status: "Invited" | "Active" | "Suspended";
  branchScopeMode: "ALL" | "RESTRICTED";
  lastSignInProvider?: string | null;
  lastLoginAt?: string | null;
  role?: {
    id: string;
    name: string;
    isSystem: boolean;
    permissionsCount: number;
  } | null;
  defaultBranch?: {
    id: string;
    name: string;
  } | null;
  allowedBranches?: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
};

type TenantRoleDetailRow = {
  id: string;
  name: string;
  isSystem: boolean;
  permissionsCount: number;
  usersAssigned: number;
  createdAt: string;
};

type AuditPreviewRow = {
  id: string;
  action: string;
  resource: string;
  createdAt: string;
  details?: Record<string, unknown> | null;
  user?: {
    id: string;
    email: string;
    name: string;
  } | null;
};

export default function TenantDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [impersonationBusy, setImpersonationBusy] = useState(false);
  const [impersonationNotice, setImpersonationNotice] = useState("");
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);

  const [overview, setOverview] = useState<TenantOverviewDetail | null>(null);
  const [branches, setBranches] = useState<TenantBranchDetailRow[]>([]);
  const [users, setUsers] = useState<TenantUserDetailRow[]>([]);
  const [roles, setRoles] = useState<TenantRoleDetailRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditPreviewRow[]>([]);

  const fetchTenantData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewPayload, branchesPayload, usersPayload, rolesPayload, auditPayload] = await Promise.all([
        apiFetch<TenantOverviewDetail>(`/api/super-admin/tenants/${id}`, { cache: "no-store" }),
        apiFetch<{ items: TenantBranchDetailRow[] }>(`/api/super-admin/tenants/${id}/branches`, { cache: "no-store" }),
        apiFetch<{ items: TenantUserDetailRow[] }>(`/api/super-admin/tenants/${id}/users`, { cache: "no-store" }),
        apiFetch<{ items: TenantRoleDetailRow[] }>(`/api/super-admin/tenants/${id}/roles`, { cache: "no-store" }),
        apiFetch<{ items: AuditPreviewRow[] }>(`/api/super-admin/tenants/${id}/audit-preview?limit=12`, { cache: "no-store" }),
      ]);

      setOverview(overviewPayload);
      setBranches(branchesPayload.items || []);
      setUsers(usersPayload.items || []);
      setRoles(rolesPayload.items || []);
      setAuditRows(auditPayload.items || []);
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load church details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchTenantData();
  }, [fetchTenantData]);

  useEffect(() => {
    const checkImpersonation = async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        if (!response.ok) {
          setImpersonating(false);
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as {
          impersonation?: { tenantId?: string } | null;
        };
        setImpersonating(Boolean(payload.impersonation?.tenantId && payload.impersonation.tenantId === id));
      } catch {
        setImpersonating(false);
      }
    };

    void checkImpersonation();
  }, [id]);

  const toggleStatus = async () => {
    if (!overview) return;

    const nextStatus = overview.status === "Active" ? "Suspended" : "Active";
    setUpdatingStatus(true);
    try {
      const updated = await apiFetch<TenantOverviewDetail>(`/api/super-admin/tenants/${id}/status`, {
        method: "PUT",
        ...withJsonBody({ status: nextStatus }),
      });
      setOverview((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Status update failed.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const startImpersonation = async () => {
    setImpersonationBusy(true);
    setImpersonationNotice("");
    setError("");
    try {
      await apiFetch(`/api/super-admin/tenants/${id}/impersonate`, { method: "POST" });
      setImpersonating(true);
      setImpersonationNotice("Impersonation started. Opening church-admin portal...");
      router.push("/admin");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to start impersonation.");
    } finally {
      setImpersonationBusy(false);
    }
  };

  const stopImpersonation = async () => {
    setImpersonationBusy(true);
    setImpersonationNotice("");
    setError("");
    try {
      await apiFetch("/api/super-admin/tenants/impersonate/stop", {
        method: "POST",
        ...withJsonBody({ tenantId: id }),
      });
      setImpersonating(false);
      setImpersonationNotice("Impersonation stopped.");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to stop impersonation.");
    } finally {
      setImpersonationBusy(false);
    }
  };

  const tabOptions: Array<{ key: TabKey; label: string }> = useMemo(
    () => [
      { key: "overview", label: "Overview" },
      { key: "branches", label: "Branches" },
      { key: "users", label: "Users" },
      { key: "roles", label: "Roles" },
      { key: "audit", label: "Audit Preview" },
    ],
    [],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 w-64 animate-pulse rounded-xl bg-slate-200" />
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <PageBackButton fallbackHref="/super-admin/churches" label="Back to Directory" />
            <PageBreadcrumbs
              items={[
                { label: "Super Admin", href: "/super-admin" },
                { label: "Churches", href: "/super-admin/churches" },
                { label: "Details" },
              ]}
            />
          </div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error || "Church not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <PageBackButton fallbackHref="/super-admin/churches" label="Back to Directory" />
              <PageBreadcrumbs
                items={[
                  { label: "Super Admin", href: "/super-admin" },
                  { label: "Churches", href: "/super-admin/churches" },
                  { label: overview.name },
                ]}
              />
            </div>
            <h2 className="text-2xl font-black text-slate-900">{overview.name}</h2>
            <p className="text-sm font-semibold text-slate-500">{overview.domain}.noxera.plus</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void (impersonating ? stopImpersonation() : startImpersonation())}
              disabled={impersonationBusy}
              className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition disabled:opacity-50 ${
                impersonating
                  ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              {impersonationBusy ? "Please wait..." : impersonating ? "Stop Impersonation" : "Impersonate Tenant"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmStatusChange(true)}
              disabled={updatingStatus}
              className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition disabled:opacity-50 ${
                overview.status === "Active"
                  ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {updatingStatus ? "Updating..." : overview.status === "Active" ? "Suspend Tenant" : "Activate Tenant"}
            </button>
          </div>
        </div>
      </section>

      {impersonationNotice && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
          {impersonationNotice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-5">
          {tabOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                tab === item.key
                  ? "bg-indigo-600 !text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === "overview" && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Tenant Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="font-black text-slate-900">{overview.status}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Plan</dt><dd className="font-black text-slate-900">{overview.plan?.name || "Trial"} ({(overview.plan?.price ?? 0) > 0 ? `$${overview.plan?.price}/mo` : "$0/mo"})</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Owner</dt><dd className="font-black text-slate-900">{overview.ownerName || "Church Owner"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Owner Email</dt><dd className="font-semibold text-slate-700">{overview.ownerEmail || "Not assigned"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Created</dt><dd className="font-semibold text-slate-700">{new Date(overview.createdAt).toLocaleString()}</dd></div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Operations Profile</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Country</dt><dd className="font-semibold text-slate-700">{overview.profile?.country || "Not set"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Timezone</dt><dd className="font-semibold text-slate-700">{overview.profile?.timezone || "UTC"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Currency</dt><dd className="font-semibold text-slate-700">{overview.profile?.currency || "USD"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Denomination</dt><dd className="font-semibold text-slate-700">{overview.profile?.denomination || "Not set"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Size Range</dt><dd className="font-semibold text-slate-700">{overview.profile?.sizeRange || "Not set"}</dd></div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Branch/User Health</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MetricChip label="Branches" value={`${overview.activeBranchCount}/${overview.branchCount}`} />
              <MetricChip label="Users" value={`${overview.activeUserCount}/${overview.userCount}`} />
              <MetricChip label="Roles" value={String(overview.roleCount)} />
              <MetricChip label="Invited Users" value={String(overview.userStatusDistribution?.invited ?? 0)} />
            </div>
          </div>
        </section>
      )}

      {tab === "branches" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Location</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Members</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Services</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Attendance</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Users</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branches.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No branches available.</td></tr>
              ) : (
                branches.map((branch) => (
                  <tr key={branch.id}>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{branch.name}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-600">{branch.location || "Not set"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{branch.stats.members}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{branch.stats.services}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{branch.stats.attendance}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{branch.stats.users}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {branch.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === "users" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Scope</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No tenant users found.</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-black text-slate-900">{user.name}</p>
                      <p className="text-xs font-medium text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{user.role?.name || "Unassigned"}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                      {user.branchScopeMode === "ALL"
                        ? "All branches"
                        : (user.allowedBranches || []).map((branch) => branch.name).join(", ") || "Restricted"}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{user.lastSignInProvider || "N/A"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                        user.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : user.status === "Invited"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === "roles" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Permissions</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Users Assigned</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No roles found.</td></tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id}>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{role.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${role.isSystem ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-700"}`}>
                        {role.isSystem ? "System" : "Custom"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{role.permissionsCount}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{role.usersAssigned}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{new Date(role.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === "audit" && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditRows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">No audit events yet.</td></tr>
              ) : (
                auditRows.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{new Date(entry.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{entry.action}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{entry.resource}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{entry.user?.email || "System"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      <ConfirmActionModal
        open={confirmStatusChange}
        busy={updatingStatus}
        title={overview.status === "Active" ? "Suspend tenant workspace?" : "Activate tenant workspace?"}
        description={overview.status === "Active"
          ? "Suspending blocks tenant admin access and pauses operational workflows until reactivated."
          : "Activating restores tenant access and operational workflows."}
        confirmLabel={overview.status === "Active" ? "Suspend tenant" : "Activate tenant"}
        tone={overview.status === "Active" ? "danger" : "primary"}
        onCancel={() => {
          if (!updatingStatus) {
            setConfirmStatusChange(false);
          }
        }}
        onConfirm={() => {
          void toggleStatus();
          setConfirmStatusChange(false);
        }}
      />
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-slate-900">{value}</p>
    </div>
  );
}
