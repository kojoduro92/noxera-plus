"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";

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
  plan?: {
    name?: string | null;
    price?: number | null;
  } | null;
};

export default function AnalyticsReportPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    return Array.from(summary.entries()).map(([planName, data]) => ({
      planName,
      ...data,
    }));
  }, [tenants]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Analytics Report</h2>
        <p className="text-sm text-slate-500 mt-1">Operational metrics and plan-level revenue overview for super-admin decisions.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 space-y-3">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Churches</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{metrics?.totalChurches ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Subscriptions</p>
          <p className="mt-3 text-4xl font-black text-slate-900">{metrics?.activeChurches ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Recurring Revenue</p>
          <p className="mt-3 text-4xl font-black text-slate-900">${metrics?.mrr ?? 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-900">Plan Breakdown</h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Plan</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tenants</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Active MRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {planBreakdown.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-sm text-slate-500 text-center">
                  No data available yet.
                </td>
              </tr>
            ) : (
              planBreakdown.map((row) => (
                <tr key={row.planName}>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{row.planName}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{row.count}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">${row.mrr}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
