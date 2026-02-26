import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

function parseUpstreamError(text: string, fallback: string) {
  try {
    const parsed = JSON.parse(text) as { message?: string; code?: string };
    return {
      message: parsed.message?.trim() || fallback,
      code: parsed.code?.trim(),
    };
  } catch {
    return {
      message: text.trim() || fallback,
      code: undefined,
    };
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    churchName?: string;
    adminEmail?: string;
    domain?: string;
    branchName?: string;
    plan?: string;
    ownerName?: string;
    ownerPhone?: string;
    country?: string;
    timezone?: string;
    currency?: string;
    denomination?: string;
    sizeRange?: string;
  };

  if (!body.churchName?.trim() || !body.adminEmail?.trim() || !body.domain?.trim() || !body.ownerName?.trim()) {
    return NextResponse.json(
      {
        message: "Church name, owner name, admin email, and domain are required.",
        code: "MISSING_REQUIRED_FIELDS",
      },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_BASE_URL}/public/tenants/trial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      churchName: body.churchName,
      adminEmail: body.adminEmail,
      domain: body.domain,
      branchName: body.branchName,
      plan: body.plan,
      ownerName: body.ownerName,
      ownerPhone: body.ownerPhone,
      country: body.country,
      timezone: body.timezone,
      currency: body.currency,
      denomination: body.denomination,
      sizeRange: body.sizeRange,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!upstream || !upstream.ok) {
    const payload = upstream
      ? parseUpstreamError(await upstream.text(), "Unable to start your free trial right now.")
      : { message: "Unable to reach onboarding service.", code: "ONBOARDING_API_UNREACHABLE" };

    return NextResponse.json(payload, { status: upstream?.status ?? 502 });
  }

  const created = await upstream.json();
  return NextResponse.json(created);
}
