"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { CURRENCY_OPTIONS, formatMoney } from "@/lib/platform-options";
import { DonutChart, HorizontalBarChart, LineTrendChart, type Segment, type SeriesPoint } from "@/components/super-admin/charts";
import { usePlatformPersonalization } from "@/contexts/PlatformPersonalizationContext";

type Metrics = {
  totalChurches: number;
  activeChurches: number;
  mrr: number;
};

type Tenant = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  country?: string | null;
  currency?: string | null;
  plan?: {
    name?: string | null;
    price?: number | null;
  } | null;
};

type TimeWindow = 6 | 12;

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short" });
}

function makeSignupSeries(tenants: Tenant[], windowMonths: TimeWindow): SeriesPoint[] {
  const now = new Date();
  const points: SeriesPoint[] = [];

  for (let index = windowMonths - 1; index >= 0; index -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index + 1, 1));
    const value = tenants.filter((tenant) => {
      const createdAt = new Date(tenant.createdAt);
      return createdAt >= start && createdAt < end;
    }).length;

    points.push({ label: monthLabel(start), value });
  }

  return points;
}

function makeMrrSeries(tenants: Tenant[], windowMonths: TimeWindow): SeriesPoint[] {
  const now = new Date();
  const points: SeriesPoint[] = [];

  for (let index = windowMonths - 1; index >= 0; index -= 1) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index + 1, 1));

    const value = tenants.reduce((sum, tenant) => {
      if (tenant.status !== "Active") return sum;
      const createdAt = new Date(tenant.createdAt);
      if (createdAt < start || createdAt >= end) return sum;
      return sum + (tenant.plan?.price ?? 0);
    }, 0);

    points.push({ label: monthLabel(start), value });
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

export default function AnalyticsReportPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [windowMonths, setWindowMonths] = useState<TimeWindow>(12);
  const { personalization, setPersonalization } = usePlatformPersonalization();
  const currency = personalization.defaultCurrency;

  const load = async () => {
    try {
      setLoading(true);
      const [metricsResponse, tenantsResponse] = await Promise.all([
        apiFetch<Metrics>("/api/super-admin/tenants/platform/metrics"),
        apiFetch<Tenant[]>("/api/super-admin/tenants"),
      ]);

      setMetrics(metricsResponse);
      setTenants(tenantsResponse);
      setError("");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to load analytics report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const signupSeries = useMemo(() => makeSignupSeries(tenants, windowMonths), [tenants, windowMonths]);
  const mrrSeries = useMemo(() => makeMrrSeries(tenants, windowMonths), [tenants, windowMonths]);

  const planBreakdown = useMemo(() => {
    const summary = new Map<string, { count: number; mrr: number }>();

    for (const tenant of tenants) {
      const planName = tenant.plan?.name || "Trial";
      const planPrice = tenant.plan?.price ?? 0;
      const current = summary.get(planName) ?? { count: 0, mrr: 0 };
      current.count += 1;
      if (tenant.status === "Active") {
        current.mrr += planPrice;
      }
      summary.set(planName, current);
    }

    return Array.from(summary.entries())
      .map(([planName, data]) => ({ planName, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [tenants]);

  const statusSegments = useMemo(() => {
    const counts = tenants.reduce<Record<string, number>>((acc, tenant) => {
      acc[tenant.status] = (acc[tenant.status] ?? 0) + 1;
      return acc;
    }, {});

    return toSegments(counts, ["#4f46e5", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9"]);
  }, [tenants]);

  const planSegments = useMemo(() => {
    const counts = planBreakdown.reduce<Record<string, number>>((acc, item) => {
      acc[item.planName] = item.count;
      return acc;
    }, {});

    return toSegments(counts, ["#6366f1", "#8b5cf6", "#ec4899", "#f97316"]);
  }, [planBreakdown]);

  const mrrSegments = useMemo(() => {
    const counts = planBreakdown.reduce<Record<string, number>>((acc, item) => {
      acc[item.planName] = item.mrr;
      return acc;
    }, {});

    return toSegments(counts, ["#312e81", "#4f46e5", "#7c3aed", "#0ea5e9"]);
  }, [planBreakdown]);

  const activeRate = metrics?.totalChurches ? Math.round(((metrics.activeChurches / metrics.totalChurches) * 100) * 10) / 10 : 0;

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Analytics Hub</p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">Platform Analytics & Visualization</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Growth, revenue signals, and plan health for super-admin decisioning.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">Display Currency</label>
            <select
              value={currency}
              onChange={(event) => setPersonalization({ defaultCurrency: event.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.value}</option>
              ))}
            </select>
            <div className="flex rounded-lg border border-slate-300 bg-white p-1">
              {[6, 12].map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setWindowMonths(period as TimeWindow)}
                  className={`rounded-md px-2 py-1 text-xs font-black ${windowMonths === period ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {period}M
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Churches</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{metrics?.totalChurches ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Subscriptions</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{metrics?.activeChurches ?? 0}</p>
          <p className="mt-2 text-xs font-semibold text-emerald-600">{activeRate}% activation rate</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">MRR</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{formatMoney(metrics?.mrr ?? 0, currency, personalization.defaultLocale)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tracked Plans</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{planBreakdown.length}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <LineTrendChart title={`New Church Signups (${windowMonths} months)`} points={signupSeries} />
        <LineTrendChart title={`New MRR by Signup Month (${windowMonths} months)`} points={mrrSeries} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <DonutChart title="Subscription Status" segments={statusSegments} centerLabel={`${metrics?.totalChurches ?? 0}`} />
        <HorizontalBarChart title="Plan Distribution" segments={planSegments} />
        <HorizontalBarChart title="MRR Composition" segments={mrrSegments} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-black text-slate-900">Plan Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Tenants</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Active MRR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {planBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">No plan data available yet.</td>
                </tr>
              ) : (
                planBreakdown.map((row) => (
                  <tr key={row.planName}>
                    <td className="px-5 py-4 text-sm font-black text-slate-900">{row.planName}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">{row.count}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">{formatMoney(row.mrr, currency, personalization.defaultLocale)}</td>
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
