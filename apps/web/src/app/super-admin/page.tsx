"use client";

import React, { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import Link from "next/link";

type PlatformMetrics = {
  totalChurches: number;
  activeChurches: number;
  mrr: number;
};

export default function SuperAdminDashboard() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMetrics = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch<PlatformMetrics>("/api/super-admin/tenants/platform/metrics");
      setMetrics(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load platform metrics.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMetrics();
  }, []);

  const totalChurches = metrics?.totalChurches ?? 0;
  const activeChurches = metrics?.activeChurches ?? 0;
  const conversionRate = totalChurches > 0 ? ((activeChurches / totalChurches) * 100).toFixed(1) : "0.0";

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Platform Dashboard</h2>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 space-y-3">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchMetrics()}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Total Churches</h3>
            <span className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </span>
          </div>
          <p className="text-4xl font-black mt-4 text-gray-900">{totalChurches}</p>
          <p className="text-xs text-green-500 font-bold mt-2">+2 this week</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Active Subscriptions</h3>
            <span className="p-2 bg-green-50 rounded-lg text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
          </div>
          <p className="text-4xl font-black mt-4 text-gray-900">{activeChurches}</p>
          <p className="text-xs text-gray-400 font-medium mt-2">{conversionRate}% conversion rate</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-500 text-sm font-semibold uppercase tracking-wider">Monthly Revenue</h3>
            <span className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
          </div>
          <p className="text-4xl font-black mt-4 text-gray-900">${metrics?.mrr ?? 0}</p>
          <p className="text-xs text-indigo-500 font-bold mt-2">Target: $5,000</p>
        </div>
      </div>

      <div className="bg-indigo-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-2xl font-bold mb-2">Grow your platform!</h3>
          <p className="text-indigo-200 max-w-lg mb-6 text-sm leading-relaxed">
            Monitor system health and church activity in real-time. Use the Audit Log to track every administrative action.
          </p>
          <Link
            href="/super-admin/analytics"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2.5 text-sm font-bold shadow-xl transition-colors hover:bg-indigo-50 !text-indigo-900"
          >
            View Analytics Report
            <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20"></div>
      </div>
    </div>
  );
}
