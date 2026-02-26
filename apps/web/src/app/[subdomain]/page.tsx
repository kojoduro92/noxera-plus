"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";

type Section = {
  id: string;
  type: string;
  content: any;
};

type Page = {
  id: string;
  slug: string;
  title: string;
  sections: Section[];
};

type Website = {
  id: string;
  themeConfig: any;
  pages: Page[];
};

export default function SubdomainLandingPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params);
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWebsite = async () => {
      try {
        const data = await apiFetch<Website>(`/api/public/website/${subdomain}`);
        setWebsite(data);
      } catch (err) {
        // Expected case for unknown subdomains: render the under-construction fallback.
        if (err instanceof ApiError && err.status === 404) {
          setWebsite(null);
          return;
        }
        console.warn("Unable to load public website content; using fallback view.");
      } finally {
        setLoading(false);
      }
    };
    void loadWebsite();
  }, [subdomain]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  const homePage = website?.pages.find((p) => p.slug === "home") || website?.pages[0];
  const theme = website?.themeConfig || { primaryColor: "#4f46e5" };

  if (!homePage) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-black mb-4">Under Construction</h1>
          <p className="text-slate-400">This church website is being prepared. Check back soon!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      {homePage.sections.map((section) => (
        <RenderSection key={section.id} section={section} theme={theme} subdomain={subdomain} />
      ))}
    </div>
  );
}

function RenderSection({ section, theme, subdomain }: { section: Section; theme: any; subdomain: string }) {
  const content = section.content || {};

  switch (section.type) {
    case "hero":
      return (
        <header className="relative isolate overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 px-8 py-24 lg:py-32">
          <div className="mx-auto max-w-6xl relative z-10">
            <div className="inline-block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300 mb-6">
              Welcome to our home
            </div>
            <h1 className="text-5xl font-black leading-tight sm:text-7xl lg:text-8xl tracking-tighter mb-8 italic">
              {content.title || "Vibrant Faith"}
            </h1>
            <p className="max-w-2xl text-lg lg:text-xl text-slate-300 font-medium leading-relaxed mb-10">
              {content.subtitle || "A community discovery purpose and showing radical hospitality every day."}
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                style={{ backgroundColor: theme.primaryColor }}
                className="rounded-full px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:scale-105 active:scale-95 shadow-xl shadow-indigo-500/20"
              >
                {content.buttonText || "Get Connected"}
              </button>
              <Link
                href={`/${subdomain}/events`}
                className="rounded-full border border-white/20 bg-white/5 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
              >
                View Events
              </Link>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-1/2 h-full pointer-events-none opacity-20">
            <div className="absolute inset-0 bg-indigo-500 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
          </div>
        </header>
      );

    case "content":
      return (
        <section className="mx-auto max-w-6xl px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{content.title || "Our Vision"}</h2>
              <div className="w-20 h-1.5 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
              <p className="text-lg text-slate-300 leading-relaxed">{content.body || "Content goes here..."}</p>
            </div>
            <div className="aspect-video rounded-3xl bg-slate-900 border border-white/5 shadow-2xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent group-hover:opacity-0 transition duration-700" />
              <div className="flex items-center justify-center h-full text-slate-700 font-black uppercase tracking-widest text-xs">Image Placeholder</div>
            </div>
          </div>
        </section>
      );

    case "grid":
      return (
        <section className="mx-auto max-w-6xl px-8 py-20 bg-white/5 rounded-[3rem] my-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black tracking-tight sm:text-5xl mb-4">{content.title || "Ministries"}</h2>
            <p className="text-slate-400 font-medium">Explore how we serve our community.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {(content.items || [{ title: "Kids", desc: "Nurturing faith in the next generation." }]).map((item: any, i: number) => (
              <div key={i} className="group rounded-3xl border border-white/5 bg-slate-900/50 p-8 transition hover:border-white/20 hover:bg-slate-900 shadow-xl">
                <div className="h-12 w-12 rounded-2xl mb-6 flex items-center justify-center text-xl" style={{ backgroundColor: `${theme.primaryColor}20`, color: theme.primaryColor }}>
                  {i + 1}
                </div>
                <h3 className="text-xl font-black mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      );

    default:
      return null;
  }
}
