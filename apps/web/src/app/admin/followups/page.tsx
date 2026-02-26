"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

type FollowUpRow = {
  id: string;
  memberId: string;
  type: string;
  notes?: string | null;
  dueDate?: string | null;
  assignedTo?: string | null;
  status: string;
  createdAt: string;
  member?: {
    firstName: string;
    lastName: string;
    phone?: string | null;
  } | null;
};

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function normalizeStatus(status: string) {
  return status.trim().toLowerCase();
}

export default function FollowUpsPage() {
  const { selectedBranchId } = useBranch();
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyFollowUpId, setBusyFollowUpId] = useState<string | null>(null);

  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState("Visitor Care");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"dueDate" | "createdAt">("dueDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    const branchQuery = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      const [followupPayload, memberPayload] = await Promise.all([
        apiFetch<FollowUpRow[]>(`/api/admin/followups${branchQuery}`, { cache: "no-store" }),
        apiFetch<MemberOption[]>(`/api/admin/members?status=Active${selectedBranchId ? `&branchId=${encodeURIComponent(selectedBranchId)}` : ""}`, {
          cache: "no-store",
        }),
      ]);
      setFollowUps(followupPayload);
      setMembers(memberPayload);
      if (!memberId && memberPayload.length > 0) {
        setMemberId(memberPayload[0].id);
      }
    } catch (err) {
      setFollowUps([]);
      setMembers([]);
      setError(getErrorMessage(err, "Unable to load follow-up workflows."));
    } finally {
      setLoading(false);
    }
  }, [memberId, selectedBranchId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    return [...followUps]
      .filter((row) => {
        if (statusFilter !== "all" && normalizeStatus(row.status) !== normalizeStatus(statusFilter)) return false;
        if (typeFilter !== "all" && row.type !== typeFilter) return false;

        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
          row.type.toLowerCase().includes(query) ||
          (row.notes || "").toLowerCase().includes(query) ||
          (row.assignedTo || "").toLowerCase().includes(query) ||
          `${row.member?.firstName || ""} ${row.member?.lastName || ""}`.toLowerCase().includes(query)
        );
      })
      .sort((left, right) => {
        const leftTime = new Date(sortBy === "dueDate" ? left.dueDate || left.createdAt : left.createdAt).getTime();
        const rightTime = new Date(sortBy === "dueDate" ? right.dueDate || right.createdAt : right.createdAt).getTime();
        if (sortDirection === "asc") return leftTime - rightTime;
        return rightTime - leftTime;
      });
  }, [followUps, search, sortBy, sortDirection, statusFilter, typeFilter]);

  const pendingCount = useMemo(
    () => followUps.filter((row) => !["completed", "resolved", "done"].includes(normalizeStatus(row.status))).length,
    [followUps],
  );
  const overdueCount = useMemo(
    () =>
      followUps.filter((row) => {
        if (!row.dueDate) return false;
        return new Date(row.dueDate).getTime() < Date.now() && !["completed", "resolved", "done"].includes(normalizeStatus(row.status));
      }).length,
    [followUps],
  );

  const createFollowup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberId) {
      setError("Select a member for follow-up.");
      return;
    }
    if (!type.trim()) {
      setError("Follow-up type is required.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiFetch<FollowUpRow>("/api/admin/followups", {
        method: "POST",
        ...withJsonBody({
          memberId,
          type: type.trim(),
          notes: notes.trim() || undefined,
          dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : undefined,
          assignedTo: assignedTo.trim() || undefined,
          branchId: selectedBranchId,
        }),
      });
      setNotice("Follow-up created.");
      setType("Visitor Care");
      setDueDate("");
      setAssignedTo("");
      setNotes("");
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create follow-up."));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setBusyFollowUpId(id);
    setError("");
    setNotice("");
    const branchQuery = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      await apiFetch<FollowUpRow>(`/api/admin/followups/${id}/status${branchQuery}`, {
        method: "PUT",
        ...withJsonBody({ status }),
      });
      setNotice(`Follow-up marked as ${status}.`);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update follow-up status."));
    } finally {
      setBusyFollowUpId(null);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `followups-${new Date().toISOString().slice(0, 10)}`,
      filteredRows,
      [
        { label: "Member", value: (row) => `${row.member?.firstName ?? ""} ${row.member?.lastName ?? ""}`.trim() || "Unknown" },
        { label: "Type", value: (row) => row.type },
        { label: "Status", value: (row) => row.status },
        { label: "Assigned To", value: (row) => row.assignedTo ?? "" },
        { label: "Due Date", value: (row) => (row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "") },
        { label: "Notes", value: (row) => row.notes ?? "" },
      ],
      "Follow-up Workflows",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Care Pipeline</p>
        <h2 className="mt-2 text-2xl font-black">Manage visitor/member follow-ups with clear status ownership.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Create tasks quickly, monitor overdue actions, and keep care teams accountable.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Follow-ups</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{loading ? "--" : followUps.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</p>
          <p className="mt-2 text-3xl font-black text-amber-600">{loading ? "--" : pendingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue</p>
          <p className="mt-2 text-3xl font-black text-red-600">{loading ? "--" : overdueCount}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <form onSubmit={createFollowup} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Create Follow-up</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Assign care actions to prevent visitor/member drop-off.</p>
          <div className="mt-4 grid gap-3">
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <input value={type} onChange={(event) => setType(event.target.value)} placeholder="Type (e.g., Visitor Care)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} placeholder="Assigned to (optional)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Notes" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={saving || members.length === 0} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 disabled:opacity-50">
            {saving ? "Saving..." : "Create Follow-up"}
          </button>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Filters</h3>
          <div className="mt-4 grid gap-3">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member, notes, assignee" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="grid gap-3 md:grid-cols-2">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="all">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Resolved">Resolved</option>
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="all">All types</option>
                {Array.from(new Set(followUps.map((row) => row.type))).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as "dueDate" | "createdAt")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="dueDate">Sort by due date</option>
                <option value="createdAt">Sort by created date</option>
              </select>
              <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => void fetchData()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">
                Refresh
              </button>
              <TableExportMenu onExport={handleExport} label="Download" />
            </div>
          </div>
        </section>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Member</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Due</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-8 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm font-medium text-slate-500">No follow-ups match the current filters.</td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const status = normalizeStatus(row.status);
                  const nextAction = status === "pending" ? "In Progress" : status === "in progress" ? "Completed" : "Pending";
                  const statusColor =
                    status === "completed" || status === "resolved"
                      ? "bg-emerald-50 text-emerald-700"
                      : status === "in progress"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-700";

                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{`${row.member?.firstName ?? ""} ${row.member?.lastName ?? ""}`.trim() || "Unknown"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.type}</td>
                      <td className="px-4 py-3 text-sm"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusColor}`}>{row.status}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.assignedTo || "-"}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600" title={row.notes || undefined}>{row.notes || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={busyFollowUpId === row.id}
                          onClick={() => void updateStatus(row.id, nextAction)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                        >
                          {busyFollowUpId === row.id ? "Updating..." : `Mark ${nextAction}`}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
