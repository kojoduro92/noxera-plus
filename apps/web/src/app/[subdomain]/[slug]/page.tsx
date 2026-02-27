"use client";

import { use, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { PublicSiteRenderer } from "@/components/website/public-site-renderer";

type Section = {
  id: string;
  type: string;
  content: Record<string, unknown>;
};

type Page = {
  id: string;
  slug: string;
  title: string;
  sections: Section[];
  seo?: Record<string, unknown>;
};

type Website = {
  id: string;
  themeConfig: Record<string, unknown>;
  pages: Page[];
  redirectTo?: string | null;
};

const FALLBACK_WEBSITE: Website = {
  id: "fallback",
  themeConfig: { primaryColor: "#4f46e5", accentColor: "#22c55e", font: "inter" },
  pages: [],
};

export default function PublicChurchPage({ params }: { params: Promise<{ subdomain: string; slug: string }> }) {
  const { subdomain, slug } = use(params);
  const [website, setWebsite] = useState<Website>(FALLBACK_WEBSITE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWebsite = async () => {
      try {
        const data = await apiFetch<Website>(`/api/public/website/${subdomain}`);
        if (data.redirectTo) {
          const target = new URL(data.redirectTo);
          target.pathname = slug === "home" ? "/" : `/${slug}`;
          window.location.assign(target.toString());
          return;
        }
        setWebsite(data);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setWebsite(FALLBACK_WEBSITE);
        } else {
          setWebsite(FALLBACK_WEBSITE);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadWebsite();
  }, [slug, subdomain]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  return <PublicSiteRenderer website={website} domain={subdomain} pageSlug={slug} />;
}
