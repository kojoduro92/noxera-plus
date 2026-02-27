"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import Link from "next/link";
import { DonutChart, HorizontalBarChart, LineTrendChart, Sparkline, type Segment, type SeriesPoint } from "@/components/super-admin/charts";
import { COUNTRY_OPTIONS, formatMoney, optionLabel } from "@/lib/platform-options";
import { usePlatformPersonalization } from "@/contexts/PlatformPersonalizationContext";

type PlatformMetrics = {
  churches: number;
  branches: number;
  users: number;
  activeUsers: number;
  invitedUsers: number;
  suspendedUsers: number;
  roles: number;
  customRoles: number;
};

type TenantRow = {
  id: string;
  name: string;
  domain?: string | null;
  status: string;
  createdAt: string;
  plan?: {
    name?: string | null;
    price?: number | null;
  } | null;
  country?: string | null;
  currency?: string | null;
};

type PlatformFinancialMetrics = {
  totalChurches: number;
  activeChurches: number;
  mrr: number;
};

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

function getMonthSeries(tenants: TenantRow[], months = 8): SeriesPoint[] {
  const now = new Date();
  const points: SeriesPoint[] = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const bucketDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    const nextBucketDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index + 1, 1));

    const value = tenants.filter((tenant) => {
      const createdAt = new Date(tenant.createdAt);
      return createdAt >= bucketDate && createdAt < nextBucketDate;
    }).length;

    points.push({
      label: monthLabel(bucketDate),
      value,
    });
  }

  return points;
}

function toSegments(source: Record<string, number>, palette: string[]): Segment[] {
  return Object.entries(source)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], index) => ({
      label,
      value,
      color: palette[index % palette.length],
    }));
}

function totalValue(points: SeriesPoint[]) {
  return points.reduce((sum, point) => sum + point.value, 0);
}

function toPercent(value: number, base: number) {
  if (!base) return 0;
  return Math.round((value / base) * 100);
}

