export type SelectOption = {
  value: string;
  label: string;
};

export const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
];

export const COUNTRY_OPTIONS: SelectOption[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "FR", label: "France" },
  { value: "GH", label: "Ghana" },
  { value: "NG", label: "Nigeria" },
  { value: "ZA", label: "South Africa" },
  { value: "KE", label: "Kenya" },
];

export const CURRENCY_OPTIONS: SelectOption[] = [
  { value: "USD", label: "US Dollar (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "GBP", label: "British Pound (GBP)" },
  { value: "CAD", label: "Canadian Dollar (CAD)" },
  { value: "GHS", label: "Ghana Cedi (GHS)" },
  { value: "NGN", label: "Nigerian Naira (NGN)" },
  { value: "ZAR", label: "South African Rand (ZAR)" },
  { value: "KES", label: "Kenyan Shilling (KES)" },
];

export const FONT_OPTIONS: SelectOption[] = [
  { value: "inter", label: "Inter" },
  { value: "poppins", label: "Poppins" },
  { value: "manrope", label: "Manrope" },
  { value: "nunito-sans", label: "Nunito Sans" },
  { value: "source-sans-3", label: "Source Sans 3" },
];

export function resolveFontStack(fontKey: string | undefined) {
  const normalized = (fontKey ?? "").trim().toLowerCase();
  switch (normalized) {
    case "poppins":
      return "'Poppins', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    case "manrope":
      return "'Manrope', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    case "nunito-sans":
      return "'Nunito Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    case "source-sans-3":
      return "'Source Sans 3', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    case "inter":
    default:
      return "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  }
}

export function formatMoney(value: number, currency: string, locale = "en-US") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
}

export function optionLabel(options: SelectOption[], value: string, fallback = "Unknown") {
  return options.find((option) => option.value === value)?.label ?? fallback;
}
