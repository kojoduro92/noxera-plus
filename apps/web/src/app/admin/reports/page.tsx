"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";

type MembersReport = {
  summary: {
    totalMembers: number;
    activeMembers: number;
  };
  series: Array<{ date: string; value: number }>;
};

type AttendanceReport = {
  summary: {
    totalCheckIns: number;
    memberCheckIns: number;
    visitorCheckIns: number;
  };
  series: Array<{ date: string; members: number; visitors: number; total: number }>;
};

type GivingReport = {
  summary: {
    totalAmount: number;
    transactionCount: number;
    byFund: Record<string, number>;
  };
  series: Array<{ date: string; amount: number }>;
};

type GroupsReport = {
  summary: {
    groupCount: number;
    totalMemberships: number;
    averageMembersPerGroup: number;
  };
  items: Array<{ id: string; name: string; type: string; memberCount: number }>;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default function ReportsPage() {
  const { selectedBranchId } = useBranch();
  const [rangeDays, setRangeDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [members, setMembers] = useState<MembersReport | null>(null);
  const [attendance, setAttendance] = useState<AttendanceReport | null>(null);
  const [giving, setGiving] = useState<GivingReport | null>(null);
  const [groups, setGroups] = useState<GroupsReport | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    params.set("rangeDays", rangeDays);
    if (selectedBranchId) params.set("branchId", selectedBranchId);
    const query = `?${params.toString()}`;

    try {
      const [membersPayload, attendancePayload, givingPayload, groupsPayload] = await Promise.all([
        apiFetch<MembersReport>(`/api/admin/reports/members${query}`, { cache: "no-store" }),
        apiFetch<AttendanceReport>(`/api/admin/reports/attendance${query}`, { cache: "no-store" }),
        apiFetch<GivingReport>(`/api/admin/reports/giving${query}`, { cache: "no-store" }),
        apiFetch<GroupsReport>(`/api/admin/reports/groups${selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : ""}`, { cache: "no-store" }),
      ]);

      setMembers(membersPayload);
      setAttendance(attendancePayload);
      setGiving(givingPayload);
      setGroups(groupsPayload);
    } catch (err) {
      setMembers(null);
      setAttendance(null);
      setGiving(null);
      setGroups(null);
      setError(getErrorMessage(err, "Unable to load reports."));
    } finally {
      setLoading(false);
    }
  }, [rangeDays, selectedBranchId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const latestGivingPoint = useMemo(() => {
    const point = giving?.series[giving.series.length - 1];
    return point ? `${point.date} (${formatCurrency(point.amount)})` : "No data";
  }, [giving]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Operational Reports</p>
        <h2 className="mt-2 text-2xl font-black">Track member growth, attendance trends, giving, and group engagement.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Reports are generated from live tenant data and respect branch restrictions.</p>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500">Range</label>
          <select value={rangeDays} onChange={(event) => setRangeDays(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
          </select>
          <button type="button" onClick={() => void loadReports()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500">
            Refresh
          </button>
          <button
            type="button"
            onClick={() => downloadJson(`reports-${new Date().toISOString().slice(0, 10)}.json`, { members, attendance, giving, groups })}
            disabled={loading || (!members && !attendance && !giving && !groups)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-50"
          >
            Export Snapshot
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Members</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{loading ? "--" : members?.summary.totalMembers ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">Active: {members?.summary.activeMembers ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Check-ins</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{loading ? "--" : attendance?.summary.totalCheckIns ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">Visitors: {attendance?.summary.visitorCheckIns ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Giving</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{loading ? "--" : formatCurrency(giving?.summary.totalAmount ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-500">Transactions: {giving?.summary.transactionCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Groups</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{loading ? "--" : groups?.summary.groupCount ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">Avg members/group: {groups?.summary.averageMembersPerGroup ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Member Growth Series</h3>
          {loading ? (
            <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-5 animate-pulse rounded bg-slate-100" />)}</div>
          ) : !members || members.series.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No member growth data in this range.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {members.series.slice(-10).map((point) => (
                <li key={point.date} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <span className="text-slate-600">{point.date}</span>
                  <span className="font-bold text-slate-900">{point.value}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Giving Trend</h3>
          <p className="mt-1 text-xs text-slate-500">Latest point: {latestGivingPoint}</p>
          {loading ? (
            <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-5 animate-pulse rounded bg-slate-100" />)}</div>
          ) : !giving || giving.series.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No giving records available yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {giving.series.slice(-10).map((point) => (
                <li key={point.date} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <span className="text-slate-600">{point.date}</span>
                  <span className="font-bold text-slate-900">{formatCurrency(point.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Group Engagement</h3>
        {loading ? (
          <div className="mt-4 space-y-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-6 animate-pulse rounded bg-slate-100" />)}</div>
        ) : !groups || groups.items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No group data available.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Group</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {groups.items.map((group) => (
                  <tr key={group.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{group.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{group.type}</td>
                    <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{group.memberCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
