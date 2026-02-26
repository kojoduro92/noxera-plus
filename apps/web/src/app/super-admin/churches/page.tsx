"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";

type Church = {
  id: string;
  name: string;
  domain: string;
  status: string;
  plan?: { name?: string | null } | null;
};

export default function ChurchesDirectoryPage() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const fetchChurches = async () => {
    try {
      const data = await apiFetch<Church[]>("/api/super-admin/tenants");
      setChurches(data);
      setError("");
    } catch (err) {
      console.warn("Failed to fetch churches");
      if (err instanceof ApiError && err.status === 401) {
        setError("Your session expired. Please sign in again.");
      } else {
        setError((err as { message?: string })?.message ?? "Unable to load churches.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChurches();
  }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "Active" ? "Suspended" : "Active";
    setStatusUpdatingId(id);
    try {
      await apiFetch<Church>(`/api/super-admin/tenants/${id}/status`, {
        method: "PUT",
        ...withJsonBody({ status: newStatus }),
      });
      setChurches((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
    } catch (err) {
      console.warn("Failed to update status");
      setError((err as { message?: string })?.message ?? "Status update failed. Try again.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Churches Directory</h2>
        <Link
          href="/super-admin/onboarding"
          className="bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium !text-white"
        >
          + Register New Church
        </Link>
      </div>

      {searchParams.get("created") === "1" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          Church created successfully.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Church Name</th>
              <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Domain</th>
              <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Plan</th>
              <th className="px-8 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {churches.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-gray-400 italic">
                  No churches found. Register your first church to begin onboarding.
                </td>
              </tr>
            ) : (
              churches.map((church) => (
                <tr key={church.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-8 py-5 whitespace-nowrap font-bold text-gray-900">
                    <Link href={`/super-admin/churches/${church.id}`} className="hover:text-indigo-600">
                      {church.name}
                    </Link>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm text-gray-500">
                    {church.domain}.noxera.plus
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-sm font-medium">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {church.plan?.name || "Trial"}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-black rounded-full uppercase ${
                        church.status === "Active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {church.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 whitespace-nowrap text-right text-sm font-bold">
                    <button
                      onClick={() => void toggleStatus(church.id, church.status)}
                      disabled={statusUpdatingId === church.id}
                      className={`transition-colors disabled:opacity-50 ${
                        church.status === "Active"
                          ? "text-red-600 hover:text-red-900"
                          : "text-green-600 hover:text-green-900"
                      }`}
                    >
                      {statusUpdatingId === church.id
                        ? "Updating..."
                        : church.status === "Active"
                          ? "Suspend"
                          : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
