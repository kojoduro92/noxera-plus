export type TenantSizeRange = "1-50" | "51-150" | "151-300" | "301-700" | "701-1500" | "1500+";

export type CreateTenantRequestV2 = {
  churchName: string;
  adminEmail: string;
  domain: string;
  branchName?: string;
  plan?: string;
  ownerName: string;
  ownerPhone?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  denomination?: string;
  sizeRange?: TenantSizeRange;
};

type CountryDefaults = {
  country: string;
  timezone: string;
  currency: string;
};

const COUNTRY_FALLBACKS: Record<string, CountryDefaults> = {
  GH: { country: "GH", timezone: "Africa/Accra", currency: "GHS" },
  NG: { country: "NG", timezone: "Africa/Lagos", currency: "NGN" },
  ZA: { country: "ZA", timezone: "Africa/Johannesburg", currency: "ZAR" },
  KE: { country: "KE", timezone: "Africa/Nairobi", currency: "KES" },
  US: { country: "US", timezone: "America/New_York", currency: "USD" },
  CA: { country: "CA", timezone: "America/Toronto", currency: "CAD" },
  GB: { country: "GB", timezone: "Europe/London", currency: "GBP" },
};

export const SIZE_RANGE_OPTIONS: Array<{ value: TenantSizeRange; label: string }> = [
  { value: "1-50", label: "1 - 50 members" },
  { value: "51-150", label: "51 - 150 members" },
  { value: "151-300", label: "151 - 300 members" },
  { value: "301-700", label: "301 - 700 members" },
  { value: "701-1500", label: "701 - 1,500 members" },
  { value: "1500+", label: "1,500+ members" },
];

export const DENOMINATION_OPTIONS = [
  "Non-denominational",
  "Pentecostal",
  "Charismatic",
  "Baptist",
  "Methodist",
  "Catholic",
  "Presbyterian",
  "Evangelical",
  "Anglican",
  "Other",
];

export function getTenantDefaultsFromLocale() {
  if (typeof Intl === "undefined") {
    return COUNTRY_FALLBACKS.US;
  }

  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const localeCountry = locale.split("-")[1]?.toUpperCase();
  const fallback = (localeCountry && COUNTRY_FALLBACKS[localeCountry]) || COUNTRY_FALLBACKS.US;
  return {
    country: fallback.country,
    timezone: timezone || fallback.timezone,
    currency: fallback.currency,
  };
}
