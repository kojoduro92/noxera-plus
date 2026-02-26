"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, withJsonBody } from "@/lib/api-client";

type CreateTenantResponse = {
  id: string;
  name: string;
  domain: string;
};

export default function SuperAdminOnboardingPage() {
  const router = useRouter();
  const [churchName, setChurchName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [domain, setDomain] = useState("");
  const [branchName, setBranchName] = useState("");
  const [plan, setPlan] = useState("Pro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch<CreateTenantResponse>("/api/super-admin/tenants", {
        method: "POST",
        ...withJsonBody({
          churchName: churchName.trim(),
          adminEmail: adminEmail.trim().toLowerCase(),
          domain: domain.trim().toLowerCase(),
          plan,
          branchName: branchName.trim() || undefined,
        }),
      });

      router.push("/super-admin/churches?created=1");
      router.refresh();
    } catch (err) {
      const message = (err as { message?: string })?.message || "Unable to create church onboarding record.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 p-6 sm:p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Setup Your Church</h2>
          <p className="text-sm text-slate-500 mt-2">Create a tenant, assign the owner account, and provision the default branch.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Admin Email</label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="pastor@church.org"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Church Name</label>
            <input
              type="text"
              value={churchName}
              onChange={(e) => setChurchName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="Grace Fellowship"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Main Branch Name (Optional)</label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              placeholder="Main Campus"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Subdomain</label>
            <div className="flex rounded-xl border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-500">
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value.replace(/\s+/g, "-"))}
                className="flex-1 px-4 py-3 text-sm font-medium outline-none border-none"
                placeholder="grace"
                required
              />
              <div className="px-4 py-3 text-sm text-slate-500 bg-slate-50 border-l border-slate-200">.noxera.plus</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white"
            >
              <option value="Basic">Basic</option>
              <option value="Pro">Pro</option>
              <option value="Enterprise">Enterprise</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-black uppercase tracking-wider px-4 py-3 disabled:opacity-60 disabled:cursor-not-allowed transition !text-white"
          >
            {loading ? "Creating Church..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
