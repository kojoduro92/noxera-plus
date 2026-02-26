"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";
import { DonutChart, LineTrendChart, StackedBarTrendChart } from "@/components/admin/charts";

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

  const attendanceStackedSeries = useMemo(
    () =>
      (attendance?.series ?? []).slice(-10).map((point) => ({
        label: point.date,
        firstLabel: "Members",
        first: point.members,
        secondLabel: "Visitors",
        second: point.visitors,
      })),
    [attendance?.series],
  );

  const memberLineSeries = useMemo(
    () => (members?.series ?? []).slice(-14).map((point) => ({ label: point.date, value: point.value })),
    [members?.series],
  );

  const givingLineSeries = useMemo(
    () => (giving?.series ?? []).slice(-14).map((point) => ({ label: point.date, value: point.amount })),
    [giving?.series],
  );

  const givingFundSegments = useMemo(
    () =>
      Object.entries(giving?.summary.byFund ?? {}).map(([label, value], index) => {
        const palette = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
        return {
          label,
          value,
          color: palette[index % palette.length],
        };
      }),
    [giving?.summary.byFund],
  );

  const exportRows = useMemo(() => {
    const unionDates = new Set<string>();
    (members?.series ?? []).forEach((point) => unionDates.add(point.date));
    (attendance?.series ?? []).forEach((point) => unionDates.add(point.date));
    (giving?.series ?? []).forEach((point) => unionDates.add(point.date));

    return Array.from(unionDates)
      .sort()
      .map((date) => {
        const memberPoint = (members?.series ?? []).find((point) => point.date === date);
        const attendancePoint = (attendance?.series ?? []).find((point) => point.date === date);
        const givingPoint = (giving?.series ?? []).find((point) => point.date === date);

        return {
          date,
          members: memberPoint?.value ?? 0,
          attendanceMembers: attendancePoint?.members ?? 0,
          attendanceVisitors: attendancePoint?.visitors ?? 0,
          attendanceTotal: attendancePoint?.total ?? 0,
          givingAmount: givingPoint?.amount ?? 0,
        };
      });
  }, [attendance?.series, giving?.series, members?.series]);

  const handleExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `admin-reports-${new Date().toISOString().slice(0, 10)}`,
      exportRows,
      [
        { label: "Date", value: (row) => row.date },
        { label: "Members", value: (row) => row.members },
        { label: "Attendance Members", value: (row) => row.attendanceMembers },
        { label: "Attendance Visitors", value: (row) => row.attendanceVisitors },
        { label: "Attendance Total", value: (row) => row.attendanceTotal },
        { label: "Giving Amount", value: (row) => row.givingAmount.toFixed(2) },
      ],
      "Admin Reports",
    );
  };

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
          <TableExportMenu onExport={handleExport} label="Download Report" />
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
          <h3 className="text-lg font-black text-slate-900">Member Growth Trend</h3>
          <div className="mt-4">
            <LineTrendChart points={memberLineSeries} stroke="#4f46e5" />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Giving Trend</h3>
          <p className="mt-1 text-xs text-slate-500">Latest point: {latestGivingPoint}</p>
          <div className="mt-4">
            <LineTrendChart points={givingLineSeries} stroke="#16a34a" />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Attendance Mix</h3>
          <p className="mt-1 text-xs text-slate-500">Members vs visitors by day.</p>
          <div className="mt-4">
            <StackedBarTrendChart points={attendanceStackedSeries} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Giving by Fund</h3>
          <p className="mt-1 text-xs text-slate-500">Fund distribution for selected range.</p>
          <div className="mt-4">
            <DonutChart segments={givingFundSegments} />
          </div>
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
