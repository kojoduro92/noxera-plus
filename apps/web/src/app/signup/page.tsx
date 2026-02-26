"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CreateTenantRequestV2, DENOMINATION_OPTIONS, getTenantDefaultsFromLocale, SIZE_RANGE_OPTIONS } from "@/lib/tenant-onboarding";

type PublicPlan = {
  name: string;
  price: number;
  trialDays: number;
  description: string;
};

type PublicProfile = {
  orgName: string;
  logoUrl?: string;
  brandPrimaryColor?: string;
  brandAccentColor?: string;
};

type CreatedTenant = {
  id: string;
  name: string;
  domain: string;
  onboarding: {
    adminEmail: string;
    ownerName: string;
    adminLoginPath: string;
    publicSitePath: string;
    trialEndsAt: string;
    selectedPlan: string;
    selectedPlanPrice: number;
  };
};

export default function SignupPage() {
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
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [profile, setProfile] = useState<PublicProfile>({
    orgName: "Noxera Plus",
    logoUrl: "/brand-logo.png",
    brandPrimaryColor: "#d62f9d",
    brandAccentColor: "#0bb9f4",
  });
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedTenant | null>(null);

  useEffect(() => {
    const defaults = getTenantDefaultsFromLocale();
    setCountry(defaults.country);
    setTimezone(defaults.timezone);
    setCurrency(defaults.currency);
  }, []);

  useEffect(() => {
    const loadPlans = async () => {
      setLoadingPlans(true);
      try {
        const response = await fetch("/api/public/plans", { cache: "no-store" });
        const payload = (await response.json().catch(() => [])) as PublicPlan[];
        if (Array.isArray(payload) && payload.length > 0) {
          setPlans(payload);
        }
      } finally {
        setLoadingPlans(false);
      }
    };

    void loadPlans();
  }, []);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/public/platform-profile", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => ({}))) as Partial<PublicProfile>;
        setProfile((current) => ({ ...current, ...payload }));
      } catch {
        // Keep defaults when public profile fetch fails.
      }
    };

    void loadProfile();
  }, []);

  const trialDays = useMemo(() => {
    const selected = plans.find((item) => item.name === plan);
    return selected?.trialDays ?? 14;
  }, [plan, plans]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload: CreateTenantRequestV2 = {
        churchName: churchName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim() || undefined,
        domain: domain.trim().toLowerCase(),
        branchName: branchName.trim() || undefined,
        plan,
        country: country.trim() || undefined,
        timezone: timezone.trim() || undefined,
        currency: currency.trim().toUpperCase() || undefined,
        denomination: denomination.trim() || undefined,
        sizeRange: (sizeRange || undefined) as CreateTenantRequestV2["sizeRange"],
      };

      const response = await fetch("/api/public/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json().catch(() => ({}))) as CreatedTenant & { message?: string };
      if (!response.ok) {
        throw new Error(responsePayload.message ?? "Unable to create your church trial right now.");
      }

      setCreated(responsePayload);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to create your church trial right now.");
    } finally {
      setSubmitting(false);
    }
  };

  const loginUrl = created ? created.onboarding.adminLoginPath : "/login";
  const brandName = profile.orgName?.trim() || "Noxera Plus";
  const logoUrl = profile.logoUrl?.trim() || "/brand-logo.png";
  const brandPrimaryColor = profile.brandPrimaryColor || "#d62f9d";
  const brandAccentColor = profile.brandAccentColor || "#0bb9f4";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-xl border px-3 py-2"
            style={{ borderColor: `${brandPrimaryColor}4d`, backgroundColor: `${brandPrimaryColor}1a` }}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-white text-xs font-black !text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={`${brandName} logo`} className="h-full w-full object-cover" />
            </span>
            <span className="text-sm font-black tracking-wide">{brandName.toUpperCase()}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-indigo-300 hover:text-indigo-100">
              Admin Login
            </Link>
            <Link href="/super-admin/login" className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-indigo-300 hover:text-indigo-100">
              Super Admin
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Self-Serve Onboarding</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Start your church workspace in minutes.</h1>
            <p className="mt-3 text-sm text-slate-300">
              Create your tenant, start with a {trialDays}-day free trial, and sign in with Google using your admin email.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandAccentColor }} />
                Instant tenant + default branch provisioning
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandAccentColor }} />
                Google-first login with OTP fallback option
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandAccentColor }} />
                Upgrade to paid plan after trial ends
              </li>
            </ul>

            <div className="mt-8 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-100">Plan Snapshot</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(plans.length > 0
                  ? plans
                  : [
                      { name: "Basic", price: 49, trialDays: 14, description: "Core operations" },
                      { name: "Pro", price: 99, trialDays: 14, description: "Advanced workflows" },
                      { name: "Enterprise", price: 199, trialDays: 14, description: "Scale governance" },
                    ]
                ).map((item) => (
                  <div key={item.name} className={`rounded-xl border p-3 ${plan === item.name ? "bg-slate-900" : "border-slate-700 bg-slate-950/60"}`} style={plan === item.name ? { borderColor: brandAccentColor } : undefined}>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-200">{item.name}</p>
                    <p className="mt-1 text-lg font-black text-white">${item.price}<span className="ml-1 text-[10px] text-slate-400">/mo</span></p>
                    <p className="mt-1 text-[11px] text-slate-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
            {!created ? (
              <>
                <h2 className="text-xl font-black tracking-tight">Create Church Account</h2>
                <p className="mt-2 text-xs text-slate-400">All fields below are needed for your initial workspace setup.</p>

                {error && <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200">{error}</div>}

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <Field label="Owner Full Name" value={ownerName} onChange={setOwnerName} placeholder="Pastor Emmanuel Oduro" required />
                  <Field label="Owner Phone (optional)" value={ownerPhone} onChange={setOwnerPhone} placeholder="+233 55 000 0000" />
                  <Field label="Church Name" value={churchName} onChange={setChurchName} placeholder="Grace Fellowship" required />
                  <Field label="Admin Email" type="email" value={adminEmail} onChange={setAdminEmail} placeholder="admin@church.org" required />
                  <Field
                    label="Church Subdomain"
                    value={domain}
                    onChange={(value) => setDomain(value.replace(/\s+/g, "-").toLowerCase())}
                    placeholder="grace"
                    required
                    suffix=".noxera.plus"
                  />
                  <Field label="Main Branch (optional)" value={branchName} onChange={setBranchName} placeholder="Main Campus" />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Country" value={country} onChange={(value) => setCountry(value.toUpperCase())} placeholder="US" />
                    <Field label="Timezone" value={timezone} onChange={setTimezone} placeholder="Africa/Accra" />
                    <Field label="Currency" value={currency} onChange={(value) => setCurrency(value.toUpperCase())} placeholder="USD" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Denomination</label>
                      <select
                        value={denomination}
                        onChange={(event) => setDenomination(event.target.value)}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm font-bold text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
                      >
                        <option value="">Select denomination</option>
                        {DENOMINATION_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Estimated size</label>
                      <select
                        value={sizeRange}
                        onChange={(event) => setSizeRange(event.target.value)}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm font-bold text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
                      >
                        <option value="">Select size range</option>
                        {SIZE_RANGE_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Paid Plan after trial</label>
                    <select
                      value={plan}
                      onChange={(event) => setPlan(event.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm font-bold text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/30"
                    >
                      <option value="Basic">Basic</option>
                      <option value="Pro">Pro</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || loadingPlans}
                    className="w-full rounded-2xl py-4 text-sm font-black uppercase tracking-widest !text-white shadow-xl transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: brandPrimaryColor, boxShadow: `0 20px 40px ${brandPrimaryColor}50` }}
                  >
                    {submitting ? "Creating Workspace..." : `Start ${trialDays}-Day Free Trial`}
                  </button>
                </form>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Trial Activated</p>
                  <h2 className="mt-2 text-2xl font-black">{created.name} is ready.</h2>
                  <p className="mt-2 text-sm text-emerald-100">
                    Trial ends on {new Date(created.onboarding.trialEndsAt).toLocaleDateString()}. Paid plan queued: {created.onboarding.selectedPlan} (${created.onboarding.selectedPlanPrice}/mo).
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 space-y-2 text-sm">
                  <p><span className="font-black text-slate-300">Owner:</span> <span className="text-slate-100">{created.onboarding.ownerName}</span></p>
                  <p><span className="font-black text-slate-300">Admin email:</span> <span className="text-slate-100">{created.onboarding.adminEmail}</span></p>
                  <p><span className="font-black text-slate-300">Admin login:</span> <span className="text-slate-100">{loginUrl}</span></p>
                  <p><span className="font-black text-slate-300">Public site:</span> <span className="text-slate-100">{created.onboarding.publicSitePath}</span></p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href="/login" className="rounded-xl px-4 py-3 text-center text-xs font-black uppercase tracking-wider !text-white transition hover:opacity-90" style={{ backgroundColor: brandPrimaryColor }}>
                    Continue to Admin Login
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults = getTenantDefaultsFromLocale();
                      setCreated(null);
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
                      setError("");
                    }}
                    className="rounded-xl border border-slate-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-200 transition hover:border-indigo-300"
                  >
                    Create Another Church
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</label>
      <div className="flex overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/80 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/30">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full bg-transparent px-4 py-3 text-sm font-bold text-slate-100 outline-none placeholder:text-slate-600"
        />
        {suffix && <span className="inline-flex items-center border-l border-slate-700 px-3 text-xs font-semibold text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}
