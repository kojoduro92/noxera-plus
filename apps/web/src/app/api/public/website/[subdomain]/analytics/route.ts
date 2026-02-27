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

export async function POST(request: Request, context: RouteContext) {
  const { subdomain } = await context.params;
  const bodyText = await request.text();
  const candidates = normalizeCandidates(subdomain);

  if (!candidates.length) {
    return NextResponse.json({ message: "Subdomain is required." }, { status: 400 });
  }

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${API_BASE_URL}/public/website/${encodeURIComponent(candidate)}/analytics`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: bodyText,
        cache: "no-store",
      });

      const payload = await response.text();
      if (response.ok) {
        return new NextResponse(payload, {
          status: response.status,
          headers: {
            "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
          },
        });
      }

      if (response.status === 404) {
        continue;
      }
    } catch {
      // try next
    }
  }

  return NextResponse.json({ message: "Unable to track analytics." }, { status: 404 });
}
