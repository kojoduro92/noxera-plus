import Link from "next/link";

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

const metrics = [
  { label: "Church workflows automated", value: "30+" },
  { label: "Average setup time", value: "< 15 min" },
  { label: "Free trial", value: "14 days" },
  { label: "Admin onboarding", value: "Google-first" },
];

const plans = [
  {
    name: "Basic",
    price: "$49",
    description: "For single campus teams getting started.",
    features: ["Members directory", "Services calendar", "Basic reports"],
  },
  {
    name: "Pro",
    price: "$99",
    featured: true,
    description: "For growing churches with active operations.",
    features: ["Everything in Basic", "Attendance analytics", "Giving + exports"],
  },
  {
    name: "Enterprise",
    price: "$199",
    description: "For larger organizations needing governance.",
    features: ["Everything in Pro", "Advanced controls", "Priority support"],
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

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-indigo-900/50 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.30),_rgba(2,6,23,0.98)_55%)]">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-8 md:pt-10">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-xs font-black !text-white">N+</span>
              <span className="text-sm font-black tracking-wide">NOXERA PLUS</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wider">
              <Link href="/docs" className="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-indigo-300 hover:text-indigo-100">
                Docs
              </Link>
              <Link href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 !text-white transition hover:bg-indigo-500">
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
                Noxera Plus helps ministries run daily operations with professional workflows, clear accountability, and tenant-safe architecture.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500">
                  Start 14-Day Free Trial
                </Link>
                <Link href="/grace" className="rounded-xl border border-slate-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-100 transition hover:border-indigo-300 hover:text-indigo-100">
                  View Sample Church Site
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-700/80 bg-slate-900/70 p-6 shadow-2xl shadow-black/30">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-200">Why teams choose Noxera</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {metrics.map((metric) => (
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

      <section className="mx-auto max-w-6xl px-6 py-14">
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
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight">Pricing that starts with trial</h2>
              <p className="mt-2 text-sm text-slate-300">All plans begin with a 14-day free trial. Upgrade to your selected plan afterward.</p>
            </div>
            <Link href="/signup" className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500">
              Start Trial
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-5 ${
                  plan.featured
                    ? "border-indigo-500 bg-indigo-600/15 shadow-lg shadow-indigo-900/40"
                    : "border-slate-700 bg-slate-950/70"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">{plan.name}</p>
                <p className="mt-2 text-3xl font-black text-white">{plan.price}<span className="ml-1 text-sm text-slate-400">/ mo</span></p>
                <p className="mt-2 text-sm text-slate-300">{plan.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
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
                    ? "bg-indigo-600 !text-white hover:bg-indigo-500"
                    : "border border-slate-600 text-slate-100 hover:border-indigo-300 hover:text-indigo-100"
                }`}
              >
                {card.action}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800">
        <div className="mx-auto max-w-6xl px-6 py-10 text-xs text-slate-400">
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] font-semibold">
            <Link href="/docs" className="hover:text-slate-200">Docs</Link>
            <Link href="/status" className="hover:text-slate-200">Status</Link>
            <Link href="/trust" className="hover:text-slate-200">Trust & Security</Link>
            <Link href="/pricing-faq" className="hover:text-slate-200">Pricing FAQ</Link>
          </div>
          <p>© {new Date().getFullYear()} Noxera Plus. Church operations platform.</p>
        </div>
      </section>
    </main>
  );
}
