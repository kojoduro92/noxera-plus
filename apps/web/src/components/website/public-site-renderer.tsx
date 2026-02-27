"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState, type CSSProperties } from "react";

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

type TemplateTone = "light" | "dark" | "warm";

function blockArray(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return fallback;
  return parsed;
}

function isExternalHref(href: string) {
  return href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#");
}

function normalizePath(input: string) {
  if (!input) return "/";
  return input.startsWith("/") ? input : `/${input}`;
}

function joinPath(basePath: string, path: string) {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  if (path === "/") return base;
  return `${base}${path}`;
}

function resolvePublicHref(value: unknown, domain: string | undefined, previewBasePath: string | undefined, fallback = "/") {
  const raw = toText(value, fallback);
  if (isExternalHref(raw)) return raw;

  const path = normalizePath(raw);
  if (domain) {
    if (path === "/" || path === "/home") return `/${domain}`;
    return `/${domain}${path}`;
  }

  if (previewBasePath) {
    if (path === "/home") return joinPath(previewBasePath, "/");
    return joinPath(previewBasePath, path);
  }

  return path;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date)) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function SiteLink({ href, className, children, onClick }: { href: string; className?: string; children: ReactNode; onClick?: () => void }) {
  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} onClick={onClick} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function templateTone(templateStyle: string, light: boolean): TemplateTone {
  if (light) return "light";
  if (templateStyle === "community-warm" || templateStyle === "growth-gradient") return "warm";
  return "dark";
}

function sectionPanelClass(light: boolean, templateStyle: string) {
  const tone = templateTone(templateStyle, light);
  if (tone === "light") return "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm";
  if (tone === "warm") return "rounded-3xl border border-white/20 bg-white/10 p-6 shadow-[0_22px_60px_rgba(15,23,42,0.28)] backdrop-blur";
  return "rounded-3xl border border-white/10 bg-white/5 p-6";
}

function cardClass(light: boolean, templateStyle: string) {
  const tone = templateTone(templateStyle, light);
  if (tone === "light") return "rounded-2xl border border-slate-200 bg-slate-50 p-4";
  if (tone === "warm") return "rounded-2xl border border-white/20 bg-slate-950/35 p-4 backdrop-blur";
  return "rounded-2xl border border-white/10 bg-slate-900/60 p-4";
}

function headingClass(light: boolean, templateStyle: string) {
  if (light) return "text-slate-900";
  if (templateStyle === "community-warm") return "text-cyan-50";
  if (templateStyle === "growth-gradient") return "text-violet-50";
  return "text-white";
}

function bodyClass(light: boolean, templateStyle: string) {
  if (light) return "text-slate-600";
  if (templateStyle === "community-warm") return "text-sky-100/90";
  if (templateStyle === "growth-gradient") return "text-violet-100/85";
  return "text-slate-300";
}

