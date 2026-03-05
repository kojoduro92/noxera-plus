"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { ConfirmActionModal } from "@/components/super-admin/confirm-action-modal";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

type TenantOption = {
  id: string;
  name: string;
};

type RoleOption = {
  id: string;
  name: string;
  tenant: {
    id: string;
    name: string;
  };
};

type PlatformUserRow = {
  id: string;
  name: string;
  email: string;
  status: "Invited" | "Active" | "Suspended";
  branchScopeMode: "ALL" | "RESTRICTED";
  lastSignInProvider?: string | null;
  tenant?: {
    id: string;
    name: string;
  } | null;
  role?: {
    id: string;
    name: string;
  } | null;
  branchAccess?: Array<{
    branch?: {
      id: string;
      name: string;
    } | null;
  }>;
};

type PaginatedUsers = {
  items: PlatformUserRow[];
  total: number;
  page: number;
  limit: number;
};

type RoleResponse = {
  items: RoleOption[];
  total: number;
  page: number;
  limit: number;
};

type SortOption = "name" | "status" | "tenant" | "role";

type PendingAction =
  | { type: "suspend" | "reactivate"; user: PlatformUserRow }
  | { type: "reset"; user: PlatformUserRow }
  | null;

const EMPTY_USERS: PaginatedUsers = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
};

