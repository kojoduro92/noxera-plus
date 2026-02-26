import Link from "next/link";

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/" className="text-xs font-black uppercase tracking-wider text-indigo-300 hover:text-indigo-200">
          ← Back to Noxera Plus
        </Link>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Product Docs & Help Center</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">Operational guides for onboarding, tenant governance, branches, members, services, giving, and reports.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            ["Getting Started", "Create a church workspace, claim owner account, and invite staff securely."],
            ["Tenant Governance", "Branch scopes, role permissions, invite lifecycle, and audit events."],
            ["Daily Operations", "Members, services, attendance, events, groups, and communication workflows."],
            ["Troubleshooting", "Session issues, provider setup checks, and tenant linking recovery paths."],
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
