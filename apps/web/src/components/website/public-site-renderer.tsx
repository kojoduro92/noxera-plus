"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type PublicSection = {
  id: string;
  type: string;
  content: Record<string, any>;
};

type PublicPage = {
  id: string;
  slug: string;
  title: string;
  sections: PublicSection[];
  seo?: Record<string, any>;
};

type PublicWebsite = {
  id: string;
  themeConfig: Record<string, any>;
  pages: PublicPage[];
};

type FormState = {
  [key: string]: string;
};

function blockArray(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function trackAnalytics(
  domain: string | undefined,
  payload: {
    pagePath: string;
    eventType: "page_view" | "cta_click" | "form_submit";
    source?: string;
    payload?: Record<string, unknown>;
  },
) {
  if (!domain) return;
  const body = JSON.stringify(payload);
  const target = `/api/public/website/${encodeURIComponent(domain)}/analytics`;

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(target, blob);
      return;
    } catch {
      // fallback to fetch
    }
  }

  void fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics should not block the user flow.
  });
}

function DynamicListBlock({ content }: { content: Record<string, any> }) {
  const resolvedItems = Array.isArray(content.resolvedItems) ? content.resolvedItems : [];
  const fallback = (content.fallback && typeof content.fallback === "object" ? content.fallback : {}) as Record<string, any>;

  if (!resolvedItems.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="text-2xl font-black text-white">{fallback.heading || content.heading || "Updates"}</h3>
        <p className="mt-2 text-sm text-slate-300">{fallback.body || "No items available right now."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-2xl font-black text-white">{content.heading || "Latest"}</h3>
      <div className="mt-4 grid gap-3">
        {resolvedItems.map((item: Record<string, any>, index: number) => (
          <article key={`${item.title || index}`} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-base font-black text-white">{item.title || `Item ${index + 1}`}</p>
            {item.subtitle ? <p className="mt-1 text-sm text-slate-300">{item.subtitle}</p> : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function FormBlock({ content, domain, pagePath }: { content: Record<string, any>; domain?: string; pagePath: string }) {
  const formKey = typeof content.formKey === "string" && content.formKey.trim() ? content.formKey.trim() : "contact-us";
  const fields = blockArray(content.fields);
  const shape = fields.length
    ? fields
    : [
        { key: "name", label: "Name", type: "text", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "message", label: "Message", type: "textarea", required: true },
      ];

  const initialState = useMemo<FormState>(
    () =>
      shape.reduce<FormState>((acc, field) => {
        const key = typeof field.key === "string" ? field.key : "field";
        acc[key] = "";
        return acc;
      }, {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formKey],
  );

  const [state, setState] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!domain) {
      setError("Form submission is disabled in preview mode.");
      return;
    }
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/public/website/${encodeURIComponent(domain)}/forms/${encodeURIComponent(formKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fields: state, sourcePath: pagePath }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setError(payload.message || "Unable to submit form.");
        return;
      }

      setNotice("Submission received. Our team will follow up shortly.");
      setState(initialState);

      trackAnalytics(domain, {
        pagePath,
        eventType: "form_submit",
        source: formKey,
      });
    } catch {
      setError("Unable to submit form.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-2xl font-black text-white">{content.title || "Connect With Us"}</h3>
      {content.description ? <p className="mt-2 text-sm text-slate-300">{content.description}</p> : null}
      <form className="mt-4 grid gap-3" onSubmit={submit}>
        {shape.map((field, index) => {
          const key = typeof field.key === "string" ? field.key : `field_${index}`;
          const type = typeof field.type === "string" ? field.type : "text";
          const required = field.required !== false;
          const label = typeof field.label === "string" ? field.label : key;
          const value = state[key] ?? "";

          if (type === "textarea") {
            return (
              <label key={key} className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
                {label}
                <textarea
                  required={required}
                  value={value}
                  onChange={(evt) => setState((current) => ({ ...current, [key]: evt.target.value }))}
                  rows={4}
                  className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                />
              </label>
            );
          }

          return (
            <label key={key} className="space-y-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
              {label}
              <input
                required={required}
                type={type}
                value={value}
                onChange={(evt) => setState((current) => ({ ...current, [key]: evt.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              />
            </label>
          );
        })}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-900 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : content.submitLabel || "Submit"}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm font-semibold text-rose-300">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm font-semibold text-emerald-300">{notice}</p> : null}
    </section>
  );
}

export function PublicSiteRenderer({
  website,
  domain,
  pageSlug,
}: {
  website: PublicWebsite;
  domain?: string;
  pageSlug?: string;
}) {
  const activePage =
    (pageSlug ? website.pages.find((page) => page.slug === pageSlug) : null) ??
    website.pages.find((page) => page.slug === "home") ??
    website.pages[0];
  const theme = website.themeConfig || {};
  const primaryColor = typeof theme.primaryColor === "string" ? theme.primaryColor : "#4f46e5";
  const accentColor = typeof theme.accentColor === "string" ? theme.accentColor : "#22c55e";

  useEffect(() => {
    trackAnalytics(domain, {
      pagePath: `/${activePage?.slug || "home"}`,
      eventType: "page_view",
      source: "public_page",
    });
  }, [domain, activePage?.slug]);

  if (!activePage) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-black mb-4">Under Construction</h1>
          <p className="text-slate-400">This church website is being prepared. Check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      {activePage.sections.map((section) => {
        const content = section.content || {};

        if (section.type === "hero") {
          return (
            <header key={section.id} className="relative isolate overflow-hidden px-8 py-24 lg:py-32" style={{ background: `linear-gradient(145deg, ${primaryColor}25, #020617 55%, ${accentColor}20)` }}>
              <div className="nx-shell relative z-10">
                <div className="inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200 mb-6">
                  {content.eyebrow || "Welcome"}
                </div>
                <h1 className="text-5xl font-black leading-tight sm:text-7xl tracking-tighter mb-8">{content.title || "Welcome"}</h1>
                <p className="max-w-3xl text-lg text-slate-200 leading-relaxed mb-10">{content.subtitle || "Experience faith and community."}</p>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href={content.primaryCtaHref || "/new-here"}
                    onClick={() =>
                        trackAnalytics(domain, {
                        pagePath: `/${activePage.slug}`,
                        eventType: "cta_click",
                        source: "hero_primary",
                        payload: { href: content.primaryCtaHref || "/new-here" },
                      })
                    }
                    className="rounded-full px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {content.primaryCtaLabel || "Plan Your Visit"}
                  </Link>
                  {content.secondaryCtaLabel ? (
                    <Link
                      href={content.secondaryCtaHref || "/service-times"}
                      onClick={() =>
                        trackAnalytics(domain, {
                          pagePath: `/${activePage.slug}`,
                          eventType: "cta_click",
                          source: "hero_secondary",
                          payload: { href: content.secondaryCtaHref || "/service-times" },
                        })
                      }
                      className="rounded-full border border-white/20 bg-white/5 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
                    >
                      {content.secondaryCtaLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </header>
          );
        }

        if (section.type === "cta_band") {
          return (
            <section key={section.id} className="nx-shell py-8">
              <div className="rounded-3xl border border-white/10 p-8" style={{ background: `linear-gradient(120deg, ${primaryColor}30, ${accentColor}30)` }}>
                <h2 className="text-3xl font-black text-white">{content.heading || "Take your next step"}</h2>
                <p className="mt-2 text-slate-200">{content.body || "Connect with our church team today."}</p>
                <Link
                  href={content.ctaHref || "/contact"}
                  onClick={() =>
                    trackAnalytics(domain, {
                      pagePath: `/${activePage.slug}`,
                      eventType: "cta_click",
                      source: "cta_band",
                    })
                  }
                  className="mt-5 inline-flex rounded-full bg-white px-6 py-2 text-xs font-black uppercase tracking-wider text-slate-900"
                >
                  {content.ctaLabel || "Get Started"}
                </Link>
              </div>
            </section>
          );
        }

        if (section.type === "feature_grid") {
          const items = Array.isArray(content.items) ? content.items : [];
          return (
            <section key={section.id} className="nx-shell py-14">
              <h2 className="text-3xl font-black text-white">{content.heading || "Highlights"}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item: Record<string, any>, index: number) => (
                  <article key={`${item.title || index}`} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-lg font-black text-white">{item.title || `Item ${index + 1}`}</p>
                    <p className="mt-2 text-sm text-slate-300">{item.description || item.desc || "Description"}</p>
                  </article>
                ))}
              </div>
            </section>
          );
        }

        if (section.type === "dynamic_list") {
          return (
            <section key={section.id} className="nx-shell py-12">
              <DynamicListBlock content={content} />
            </section>
          );
        }

        if (section.type === "form") {
          return (
            <section key={section.id} className="nx-shell py-12">
              <FormBlock content={content} domain={domain} pagePath={`/${activePage.slug}`} />
            </section>
          );
        }

        if (section.type === "custom_fragment") {
          const html = typeof content.html === "string" ? content.html : "";
          return (
            <section key={section.id} className="nx-shell py-12">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6" dangerouslySetInnerHTML={{ __html: html }} />
            </section>
          );
        }

        return (
          <section key={section.id} className="nx-shell py-8">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-2xl font-black text-white">{content.title || section.type}</h2>
              <p className="mt-2 text-sm text-slate-300">{content.body || content.subtitle || "Section content"}</p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