export default function SuperAdminDashboard() {
  const { personalization } = usePlatformPersonalization();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [financial, setFinancial] = useState<PlatformFinancialMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const [overviewData, financialData, tenantsData] = await Promise.all([
        apiFetch<PlatformMetrics>("/api/super-admin/platform/overview"),
        apiFetch<PlatformFinancialMetrics>("/api/super-admin/tenants/platform/metrics"),
        apiFetch<TenantRow[]>("/api/super-admin/tenants"),
      ]);

      setMetrics(overviewData);
      setFinancial(financialData);
      setTenants(tenantsData);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load dashboard metrics.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  const signupSeries = useMemo(() => getMonthSeries(tenants, 8), [tenants]);

  const statusSegments = useMemo(() => {
    const counts = tenants.reduce<Record<string, number>>((acc, tenant) => {
      const key = tenant.status || "Unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return toSegments(counts, ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9"]);
  }, [tenants]);

  const planSegments = useMemo(() => {
    const counts = tenants.reduce<Record<string, number>>((acc, tenant) => {
      const key = tenant.plan?.name || "Trial";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return toSegments(counts, ["#6366f1", "#8b5cf6", "#ec4899", "#f97316"]);
  }, [tenants]);

  const countrySegments = useMemo(() => {
    const counts = tenants.reduce<Record<string, number>>((acc, tenant) => {
      const key = optionLabel(COUNTRY_OPTIONS, tenant.country ?? "", "Unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return toSegments(counts, ["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7", "#e11d48", "#14b8a6"]);
  }, [tenants]);

  const activeMrrByPlan = useMemo(() => {
    const counts = tenants.reduce<Record<string, number>>((acc, tenant) => {
      if (tenant.status !== "Active") {
        return acc;
      }

      const key = tenant.plan?.name || "Trial";
      const price = tenant.plan?.price ?? 0;
      acc[key] = (acc[key] ?? 0) + price;
      return acc;
    }, {});

    return toSegments(counts, ["#4338ca", "#4f46e5", "#7c3aed", "#2563eb"]);
  }, [tenants]);

  const kpiSparkline = useMemo(() => {
    const growth = signupSeries.reduce<number[]>((acc, point) => {
      const next = (acc[acc.length - 1] ?? 0) + point.value;
      acc.push(next);
      return acc;
    }, []);

    return growth.map((value, index) => ({ label: signupSeries[index]?.label ?? `${index + 1}`, value }));
  }, [signupSeries]);

  const activeTenants = statusSegments.find((segment) => segment.label.toLowerCase() === "active")?.value ?? 0;
  const suspendedTenants = statusSegments.find((segment) => segment.label.toLowerCase() === "suspended")?.value ?? 0;
  const systemHealth = [
    { label: "Servers", value: 99.2 },
    { label: "Payments", value: 100 },
    { label: "Notifications", value: 98.7 },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-indigo-950 via-indigo-800 to-cyan-700 p-6 text-white shadow-xl shadow-indigo-900/20">
        <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/15 blur-3xl" />
        <div className="absolute -bottom-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-100">Platform Overview</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">Welcome to Noxera Plus control center</h2>
            <p className="mt-2 max-w-3xl text-sm text-indigo-100">
              Monitor tenant growth, financial health, and operational risk posture from one unified governance cockpit.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-100">Tenants</p>
              <p className="mt-1 text-2xl font-black">{metrics?.churches ?? 0}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-100">Active</p>
              <p className="mt-1 text-2xl font-black">{activeTenants}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-100">Suspended</p>
              <p className="mt-1 text-2xl font-black">{suspendedTenants}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-100">MRR</p>
              <p className="mt-1 text-2xl font-black">{formatMoney(financial?.mrr ?? 0, personalization.defaultCurrency, personalization.defaultLocale)}</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <KpiCard
          label="Total Churches"
          value={metrics?.churches ?? 0}
          sublabel={`${metrics?.branches ?? 0} active branches`}
          accent="from-blue-500 to-cyan-400"
          series={kpiSparkline}
        />
        <KpiCard
          label="Total Members"
          value={metrics?.users ?? 0}
          sublabel={`${metrics?.activeUsers ?? 0} active users`}
          accent="from-violet-500 to-indigo-500"
          series={kpiSparkline}
        />
        <KpiCard
          label="Monthly Revenue"
          value={formatMoney(financial?.mrr ?? 0, personalization.defaultCurrency, personalization.defaultLocale)}
          sublabel={`${toPercent(financial?.activeChurches ?? 0, metrics?.churches ?? 0)}% active subscriptions`}
          accent="from-emerald-500 to-teal-400"
          series={kpiSparkline}
        />
        <KpiCard
          label="Invited Pending"
          value={metrics?.invitedUsers ?? 0}
          sublabel={`${metrics?.customRoles ?? 0} custom roles`}
          accent="from-fuchsia-500 to-pink-400"
          series={kpiSparkline}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <LineTrendChart title="Revenue and Signups Trend" points={signupSeries} />
        </section>
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Quick Actions</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/super-admin/onboarding" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-indigo-200 hover:bg-indigo-50">
              Register Church
            </Link>
            <Link href="/super-admin/billing" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-indigo-200 hover:bg-indigo-50">
              Manage Billing
            </Link>
            <Link href="/super-admin/users" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-indigo-200 hover:bg-indigo-50">
              Invite Platform User
            </Link>
            <Link href="/super-admin/system" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-indigo-200 hover:bg-indigo-50">
              System Controls
            </Link>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">System Health</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {systemHealth.map((item) => (
                <li key={item.label} className="flex items-center justify-between">
                  <span className="font-semibold">{item.label}</span>
                  <span className="font-black text-emerald-700">{item.value.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <DonutChart title="Tenant Status Distribution" segments={statusSegments} centerLabel={`${tenants.length}`} />
        <HorizontalBarChart title="Plan Adoption" segments={planSegments} />
        <HorizontalBarChart title="Top Countries" segments={countrySegments} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <HorizontalBarChart title="MRR by Plan" segments={activeMrrByPlan} />
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-900 to-violet-800 p-6 text-white shadow-sm">
          <h3 className="text-2xl font-black">Platform execution flow</h3>
          <p className="mt-2 text-sm text-indigo-100">Launch governance actions in a sequence that keeps growth and compliance balanced.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href="/super-admin/analytics" className="rounded-xl border border-indigo-200/30 bg-white/10 p-3 text-sm font-black transition hover:bg-white/20">
              Analytics Report
            </Link>
            <Link href="/super-admin/feature-flags" className="rounded-xl border border-indigo-200/30 bg-white/10 p-3 text-sm font-black transition hover:bg-white/20">
              Feature Flags
            </Link>
            <Link href="/super-admin/content" className="rounded-xl border border-indigo-200/30 bg-white/10 p-3 text-sm font-black transition hover:bg-white/20">
              Content Hub
            </Link>
            <Link href="/super-admin/audit-logs" className="rounded-xl border border-indigo-200/30 bg-white/10 p-3 text-sm font-black transition hover:bg-white/20">
              Security & Audit
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  accent,
  series,
}: {
  label: string;
  value: number | string;
  sublabel: string;
  accent: string;
  series: SeriesPoint[];
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${accent}`} />
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-4xl font-black text-slate-900">{value}</p>
      <p className="mt-2 text-xs font-semibold text-slate-500">{sublabel}</p>
      <div className="mt-3 text-indigo-500">
        <Sparkline points={series} className="h-9 w-full" />
      </div>
    </article>
  );
}
