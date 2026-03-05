"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
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
  tenant?: {
    id: string;
    name: string;
  } | null;
  role?: {
    id: string;
    name: string;
  } | null;
  lastSignInProvider?: string | null;
};

type PaginatedUsers = {
  items: PlatformUserRow[];
  total: number;
  page: number;
  limit: number;
};

type RoleResponse = {
  items: RoleOption[];
};

const EMPTY_USERS: PaginatedUsers = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
};

export default function AccessOperationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "/super-admin/access-operations";

  const page = Math.max(1, Number(searchParams?.get("page") || "1"));
  const search = searchParams?.get("search") || "";
  const status = searchParams?.get("status") || "";
  const tenantId = searchParams?.get("tenantId") || "";

  const [data, setData] = useState<PaginatedUsers>(EMPTY_USERS);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  const [draftSearch, setDraftSearch] = useState(search);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftTenantId, setDraftTenantId] = useState(tenantId);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingRoleByUser, setPendingRoleByUser] = useState<Record<string, string>>({});
  const [pendingTenantByUser, setPendingTenantByUser] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    setDraftSearch(search);
    setDraftStatus(status);
    setDraftTenantId(tenantId);
  }, [search, status, tenantId]);

  const roleOptionsByTenant = useMemo(() => {
    const index = new Map<string, RoleOption[]>();
    for (const role of roles) {
      const bucket = index.get(role.tenant.id) ?? [];
      bucket.push(role);
      index.set(role.tenant.id, bucket);
    }
    return index;
  }, [roles]);

  const loadReferenceData = useCallback(async () => {
    try {
      const [tenantsPayload, rolesPayload] = await Promise.all([
        apiFetch<Array<{ id: string; name: string }>>("/api/super-admin/tenants", { cache: "no-store" }),
        apiFetch<RoleResponse>("/api/super-admin/platform/roles?page=1&limit=500", { cache: "no-store" }),
      ]);
      setTenants(tenantsPayload.map((tenant) => ({ id: tenant.id, name: tenant.name })));
      setRoles(rolesPayload.items ?? []);
    } catch {
      setTenants([]);
      setRoles([]);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (tenantId) params.set("tenantId", tenantId);
      params.set("page", String(page));
      params.set("limit", "25");

      const payload = await apiFetch<PaginatedUsers>(`/api/super-admin/platform/users?${params.toString()}`, { cache: "no-store" });
      setData(payload);
      setSelectedIds([]);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load access operations data.");
      }
      setData(EMPTY_USERS);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, tenantId]);

  useEffect(() => {
    void loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    if (draftStatus) params.set("status", draftStatus);
    if (draftTenantId) params.set("tenantId", draftTenantId);
    params.set("page", "1");
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(Math.max(1, nextPage)));
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  const toggleSelect = (userId: string) => {
    setSelectedIds((previous) =>
      previous.includes(userId) ? previous.filter((id) => id !== userId) : [...previous, userId],
    );
  };

  const selectAllOnPage = () => {
    const ids = data.items.map((user) => user.id);
    setSelectedIds(ids);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const bulkRun = async (type: "suspend" | "reactivate" | "reset") => {
    if (selectedIds.length === 0) {
      setError("Select at least one user for bulk operation.");
      return;
    }

    setBulkBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await apiFetch<{
        succeeded: number;
        failed: number;
      }>("/api/super-admin/platform/users/bulk", {
        method: "PATCH",
        ...withJsonBody({
          userIds: selectedIds,
          action: type,
        }),
      });

      if (result.succeeded === 0) {
        setError("Bulk operation failed for all selected users.");
      } else if (result.failed > 0) {
        setNotice(`${result.succeeded} updated, ${result.failed} failed.`);
      } else {
        setNotice(`${result.succeeded} user(s) updated.`);
      }
      await loadUsers();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to run bulk operation.");
    } finally {
      setBulkBusy(false);
    }
  };

  const updateRole = async (user: PlatformUserRow) => {
    const roleId = pendingRoleByUser[user.id] ?? user.role?.id ?? "";
    if (!roleId) {
      setError("Choose a role before applying update.");
      return;
    }

    setBusyUserId(user.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/platform/users/${user.id}/role`, {
        method: "PATCH",
        ...withJsonBody({ roleId }),
      });
      setNotice(`Role updated for ${user.name}.`);
      await loadUsers();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update role.");
    } finally {
      setBusyUserId(null);
    }
  };

  const transferTenant = async (user: PlatformUserRow) => {
    const nextTenantId = pendingTenantByUser[user.id] ?? user.tenant?.id ?? "";
    if (!nextTenantId) {
      setError("Choose a tenant before applying transfer.");
      return;
    }

    setBusyUserId(user.id);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/super-admin/platform/users/${user.id}/tenant`, {
        method: "PATCH",
        ...withJsonBody({ tenantId: nextTenantId }),
      });
      setNotice(`Tenant updated for ${user.name}.`);
      await loadUsers();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to transfer tenant.");
    } finally {
      setBusyUserId(null);
    }
  };

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "super-admin-access-operations",
      data.items,
      [
        { label: "Name", value: (row) => row.name },
        { label: "Email", value: (row) => row.email },
        { label: "Status", value: (row) => row.status },
        { label: "Tenant", value: (row) => row.tenant?.name ?? "Unlinked" },
        { label: "Role", value: (row) => row.role?.name ?? "Unassigned" },
      ],
      "Access Operations",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Operational Controls</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Access Operations</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Run bulk access actions and immediate role/tenant reassignment from one workspace.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <input value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Search users" className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="Invited">Invited</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
          <select value={draftTenantId} onChange={(event) => setDraftTenantId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="">All churches</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
          <button type="button" onClick={applyFilters} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold !text-white">Apply Filters</button>
          <TableExportMenu onExport={exportRows} label="Export" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={selectAllOnPage} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">Select page</button>
          <button type="button" onClick={clearSelection} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">Clear</button>
          <button type="button" disabled={bulkBusy} onClick={() => void bulkRun("suspend")} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 disabled:opacity-50">Bulk Suspend</button>
          <button type="button" disabled={bulkBusy} onClick={() => void bulkRun("reactivate")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:opacity-50">Bulk Reactivate</button>
          <button type="button" disabled={bulkBusy} onClick={() => void bulkRun("reset")} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 disabled:opacity-50">Bulk Reset Access</button>
          <span className="ml-auto text-xs font-semibold text-slate-500">{selectedIds.length} selected</span>
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
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Select</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Role Transfer</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Tenant Transfer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading users...</td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No users found.</td>
                </tr>
              ) : (
                data.items.map((user) => {
                  const tenantValue = pendingTenantByUser[user.id] ?? user.tenant?.id ?? "";
                  const userRoles = roleOptionsByTenant.get(tenantValue) ?? [];
                  const roleValue = pendingRoleByUser[user.id] ?? user.role?.id ?? "";
                  const busy = busyUserId === user.id;

                  return (
                    <tr key={user.id}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => toggleSelect(user.id)} />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-slate-900">{user.name}</p>
                        <p className="text-xs font-medium text-slate-500">{user.email}</p>
                        <p className="text-xs font-medium text-slate-500">{user.tenant?.name ?? "Unlinked"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${user.status === "Active" ? "bg-emerald-100 text-emerald-700" : user.status === "Suspended" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <select value={roleValue} onChange={(event) => setPendingRoleByUser((prev) => ({ ...prev, [user.id]: event.target.value }))} className="w-44 rounded-lg border border-slate-300 px-2 py-1 text-xs" disabled={busy}>
                            <option value="">Select role</option>
                            {userRoles.map((role) => (
                              <option key={role.id} value={role.id}>{role.name}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => void updateRole(user)} disabled={busy || !roleValue} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-50">Apply</button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <select value={tenantValue} onChange={(event) => setPendingTenantByUser((prev) => ({ ...prev, [user.id]: event.target.value }))} className="w-44 rounded-lg border border-slate-300 px-2 py-1 text-xs" disabled={busy}>
                            <option value="">Select tenant</option>
                            {tenants.map((tenant) => (
                              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                            ))}
                          </select>
                          <button type="button" onClick={() => void transferTenant(user)} disabled={busy || !tenantValue || tenantValue === (user.tenant?.id ?? "")} className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-50">Apply</button>
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
          <p className="text-xs font-semibold text-slate-500">Page {data.page} of {totalPages} • {data.total} user(s)</p>
          <div className="flex gap-2">
            <button type="button" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Previous</button>
            <button type="button" disabled={data.page >= totalPages} onClick={() => setPage(data.page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}
