import Link from "next/link";
import { use } from "react";

const quickLinks = ["about", "events", "giving", "connect"];

function titleize(subdomain: string) {
  return subdomain
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export default function SubdomainLandingPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params);
  const displayName = `${titleize(subdomain)} Church`;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="relative isolate overflow-hidden rounded-b-3xl bg-gradient-to-br from-indigo-600 via-purple-700 to-slate-900 px-8 py-24">
        <div className="mx-auto max-w-6xl space-y-6">
          <p className="text-xs font-semibold tracking-[0.45em] uppercase text-indigo-200">{subdomain}.noxera.plus</p>
          <h1 className="text-4xl font-black leading-tight sm:text-6xl">{displayName}</h1>
          <p className="max-w-3xl text-lg text-indigo-100/90">
            A vibrant community built on faith, creativity, and generous living. This landing page is a quick placeholder until the full
            Website Builder content syncs from the admin experience.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/${subdomain}/events`}
              className="rounded-full bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.25em] text-indigo-600 transition hover:translate-y-0.5"
            >
              View Events
            </Link>
            <Link
              href={`/${subdomain}/giving`}
              className="rounded-full border border-white/40 px-5 py-3 text-sm font-black uppercase tracking-[0.25em] text-white transition hover:border-white"
            >
              Give
            </Link>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 opacity-40 blur-3xl" aria-hidden />
      </header>

      <main className="mx-auto max-w-6xl px-8 py-16 space-y-16">
        <section className="grid gap-6 rounded-3xl bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
          <h2 className="text-2xl font-black tracking-tight text-white">Our Mission</h2>
          <p className="text-sm text-slate-100/80">
            We exist to help every member discover their calling, build authentic community, and show radical hospitality every day. The
            content in this section will eventually reflect the live ministries and events you configure in the admin console.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {quickLinks.map((slug) => (
              <Link
                key={slug}
                href={`/${subdomain}/${slug}`}
                className="rounded-2xl border border-white/25 bg-white/10 px-5 py-6 text-sm font-bold uppercase tracking-widest text-white transition hover:border-white/70"
              >
                Explore {slug}
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-8 rounded-3xl bg-slate-900/60 p-8 shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.5em] text-indigo-300">Next Gathering</p>
              <h3 className="text-3xl font-black text-white tracking-tight">Sunday Worship · 10am</h3>
            </div>
            <div className="text-right text-sm text-slate-300">
              <p>123 Faith Blvd · {displayName}</p>
              <p>City, State</p>
            </div>
          </div>
          <p className="text-sm text-slate-200/80">
            Drop in for a coffee and experience a relaxed, joyful worship service filled with live music and relevant teaching. After the
            service, meet the team at the Gather Lounge for a warm welcome.
          </p>
        </section>
      </main>
    </div>
  );
}
