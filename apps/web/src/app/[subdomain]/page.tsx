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

export default function SubdomainLandingPage({ params }: { params: Promise<{ subdomain: string }> }) {
  const { subdomain } = use(params);
  const [website, setWebsite] = useState<Website>(FALLBACK_WEBSITE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWebsite = async () => {
      try {
        const data = await apiFetch<Website>(`/api/public/website/${subdomain}`);
        if (data.redirectTo) {
          window.location.assign(data.redirectTo);
          return;
        }
        setWebsite(data);
      } catch (err) {
        // Expected case for unknown subdomains: render fallback with under-construction state.
        if (err instanceof ApiError && err.status === 404) {
          setWebsite(FALLBACK_WEBSITE);
        } else {
          console.warn("Unable to load public website content; using fallback view.");
          setWebsite(FALLBACK_WEBSITE);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadWebsite();
  }, [subdomain]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  return <PublicSiteRenderer website={website} domain={subdomain} />;
}
