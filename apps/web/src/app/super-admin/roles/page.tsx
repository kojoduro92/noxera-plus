"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const EMPTY_ROLES: RoleResponse = {
  items: [],
  total: 0,
  page: 1,
  limit: 25,
};

export default function SuperAdminRolesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "/super-admin/roles";

  const page = Math.max(1, Number(searchParams?.get("page") || "1"));
  const search = searchParams?.get("search") || "";

  const [rolesData, setRolesData] = useState<RoleResponse>(EMPTY_ROLES);
  const [draftSearch, setDraftSearch] = useState(search);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setDraftSearch(search);
  }, [search]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", "25");

      const payload = await apiFetch<RoleResponse>(`/api/super-admin/platform/roles?${params.toString()}`, {
        cache: "no-store",
      });
      setRolesData(payload);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load platform roles.");
      }
      setRolesData(EMPTY_ROLES);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  const sortedRoles = useMemo(() => {
    const next = [...rolesData.items];
    const direction = sortDirection === "asc" ? 1 : -1;

    next.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name) * direction;
      if (sortBy === "tenant") return (a.tenant?.name ?? "").localeCompare(b.tenant?.name ?? "") * direction;
      if (sortBy === "permissions") return (a.permissions.length - b.permissions.length) * direction;
      return (a._count.users - b._count.users) * direction;
    });

    return next;
  }, [rolesData.items, sortBy, sortDirection]);

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(
      format,
      "super-admin-roles",
      sortedRoles,
      [
        { label: "Role", value: (row) => row.name },
        { label: "Tenant", value: (row) => row.tenant?.name ?? "" },
        { label: "Type", value: (row) => (row.isSystem ? "System" : "Custom") },
        { label: "Permissions", value: (row) => row.permissions.length },
        { label: "Users", value: (row) => row._count.users },
      ],
      "Super Admin Roles",
    );
  };

  const applyFilters = () => {
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

  const totalPages = Math.max(1, Math.ceil(rolesData.total / rolesData.limit));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Global Roles Overview</h2>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Review system and custom role definitions across all church tenants.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <input
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search role or tenant"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2"
          />
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
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{role.permissions.length}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{role._count.users}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500">
            Page {rolesData.page} of {totalPages} • {rolesData.total} role(s)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={rolesData.page <= 1}
              onClick={() => setPage(rolesData.page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={rolesData.page >= totalPages}
              onClick={() => setPage(rolesData.page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
