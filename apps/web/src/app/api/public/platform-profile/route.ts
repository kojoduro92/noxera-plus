import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const FALLBACK_PROFILE = {
  orgName: "Noxera Plus",
  defaultLocale: "en-US",
  defaultCurrency: "USD",
  defaultCountry: "US",
  defaultLanguage: "en",
  logoUrl: "",
  brandPrimaryColor: "#4f46e5",
  brandAccentColor: "#22c55e",
};

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/public/platform/profile`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(FALLBACK_PROFILE, { status: 200 });
    }

    const payload = (await response.json().catch(() => FALLBACK_PROFILE)) as Record<string, unknown>;
    return NextResponse.json({ ...FALLBACK_PROFILE, ...payload }, { status: 200 });
  } catch {
    return NextResponse.json(FALLBACK_PROFILE, { status: 200 });
  }
}
