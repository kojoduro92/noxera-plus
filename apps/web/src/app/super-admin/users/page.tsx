"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRowsAsCsv } from "@/lib/export-utils";
import { ConfirmActionModal } from "@/components/super-admin/confirm-action-modal";

type TenantOption = {
  id: string;
  name: string;
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

type SortOption = "name" | "status" | "tenant" | "role";

type PendingAction =
  | { type: "suspend" | "reactivate"; user: PlatformUserRow }
  | { type: "reset"; user: PlatformUserRow }
  | null;

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<PlatformUserRow[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const statusLabelClass = useMemo(
    () => ({
      Active: "bg-emerald-100 text-emerald-700",
      Invited: "bg-amber-100 text-amber-700",
      Suspended: "bg-rose-100 text-rose-700",
    }),
    [],
  );

  const fetchTenants = useCallback(async () => {
    try {
      const payload = await apiFetch<Array<{ id: string; name: string }>>("/api/super-admin/tenants");
      setTenants(payload.map((tenant) => ({ id: tenant.id, name: tenant.name })));
    } catch {
      setTenants([]);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("search", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (tenantFilter) params.set("tenantId", tenantFilter);

      const payload = await apiFetch<PaginatedUsers>(`/api/super-admin/platform/users${params.toString() ? `?${params.toString()}` : ""}`, {
        cache: "no-store",
      });
      setUsers(payload.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load platform users.");
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, tenantFilter]);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const updateStatus = async (user: PlatformUserRow, status: "Invited" | "Active" | "Suspended") => {
    setActionBusyId(user.id);
    setError("");
    try {
      await apiFetch(`/api/super-admin/platform/users/${user.id}/status`, {
        method: "PATCH",
        ...withJsonBody({ status }),
      });
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
    try {
      await apiFetch(`/api/super-admin/platform/users/${user.id}/reset-access`, {
        method: "POST",
      });
      await fetchUsers();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to reset access.");
    } finally {
      setActionBusyId(null);
      setPendingAction(null);
    }
  };

  const sortedUsers = useMemo(() => {
    const next = [...users];
    const direction = sortDirection === "asc" ? 1 : -1;

    next.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * direction;
      if (sortBy === "status") return a.status.localeCompare(b.status) * direction;
      if (sortBy === "tenant") return (a.tenant?.name ?? "").localeCompare(b.tenant?.name ?? "") * direction;
      return (a.role?.name ?? "").localeCompare(b.role?.name ?? "") * direction;
    });

    return next;
  }, [sortBy, sortDirection, users]);

  const exportRows = () => {
    downloadRowsAsCsv("super-admin-users.csv", sortedUsers, [
      { label: "Name", value: (row) => row.name },
      { label: "Email", value: (row) => row.email },
      { label: "Tenant", value: (row) => row.tenant?.name ?? "Unlinked" },
      { label: "Role", value: (row) => row.role?.name ?? "Unassigned" },
      { label: "Branch Scope", value: (row) => (row.branchScopeMode === "RESTRICTED" ? `${row.branchAccess?.length ?? 0} branch(es)` : "All branches") },
      { label: "Status", value: (row) => row.status },
      { label: "Provider", value: (row) => row.lastSignInProvider ?? "" },
    ]);
  };

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
        <div className="grid gap-3 md:grid-cols-6">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or tenant"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All statuses</option>
            <option value="Invited">Invited</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
          <select
            value={tenantFilter}
            onChange={(event) => setTenantFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">All churches</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
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
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
          </div>
          <button
            type="button"
            onClick={exportRows}
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
          >
            Download CSV
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
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
                sortedUsers.map((user) => (
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
                      <div className="flex justify-end gap-2">
                        {user.status === "Suspended" ? (
                          <button
                            type="button"
                            onClick={() => setPendingAction({ type: "reactivate", user })}
                            disabled={actionBusyId === user.id}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingAction({ type: "suspend", user })}
                            disabled={actionBusyId === user.id}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPendingAction({ type: "reset", user })}
                          disabled={actionBusyId === user.id}
                          className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                        >
                          Reset Access
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
