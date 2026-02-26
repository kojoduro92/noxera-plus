"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";

type Tenant = {
  id: string;
  name: string;
  domain: string;
  status: string;
  plan?: { name?: string | null; price?: number | null } | null;
  createdAt: string;
};

export default function TenantDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const data = await apiFetch<Tenant>(`/api/super-admin/tenants/${id}`);
        setTenant(data);
        setError("");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setError("Your session expired. Please sign in again.");
        } else {
          setError((err as { message?: string })?.message ?? "Unable to load church details.");
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchTenant();
  }, [id]);

  const toggleStatus = async () => {
    if (!tenant) return;

    const newStatus = tenant.status === "Active" ? "Suspended" : "Active";
    setUpdatingStatus(true);
    try {
      const updated = await apiFetch<Tenant>(`/api/super-admin/tenants/${id}/status`, {
        method: "PUT",
        ...withJsonBody({ status: newStatus }),
      });
      setTenant(updated);
      setError("");
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Status update failed.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-4">
        <Link href="/super-admin/churches" className="text-gray-500 hover:text-indigo-600">
          ← Back to Directory
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error || "Church not found."}
        </div>
      </div>
    );
  }

  const planName = tenant.plan?.name || "Trial";
  const planPrice = tenant.plan?.price ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/super-admin/churches" className="text-gray-500 hover:text-indigo-600">
            ← Back to Directory
          </Link>
          <h2 className="text-2xl font-bold text-gray-800">Church Details</h2>
        </div>
        <button
          onClick={() => void toggleStatus()}
          disabled={updatingStatus}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
            tenant.status === "Active"
              ? "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
              : "bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {updatingStatus ? "Updating..." : tenant.status === "Active" ? "Suspend Tenant" : "Activate Tenant"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-lg leading-6 font-semibold text-gray-900">
              {tenant.name} (ID: {tenant.id})
            </h3>
            <p className="mt-1 text-sm text-gray-500">Domain: {tenant.domain}.noxera.plus</p>
          </div>
          <span
            className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${
              tenant.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
            }`}
          >
            {tenant.status}
          </span>
        </div>

        <div className="px-6 py-5">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-8">
            <div>
              <dt className="text-sm font-medium text-gray-500">Subscription Plan</dt>
              <dd className="mt-1 text-sm text-gray-900 font-semibold">
                {planName} ({planPrice > 0 ? `$${planPrice}/mo` : "$0/mo"})
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">{new Date(tenant.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Domain</dt>
              <dd className="mt-1 text-sm text-gray-900">{tenant.domain}.noxera.plus</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Tenant ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{tenant.id}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
