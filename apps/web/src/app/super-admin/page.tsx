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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Platform Overview</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Super Admin Command Center</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          Multi-tenant operations, growth metrics, and health signals in one cockpit.
        </p>
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Churches</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{metrics?.churches ?? 0}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{metrics?.branches ?? 0} active branches</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Platform Users</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{metrics?.users ?? 0}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{metrics?.activeUsers ?? 0} active users</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Recurring Revenue</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{formatMoney(financial?.mrr ?? 0, personalization.defaultCurrency, personalization.defaultLocale)}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500">{financial?.activeChurches ?? 0} active subscriptions</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Church Growth Pulse</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{totalValue(signupSeries)}</p>
          <div className="mt-3 text-indigo-600">
            <Sparkline points={kpiSparkline} className="h-10 w-full" />
          </div>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LineTrendChart title="Church Signups (Last 8 Months)" points={signupSeries} />
        </div>
        <DonutChart title="Tenant Status Distribution" segments={statusSegments} centerLabel={`${tenants.length}`} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <HorizontalBarChart title="Plan Adoption" segments={planSegments} />
        <HorizontalBarChart title="MRR by Plan" segments={activeMrrByPlan} />
        <HorizontalBarChart title="Top Countries" segments={countrySegments} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-900 to-indigo-700 p-7 text-white shadow-sm">
        <h3 className="text-2xl font-black">Platform execution quick actions</h3>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">
          Open operational modules directly and keep rollout, governance, and system stability moving in one flow.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/super-admin/analytics" className="rounded-xl border border-indigo-200/30 bg-white/10 p-4 text-sm font-black transition hover:bg-white/20">
            Analytics
          </Link>
          <Link href="/super-admin/feature-flags" className="rounded-xl border border-indigo-200/30 bg-white/10 p-4 text-sm font-black transition hover:bg-white/20">
            Feature Flags
          </Link>
          <Link href="/super-admin/content" className="rounded-xl border border-indigo-200/30 bg-white/10 p-4 text-sm font-black transition hover:bg-white/20">
            Content Hub
          </Link>
          <Link href="/super-admin/system" className="rounded-xl border border-indigo-200/30 bg-white/10 p-4 text-sm font-black transition hover:bg-white/20">
            System Controls
          </Link>
        </div>
      </section>
    </div>
  );
}
