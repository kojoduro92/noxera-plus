import Link from "next/link";

const faqs = [
  {
    question: "How does trial and renewal work?",
    answer: "Every tenant starts on a 14-day trial. Plan billing starts after trial expiry according to platform billing policy.",
  },
  {
    question: "How does owner login work after signup?",
    answer: "Owner account is invited at provisioning and auto-claims on first successful sign-in with the invited email.",
  },
  {
    question: "Can one email belong to multiple church tenants?",
    answer: "No. This deployment uses single-tenant-per-email to prevent identity collisions and data leakage.",
  },
  {
    question: "Can we enable/disable features safely?",
    answer: "Yes. Release controls support feature flags and staged tenant cohorts to avoid breaking active users.",
  },
];

export default function PricingFaqPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link href="/" className="text-xs font-black uppercase tracking-wider text-indigo-300 hover:text-indigo-200">
          ← Back to Noxera Plus
        </Link>
        <h1 className="mt-4 text-4xl font-black tracking-tight">Pricing & Trial FAQ</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-300">Clear billing expectations for self-serve onboarding and governance-safe upgrades.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Basic", "$49 / mo"],
            ["Pro", "$99 / mo"],
            ["Enterprise", "$199 / mo"],
          ].map(([plan, price]) => (
            <div key={plan} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{plan}</p>
              <p className="mt-2 text-2xl font-black text-white">{price}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((item) => (
            <article key={item.question} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="text-base font-black">{item.question}</h2>
              <p className="mt-2 text-sm text-slate-300">{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
