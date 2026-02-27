"use client";

import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { BillingTenantRow, PaginatedResponse, PlanSummary } from "@/lib/super-admin-types";
import { formatMoney } from "@/lib/platform-options";
import { usePlatformPersonalization } from "@/contexts/PlatformPersonalizationContext";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

type BillingListResponse = PaginatedResponse<BillingTenantRow> & {
  summary: {
    mrr: number;
    activeSubscriptions: number;
  };
};

const BILLING_STATUSES = ["Active", "Past Due", "Suspended", "Cancelled"] as const;
type SortOption = "tenant" | "status" | "plan" | "created";

type CouponRow = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  expiryDate?: string | null;
  usageLimit?: number | null;
  usageCount: number;
  isActive: boolean;
};

type CouponsResponse = PaginatedResponse<CouponRow>;

export default function BillingPlansPage() {
  const { personalization } = usePlatformPersonalization();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const currentPath = pathname ?? "/super-admin/billing";

  const [activeTab, setActiveTab] = useState<"subscriptions" | "coupons">("subscriptions");
  const page = Math.max(1, Number(searchParams?.get("page") || "1"));
  const status = searchParams?.get("status") || "";
  const search = searchParams?.get("search") || "";
  const planId = searchParams?.get("planId") || "";

  const [draftSearch, setDraftSearch] = useState(search);
  const [draftStatus, setDraftStatus] = useState(status);
  const [draftPlanId, setDraftPlanId] = useState(planId);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [data, setData] = useState<BillingListResponse>({
    items: [],
    page: 1,
    limit: 25,
    total: 0,
    summary: { mrr: 0, activeSubscriptions: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<CouponsResponse>({ items: [], page: 1, limit: 25, total: 0 });
  const [couponCreating, setCouponCreating] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "PERCENTAGE",
    discountValue: 0,
    expiryDate: "",
    usageLimit: 0,
  });

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingTenantId, setUpdatingTenantId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("tenant");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setDraftSearch(search);
    setDraftStatus(status);
    setDraftPlanId(planId);
  }, [search, status, planId]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (planId) params.set("planId", planId);
    params.set("page", String(page));
    params.set("limit", "25");
    return params.toString();
  }, [page, planId, search, status]);

  const loadData = useCallback(async () => {
    try {
      setError("");
      const [plansResponse, tenantsResponse] = await Promise.all([
        apiFetch<PlanSummary[]>("/api/super-admin/billing/plans"),
        apiFetch<BillingListResponse>(`/api/super-admin/billing/tenants?${queryString}`),
      ]);
      setPlans(plansResponse);
      setData(tenantsResponse);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load billing data.");
      }
    }
  }, [queryString]);

  const loadCoupons = useCallback(async () => {
    try {
      setCouponError("");
      const response = await apiFetch<CouponsResponse>(`/api/super-admin/billing/coupons?page=${page}&limit=25`);
      setCoupons(response);
    } catch (err) {
      setCouponError((err as { message?: string })?.message ?? "Unable to load coupons.");
    }
  }, [page]);

  useEffect(() => {
    setLoading(true);
    if (activeTab === "subscriptions") {
      void loadData().finally(() => setLoading(false));
    } else {
      void loadCoupons().finally(() => setLoading(false));
    }
  }, [activeTab, loadCoupons, loadData]);

  const createCoupon = async (event: FormEvent) => {
    event.preventDefault();
    setCouponCreating(true);
    setCouponError("");
    try {
      await apiFetch("/api/super-admin/billing/coupons", {
        method: "POST",
        ...withJsonBody({
          ...couponForm,
          usageLimit: couponForm.usageLimit || null,
        }),
      });
      setNotice("Coupon created successfully.");
      setCouponForm({ code: "", discountType: "PERCENTAGE", discountValue: 0, expiryDate: "", usageLimit: 0 });
      void loadCoupons();
    } catch (err) {
      setCouponError((err as { message?: string })?.message ?? "Failed to create coupon.");
    } finally {
      setCouponCreating(false);
    }
  };

  const toggleCoupon = async (id: string) => {
    try {
      await apiFetch(`/api/super-admin/billing/coupons/${id}/active`, { method: "PATCH" });
      void loadCoupons();
    } catch (err) {
      setCouponError((err as { message?: string })?.message ?? "Failed to update coupon.");
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    try {
      await apiFetch(`/api/super-admin/billing/coupons/${id}`, { method: "DELETE" });
      void loadCoupons();
    } catch (err) {
      setCouponError((err as { message?: string })?.message ?? "Failed to delete coupon.");
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (draftSearch.trim()) params.set("search", draftSearch.trim());
    if (draftStatus) params.set("status", draftStatus);
    if (draftPlanId) params.set("planId", draftPlanId);
    params.set("page", "1");
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(Math.max(1, nextPage)));
    router.replace(`${currentPath}?${params.toString()}`);
  };

  const updateTenantPlan = async (tenantId: string, selectedPlanId: string) => {
    setNotice("");
    setError("");
    setUpdatingTenantId(tenantId);

    try {
      const updated = await apiFetch<BillingTenantRow>(`/api/super-admin/billing/tenants/${tenantId}/plan`, {
        method: "PATCH",
        ...withJsonBody({ planId: selectedPlanId }),
      });
      setData((prev) => ({
        ...prev,
        items: prev.items.map((tenant) => (tenant.id === tenantId ? updated : tenant)),
      }));
      setNotice("Plan updated successfully.");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Failed to update plan.");
    } finally {
      setUpdatingTenantId(null);
    }
  };

  const updateTenantStatus = async (tenantId: string, nextStatus: string) => {
    setNotice("");
    setError("");
    setUpdatingTenantId(tenantId);

    try {
      const updated = await apiFetch<BillingTenantRow>(`/api/super-admin/billing/tenants/${tenantId}/status`, {
        method: "PATCH",
        ...withJsonBody({ status: nextStatus }),
      });
      setData((prev) => ({
        ...prev,
        items: prev.items.map((tenant) => (tenant.id === tenantId ? updated : tenant)),
      }));
      setNotice("Billing status updated.");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Failed to update status.");
    } finally {
      setUpdatingTenantId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  const sortedItems = useMemo(() => {
    const next = [...data.items];
    const direction = sortDirection === "asc" ? 1 : -1;
    next.sort((a, b) => {
      if (sortBy === "tenant") return a.name.localeCompare(b.name) * direction;
      if (sortBy === "status") return a.status.localeCompare(b.status) * direction;
      if (sortBy === "plan") return (a.plan?.name ?? "").localeCompare(b.plan?.name ?? "") * direction;
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * direction;
    });
    return next;
  }, [data.items, sortBy, sortDirection]);

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(format, "super-admin-billing-tenants", sortedItems, [
      { label: "Tenant", value: (row) => row.name },
      { label: "Domain", value: (row) => (row.domain ? `${row.domain}.noxera.plus` : "") },
      { label: "Plan", value: (row) => row.plan?.name ?? "No plan" },
      { label: "Status", value: (row) => row.status },
      { label: "Created", value: (row) => new Date(row.createdAt).toLocaleDateString() },
    ], "Super Admin Billing");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("subscriptions")}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider transition ${
            activeTab === "subscriptions"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          Tenant Subscriptions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("coupons")}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider transition ${
            activeTab === "coupons"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          Coupon Management
        </button>
      </div>

      {activeTab === "subscriptions" ? (
        <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Subscriptions</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{data.summary.activeSubscriptions}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current MRR</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{formatMoney(data.summary.mrr, personalization.defaultCurrency, personalization.defaultLocale)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Plans Configured</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{plans.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-6">
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Search</span>
            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Church name or domain"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
            <select
              value={draftStatus}
              onChange={(event) => setDraftStatus(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All statuses</option>
              {BILLING_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Plan</span>
            <select
              value={draftPlanId}
              onChange={(event) => setDraftPlanId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All plans</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold transition hover:bg-indigo-700 !text-white"
            >
              Apply Filters
            </button>
          </div>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="tenant">Sort: Tenant</option>
            <option value="status">Sort: Status</option>
            <option value="plan">Sort: Plan</option>
            <option value="created">Sort: Created</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={sortDirection}
              onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="asc">Asc</option>
              <option value="desc">Desc</option>
            </select>
            <TableExportMenu onExport={exportRows} label="Export" />
          </div>
        </div>
      </div>

      {error && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Tenant</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-5 py-4">
                      <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-9 w-40 animate-pulse rounded-xl bg-slate-200" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-9 w-36 animate-pulse rounded-xl bg-slate-200" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                    </td>
                  </tr>
                ))
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">
                    No billing tenants found for the current filter set.
                  </td>
                </tr>
              ) : (
                sortedItems.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                      <p className="text-xs text-slate-500">{tenant.domain ? `${tenant.domain}.noxera.plus` : "No domain"}</p>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <select
                        value={tenant.plan?.id || ""}
                        onChange={(event) => void updateTenantPlan(tenant.id, event.target.value)}
                        disabled={updatingTenantId === tenant.id}
                        className="w-44 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                      >
                        <option value="">No plan</option>
                        {plans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name} ({formatMoney(plan.price, personalization.defaultCurrency, personalization.defaultLocale)})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={tenant.status}
                        onChange={(event) => void updateTenantStatus(tenant.id, event.target.value)}
                        disabled={updatingTenantId === tenant.id}
                        className="w-44 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
                      >
                        {BILLING_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">{new Date(tenant.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-500">
            Page {data.page} of {totalPages} • {data.total} tenant(s)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setPage(data.page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.page >= totalPages}
              onClick={() => setPage(data.page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      </>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            <form onSubmit={createCoupon} className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Create New Coupon</h3>
              <div className="mt-4 space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">Coupon Code</span>
                  <input
                    value={couponForm.code}
                    onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })}
                    placeholder="e.g. WELCOME50"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    required
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Type</span>
                    <select
                      value={couponForm.discountType}
                      onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold outline-none"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Value</span>
                    <input
                      type="number"
                      value={couponForm.discountValue}
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold outline-none"
                      required
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">Expiry Date (Optional)</span>
                  <input
                    type="date"
                    value={couponForm.expiryDate}
                    onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold outline-none"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">Usage Limit (Optional)</span>
                  <input
                    type="number"
                    value={couponForm.usageLimit}
                    onChange={(e) => setCouponForm({ ...couponForm, usageLimit: Number(e.target.value) })}
                    placeholder="0 for unlimited"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={couponCreating}
                  className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-black uppercase tracking-wider text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  {couponCreating ? "Creating..." : "Create Coupon"}
                </button>
              </div>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Code</th>
                      <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Discount</th>
                      <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Usage</th>
                      <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                      <th className="px-5 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}><td colSpan={5} className="px-5 py-4"><div className="h-6 w-full animate-pulse rounded bg-slate-100" /></td></tr>
                      ))
                    ) : coupons.items.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">No coupons found.</td></tr>
                    ) : (
                      coupons.items.map((coupon) => (
                        <tr key={coupon.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-4 whitespace-nowrap font-black text-indigo-600">{coupon.code}</td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-sm font-bold text-slate-900">
                              {coupon.discountType === "PERCENTAGE" ? `${coupon.discountValue}%` : formatMoney(coupon.discountValue, personalization.defaultCurrency, personalization.defaultLocale)}
                            </span>
                            <p className="text-[10px] text-slate-500 font-semibold uppercase">Off total price</p>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <p className="text-sm font-bold text-slate-700">{coupon.usageCount} / {coupon.usageLimit || "∞"}</p>
                            <p className="text-[10px] text-slate-500 font-semibold uppercase">Redemptions</p>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${coupon.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              {coupon.isActive ? "Active" : "Disabled"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => void toggleCoupon(coupon.id)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition">
                                {coupon.isActive ? "Disable" : "Enable"}
                              </button>
                              <button onClick={() => void deleteCoupon(coupon.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition">
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
