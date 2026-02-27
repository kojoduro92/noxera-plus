"use client";

import { use, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PublicSiteRenderer } from "@/components/website/public-site-renderer";

type PreviewWebsitePayload = {
  id: string;
  themeConfig: Record<string, unknown>;
  pages: Array<{
    id: string;
    slug: string;
    title: string;
    sections: Array<{ id: string; type: string; content: Record<string, unknown> }>;
    seo?: Record<string, unknown>;
  }>;
  preview?: boolean;
  expiresAt?: string;
};

export default function WebsitePreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [website, setWebsite] = useState<PreviewWebsitePayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const payload = await apiFetch<PreviewWebsitePayload>(`/api/public/website/preview/${token}`);
        setWebsite(payload);
      } catch {
        setError("Preview link is invalid or has expired.");
      }
    };

    void loadPreview();
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-center">
          <h1 className="text-2xl font-black">Preview unavailable</h1>
          <p className="mt-2 text-sm text-rose-200">{error}</p>
        </div>
      </div>
    );
  }

  if (!website) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 z-50 border-b border-indigo-300/30 bg-indigo-500/20 px-4 py-2 text-center text-xs font-black uppercase tracking-wider text-indigo-100 backdrop-blur">
        Preview Mode{website.expiresAt ? ` • Expires ${new Date(website.expiresAt).toLocaleString()}` : ""}
      </div>
      <PublicSiteRenderer website={website} />
    </div>
  );
}
