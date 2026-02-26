"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

type RoleRow = {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  tenant: {
    id: string;
    name: string;
    domain: string | null;
  };
  _count: {
    users: number;
  };
};

type RoleResponse = {
  items: RoleRow[];
  total: number;
  page: number;
  limit: number;
};

type SortOption = "name" | "tenant" | "permissions" | "users";

export default function SuperAdminRolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const payload = await apiFetch<RoleResponse>(`/api/super-admin/platform/roles${params.toString() ? `?${params.toString()}` : ""}`, {
        cache: "no-store",
      });
      setRoles(payload.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load platform roles.");
      }
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  const sortedRoles = useMemo(() => {
    const next = [...roles];
    const direction = sortDirection === "asc" ? 1 : -1;

    next.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * direction;
      if (sortBy === "tenant") return (a.tenant?.name ?? "").localeCompare(b.tenant?.name ?? "") * direction;
      if (sortBy === "permissions") return (a.permissions.length - b.permissions.length) * direction;
      return (a._count.users - b._count.users) * direction;
    });

    return next;
  }, [roles, sortBy, sortDirection]);

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(format, "super-admin-roles", sortedRoles, [
      { label: "Role", value: (row) => row.name },
      { label: "Tenant", value: (row) => row.tenant?.name ?? "" },
      { label: "Type", value: (row) => (row.isSystem ? "System" : "Custom") },
      { label: "Permissions", value: (row) => row.permissions.length },
      { label: "Users", value: (row) => row._count.users },
    ], "Super Admin Roles");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Global Roles Overview</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Review system and custom role definitions across all church tenants.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search role or tenant"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2"
          />
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="name">Sort: Role</option>
            <option value="tenant">Sort: Tenant</option>
            <option value="permissions">Sort: Permissions</option>
            <option value="users">Sort: Users</option>
          </select>
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
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Permissions</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    Loading roles...
                  </td>
                </tr>
              ) : sortedRoles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    No roles found for this query.
                  </td>
                </tr>
              ) : (
                sortedRoles.map((role) => (
                  <tr key={role.id}>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{role.name}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{role.tenant?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                          role.isSystem ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {role.isSystem ? "System" : "Custom"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {role.permissions.length}
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{role._count.users}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
