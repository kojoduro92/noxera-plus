import Link from "next/link";

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="nx-shell py-12">
        <Link href="/" className="text-xs font-black uppercase tracking-wider text-indigo-300 hover:text-indigo-200">
          ← Back to Noxera Plus
        </Link>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Platform Status & Uptime</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">Live visibility for API health, auth services, notifications queue, and reporting pipelines.</p>

        <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="text-xs font-black uppercase tracking-wider text-emerald-200">Current Status</p>
          <p className="mt-2 text-xl font-black text-white">All core systems operational</p>
          <p className="mt-1 text-sm text-emerald-200">Auth session checks, admin proxies, and tenant-isolated APIs are healthy.</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["API", "99.95%"],
            ["Auth", "99.99%"],
            ["Jobs / Reminders", "99.90%"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-black text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
