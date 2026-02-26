"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sendSignInLinkToEmail } from "firebase/auth";
import { apiFetch, withJsonBody } from "@/lib/api-client";
import { PageBackButton } from "@/components/console/page-back-button";
import { PageBreadcrumbs } from "@/components/console/page-breadcrumbs";
import { auth } from "@/lib/firebase";
import { CreateTenantRequestV2, DENOMINATION_OPTIONS, getTenantDefaultsFromLocale, SIZE_RANGE_OPTIONS } from "@/lib/tenant-onboarding";

type CreateTenantResponse = {
  id: string;
  name: string;
  domain: string;
  status: string;
  onboarding: {
    adminEmail: string;
    adminLoginPath: string;
    publicSitePath: string;
    trialEndsAt: string;
    selectedPlan: string;
    selectedPlanPrice: number;
    ownerName: string;
    ownerPhone?: string | null;
    country?: string | null;
    timezone?: string | null;
    currency?: string | null;
    denomination?: string | null;
    sizeRange?: string | null;
  };
};

export default function SuperAdminOnboardingPage() {
  const router = useRouter();
  const [churchName, setChurchName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [domain, setDomain] = useState("");
  const [branchName, setBranchName] = useState("");
  const [country, setCountry] = useState("US");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [denomination, setDenomination] = useState("");
  const [sizeRange, setSizeRange] = useState("");
  const [plan, setPlan] = useState("Pro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createdTenant, setCreatedTenant] = useState<CreateTenantResponse | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => {
    const defaults = getTenantDefaultsFromLocale();
    setCountry(defaults.country);
    setTimezone(defaults.timezone);
    setCurrency(defaults.currency);
  }, []);

  const getAbsoluteUrl = (path: string) => {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  };

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Copied to clipboard.");
    } catch {
      setNotice("Copy failed. Please copy manually.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const payload: CreateTenantRequestV2 = {
        churchName: churchName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim() || undefined,
        domain: domain.trim().toLowerCase(),
        plan,
        branchName: branchName.trim() || undefined,
        country: country.trim() || undefined,
        timezone: timezone.trim() || undefined,
        currency: currency.trim().toUpperCase() || undefined,
        denomination: denomination.trim() || undefined,
        sizeRange: (sizeRange || undefined) as CreateTenantRequestV2["sizeRange"],
      };

      const created = await apiFetch<CreateTenantResponse>("/api/super-admin/tenants", {
        method: "POST",
        ...withJsonBody(payload),
      });
      setCreatedTenant(created);
      setNotice(`Church "${created.name}" created successfully.`);
    } catch (err) {
      const message = (err as { message?: string })?.message || "Unable to create church onboarding record.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInviteLink = async () => {
    if (!createdTenant?.onboarding.adminEmail) return;
    if (!auth) {
      setError("Firebase Auth is not initialized. Configure Firebase env values first.");
      return;
    }

    setSendingInvite(true);
    setError("");
    setNotice("");

    try {
      await sendSignInLinkToEmail(auth, createdTenant.onboarding.adminEmail, {
        url: getAbsoluteUrl("/login?next=/admin"),
        handleCodeInApp: true,
      });
      setNotice(`One-time access link sent to ${createdTenant.onboarding.adminEmail}.`);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/operation-not-allowed") {
        setError("Email-link sign-in is disabled in Firebase. Enable Email link in Authentication > Sign-in method.");
      } else {
        setError((err as { message?: string })?.message || "Unable to send access link.");
      }
    } finally {
      setSendingInvite(false);
    }
  };

  const resetForAnother = () => {
    const defaults = getTenantDefaultsFromLocale();
    setChurchName("");
    setAdminEmail("");
    setOwnerName("");
    setOwnerPhone("");
    setDomain("");
    setBranchName("");
    setCountry(defaults.country);
    setTimezone(defaults.timezone);
    setCurrency(defaults.currency);
    setDenomination("");
    setSizeRange("");
    setPlan("Pro");
    setCreatedTenant(null);
    setError("");
    setNotice("");
  };

  const trialEndDate = createdTenant ? new Date(createdTenant.onboarding.trialEndsAt).toLocaleDateString() : "";
  const adminLoginUrl = createdTenant ? getAbsoluteUrl(createdTenant.onboarding.adminLoginPath) : "";
  const publicSiteUrl = createdTenant ? getAbsoluteUrl(createdTenant.onboarding.publicSitePath) : "";

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <PageBackButton fallbackHref="/super-admin/churches" label="Back to Churches" />
          <PageBreadcrumbs
            items={[
              { label: "Super Admin", href: "/super-admin" },
              { label: "Churches", href: "/super-admin/churches" },
              { label: "Onboarding" },
            ]}
          />
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70 p-6 sm:p-8">
        <div className="mb-8">
          <h2 className="text-3xl font-black tracking-tight text-slate-900">Setup Your Church</h2>
          <p className="text-sm text-slate-500 mt-2">Create tenant + admin access on a 14-day trial, then upgrade to the selected paid plan.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {notice}
          </div>
        )}

        {!createdTenant ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Owner Full Name</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="Pastor Emmanuel Oduro"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Owner Phone (Optional)</label>
                <input
                  type="tel"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="+233 55 000 0000"
                />
              </div>
            </div>

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

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="US"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="Africa/Accra"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Currency</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Denomination (Optional)</label>
                <select
                  value={denomination}
                  onChange={(e) => setDenomination(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white"
                >
                  <option value="">Select denomination</option>
                  {DENOMINATION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Estimated Size (Optional)</label>
                <select
                  value={sizeRange}
                  onChange={(e) => setSizeRange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white"
                >
                  <option value="">Select range</option>
                  {SIZE_RANGE_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
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
              <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Paid Plan (After Trial)</label>
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
              {loading ? "Creating Church..." : "Create Church on Trial"}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-800">Onboarding Complete</p>
              <p className="mt-1 text-xs font-medium text-emerald-700">
                {createdTenant.name} is live on trial through {trialEndDate}. Paid plan queued: {createdTenant.onboarding.selectedPlan} (${createdTenant.onboarding.selectedPlanPrice}/mo).
              </p>
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Owner: {createdTenant.onboarding.ownerName}{createdTenant.onboarding.ownerPhone ? ` • ${createdTenant.onboarding.ownerPhone}` : ""}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-slate-600">Admin Access Handoff</p>
              <InfoRow
                label="Admin Email"
                value={createdTenant.onboarding.adminEmail}
                onCopy={() => void copyToClipboard(createdTenant.onboarding.adminEmail)}
              />
              <InfoRow
                label="Owner Name"
                value={createdTenant.onboarding.ownerName}
                onCopy={() => void copyToClipboard(createdTenant.onboarding.ownerName)}
              />
              <InfoRow
                label="Admin Login URL"
                value={adminLoginUrl}
                onCopy={() => void copyToClipboard(adminLoginUrl)}
              />
              <InfoRow
                label="Public Site URL"
                value={publicSiteUrl}
                onCopy={() => void copyToClipboard(publicSiteUrl)}
              />
              <p className="text-xs text-slate-600">
                Preferred method: the admin signs in with Google using the same email above. If needed, send an OTP access link.
              </p>
              <button
                type="button"
                onClick={() => void handleSendInviteLink()}
                disabled={sendingInvite}
                className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendingInvite ? "Sending..." : "Send One-Time Access Link"}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={resetForAnother}
                className="rounded-xl border border-slate-300 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              >
                Onboard Another
              </button>
              <button
                type="button"
                onClick={() => router.push("/super-admin/churches")}
                className="rounded-xl border border-slate-300 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              >
                Open Churches
              </button>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500"
              >
                Open Admin Portal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-slate-800">{value}</p>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
        >
          Copy
        </button>
      </div>
    </div>
  );
}
