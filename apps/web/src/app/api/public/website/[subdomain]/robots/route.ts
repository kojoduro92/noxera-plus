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
      const response = await fetch(`${API_BASE_URL}/public/website/${encodeURIComponent(candidate)}/robots.txt`, {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) continue;
      const body = await response.text();
      return new NextResponse(body, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    } catch {
      // Try next candidate
    }
  }

  return new NextResponse("User-agent: *\nAllow: /\n", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
