"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";

type MemberRow = { id: string; email?: string | null; phone?: string | null };
type ServiceRow = { id: string; name: string; date: string };
type AttendanceRow = { id: string; createdAt: string };

type DashboardMetrics = {
  totalMembers: number;
  totalServices: number;
  weeklyCheckIns: number;
  contactCoverage: number;
  upcomingServices: ServiceRow[];
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

export default function AdminDashboard() {
  const { selectedBranchId } = useBranch();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalMembers: 0,
    totalServices: 0,
    weeklyCheckIns: 0,
    contactCoverage: 0,
    upcomingServices: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError("");

    const branchQuery = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      const [members, services, attendance] = await Promise.all([
        apiFetch<MemberRow[]>(`/api/admin/members${branchQuery}`, {
          cache: "no-store",
        }),
        apiFetch<ServiceRow[]>(`/api/admin/services${branchQuery}`, {
          cache: "no-store",
        }),
        apiFetch<AttendanceRow[]>(`/api/admin/attendance${branchQuery}`, {
          cache: "no-store",
        }),
      ]);

      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weeklyCheckIns = attendance.filter((entry) => new Date(entry.createdAt).getTime() >= sevenDaysAgo).length;
      const contactCoverage = members.length ? Math.round((members.filter((member) => Boolean(member.email || member.phone)).length / members.length) * 100) : 0;
      const upcomingServices = [...services]
        .filter((service) => new Date(service.date).getTime() >= Date.now())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4);

      setMetrics({
        totalMembers: members.length,
        totalServices: services.length,
        weeklyCheckIns,
        contactCoverage,
        upcomingServices,
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load dashboard metrics."));
      setMetrics({ totalMembers: 0, totalServices: 0, weeklyCheckIns: 0, contactCoverage: 0, upcomingServices: [] });
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const branchLabel = useMemo(() => selectedBranchId ?? "All branches", [selectedBranchId]);
  const nextService = metrics.upcomingServices[0];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Operations Snapshot</p>
          <h2 className="mt-2 text-2xl font-black">Healthy operations start with consistent records.</h2>
          <p className="mt-2 max-w-2xl text-sm text-indigo-100">
            Keep member profiles complete, schedule services ahead, and run attendance from one place.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href="/admin/members/new" className="rounded-lg bg-white px-4 py-2 text-xs font-black uppercase tracking-wider !text-indigo-900 transition hover:bg-indigo-100">
              Add Member
            </Link>
            <Link href="/admin/services" className="rounded-lg border border-indigo-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-100 transition hover:bg-indigo-700/40">
              Open Services
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Members" value={metrics.totalMembers} loading={loading} tone="indigo" />
        <MetricCard label="Scheduled Services" value={metrics.totalServices} loading={loading} tone="violet" />
        <MetricCard label="Weekly Check-Ins" value={metrics.weeklyCheckIns} loading={loading} tone="emerald" />
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Branch</p>
          <p className="mt-2 text-sm font-black text-slate-800">{branchLabel}</p>
          <p className="mt-2 text-xs text-slate-500">
            Next service: <span className="font-semibold text-slate-700">{nextService ? new Date(nextService.date).toLocaleDateString() : "Not scheduled"}</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Contact coverage: <span className="font-semibold text-slate-700">{metrics.contactCoverage}%</span>
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Operational Flow</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Link href="/admin/members/new" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50">
            <p className="text-sm font-black text-slate-800">1. Register members</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Capture core + profile data in one standardized form.</p>
          </Link>
          <Link href="/admin/services" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50">
            <p className="text-sm font-black text-slate-800">2. Schedule services</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Plan upcoming services and pick active check-in sessions.</p>
          </Link>
          <Link href="/admin/services" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50">
            <p className="text-sm font-black text-slate-800">3. Track attendance</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Record member/visitor attendance in real-time for reports.</p>
          </Link>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Upcoming Services</h2>
            <Link href="/admin/services" className="text-xs font-bold text-indigo-600 hover:text-indigo-500">
              Open Services
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

        <section className="rounded-xl border border-slate-200 bg-indigo-900 p-5 text-white shadow-sm">
          <h2 className="text-lg font-black">Operational Shortcuts</h2>
          <p className="mt-1 text-xs text-indigo-200">Jump directly into your highest frequency workflows.</p>
          <div className="mt-4 space-y-2">
            <Link href="/admin/members" className="block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wide !text-white transition hover:bg-indigo-500">
              Open Members Directory
            </Link>
            <Link href="/admin/services" className="block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wide !text-white transition hover:bg-indigo-500">
              Manage Services & Attendance
            </Link>
            <Link href="/admin/reports" className="block rounded-lg border border-indigo-500 px-4 py-2 text-xs font-black uppercase tracking-wide text-indigo-100 transition hover:bg-indigo-700/40">
              View Reports
            </Link>
          </div>
        </section>
      </div>
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
  tone: "indigo" | "violet" | "emerald";
}) {
  const toneClass =
    tone === "indigo" ? "bg-indigo-50 text-indigo-700" : tone === "violet" ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${toneClass}`}>{label}</span>
      {loading ? (
        <div className="mt-2 h-9 w-20 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
      )}
    </div>
  );
}
