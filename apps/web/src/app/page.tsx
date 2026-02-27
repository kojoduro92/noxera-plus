import Link from "next/link";
import { resolveFontStack } from "@/lib/platform-options";

type PublicPlan = {
  name: string;
  price: number;
  trialDays: number;
  description: string;
};

type PublicMetrics = {
  churchCount: number;
  activeUsers: number;
  branchCount: number;
  trialDays: number;
  setupMinutes: number;
  onboardingMode: string;
};

type PublicProfile = {
  orgName: string;
  defaultLocale: string;
  defaultCurrency: string;
  logoUrl?: string;
  brandPrimaryColor?: string;
  brandAccentColor?: string;
  baseFontFamily?: string;
};

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const coreFeatures = [
  {
    title: "Members Lifecycle",
    description: "Track full member journeys from first visit to long-term engagement with complete pastoral records.",
  },
  {
    title: "Services & Attendance",
    description: "Plan worship schedules, run fast check-ins, and monitor attendance trends by service and branch.",
  },
  {
    title: "Giving & Financial Visibility",
    description: "Capture offerings, monitor giving health, and export clear reports for operational accountability.",
  },
  {
    title: "Multi-Tenant Platform",
    description: "Run multiple churches from one platform with role-based access, onboarding controls, and audit logs.",
  },
];

const fallbackProfile: PublicProfile = {
  orgName: "Noxera Plus",
  defaultLocale: "en-US",
  defaultCurrency: "USD",
  logoUrl: "/brand-logo.png",
  brandPrimaryColor: "#d62f9d",
  brandAccentColor: "#0bb9f4",
  baseFontFamily: "inter",
};

const fallbackMetrics: PublicMetrics = {
  churchCount: 30,
  activeUsers: 120,
  branchCount: 45,
  trialDays: 14,
  setupMinutes: 15,
  onboardingMode: "Google + Password + OTP",
};

const fallbackPlans: PublicPlan[] = [
  {
    name: "Basic",
    price: 49,
    trialDays: 14,
    description: "Core church operations for growing ministries.",
  },
  {
    name: "Pro",
    price: 99,
    trialDays: 14,
    description: "Advanced workflows for multi-branch operations.",
  },
  {
    name: "Enterprise",
    price: 199,
    trialDays: 14,
    description: "Platform-scale governance and premium support.",
  },
];

const portalCards = [
  {
    title: "Start Free Trial",
    description: "Self-serve onboarding for church admins. Trial first, payment later.",
    href: "/signup",
    action: "Create Church Account",
    primary: true,
  },
  {
    title: "Church Admin Login",
    description: "Sign in to manage members, services, giving, and church operations.",
    href: "/login",
    action: "Open Admin Portal",
  },
  {
    title: "Super Admin Login",
    description: "Platform operations for billing, tenant onboarding, support, and audit governance.",
    href: "/super-admin/login",
    action: "Open Super Admin",
  },
];

async function fetchPublicJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json().catch(() => fallback)) as T;
  } catch {
    return fallback;
  }
}

