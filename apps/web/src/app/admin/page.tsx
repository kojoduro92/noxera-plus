"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";
import { DonutChart, LineTrendChart, StackedBarTrendChart } from "@/components/admin/charts";

type MemberRow = { id: string; email?: string | null; phone?: string | null };
type ServiceRow = { id: string; name: string; date: string };
type AttendanceRow = { id: string; createdAt: string };
type FollowUpRow = { id: string; status: string; createdAt: string };

type DashboardMetrics = {
  totalMembers: number;
  totalServices: number;
  weeklyCheckIns: number;
  contactCoverage: number;
  pendingFollowUps: number;
  completedFollowUps: number;
  upcomingServices: ServiceRow[];
  attendanceSeries: Array<{ label: string; value: number }>;
  serviceSeries: Array<{ label: string; value: number }>;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function toDateKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function buildRecentDaysSeries(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString([], { month: "short", day: "numeric" }),
    };
  });
}

export default function AdminDashboard() {
  const { selectedBranchId } = useBranch();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMembers: 0,
    totalServices: 0,
    weeklyCheckIns: 0,
    contactCoverage: 0,
    pendingFollowUps: 0,
    completedFollowUps: 0,
    upcomingServices: [],
    attendanceSeries: [],
    serviceSeries: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError("");

    const branchQuery = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      const [members, services, attendance, followups] = await Promise.all([
        apiFetch<MemberRow[]>(`/api/admin/members${branchQuery}`, {
          cache: "no-store",
        }),
        apiFetch<ServiceRow[]>(`/api/admin/services${branchQuery}`, {
          cache: "no-store",
        }),
        apiFetch<AttendanceRow[]>(`/api/admin/attendance${branchQuery}`, {
          cache: "no-store",
        }),
        apiFetch<FollowUpRow[]>(`/api/admin/followups${branchQuery}`, {
          cache: "no-store",
        }),
      ]);

      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weeklyCheckIns = attendance.filter((entry) => new Date(entry.createdAt).getTime() >= sevenDaysAgo).length;
      const contactCoverage = members.length
        ? Math.round((members.filter((member) => Boolean(member.email || member.phone)).length / members.length) * 100)
        : 0;
      const upcomingServices = [...services]
        .filter((service) => new Date(service.date).getTime() >= Date.now())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);

      const normalizedFollowUps = followups.map((item) => item.status.trim().toLowerCase());
      const pendingFollowUps = normalizedFollowUps.filter((status) => !["completed", "resolved", "done"].includes(status)).length;
      const completedFollowUps = normalizedFollowUps.filter((status) => ["completed", "resolved", "done"].includes(status)).length;

      const recentDays = buildRecentDaysSeries(14);
      const attendanceCounts = attendance.reduce<Record<string, number>>((accumulator, item) => {
        const key = toDateKey(item.createdAt);
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
      }, {});
      const serviceCounts = services.reduce<Record<string, number>>((accumulator, item) => {
        const key = toDateKey(item.date);
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
      }, {});

      const attendanceSeries = recentDays.map((day) => ({ label: day.label, value: attendanceCounts[day.key] ?? 0 }));
      const serviceSeries = recentDays.map((day) => ({ label: day.label, value: serviceCounts[day.key] ?? 0 }));

      setMetrics({
        totalMembers: members.length,
        totalServices: services.length,
        weeklyCheckIns,
        contactCoverage,
        pendingFollowUps,
        completedFollowUps,
        upcomingServices,
        attendanceSeries,
        serviceSeries,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load dashboard metrics."));
      setMetrics({
        totalMembers: 0,
        totalServices: 0,
        weeklyCheckIns: 0,
        contactCoverage: 0,
        pendingFollowUps: 0,
        completedFollowUps: 0,
        upcomingServices: [],
        attendanceSeries: [],
        serviceSeries: [],
      });
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const branchLabel = useMemo(() => selectedBranchId ?? "All branches", [selectedBranchId]);
  const nextService = metrics.upcomingServices[0];

  const stackedTrend = useMemo(
    () =>
      metrics.attendanceSeries.slice(-8).map((point, index) => ({
        label: point.label,
        firstLabel: "Check-ins",
        first: point.value,
        secondLabel: "Scheduled Services",
        second: metrics.serviceSeries[index + Math.max(0, metrics.serviceSeries.length - 8)]?.value ?? 0,
      })),
    [metrics.attendanceSeries, metrics.serviceSeries],
  );

  const followUpCompletion = metrics.pendingFollowUps + metrics.completedFollowUps > 0
    ? Math.round((metrics.completedFollowUps / (metrics.pendingFollowUps + metrics.completedFollowUps)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-violet-800 to-fuchsia-600 p-6 text-white shadow-lg shadow-indigo-900/25">
        <div className="absolute -left-12 -top-16 h-52 w-52 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-12 -bottom-24 h-60 w-60 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-100">Operations Snapshot</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Healthy operations require consistent follow-through.</h2>
            <p className="mt-2 max-w-2xl text-sm text-indigo-100">
              Capture members, schedule services, track attendance, and close follow-up actions from one control plane.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/admin/members/new" className="rounded-lg bg-white px-4 py-2 text-xs font-black uppercase tracking-wider !text-indigo-900 transition hover:bg-indigo-100">
                Add Member
              </Link>
              <Link href="/admin/followups" className="rounded-lg border border-indigo-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-100 transition hover:bg-indigo-700/40">
                Open Follow-ups
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-indigo-100">Branch Scope</p>
              <p className="mt-1 truncate text-base font-black">{branchLabel}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-indigo-100">Coverage</p>
              <p className="mt-1 text-base font-black">{metrics.contactCoverage}%</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-indigo-100">Pending</p>
              <p className="mt-1 text-base font-black">{metrics.pendingFollowUps}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-indigo-100">Completion</p>
              <p className="mt-1 text-base font-black">{followUpCompletion}%</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Members" value={metrics.totalMembers} loading={loading} tone="indigo" />
        <MetricCard label="Scheduled Services" value={metrics.totalServices} loading={loading} tone="violet" />
        <MetricCard label="Weekly Check-Ins" value={metrics.weeklyCheckIns} loading={loading} tone="emerald" />
        <MetricCard label="Pending Follow-ups" value={metrics.pendingFollowUps} loading={loading} tone="amber" />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Next Service</p>
          <p className="mt-2 text-sm font-black text-slate-800">{nextService?.name ?? "No upcoming service"}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{nextService ? new Date(nextService.date).toLocaleString() : "Schedule one from Services"}</p>
          <Link href="/admin/services" className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
            Open Services
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Attendance Trend (14 days)</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Check-ins per day across current branch scope.</p>
          <div className="mt-4">
            <LineTrendChart points={metrics.attendanceSeries} stroke="#4f46e5" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">Follow-up Pipeline</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">Keep care workflows moving by closing pending actions weekly.</p>
          <div className="mt-4">
            <DonutChart
              segments={[
                { label: "Pending", value: metrics.pendingFollowUps, color: "#f59e0b" },
                { label: "Completed", value: metrics.completedFollowUps, color: "#10b981" },
              ]}
            />
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Check-ins vs Scheduled Services (8 days)</h2>
        <div className="mt-4">
          <StackedBarTrendChart points={stackedTrend} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Upcoming Services</h2>
            <Link href="/admin/services" className="text-xs font-bold text-indigo-600 hover:text-indigo-500">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-200" />
              ))
            ) : metrics.upcomingServices.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                No upcoming services scheduled.
              </p>
            ) : (
              metrics.upcomingServices.map((service) => (
                <div key={service.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/40">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{service.name}</p>
                    <p className="text-xs text-slate-500">{new Date(service.date).toLocaleString()}</p>
                  </div>
                  <Link href="/admin/services" className="text-xs font-bold text-indigo-600 hover:text-indigo-500">
                    Check-in
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-900 to-violet-800 p-5 text-white shadow-sm">
          <h2 className="text-lg font-black">Operational Shortcuts</h2>
          <p className="mt-1 text-xs text-indigo-100">Jump directly into high-frequency team workflows.</p>
          <div className="mt-4 space-y-2">
            <Link href="/admin/members" className="block rounded-lg bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide !text-white transition hover:bg-white/25">
              Open Members Directory
            </Link>
            <Link href="/admin/followups" className="block rounded-lg bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide !text-white transition hover:bg-white/25">
              Manage Follow-ups
            </Link>
            <Link href="/admin/reports" className="block rounded-lg border border-indigo-200/60 px-4 py-2 text-xs font-black uppercase tracking-wide text-indigo-100 transition hover:bg-indigo-700/40">
              View Reports
            </Link>
            <Link href="/admin/giving" className="block rounded-lg border border-indigo-200/60 px-4 py-2 text-xs font-black uppercase tracking-wide text-indigo-100 transition hover:bg-indigo-700/40">
              Giving & Finance
            </Link>
          </div>
        </section>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: number;
  loading: boolean;
  tone: "indigo" | "violet" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "indigo"
      ? "from-indigo-500 to-blue-500"
      : tone === "violet"
        ? "from-violet-500 to-fuchsia-500"
        : tone === "amber"
          ? "from-amber-500 to-orange-500"
          : "from-emerald-500 to-teal-500";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${toneClass}`} />
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-9 w-20 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      )}
    </div>
  );
}
