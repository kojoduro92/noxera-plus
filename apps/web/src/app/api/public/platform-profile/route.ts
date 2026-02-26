import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const FALLBACK_PROFILE = {
  orgName: "Noxera Plus",
  defaultLocale: "en-US",
  defaultCurrency: "USD",
  defaultCountry: "US",
  defaultLanguage: "en",
  logoUrl: "/brand-logo.png",
  faviconUrl: "/brand-favicon.png",
  themeMode: "system",
  brandPrimaryColor: "#d62f9d",
  brandAccentColor: "#0bb9f4",
};

export async function GET() {
  const sanitize = (payload: Record<string, unknown>) => ({
    orgName: typeof payload.orgName === "string" && payload.orgName.trim() ? payload.orgName : FALLBACK_PROFILE.orgName,
    defaultLocale:
      typeof payload.defaultLocale === "string" && payload.defaultLocale.trim()
        ? payload.defaultLocale
        : FALLBACK_PROFILE.defaultLocale,
    defaultCurrency:
      typeof payload.defaultCurrency === "string" && payload.defaultCurrency.trim()
        ? payload.defaultCurrency
        : FALLBACK_PROFILE.defaultCurrency,
    defaultCountry:
      typeof payload.defaultCountry === "string" && payload.defaultCountry.trim()
        ? payload.defaultCountry
        : FALLBACK_PROFILE.defaultCountry,
    defaultLanguage:
      typeof payload.defaultLanguage === "string" && payload.defaultLanguage.trim()
        ? payload.defaultLanguage
        : FALLBACK_PROFILE.defaultLanguage,
    logoUrl: typeof payload.logoUrl === "string" && payload.logoUrl.trim() ? payload.logoUrl : FALLBACK_PROFILE.logoUrl,
    faviconUrl:
      typeof payload.faviconUrl === "string" && payload.faviconUrl.trim() ? payload.faviconUrl : FALLBACK_PROFILE.faviconUrl,
    themeMode: typeof payload.themeMode === "string" && payload.themeMode.trim() ? payload.themeMode : FALLBACK_PROFILE.themeMode,
    brandPrimaryColor:
      typeof payload.brandPrimaryColor === "string" && payload.brandPrimaryColor.trim()
        ? payload.brandPrimaryColor
        : FALLBACK_PROFILE.brandPrimaryColor,
    brandAccentColor:
      typeof payload.brandAccentColor === "string" && payload.brandAccentColor.trim()
        ? payload.brandAccentColor
        : FALLBACK_PROFILE.brandAccentColor,
  });

  try {
    const response = await fetch(`${API_BASE_URL}/public/platform/profile`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(FALLBACK_PROFILE, { status: 200 });
    }

    const payload = (await response.json().catch(() => FALLBACK_PROFILE)) as Record<string, unknown>;
    return NextResponse.json(sanitize(payload), { status: 200 });
  } catch {
    return NextResponse.json(FALLBACK_PROFILE, { status: 200 });
  }
}