export default function SuperAdminUsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "/super-admin/users";

  const page = Math.max(1, Number(searchParams?.get("page") || "1"));
  const search = searchParams?.get("search") || "";
  const statusFilter = searchParams?.get("status") || "";
  const tenantFilter = searchParams?.get("tenantId") || "";

  const [usersData, setUsersData] = useState<PaginatedUsers>(EMPTY_USERS);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [draftSearch, setDraftSearch] = useState(search);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftTenant, setDraftTenant] = useState(tenantFilter);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const [pendingRoleByUser, setPendingRoleByUser] = useState<Record<string, string>>({});
  const [pendingTenantByUser, setPendingTenantByUser] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftSearch(search);
    setDraftStatus(statusFilter);
    setDraftTenant(tenantFilter);
  }, [search, statusFilter, tenantFilter]);

  const statusLabelClass = useMemo(
    () => ({
      Active: "bg-emerald-100 text-emerald-700",
      Invited: "bg-amber-100 text-amber-700",
      Suspended: "bg-rose-100 text-rose-700",
    }),
    [],
  );

  const roleOptionsByTenant = useMemo(() => {
    const index = new Map<string, RoleOption[]>();
    for (const role of roles) {
      const bucket = index.get(role.tenant.id) ?? [];
      bucket.push(role);
      index.set(role.tenant.id, bucket);
    }
    return index;
  }, [roles]);

  const fetchTenantsAndRoles = useCallback(async () => {
    try {
      const [tenantsPayload, rolesPayload] = await Promise.all([
        apiFetch<Array<{ id: string; name: string }>>("/api/super-admin/tenants"),
        apiFetch<RoleResponse>("/api/super-admin/platform/roles?page=1&limit=500", { cache: "no-store" }),
      ]);
      setTenants(tenantsPayload.map((tenant) => ({ id: tenant.id, name: tenant.name })));
      setRoles(rolesPayload.items ?? []);
    } catch {
      setTenants([]);
      setRoles([]);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (tenantFilter) params.set("tenantId", tenantFilter);
      params.set("page", String(page));
      params.set("limit", "25");

      const payload = await apiFetch<PaginatedUsers>(`/api/super-admin/platform/users?${params.toString()}`, {
        cache: "no-store",
      });
      setUsersData(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load platform users.");
      }
      setUsersData(EMPTY_USERS);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, tenantFilter]);

  useEffect(() => {
    void fetchTenantsAndRoles();
  }, [fetchTenantsAndRoles]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const updateStatus = async (user: PlatformUserRow, status: "Invited" | "Active" | "Suspended") => {
    setActionBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/platform/users/${user.id}/status`, {
        method: "PATCH",
        ...withJsonBody({ status }),
      });
      setNotice(`Status updated for ${user.name}.`);
      await fetchUsers();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update user status.");
    } finally {
      setActionBusyId(null);
      setPendingAction(null);
    }
  };

  const resetAccess = async (user: PlatformUserRow) => {
    setActionBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/platform/users/${user.id}/reset-access`, {
        method: "POST",
      });
      setNotice(`Access reset requested for ${user.name}.`);
      await fetchUsers();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to reset access.");
    } finally {
      setActionBusyId(null);
      setPendingAction(null);
    }
  };

  const updateRole = async (user: PlatformUserRow) => {
    const roleId = pendingRoleByUser[user.id] ?? user.role?.id ?? "";
    if (!roleId) {
      setError("Choose a role before applying the update.");
      return;
    }

    setActionBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/platform/users/${user.id}/role`, {
        method: "PATCH",
        ...withJsonBody({ roleId }),
      });
      setNotice(`Role updated for ${user.name}.`);
      await fetchUsers();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update role.");
    } finally {
      setActionBusyId(null);
    }
  };

  const transferTenant = async (user: PlatformUserRow) => {
    const tenantId = pendingTenantByUser[user.id] ?? user.tenant?.id ?? "";
    if (!tenantId) {
      setError("Choose a tenant before applying transfer.");
      return;
    }

    setActionBusyId(user.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/platform/users/${user.id}/tenant`, {
        method: "PATCH",
        ...withJsonBody({ tenantId }),
      });
      setNotice(`Tenant assignment updated for ${user.name}.`);
      await fetchUsers();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to transfer tenant.");
    } finally {
      setActionBusyId(null);
    }
  };

  const sortedUsers = useMemo(() => {
    const next = [...usersData.items];
    const direction = sortDirection === "asc" ? 1 : -1;

    next.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * direction;
      if (sortBy === "status") return a.status.localeCompare(b.status) * direction;
      if (sortBy === "tenant") return (a.tenant?.name ?? "").localeCompare(b.tenant?.name ?? "") * direction;
      return (a.role?.name ?? "").localeCompare(b.role?.name ?? "") * direction;
    });

    return next;
  }, [sortBy, sortDirection, usersData.items]);

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "super-admin-users",
      sortedUsers,
      [
        { label: "Name", value: (row) => row.name },
        { label: "Email", value: (row) => row.email },
        { label: "Tenant", value: (row) => row.tenant?.name ?? "Unlinked" },
        { label: "Role", value: (row) => row.role?.name ?? "Unassigned" },
        { label: "Branch Scope", value: (row) => (row.branchScopeMode === "RESTRICTED" ? `${row.branchAccess?.length ?? 0} branch(es)` : "All branches") },
        { label: "Status", value: (row) => row.status },
        { label: "Provider", value: (row) => row.lastSignInProvider ?? "" },
      ],
      "Super Admin Users",
    );
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    if (draftStatus) params.set("status", draftStatus);
    if (draftTenant) params.set("tenantId", draftTenant);
    params.set("page", "1");
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(Math.max(1, nextPage)));
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(usersData.total / usersData.limit));

  const confirmTitle =
    pendingAction?.type === "suspend"
      ? "Suspend platform user?"
      : pendingAction?.type === "reactivate"
        ? "Reactivate platform user?"
        : "Reset user access?";

  const confirmDescription =
    pendingAction?.type === "suspend"
      ? "Suspending blocks this user from signing into their assigned tenant workspace."
      : pendingAction?.type === "reactivate"
        ? "Reactivating restores this user’s ability to sign in."
        : "Reset access invalidates active auth context and requires a new secure login.";

  const confirmLabel =
    pendingAction?.type === "suspend"
      ? "Suspend user"
      : pendingAction?.type === "reactivate"
        ? "Reactivate user"
        : "Reset access";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Global Users Directory</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Govern invited, active, and suspended users across every church tenant.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-7">
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search name, email, or tenant"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2"
          />
          <select
            value={draftStatus}
            onChange={(event) => setDraftStatus(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All statuses</option>
            <option value="Invited">Invited</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
          <select
            value={draftTenant}
            onChange={(event) => setDraftTenant(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All churches</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold transition hover:bg-indigo-700 !text-white"
          >
            Apply Filters
          </button>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
            <option value="tenant">Sort: Tenant</option>
            <option value="role">Sort: Role</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
            <TableExportMenu onExport={exportRows} />
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
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Branch Scope</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : sortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No platform users found for the selected filters.
                  </td>
                </tr>
              ) : (
                sortedUsers.map((user) => {
                  const tenantValue = pendingTenantByUser[user.id] ?? user.tenant?.id ?? "";
                  const tenantScopedRoles = roleOptionsByTenant.get(tenantValue) ?? [];
                  const roleValue = pendingRoleByUser[user.id] ?? user.role?.id ?? "";
                  const busy = actionBusyId === user.id;

                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-slate-900">{user.name}</p>
                        <p className="text-xs font-medium text-slate-500">{user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{user.tenant?.name ?? "Unlinked"}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-700">{user.role?.name ?? "Unassigned"}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                        {user.branchScopeMode === "RESTRICTED"
                          ? `${user.branchAccess?.length ?? 0} branch(es)`
                          : "All branches"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusLabelClass[user.status]}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="space-y-2">
                          <div className="flex justify-end gap-2">
                            {user.status === "Suspended" ? (
                              <button
                                type="button"
                                onClick={() => setPendingAction({ type: "reactivate", user })}
                                disabled={busy}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                              >
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingAction({ type: "suspend", user })}
                                disabled={busy}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                              >
                                Suspend
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setPendingAction({ type: "reset", user })}
                              disabled={busy}
                              className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                            >
                              Reset Access
                            </button>
                          </div>

                          <div className="flex justify-end gap-2">
                            <select
                              value={roleValue}
                              onChange={(event) =>
                                setPendingRoleByUser((prev) => ({
                                  ...prev,
                                  [user.id]: event.target.value,
                                }))
                              }
                              className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                              disabled={busy}
                            >
                              <option value="">Select role</option>
                              {tenantScopedRoles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void updateRole(user)}
                              disabled={busy || !roleValue}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Change Role
                            </button>
                          </div>

                          <div className="flex justify-end gap-2">
                            <select
                              value={tenantValue}
                              onChange={(event) =>
                                setPendingTenantByUser((prev) => ({
                                  ...prev,
                                  [user.id]: event.target.value,
                                }))
                              }
                              className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
                              disabled={busy}
                            >
                              <option value="">Select tenant</option>
                              {tenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>
                                  {tenant.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void transferTenant(user)}
                              disabled={busy || !tenantValue || tenantValue === (user.tenant?.id ?? "")}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Move Tenant
                            </button>
                          </div>
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
            Page {usersData.page} of {totalPages} • {usersData.total} user(s)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={usersData.page <= 1}
              onClick={() => setPage(usersData.page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={usersData.page >= totalPages}
              onClick={() => setPage(usersData.page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      <ConfirmActionModal
        open={Boolean(pendingAction)}
        busy={Boolean(pendingAction?.user && actionBusyId === pendingAction.user.id)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        tone={pendingAction?.type === "suspend" ? "danger" : "primary"}
        onCancel={() => {
          if (!actionBusyId) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => {
          if (!pendingAction) return;
          if (pendingAction.type === "suspend") {
            void updateStatus(pendingAction.user, "Suspended");
            return;
          }
          if (pendingAction.type === "reactivate") {
            void updateStatus(pendingAction.user, "Active");
            return;
          }
          void resetAccess(pendingAction.user);
        }}
      />
    </div>
  );
}
