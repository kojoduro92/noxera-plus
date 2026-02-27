import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type RouteContext = {
  params: Promise<{ subdomain: string }>;
};

function normalizeCandidates(rawSubdomain: string) {
  const candidate = rawSubdomain.trim().toLowerCase();
  if (!candidate) return [];
  const stripped = candidate.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const firstLabel = stripped.split(".")[0] ?? stripped;
  return Array.from(new Set([stripped, firstLabel].filter(Boolean)));
}

export async function GET(_request: Request, context: RouteContext) {
  const { subdomain } = await context.params;
  const candidates = normalizeCandidates(subdomain);

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${API_BASE_URL}/public/website/${encodeURIComponent(candidate)}/sitemap.xml`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) continue;
      const xml = await response.text();
      return new NextResponse(xml, {
        status: 200,
        headers: { "content-type": "application/xml; charset=utf-8" },
      });
    } catch {
      // Try next candidate
    }
  }

  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
    status: 200,
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