function formatPrice(value: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

export default async function Home() {
  const [profile, metrics, plans] = await Promise.all([
    fetchPublicJson<PublicProfile>("/public/platform/profile", fallbackProfile),
    fetchPublicJson<PublicMetrics>("/public/tenants/metrics", fallbackMetrics),
    fetchPublicJson<PublicPlan[]>("/public/tenants/plans", fallbackPlans),
  ]);

  const brandName = profile.orgName?.trim() || fallbackProfile.orgName;
  const brandPrimaryColor = profile.brandPrimaryColor || fallbackProfile.brandPrimaryColor || "#d62f9d";
  const brandAccentColor = profile.brandAccentColor || fallbackProfile.brandAccentColor || "#0bb9f4";
  const logoUrl = profile.logoUrl || fallbackProfile.logoUrl || "/brand-logo.png";
  const displayPlans = plans.length > 0 ? plans : fallbackPlans;
  const baseFontFamily = resolveFontStack(profile.baseFontFamily || fallbackProfile.baseFontFamily);
  const formattedMetrics = [
    { label: "Churches onboarded", value: String(metrics.churchCount) },
    { label: "Active platform users", value: String(metrics.activeUsers) },
    { label: "Average setup time", value: `< ${metrics.setupMinutes} min` },
    { label: "Active branches", value: String(metrics.branchCount) },
    { label: "Free trial", value: `${metrics.trialDays} days` },
    { label: "Admin onboarding", value: metrics.onboardingMode },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white" style={{ fontFamily: baseFontFamily }}>
      <section className="relative overflow-hidden border-b border-indigo-900/50 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.30),_rgba(2,6,23,0.98)_55%)]">
        <div className="nx-shell pb-20 pt-8 md:pt-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
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
            <nav className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider">
              <Link href="/docs" className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-indigo-300 hover:text-indigo-100">
                Docs
              </Link>
              <Link href="/signup" className="rounded-lg px-4 py-2 !text-white transition hover:opacity-90" style={{ backgroundColor: brandPrimaryColor }}>
                Start Free Trial
              </Link>
              <Link href="/login" className="rounded-lg border border-slate-600 px-4 py-2 text-slate-200 transition hover:border-indigo-300 hover:text-indigo-100">
                Admin Login
              </Link>
            </nav>
          </header>

          <div className="mt-14 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="inline-flex rounded-full border border-indigo-400/40 bg-indigo-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">
                Church Operations Platform
              </p>
              <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Grow your church with one operational system for members, services, giving, and reporting.
              </h1>
              <p className="mt-5 max-w-2xl text-base text-slate-300">
                {brandName} helps ministries run daily operations with professional workflows, clear accountability, and tenant-safe architecture.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="rounded-xl px-6 py-3 text-xs font-black uppercase tracking-wider !text-white transition hover:opacity-90" style={{ backgroundColor: brandPrimaryColor }}>
                  Start {metrics.trialDays}-Day Free Trial
                </Link>
                <Link href="/grace" className="rounded-xl border border-slate-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-100 transition hover:border-indigo-300 hover:text-indigo-100">
                  View Sample Church Site
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700/80 bg-slate-900/70 p-6 shadow-2xl shadow-black/30">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-200">Why teams choose {brandName}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {formattedMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3">
                    <p className="text-2xl font-black text-white">{metric.value}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{metric.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                Self-serve signup creates your church workspace instantly with trial access and guided login handoff.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-shell py-14">
        <h2 className="text-2xl font-black tracking-tight">Platform Capabilities</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">Built for real church operations with clean user experience across admin and super-admin portals.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {coreFeatures.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-black text-white">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/60">
        <div className="nx-shell py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Pricing that starts with trial</h2>
              <p className="mt-2 text-sm text-slate-300">All plans begin with a {metrics.trialDays}-day free trial. Upgrade to your selected plan afterward.</p>
            </div>
            <Link href="/signup" className="rounded-xl px-5 py-3 text-xs font-black uppercase tracking-wider !text-white transition hover:opacity-90" style={{ backgroundColor: brandPrimaryColor }}>
              Start Trial
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {displayPlans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-5 ${
                  plan.name.toLowerCase() === "pro"
                    ? "bg-indigo-600/15 shadow-lg shadow-indigo-900/40"
                    : "border-slate-700 bg-slate-950/70"
                }`}
                style={plan.name.toLowerCase() === "pro" ? { borderColor: brandAccentColor } : undefined}
              >
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">{plan.name}</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {formatPrice(plan.price, profile.defaultCurrency, profile.defaultLocale)}
                  <span className="ml-1 text-sm text-slate-400">/ mo</span>
                </p>
                <p className="mt-2 text-sm text-slate-300">{plan.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  <li className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandAccentColor }} />
                    <span>{plan.trialDays}-day free trial</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandAccentColor }} />
                    <span>Role-based admin controls</span>
                  </li>
                  <li className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandAccentColor }} />
                    <span>CSV, PDF, and Excel exports</span>
                  </li>
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="nx-shell py-14">
        <h2 className="text-2xl font-black tracking-tight">Portal Access</h2>
        <p className="mt-2 text-sm text-slate-300">Choose the right entry point based on role.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {portalCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h3 className="text-lg font-black text-white">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{card.description}</p>
              <Link
                href={card.href}
                className={`mt-4 inline-flex rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
                  card.primary
                    ? " !text-white hover:opacity-90"
                    : "border border-slate-600 text-slate-100 hover:border-indigo-300 hover:text-indigo-100"
                }`}
                style={card.primary ? { backgroundColor: brandPrimaryColor } : undefined}
              >
                {card.action}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800">
        <div className="nx-shell py-10 text-xs text-slate-400">
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] font-semibold">
            <Link href="/docs" className="hover:text-slate-200">Docs</Link>
            <Link href="/status" className="hover:text-slate-200">Status</Link>
            <Link href="/trust" className="hover:text-slate-200">Trust & Security</Link>
            <Link href="/pricing-faq" className="hover:text-slate-200">Pricing FAQ</Link>
          </div>
          <p>© {new Date().getFullYear()} {brandName}. Church operations platform.</p>
        </div>
      </section>
    </main>
  );
}