function DynamicListBlock({ content, light, templateStyle }: { content: Record<string, any>; light: boolean; templateStyle: string }) {
  const resolvedItems = Array.isArray(content.resolvedItems) ? content.resolvedItems : [];
  const fallback = (content.fallback && typeof content.fallback === "object" ? content.fallback : {}) as Record<string, any>;

  if (!resolvedItems.length) {
    return (
      <div className={sectionPanelClass(light, templateStyle)}>
        <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(fallback.heading, toText(content.heading, "Updates"))}</h3>
        <p className={`mt-2 text-sm ${bodyClass(light, templateStyle)}`}>{toText(fallback.body, "No items available right now.")}</p>
      </div>
    );
  }

  return (
    <div className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Latest")}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {resolvedItems.map((item: Record<string, any>, index: number) => {
          const dateLabel = formatDate(item.date);
          return (
            <article key={`${item.title || index}`} className={cardClass(light, templateStyle)}>
              {dateLabel ? <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">{dateLabel}</p> : null}
              <p className={`mt-1 text-base font-black ${headingClass(light, templateStyle)}`}>{toText(item.title, `Item ${index + 1}`)}</p>
              {item.subtitle ? <p className={`mt-1 text-sm ${bodyClass(light, templateStyle)}`}>{toText(item.subtitle)}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function FormBlock({
  content,
  domain,
  pagePath,
  light,
  templateStyle,
}: {
  content: Record<string, any>;
  domain?: string;
  pagePath: string;
  light: boolean;
  templateStyle: string;
}) {
  const formKey = toText(content.formKey, "contact-us");
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
    <section className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.title, "Connect With Us")}</h3>
      {content.description ? <p className={`mt-2 text-sm ${bodyClass(light, templateStyle)}`}>{toText(content.description)}</p> : null}
      <form className="mt-4 grid gap-3" onSubmit={submit}>
        {shape.map((field, index) => {
          const key = typeof field.key === "string" ? field.key : `field_${index}`;
          const type = typeof field.type === "string" ? field.type : "text";
          const required = field.required !== false;
          const label = typeof field.label === "string" ? field.label : key;
          const value = state[key] ?? "";

          if (type === "textarea") {
            return (
              <label key={key} className={`space-y-1 text-xs font-semibold uppercase tracking-wider ${light ? "text-slate-500" : "text-slate-300"}`}>
                {label}
                <textarea
                  required={required}
                  value={value}
                  onChange={(evt) => setState((current) => ({ ...current, [key]: evt.target.value }))}
                  rows={4}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                    light
                      ? "border-slate-300 bg-white text-slate-900 focus:border-indigo-400"
                      : "border-white/10 bg-slate-900/70 text-white focus:border-white/20"
                  }`}
                />
              </label>
            );
          }

          return (
            <label key={key} className={`space-y-1 text-xs font-semibold uppercase tracking-wider ${light ? "text-slate-500" : "text-slate-300"}`}>
              {label}
              <input
                required={required}
                type={type}
                value={value}
                onChange={(evt) => setState((current) => ({ ...current, [key]: evt.target.value }))}
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                  light
                    ? "border-slate-300 bg-white text-slate-900 focus:border-indigo-400"
                    : "border-white/10 bg-slate-900/70 text-white focus:border-white/20"
                }`}
              />
            </label>
          );
        })}
        <button
          type="submit"
          disabled={submitting}
          className={`mt-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider disabled:opacity-60 ${light ? "bg-slate-900 text-white" : "bg-white text-slate-900"}`}
        >
          {submitting ? "Submitting..." : toText(content.submitLabel, "Submit")}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm font-semibold text-emerald-600">{notice}</p> : null}
    </section>
  );
}

