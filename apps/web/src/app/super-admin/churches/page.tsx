"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { ConfirmActionModal } from "@/components/super-admin/confirm-action-modal";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

type Church = {
  id: string;
  name: string;
  domain: string;
  status: string;
  createdAt?: string;
  branchCount?: number;
  activeBranchCount?: number;
  userCount?: number;
  activeUserCount?: number;
  invitedUserCount?: number;
  roleCount?: number;
  ownerEmail?: string | null;
  ownerName?: string | null;
  branchPreview?: string[];
  plan?: { name?: string | null } | null;
};

type SortOption = "name" | "status" | "branches" | "users";

export default function ChurchesDirectoryPage() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Suspended">("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [confirmChurch, setConfirmChurch] = useState<Church | null>(null);
  const searchParams = useSearchParams();

  const fetchChurches = async () => {
    try {
      const data = await apiFetch<Church[]>("/api/super-admin/tenants");
      setChurches(data);
      setError("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load churches.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChurches();
  }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Active" ? "Suspended" : "Active";
    setStatusUpdatingId(id);
    try {
      await apiFetch<Church>(`/api/super-admin/tenants/${id}/status`, {
        method: "PUT",
        ...withJsonBody({ status: newStatus }),
      });
      setChurches((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
      setError("");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Status update failed. Try again.");
    } finally {
      setStatusUpdatingId(null);
      setConfirmChurch(null);
    }
  };

  const filteredChurches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = churches.filter((church) => {
      if (statusFilter !== "all" && church.status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return [church.name, church.domain, church.ownerEmail ?? "", church.ownerName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });

    next.sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;
      if (sortBy === "name") return a.name.localeCompare(b.name) * direction;
      if (sortBy === "status") return a.status.localeCompare(b.status) * direction;
      if (sortBy === "branches") return ((a.branchCount ?? 0) - (b.branchCount ?? 0)) * direction;
      return ((a.userCount ?? 0) - (b.userCount ?? 0)) * direction;
    });

    return next;
  }, [churches, search, sortBy, sortDirection, statusFilter]);

  const exportVisibleRows = async (format: ExportFormat) => {
    await downloadRows(format, "super-admin-churches", filteredChurches, [
      { label: "Church", value: (church) => church.name },
      { label: "Domain", value: (church) => `${church.domain}.noxera.plus` },
      { label: "Owner", value: (church) => church.ownerEmail ?? "" },
      { label: "Plan", value: (church) => church.plan?.name ?? "Trial" },
      { label: "Branches", value: (church) => church.branchCount ?? 0 },
      { label: "Users", value: (church) => church.userCount ?? 0 },
      { label: "Status", value: (church) => church.status },
    ], "Super Admin Churches");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200" />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-6 w-full animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-6 w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-6 w-3/4 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-black text-slate-900">Churches Directory</h2>
        <Link
          href="/super-admin/onboarding"
          className="rounded-lg nx-brand-btn px-4 py-2 text-sm font-black uppercase tracking-wider !text-white transition hover:opacity-90"
        >
          + Register New Church
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search church, owner, or domain"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | "Active" | "Suspended")}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="name">Sort: Name</option>
              <option value="status">Sort: Status</option>
              <option value="branches">Sort: Branches</option>
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
          </div>
          <TableExportMenu onExport={exportVisibleRows} />
        </div>
      </section>

      {searchParams.get("created") === "1" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Church created successfully.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Church</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Owner</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Domain</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Plan</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Branches</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Users</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Roles</th>
                <th className="px-4 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                <th className="px-4 py-4 text-right text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredChurches.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-10 text-center text-sm font-semibold text-slate-500">
                  No churches found for the current filters.
                </td>
              </tr>
            ) : (
              filteredChurches.map((church) => (
                <React.Fragment key={church.id}>
                  <tr className="hover:bg-slate-50/80">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Link href={`/super-admin/churches/${church.id}`} className="text-sm font-black text-slate-900 hover:text-indigo-600">
                        {church.name}
                      </Link>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <p className="text-xs font-black text-slate-800">{church.ownerName || "Church Owner"}</p>
                      <p className="text-xs font-medium text-slate-500">{church.ownerEmail || "Not assigned"}</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">
                      {church.domain}.noxera.plus
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-700">
                        {church.plan?.name || "Trial"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">
                      {church.activeBranchCount ?? 0}/{church.branchCount ?? 0}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">
                      {church.activeUserCount ?? 0}/{church.userCount ?? 0}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-700 whitespace-nowrap">
                      {church.roleCount ?? 0}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${
                          church.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {church.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/super-admin/churches/${church.id}`}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                          View Details
                        </Link>
                        <button
                          type="button"
                          onClick={() => setExpandedId((prev) => (prev === church.id ? null : church.id))}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                        >
                          {expandedId === church.id ? "Hide" : "Preview"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmChurch(church)}
                          disabled={statusUpdatingId === church.id}
                          className={`rounded-md border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                            church.status === "Active"
                              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {statusUpdatingId === church.id ? "Updating..." : church.status === "Active" ? "Suspend" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === church.id && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Branch preview</p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">
                              {church.branchPreview && church.branchPreview.length > 0
                                ? church.branchPreview.join(", ")
                                : "No branches yet"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pending invites</p>
                            <p className="mt-1 text-xs font-semibold text-amber-700">{church.invitedUserCount ?? 0}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Portal links</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Link href={`/super-admin/churches/${church.id}`} className="text-xs font-bold text-indigo-700 hover:text-indigo-600">
                                Open church details
                              </Link>
                              <span className="text-xs text-slate-300">|</span>
                              <Link href="/super-admin/users" className="text-xs font-bold text-indigo-700 hover:text-indigo-600">
                                Open users directory
                              </Link>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmActionModal
        open={Boolean(confirmChurch)}
        busy={Boolean(confirmChurch && statusUpdatingId === confirmChurch.id)}
        title={confirmChurch?.status === "Active" ? "Suspend church tenant?" : "Activate church tenant?"}
        description={confirmChurch?.status === "Active"
          ? "Suspending blocks tenant admin access and can pause billing-related workflows."
          : "Activating restores tenant access and resumes normal operations."}
        confirmLabel={confirmChurch?.status === "Active" ? "Suspend tenant" : "Activate tenant"}
        tone={confirmChurch?.status === "Active" ? "danger" : "primary"}
        onCancel={() => {
          if (!statusUpdatingId) {
            setConfirmChurch(null);
          }
        }}
        onConfirm={() => {
          if (confirmChurch) {
            void toggleStatus(confirmChurch.id, confirmChurch.status);
          }
        }}
      />
    </div>
  );
}
