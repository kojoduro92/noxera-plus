"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type PlatformPersonalization = {
  orgName: string;
  defaultLocale: string;
  defaultCurrency: string;
  defaultCountry: string;
  defaultLanguage: string;
  logoUrl: string;
  brandPrimaryColor: string;
  brandAccentColor: string;
};

type PlatformProfilePayload = Partial<PlatformPersonalization>;

type PlatformPersonalizationContextValue = {
  personalization: PlatformPersonalization;
  setPersonalization: (updates: Partial<PlatformPersonalization>, persistLocal?: boolean) => void;
  hydrateFromPlatformProfile: (profile: PlatformProfilePayload) => void;
  refreshFromServer: () => Promise<void>;
};

const LOCAL_STORAGE_KEY = "noxera_platform_personalization";

const defaultPersonalization: PlatformPersonalization = {
  orgName: "Noxera Plus",
  defaultLocale: "en-US",
  defaultCurrency: "USD",
  defaultCountry: "US",
  defaultLanguage: "en",
  logoUrl: "",
  brandPrimaryColor: "#4f46e5",
  brandAccentColor: "#22c55e",
};

const PlatformPersonalizationContext = createContext<PlatformPersonalizationContextValue | undefined>(undefined);

function sanitizeHexColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const normalized = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return normalized.toLowerCase();
}

function hexToRgbTuple(hex: string) {
  const safeHex = sanitizeHexColor(hex, "#4f46e5").replace("#", "");
  const red = Number.parseInt(safeHex.slice(0, 2), 16);
  const green = Number.parseInt(safeHex.slice(2, 4), 16);
  const blue = Number.parseInt(safeHex.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

function normalizeProfile(profile: PlatformProfilePayload): PlatformPersonalization {
  return {
    orgName: profile.orgName?.trim() || defaultPersonalization.orgName,
    defaultLocale: profile.defaultLocale?.trim() || defaultPersonalization.defaultLocale,
    defaultCurrency: profile.defaultCurrency?.trim().toUpperCase() || defaultPersonalization.defaultCurrency,
    defaultCountry: profile.defaultCountry?.trim().toUpperCase() || defaultPersonalization.defaultCountry,
    defaultLanguage: profile.defaultLanguage?.trim().toLowerCase() || defaultPersonalization.defaultLanguage,
    logoUrl: profile.logoUrl?.trim() || "",
    brandPrimaryColor: sanitizeHexColor(profile.brandPrimaryColor, defaultPersonalization.brandPrimaryColor),
    brandAccentColor: sanitizeHexColor(profile.brandAccentColor, defaultPersonalization.brandAccentColor),
  };
}

function applyBrandVariables(profile: PlatformPersonalization) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.setProperty("--brand-primary", profile.brandPrimaryColor);
  root.style.setProperty("--brand-accent", profile.brandAccentColor);
  root.style.setProperty("--brand-primary-rgb", hexToRgbTuple(profile.brandPrimaryColor));
  root.style.setProperty("--brand-accent-rgb", hexToRgbTuple(profile.brandAccentColor));
}

export function PlatformPersonalizationProvider({ children }: { children: React.ReactNode }) {
  const [personalization, setPersonalizationState] = useState<PlatformPersonalization>(defaultPersonalization);

  const setPersonalization = useCallback((updates: Partial<PlatformPersonalization>, persistLocal = true) => {
    setPersonalizationState((current) => {
      const next = normalizeProfile({ ...current, ...updates });
      if (persistLocal && typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const hydrateFromPlatformProfile = useCallback((profile: PlatformProfilePayload) => {
    const next = normalizeProfile(profile);
    setPersonalizationState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const refreshFromServer = useCallback(async () => {
    try {
      const response = await fetch("/api/public/platform-profile", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json().catch(() => ({}))) as PlatformProfilePayload;
      if (!payload || typeof payload !== "object") return;
      hydrateFromPlatformProfile(payload);
    } catch {
      // Keep existing personalization if profile fetch fails.
    }
  }, [hydrateFromPlatformProfile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PlatformProfilePayload;
      setPersonalizationState(normalizeProfile(parsed));
    }

    void refreshFromServer();
  }, [refreshFromServer]);

  useEffect(() => {
    applyBrandVariables(personalization);
  }, [personalization]);

  const value = useMemo<PlatformPersonalizationContextValue>(
    () => ({
      personalization,
      setPersonalization,
      hydrateFromPlatformProfile,
      refreshFromServer,
    }),
    [hydrateFromPlatformProfile, personalization, refreshFromServer, setPersonalization],
  );

  return <PlatformPersonalizationContext.Provider value={value}>{children}</PlatformPersonalizationContext.Provider>;
}

export function usePlatformPersonalization() {
  const context = useContext(PlatformPersonalizationContext);
  if (!context) {
    throw new Error("usePlatformPersonalization must be used within PlatformPersonalizationProvider.");
  }
  return context;
}
