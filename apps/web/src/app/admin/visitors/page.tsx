"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import type { MemberProfile } from "@/lib/members";
import { formatMemberFullName } from "@/lib/members";
import { useBranch } from "@/contexts/BranchContext";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function statusClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "active") return "bg-emerald-50 text-emerald-700";
  if (normalized === "prospect") return "bg-amber-50 text-amber-700";
  if (normalized === "visitor") return "bg-indigo-50 text-indigo-700";
  return "bg-slate-100 text-slate-700";
}

export default function VisitorsPage() {
  const { selectedBranchId } = useBranch();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Visitor" | "Prospect" | "Active">("all");
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (selectedBranchId) params.set("branchId", selectedBranchId);
    try {
      const payload = await apiFetch<MemberProfile[]>(`/api/admin/members${params.toString() ? `?${params.toString()}` : ""}`, {
        cache: "no-store",
      });
      setMembers(payload);
    } catch (err) {
      setMembers([]);
      setError(getErrorMessage(err, "Unable to load visitors."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const visitorRows = useMemo(() => {
    const base = members.filter((member) => {
      const hasVisitorTag = member.tags.some((tag) => ["visitor", "first-timer", "first timer"].includes(tag.trim().toLowerCase()));
      return hasVisitorTag || ["Visitor", "Prospect", "Active"].includes(member.status);
    });

    return base
      .filter((member) => {
        if (statusFilter !== "all" && member.status !== statusFilter) return false;
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return (
          formatMemberFullName(member).toLowerCase().includes(query) ||
          (member.phone || "").toLowerCase().includes(query) ||
          (member.email || "").toLowerCase().includes(query) ||
          member.tags.join(" ").toLowerCase().includes(query)
        );
      })
      .sort((left, right) => formatMemberFullName(left).localeCompare(formatMemberFullName(right)));
  }, [members, search, statusFilter]);

  const metrics = useMemo(() => {
    const visitors = visitorRows.filter((row) => row.status === "Visitor").length;
    const prospects = visitorRows.filter((row) => row.status === "Prospect").length;
    const converted = visitorRows.filter((row) => row.status === "Active").length;
    return { visitors, prospects, converted };
  }, [visitorRows]);

  const convertToActive = async (member: MemberProfile) => {
    setBusyMemberId(member.id);
    setError("");
    setNotice("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      const nextTags = member.tags.filter((tag) => !["visitor", "first-timer", "first timer", "prospect"].includes(tag.trim().toLowerCase()));
      await apiFetch(`/api/admin/members/${member.id}${query}`, {
        method: "PUT",
        ...withJsonBody({ status: "Active", tags: nextTags }),
      });
      setNotice(`${formatMemberFullName(member)} converted to Active member.`);
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to convert visitor to member."));
    } finally {
      setBusyMemberId(null);
    }
  };

  const createFollowUp = async (member: MemberProfile) => {
    setBusyMemberId(member.id);
    setError("");
    setNotice("");

    try {
      await apiFetch("/api/admin/followups", {
        method: "POST",
        ...withJsonBody({
          memberId: member.id,
          type: "Visitor Care",
          notes: `First-time visitor follow-up for ${formatMemberFullName(member)}.`,
          branchId: selectedBranchId,
        }),
      });
      setNotice(`Follow-up created for ${formatMemberFullName(member)}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create follow-up."));
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `visitors-${new Date().toISOString().slice(0, 10)}`,
      visitorRows,
      [
        { label: "Name", value: (row) => formatMemberFullName(row) },
        { label: "Status", value: (row) => row.status },
        { label: "Phone", value: (row) => row.phone ?? "" },
        { label: "Email", value: (row) => row.email ?? "" },
        { label: "Tags", value: (row) => row.tags.join(" | ") },
      ],
      "Visitors Pipeline",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Visitors Pipeline</p>
        <h2 className="mt-2 text-2xl font-black">Track first-time guests, prospects, and conversion to active members.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Capture follow-up actions quickly and keep the onboarding journey visible.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Visitors" value={loading ? "--" : String(metrics.visitors)} />
        <MetricCard label="Prospects" value={loading ? "--" : String(metrics.prospects)} />
        <MetricCard label="Converted" value={loading ? "--" : String(metrics.converted)} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search visitor name, phone, email, tags"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "Visitor" | "Prospect" | "Active")} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="Visitor">Visitor</option>
            <option value="Prospect">Prospect</option>
            <option value="Active">Active</option>
          </select>
          <button type="button" onClick={() => void loadMembers()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">
            Refresh
          </button>
          <TableExportMenu onExport={handleExport} label="Download" />
        </div>
      </section>

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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Visitor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tags</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}><td colSpan={5} className="px-4 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                ))
              ) : visitorRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm font-medium text-slate-500">No visitors found for current filters.</td>
                </tr>
              ) : (
                visitorRows.map((member) => (
                  <tr key={member.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{formatMemberFullName(member)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      <div>{member.phone || "No phone"}</div>
                      <div className="text-xs text-slate-500">{member.email || "No email"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(member.status)}`}>{member.status}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-700">{member.tags.length > 0 ? member.tags.join(", ") : "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          disabled={busyMemberId === member.id}
                          onClick={() => void createFollowUp(member)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                        >
                          Follow-up
                        </button>
                        <button
                          type="button"
                          disabled={busyMemberId === member.id || member.status === "Active"}
                          onClick={() => void convertToActive(member)}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-500 disabled:opacity-50"
                        >
                          Convert
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
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}