function StatsBlock({ content, light, templateStyle }: { content: Record<string, any>; light: boolean; templateStyle: string }) {
  const items = blockArray(content.items);
  return (
    <section className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Church Snapshot")}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <article key={`${item.label || index}`} className={cardClass(light, templateStyle)}>
            <p className={`text-3xl font-black ${headingClass(light, templateStyle)}`}>{toText(item.value, "0")}</p>
            <p className={`mt-1 text-xs font-bold uppercase tracking-wider ${bodyClass(light, templateStyle)}`}>{toText(item.label, `Metric ${index + 1}`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ServiceTimesBlock({ content, light, templateStyle }: { content: Record<string, any>; light: boolean; templateStyle: string }) {
  const items = blockArray(content.items);
  return (
    <section className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Service Times")}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <article key={`${item.label || index}`} className={cardClass(light, templateStyle)}>
            <p className={`text-xs font-bold uppercase tracking-wider ${bodyClass(light, templateStyle)}`}>{toText(item.label, `Schedule ${index + 1}`)}</p>
            <p className={`mt-1 text-lg font-black ${headingClass(light, templateStyle)}`}>{toText(item.value, "TBD")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function StaffCardsBlock({ content, light, templateStyle }: { content: Record<string, any>; light: boolean; templateStyle: string }) {
  const items = blockArray(content.items);
  return (
    <section className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Leadership")}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <article key={`${item.name || index}`} className={cardClass(light, templateStyle)}>
            <div className={`h-12 w-12 rounded-full border ${light ? "border-slate-300 bg-slate-100" : "border-white/20 bg-gradient-to-br from-slate-700 to-slate-900"}`} />
            <p className={`mt-3 text-lg font-black ${headingClass(light, templateStyle)}`}>{toText(item.name, `Leader ${index + 1}`)}</p>
            <p className={`text-sm font-semibold ${bodyClass(light, templateStyle)}`}>{toText(item.role, "Team")}</p>
            {item.bio ? <p className={`mt-2 text-sm ${bodyClass(light, templateStyle)}`}>{toText(item.bio)}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function TestimonialsBlock({ content, light, templateStyle }: { content: Record<string, any>; light: boolean; templateStyle: string }) {
  const items = blockArray(content.items);
  return (
    <section className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Stories")}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => (
          <article key={`${item.author || index}`} className={cardClass(light, templateStyle)}>
            <p className={`text-sm italic ${bodyClass(light, templateStyle)}`}>&ldquo;{toText(item.quote, "Story coming soon.")}&rdquo;</p>
            <p className={`mt-3 text-xs font-bold uppercase tracking-wider ${bodyClass(light, templateStyle)}`}>{toText(item.author, `Member ${index + 1}`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FaqBlock({ content, light, templateStyle }: { content: Record<string, any>; light: boolean; templateStyle: string }) {
  const items = blockArray(content.items);
  return (
    <section className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Frequently Asked Questions")}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <details key={`${item.question || index}`} className={cardClass(light, templateStyle)}>
            <summary className={`cursor-pointer text-sm font-black ${headingClass(light, templateStyle)}`}>{toText(item.question, `Question ${index + 1}`)}</summary>
            <p className={`mt-2 text-sm ${bodyClass(light, templateStyle)}`}>{toText(item.answer, "Answer coming soon.")}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function GalleryBlock({ content, light, templateStyle }: { content: Record<string, any>; light: boolean; templateStyle: string }) {
  const items = blockArray(content.items);
  return (
    <section className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Gallery")}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <article key={`${item.imageUrl || index}`} className={`${cardClass(light, templateStyle)} overflow-hidden p-0`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={toText(item.imageUrl, "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1200&q=80")}
              alt={toText(item.title, `Gallery image ${index + 1}`)}
              className="h-48 w-full object-cover"
              loading="lazy"
            />
            <div className="p-3">
              <p className={`text-sm font-black ${headingClass(light, templateStyle)}`}>{toText(item.title, `Photo ${index + 1}`)}</p>
              {item.caption ? <p className={`mt-1 text-xs ${bodyClass(light, templateStyle)}`}>{toText(item.caption)}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MapContactBlock({ content, light, templateStyle }: { content: Record<string, any>; light: boolean; templateStyle: string }) {
  const heading = toText(content.heading, "Find and Contact Us");
  const address = toText(content.address, "Address unavailable");
  const email = toText(content.email, "hello@church.org");
  const phone = toText(content.phone, "+1 (000) 000-0000");
  const mapLink = toText(content.mapLink, "https://maps.google.com");

  return (
    <section className={sectionPanelClass(light, templateStyle)}>
      <h3 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{heading}</h3>
      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <a
          href={mapLink}
          target="_blank"
          rel="noreferrer"
          className={`flex min-h-52 items-end rounded-2xl border p-4 text-sm font-semibold ${
            light ? "border-slate-300 bg-slate-100 text-slate-700 hover:text-slate-900" : "border-white/10 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-300 hover:text-white"
          }`}
        >
          Open map directions
        </a>
        <div className={`${cardClass(light, templateStyle)} space-y-3 text-sm`}>
          <p>
            <span className={`block text-[10px] font-black uppercase tracking-[0.2em] ${light ? "text-slate-500" : "text-slate-400"}`}>Address</span>
            <span className={bodyClass(light, templateStyle)}>{address}</span>
          </p>
          <p>
            <span className={`block text-[10px] font-black uppercase tracking-[0.2em] ${light ? "text-slate-500" : "text-slate-400"}`}>Email</span>
            <a href={`mailto:${email}`} className={light ? "text-slate-800 hover:text-slate-900" : "text-slate-200 hover:text-white"}>
              {email}
            </a>
          </p>
          <p>
            <span className={`block text-[10px] font-black uppercase tracking-[0.2em] ${light ? "text-slate-500" : "text-slate-400"}`}>Phone</span>
            <a href={`tel:${phone}`} className={light ? "text-slate-800 hover:text-slate-900" : "text-slate-200 hover:text-white"}>
              {phone}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

function FooterBlock({
  content,
  domain,
  previewBasePath,
  light,
  templateStyle,
}: {
  content: Record<string, any>;
  domain?: string;
  previewBasePath?: string;
  light: boolean;
  templateStyle: string;
}) {
  const links = blockArray(content.links);
  return (
    <section className={sectionPanelClass(light, templateStyle)}>
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className={`text-xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.title, "Church Website")}</h3>
          <p className={`mt-2 max-w-xl text-sm ${bodyClass(light, templateStyle)}`}>{toText(content.body, "Welcome to our church community.")}</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {links.map((link, index) => {
            const href = resolvePublicHref(link.href, domain, previewBasePath, "/");
            return (
              <SiteLink key={`${link.label || index}`} href={href} className={`rounded-full border px-4 py-1.5 text-[11px] font-black uppercase tracking-wider ${light ? "border-slate-300 bg-white text-slate-700" : "border-white/20 bg-white/5 text-white"}`}>
                {toText(link.label, `Link ${index + 1}`)}
              </SiteLink>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

export function PublicSiteRenderer({
  website,
  domain,
  pageSlug,
  previewBasePath,
}: {
  website: PublicWebsite;
  domain?: string;
  pageSlug?: string;
  previewBasePath?: string;
}) {
  const activePage =
    (pageSlug ? website.pages.find((page) => page.slug === pageSlug) : null) ?? website.pages.find((page) => page.slug === "home") ?? website.pages[0];

  const theme = website.themeConfig || {};
  const templateStyle = toText(theme.templateStyle, "corporate-blue");
  const light = templateStyle === "classic-red" || templateStyle === "classic-contemporary";
  const isCommunity = templateStyle === "community-warm";
  const isGrowth = templateStyle === "growth-gradient";
  const isClassic = templateStyle === "classic-red" || templateStyle === "classic-contemporary";
  const isMidnight = templateStyle === "midnight-modern";

  const siteName = toText(theme.siteName, "Noxera Church");
  const logoUrl = toText(theme.logoUrl, "/brand-logo.svg");
  const topContact = toText(theme.contactLine, "Join us this Sunday. Everyone is welcome.");
  const navCtaLabel = toText(theme.navCtaLabel, "Donate");
  const navCtaHref = resolvePublicHref(theme.navCtaHref, domain, previewBasePath, "/give");
  const primaryColor = toText(theme.primaryColor, "#4f46e5");
  const accentColor = toText(theme.accentColor, "#22c55e");

  const layoutMode = toText(theme.layoutMode, "full");
  const customWidth = Math.max(960, Math.min(2200, toNumber(theme.customContentWidth, 1440)));
  const contentWidth = layoutMode === "boxed" ? "1280px" : layoutMode === "custom" ? `${customWidth}px` : "1760px";

  const menuPages = useMemo(() => website.pages.filter((page) => page.slug !== "privacy").slice(0, 8), [website.pages]);
  const activePath = `/${activePage?.slug || "home"}`;

  const frameToneClass = light
    ? "bg-slate-100 text-slate-900"
    : isCommunity
      ? "bg-gradient-to-b from-[#062235] via-[#11233f] to-[#0b1a2b] text-white"
      : isGrowth
        ? "bg-gradient-to-b from-[#14082f] via-[#1f1148] to-[#0a1224] text-white"
        : isMidnight
          ? "bg-[#020617] text-white"
          : "bg-slate-950 text-white";

  const headerToneClass = light ? "border-slate-200 bg-white/95" : "border-white/10 bg-slate-950/90";
  const topLineToneClass = light ? "border-slate-200 text-slate-600" : "border-white/10 text-slate-300";
  const logoToneClass = light ? "border-slate-200 bg-white" : "border-white/10 bg-white/5";
  const brandToneClass = light ? "text-slate-900" : "text-white";
  const navActiveClass = light ? "bg-slate-900 text-white" : "bg-white text-slate-900";
  const navIdleClass = light ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-white/10 hover:text-white";
  const ctaSurfaceClass = light ? "shadow-sm" : "shadow-[0_10px_35px_rgba(2,6,23,0.35)]";
  const ctaBandLinkClass = light ? "bg-slate-900 text-white" : "bg-white text-slate-900";

  const heroLayoutClass = isClassic
    ? "py-24 lg:py-28"
    : isCommunity || isGrowth
      ? "py-20 lg:py-24"
      : "py-24 lg:py-32";
  const heroTitleClass = isClassic ? "max-w-5xl text-5xl sm:text-6xl" : isGrowth ? "max-w-5xl text-5xl sm:text-7xl" : "max-w-5xl text-5xl sm:text-7xl";
  const heroSubtitleClass = isClassic ? "max-w-3xl text-lg text-slate-100" : "max-w-3xl text-lg text-slate-100";
  const heroEyebrowClass = isClassic
    ? "mb-6 inline-block rounded-full border border-white/30 bg-black/40 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-white"
    : isCommunity || isGrowth
      ? "mb-6 inline-block rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-100"
      : "mb-6 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-100";

  const frameStyle = {
    "--nx-content-max-width": contentWidth,
    "--nx-fragment-primary": primaryColor,
    "--nx-fragment-accent": accentColor,
    "--nx-site-surface-bg": light ? "#f8fafc" : "#020617",
    "--nx-site-surface-border": light ? "rgba(148,163,184,.35)" : "rgba(148,163,184,.28)",
  } as CSSProperties;

  useEffect(() => {
    trackAnalytics(domain, {
      pagePath: activePath,
      eventType: "page_view",
      source: "public_page",
    });
  }, [activePath, domain]);

  if (!activePage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-black">Under Construction</h1>
          <p className="text-slate-400">This church website is being prepared. Check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`nx-site-frame ${layoutMode === "boxed" ? "nx-layout-boxed" : "nx-layout-fluid"} ${frameToneClass}`} style={frameStyle}>
      <div className="nx-site-surface">
        <header className={`sticky top-0 z-50 border-b backdrop-blur ${headerToneClass}`}>
          <div className={`border-b px-4 py-2 text-center text-xs font-semibold ${topLineToneClass}`}>{topContact}</div>
          <div className="nx-shell flex items-center justify-between py-3">
            <Link href={resolvePublicHref("/", domain, previewBasePath, "/")} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt={`${siteName} logo`} className={`h-10 w-auto rounded-md border p-1 ${logoToneClass}`} />
              <span className={`hidden text-sm font-black uppercase tracking-[0.12em] md:block ${brandToneClass}`}>{siteName}</span>
            </Link>

            <nav className="hidden items-center gap-2 lg:flex">
              {menuPages.map((page) => {
                const href = resolvePublicHref(page.slug === "home" ? "/" : `/${page.slug}`, domain, previewBasePath, "/");
                const isActive = page.slug === activePage.slug;
                return (
                  <SiteLink
                    key={page.id}
                    href={href}
                    onClick={() =>
                      trackAnalytics(domain, {
                        pagePath: activePath,
                        eventType: "cta_click",
                        source: `menu_${page.slug}`,
                      })
                    }
                    className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                      isActive ? navActiveClass : navIdleClass
                    }`}
                  >
                    {page.title}
                  </SiteLink>
                );
              })}
            </nav>

            <details className="relative lg:hidden">
              <summary className={`cursor-pointer rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] ${light ? "border-slate-300 text-slate-700" : "border-white/20 text-slate-100"}`}>
                Menu
              </summary>
              <div className={`absolute right-0 top-10 z-50 min-w-48 rounded-2xl border p-2 shadow-2xl ${light ? "border-slate-200 bg-white" : "border-white/10 bg-slate-900/95"}`}>
                {menuPages.map((page) => (
                  <SiteLink
                    key={`mobile-${page.id}`}
                    href={resolvePublicHref(page.slug === "home" ? "/" : `/${page.slug}`, domain, previewBasePath, "/")}
                    className={`block rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${page.slug === activePage.slug ? navActiveClass : navIdleClass}`}
                  >
                    {page.title}
                  </SiteLink>
                ))}
              </div>
            </details>

            <SiteLink
              href={navCtaHref}
              onClick={() =>
                trackAnalytics(domain, {
                  pagePath: activePath,
                  eventType: "cta_click",
                  source: "nav_cta",
                  payload: { href: navCtaHref },
                })
              }
              className={`rounded-md px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white ${ctaSurfaceClass}`}
            >
              <span style={{ backgroundColor: primaryColor }} className="rounded-md px-4 py-2">
                {navCtaLabel}
              </span>
            </SiteLink>
          </div>
        </header>

        {activePage.sections.map((section) => {
          const content = section.content || {};

          if (section.type === "hero") {
            const backgroundImageUrl = toText(content.backgroundImageUrl);
            const overlayStrength = isClassic ? "d4" : isCommunity ? "a8" : isGrowth ? "b8" : "ba";
            const heroStyle: CSSProperties = backgroundImageUrl
              ? {
                  backgroundImage: isClassic
                    ? `linear-gradient(180deg, ${primaryColor}${overlayStrength}, #020617c2 62%, #020617ba), url(${backgroundImageUrl})`
                    : `linear-gradient(145deg, ${primaryColor}${overlayStrength}, #020617d9 56%, ${accentColor}88), url(${backgroundImageUrl})`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                }
              : { background: `linear-gradient(145deg, ${primaryColor}25, #020617 55%, ${accentColor}20)` };

            return (
              <header key={section.id} className={`relative isolate overflow-hidden px-6 ${heroLayoutClass}`} style={heroStyle}>
                <div className="nx-shell relative z-10">
                  <div className={heroEyebrowClass}>{toText(content.eyebrow, "Welcome")}</div>
                  <h1 className={`mb-8 font-black leading-tight tracking-tighter text-white ${heroTitleClass}`}>{toText(content.title, "Welcome")}</h1>
                  <p className={`mb-10 leading-relaxed ${heroSubtitleClass}`}>{toText(content.subtitle, "Experience faith and community.")}</p>
                  <div className="flex flex-wrap gap-4">
                    <SiteLink
                      href={resolvePublicHref(content.primaryCtaHref, domain, previewBasePath, "/new-here")}
                      onClick={() =>
                        trackAnalytics(domain, {
                          pagePath: activePath,
                          eventType: "cta_click",
                          source: "hero_primary",
                          payload: { href: resolvePublicHref(content.primaryCtaHref, domain, previewBasePath, "/new-here") },
                        })
                      }
                      className="rounded-full px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:opacity-90"
                    >
                      <span style={{ backgroundColor: primaryColor }} className="rounded-full px-8 py-4">
                        {toText(content.primaryCtaLabel, "Plan Your Visit")}
                      </span>
                    </SiteLink>
                    {content.secondaryCtaLabel ? (
                      <SiteLink
                        href={resolvePublicHref(content.secondaryCtaHref, domain, previewBasePath, "/service-times")}
                        className={`rounded-full border px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition ${
                          isClassic ? "border-white/40 bg-black/30 hover:bg-black/45" : "border-white/20 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        {toText(content.secondaryCtaLabel)}
                      </SiteLink>
                    ) : null}
                  </div>
                </div>
              </header>
            );
          }

          if (section.type === "cta_band") {
            return (
              <section key={section.id} className="nx-shell py-8">
                <div className="rounded-3xl border p-8" style={{ background: `linear-gradient(120deg, ${primaryColor}30, ${accentColor}30)`, borderColor: light ? "rgba(148,163,184,.35)" : "rgba(255,255,255,.14)" }}>
                  <h2 className={`text-3xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Take your next step")}</h2>
                  <p className={`mt-2 ${bodyClass(light, templateStyle)}`}>{toText(content.body, "Connect with our church team today.")}</p>
                  <SiteLink href={resolvePublicHref(content.ctaHref, domain, previewBasePath, "/contact")} className={`mt-5 inline-flex rounded-full px-6 py-2 text-xs font-black uppercase tracking-wider ${ctaBandLinkClass}`}>
                    {toText(content.ctaLabel, "Get Started")}
                  </SiteLink>
                </div>
              </section>
            );
          }

          if (section.type === "feature_grid") {
            const items = blockArray(content.items);
            return (
              <section key={section.id} className="nx-shell py-14">
                <h2 className={`text-3xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.heading, "Highlights")}</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((item: Record<string, any>, index: number) => (
                    <article key={`${item.title || index}`} className={`${cardClass(light, templateStyle)} overflow-hidden`}>
                      {item.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={toText(item.imageUrl)} alt={toText(item.title, `Feature ${index + 1}`)} className="mb-3 h-40 w-full rounded-xl object-cover" loading="lazy" />
                        </>
                      ) : null}
                      <p className={`text-lg font-black ${headingClass(light, templateStyle)}`}>{toText(item.title, `Item ${index + 1}`)}</p>
                      <p className={`mt-2 text-sm ${bodyClass(light, templateStyle)}`}>{toText(item.description || item.desc, "Description")}</p>
                    </article>
                  ))}
                </div>
              </section>
            );
          }

          if (section.type === "stats") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <StatsBlock content={content} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "service_times") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <ServiceTimesBlock content={content} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "staff_cards") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <StaffCardsBlock content={content} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "testimonials") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <TestimonialsBlock content={content} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "faq") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <FaqBlock content={content} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "gallery") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <GalleryBlock content={content} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "map_contact") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <MapContactBlock content={content} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "footer") {
            return (
              <section key={section.id} className="nx-shell py-12 pb-20">
                <FooterBlock content={content} domain={domain} previewBasePath={previewBasePath} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "dynamic_list") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <DynamicListBlock content={content} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "form") {
            return (
              <section key={section.id} className="nx-shell py-12">
                <FormBlock content={content} domain={domain} pagePath={activePath} light={light} templateStyle={templateStyle} />
              </section>
            );
          }

          if (section.type === "custom_fragment") {
            const html = typeof content.html === "string" ? content.html : "";
            return (
              <section key={section.id} className="nx-shell py-12">
                <div className={`nx-custom-fragment rounded-3xl border p-6 ${light ? "border-slate-200 bg-white text-slate-700" : "border-white/10 bg-white/5 text-slate-200"}`} dangerouslySetInnerHTML={{ __html: html }} />
              </section>
            );
          }

          return (
            <section key={section.id} className="nx-shell py-8">
              <div className={sectionPanelClass(light, templateStyle)}>
                <h2 className={`text-2xl font-black ${headingClass(light, templateStyle)}`}>{toText(content.title, section.type)}</h2>
                <p className={`mt-2 text-sm ${bodyClass(light, templateStyle)}`}>{toText(content.body || content.subtitle, "Section content")}</p>
              </div>
            </section>
          );
        })}

        <footer className={`mt-12 border-t py-10 ${light ? "border-slate-300 bg-white/70" : "border-white/10 bg-slate-950/80"}`}>
          <div className="nx-shell grid gap-8 md:grid-cols-3">
            <div>
              <p className={`text-sm font-black uppercase tracking-[0.22em] ${light ? "text-slate-500" : "text-slate-400"}`}>{siteName}</p>
              <p className={`mt-3 text-sm ${bodyClass(light, templateStyle)}`}>Built with Noxera Plus Website Builder. Manage pages, ministries, events, and giving from one platform.</p>
            </div>
            <div>
              <p className={`text-sm font-black uppercase tracking-[0.22em] ${light ? "text-slate-500" : "text-slate-400"}`}>Quick Links</p>
              <nav className="mt-3 flex flex-wrap gap-2">
                {menuPages.slice(0, 6).map((page) => (
                  <SiteLink
                    key={`footer-${page.id}`}
                    href={resolvePublicHref(page.slug === "home" ? "/" : `/${page.slug}`, domain, previewBasePath, "/")}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${light ? "border-slate-300 bg-white text-slate-700" : "border-white/20 bg-white/5 text-white"}`}
                  >
                    {page.title}
                  </SiteLink>
                ))}
              </nav>
            </div>
            <div>
              <p className={`text-sm font-black uppercase tracking-[0.22em] ${light ? "text-slate-500" : "text-slate-400"}`}>Newsletter</p>
              <p className={`mt-3 text-sm ${bodyClass(light, templateStyle)}`}>Get weekly updates, event notices, and prayer resources.</p>
              <div className="mt-3 flex gap-2">
                <input className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${light ? "border-slate-300 bg-white text-slate-900" : "border-white/10 bg-slate-900/70 text-white"}`} placeholder="Email address" />
                <button type="button" className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-white" style={{ backgroundColor: accentColor }}>
                  Join
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        .nx-site-frame .nx-shell {
          width: min(100%, var(--nx-content-max-width, 1440px));
          margin-left: auto;
          margin-right: auto;
          padding-left: clamp(1rem, 2vw, 1.5rem);
          padding-right: clamp(1rem, 2vw, 1.5rem);
        }

        .nx-site-frame.nx-layout-boxed {
          padding: 1rem 0 2rem;
        }

        .nx-site-frame.nx-layout-boxed .nx-site-surface {
          max-width: calc(var(--nx-content-max-width, 1280px) + 3rem);
          margin: 0 auto;
          border-radius: 1.25rem;
          overflow: hidden;
          border: 1px solid var(--nx-site-surface-border, rgba(148, 163, 184, 0.28));
          background: var(--nx-site-surface-bg, #020617);
          box-shadow: 0 24px 48px rgba(2, 6, 23, 0.35);
        }

        .nx-custom-fragment h1,
        .nx-custom-fragment h2,
        .nx-custom-fragment h3,
        .nx-custom-fragment h4,
        .nx-custom-fragment h5,
        .nx-custom-fragment h6 {
          font-weight: 800;
          letter-spacing: -0.01em;
          margin-top: 1.4rem;
          margin-bottom: 0.7rem;
        }

        .nx-custom-fragment h1 {
          font-size: 2rem;
        }

        .nx-custom-fragment h2 {
          font-size: 1.625rem;
        }

        .nx-custom-fragment h3 {
          font-size: 1.25rem;
        }

        .nx-custom-fragment h4 {
          font-size: 1.1rem;
        }

        .nx-custom-fragment p,
        .nx-custom-fragment ul,
        .nx-custom-fragment ol,
        .nx-custom-fragment blockquote,
        .nx-custom-fragment pre,
        .nx-custom-fragment table {
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .nx-custom-fragment ul,
        .nx-custom-fragment ol {
          padding-left: 1.25rem;
        }

        .nx-custom-fragment li {
          margin: 0.3rem 0;
        }

        .nx-custom-fragment a {
          color: var(--nx-fragment-accent);
          text-decoration: underline;
          text-underline-offset: 0.2rem;
          font-weight: 700;
        }

        .nx-custom-fragment blockquote {
          border-left: 3px solid var(--nx-fragment-primary);
          background: rgba(15, 23, 42, 0.15);
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
        }

        .nx-custom-fragment hr {
          border: 0;
          border-top: 1px solid rgba(148, 163, 184, 0.35);
          margin: 1rem 0;
        }

        .nx-custom-fragment img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 0.875rem;
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        .nx-custom-fragment iframe {
          display: block;
          width: 100%;
          min-height: 360px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 0.875rem;
          background: #020617;
        }

        .nx-custom-fragment table {
          width: 100%;
          border-collapse: collapse;
          overflow: hidden;
          border-radius: 0.875rem;
          border: 1px solid rgba(148, 163, 184, 0.35);
        }

        .nx-custom-fragment th,
        .nx-custom-fragment td {
          border: 1px solid rgba(148, 163, 184, 0.2);
          padding: 0.6rem 0.7rem;
          text-align: left;
        }

        .nx-custom-fragment th {
          font-weight: 800;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          background: rgba(15, 23, 42, 0.12);
        }

        .nx-custom-fragment .nx-media-card {
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 1rem;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.06);
        }

        .nx-custom-fragment .nx-media-card h3 {
          margin-top: 0;
        }

        @media (max-width: 900px) {
          .nx-site-frame .nx-shell {
            width: min(100%, var(--nx-content-max-width, 1440px));
          }
        }

        @media (max-width: 640px) {
          .nx-custom-fragment iframe {
            min-height: 240px;
          }
        }
      `}</style>
    </div>
  );
}
