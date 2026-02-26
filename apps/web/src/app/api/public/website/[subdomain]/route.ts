import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const FALLBACK_WEBSITE = {
  id: "fallback-website",
  themeConfig: { primaryColor: "#4f46e5" },
  pages: [],
};

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

  if (candidates.length === 0) {
    return NextResponse.json(FALLBACK_WEBSITE, { status: 200 });
  }

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${API_BASE_URL}/public/website/${encodeURIComponent(candidate)}`, {
        method: "GET",
        cache: "no-store",
      });

      if (response.ok) {
        const payload = await response.json().catch(() => FALLBACK_WEBSITE);
        return NextResponse.json(payload ?? FALLBACK_WEBSITE, { status: 200 });
      }

      if (response.status === 404) {
        continue;
      }
    } catch {
      // Try next candidate, then fallback.
    }
  }

  return NextResponse.json(FALLBACK_WEBSITE, { status: 200 });
}
