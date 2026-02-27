import Link from "next/link";

export default function TrustPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="nx-shell py-12">
        <Link href="/" className="text-xs font-black uppercase tracking-wider text-indigo-300 hover:text-indigo-200">
          ← Back to Noxera Plus
        </Link>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Trust, Security & Compliance</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">Noxera Plus enforces strict tenant isolation, server-side authorization, and audited administrative operations.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ["Tenant Isolation", "No client-asserted tenant trust. Access scope resolved server-side from verified auth context."],
            ["Role Enforcement", "Permissions are evaluated server-side on every sensitive mutation."],
            ["Auditability", "Impersonation, user role changes, onboarding, and access lifecycle events are logged."],
            ["Operational Controls", "Feature flags, release cohorts, and retention policies protect existing tenants during upgrades."],
          ].map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-lg font-black">{title}</h2>
              <p className="mt-2 text-sm text-slate-300">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
