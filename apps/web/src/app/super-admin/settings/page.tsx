"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { COUNTRY_OPTIONS, CURRENCY_OPTIONS, LANGUAGE_OPTIONS, optionLabel } from "@/lib/platform-options";
import { usePlatformPersonalization } from "@/contexts/PlatformPersonalizationContext";

type PlatformProfile = {
  orgName: string;
  supportEmail: string;
  defaultLocale: string;
  defaultTimezone: string;
  defaultCurrency: string;
  defaultCountry?: string;
  defaultLanguage?: string;
  logoUrl?: string;
  brandPrimaryColor?: string;
  brandAccentColor?: string;
  supportedLanguages?: string[];
  supportedCountries?: string[];
  supportedCurrencies?: string[];
};

type PlatformSettingsResponse = {
  platformProfile: PlatformProfile;
  authAccessPolicy: {
    superAdminEmails: string[];
    googleEnabled: boolean;
    passwordEnabled: boolean;
    otpEnabled: boolean;
  };
  billingPolicy: {
    defaultTrialDays: number;
    gracePeriodDays: number;
    reminderCadenceDays: number[];
  };
  auditRetention: {
    auditLogRetentionDays: number;
    outboxRetentionDays: number;
    notificationRetentionDays: number;
  };
};

type NotificationPolicy = {
  channels: {
    inApp: boolean;
    email: boolean;
  };
  renewalCadenceDays: number[];
  categories: Record<string, { inApp: boolean; email: boolean }>;
};

type ReleaseFlag = {
  id: string;
  key: string;
  description?: string | null;
  enabled: boolean;
  rolloutStage: string;
  owner?: string | null;
  tenantCohort: string[];
};

type ReleaseFlagsResponse = {
  items: ReleaseFlag[];
};

const BRAND_PRESETS = ["#4f46e5", "#2563eb", "#0891b2", "#0f766e", "#c2410c", "#be123c"];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function normalizeList(list: string[]) {
  return Array.from(new Set(list.map((value) => value.trim()).filter(Boolean)));
}

function toggleListValue(values: string[], item: string) {
  if (values.includes(item)) {
    return values.filter((value) => value !== item);
  }
  return normalizeList([...values, item]);
}

function categoryLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sanitizeColor(value: string, fallback: string) {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return fallback;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Unable to read logo file."));
    };
    reader.onerror = () => reject(new Error("Unable to read logo file."));
    reader.readAsDataURL(file);
  });
}

export default function SuperAdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettingsResponse | null>(null);
  const [notificationPolicy, setNotificationPolicy] = useState<NotificationPolicy | null>(null);
  const [releaseFlags, setReleaseFlags] = useState<ReleaseFlag[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [flagSearch, setFlagSearch] = useState("");
  const { hydrateFromPlatformProfile, setPersonalization } = usePlatformPersonalization();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [settingsPayload, notificationPayload, flagsPayload] = await Promise.all([
        apiFetch<PlatformSettingsResponse>("/api/super-admin/settings/platform", { cache: "no-store" }),
        apiFetch<NotificationPolicy>("/api/super-admin/settings/notification-policy", { cache: "no-store" }),
        apiFetch<ReleaseFlagsResponse>(
          `/api/super-admin/settings/release-flags${flagSearch ? `?search=${encodeURIComponent(flagSearch)}` : ""}`,
          { cache: "no-store" },
        ),
      ]);

      const hydratedProfile: PlatformProfile = {
        ...settingsPayload.platformProfile,
        defaultLanguage: settingsPayload.platformProfile.defaultLanguage ?? "en",
        defaultCountry: settingsPayload.platformProfile.defaultCountry ?? "US",
        defaultCurrency: settingsPayload.platformProfile.defaultCurrency ?? "USD",
        defaultLocale: settingsPayload.platformProfile.defaultLocale ?? "en-US",
        logoUrl: settingsPayload.platformProfile.logoUrl ?? "",
        brandPrimaryColor: sanitizeColor(settingsPayload.platformProfile.brandPrimaryColor ?? "#4f46e5", "#4f46e5"),
        brandAccentColor: sanitizeColor(settingsPayload.platformProfile.brandAccentColor ?? "#22c55e", "#22c55e"),
        supportedLanguages: settingsPayload.platformProfile.supportedLanguages ?? ["en", "fr"],
        supportedCountries: settingsPayload.platformProfile.supportedCountries ?? ["US", "CA", "GB", "FR", "GH", "NG"],
        supportedCurrencies: settingsPayload.platformProfile.supportedCurrencies ?? ["USD", "EUR", "GBP", "CAD", "GHS", "NGN"],
      };

      setSettings({ ...settingsPayload, platformProfile: hydratedProfile });
      setNotificationPolicy(notificationPayload);
      setReleaseFlags(flagsPayload.items);
      hydrateFromPlatformProfile(hydratedProfile);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load platform settings."));
      setSettings(null);
      setNotificationPolicy(null);
      setReleaseFlags([]);
    } finally {
      setLoading(false);
    }
  }, [flagSearch, hydrateFromPlatformProfile]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveAllSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings || !notificationPolicy) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await apiFetch("/api/super-admin/settings/platform", {
        method: "PATCH",
        ...withJsonBody(settings),
      });

      await apiFetch("/api/super-admin/settings/notification-policy", {
        method: "PATCH",
        ...withJsonBody(notificationPolicy),
      });

      hydrateFromPlatformProfile(settings.platformProfile);
      setNotice("Platform settings and personalization saved.");
      await loadSettings();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save settings."));
    } finally {
      setSaving(false);
    }
  };

  const toggleFlag = async (flag: ReleaseFlag) => {
    setError("");
    setNotice("");

    try {
      await apiFetch(`/api/super-admin/settings/release-flags/${encodeURIComponent(flag.key)}`, {
        method: "PATCH",
        ...withJsonBody({ enabled: !flag.enabled }),
      });
      setNotice(`${flag.key} ${flag.enabled ? "disabled" : "enabled"}.`);
      await loadSettings();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update release flag."));
    }
  };

  const onLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Logo file must be 2MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploadingLogo(true);
    setError("");
    try {
      const dataUrl = await readAsDataUrl(file);
      setSettings((current) =>
        current
          ? {
              ...current,
              platformProfile: {
                ...current.platformProfile,
                logoUrl: dataUrl,
              },
            }
          : current,
      );
      setPersonalization({ logoUrl: dataUrl });
      setNotice("Logo updated. Save settings to publish across portals.");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to process logo upload."));
    } finally {
      event.target.value = "";
      setUploadingLogo(false);
    }
  };

  const releaseSummary = useMemo(
    () => ({
      total: releaseFlags.length,
      enabled: releaseFlags.filter((flag) => flag.enabled).length,
      internal: releaseFlags.filter((flag) => flag.rolloutStage === "internal").length,
    }),
    [releaseFlags],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Platform Settings</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Global policy, localization, and release governance</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Configure authentication access, billing safeguards, notification behavior, and platform defaults.</p>
      </section>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      {loading || !settings || !notificationPolicy ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      ) : (
        <form onSubmit={saveAllSettings} className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Platform Identity</h3>
              <div className="mt-4 grid gap-3">
                <input
                  value={settings.platformProfile.orgName}
                  onChange={(event) => setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, orgName: event.target.value } }) : current)}
                  placeholder="Organization name"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={settings.platformProfile.supportEmail}
                  onChange={(event) => setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, supportEmail: event.target.value } }) : current)}
                  placeholder="Support email"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Branding & Personalization</h3>
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {settings.platformProfile.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={settings.platformProfile.logoUrl} alt="Platform logo" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-sm font-black text-slate-500">N+</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      value={settings.platformProfile.logoUrl ?? ""}
                      onChange={(event) => {
                        const logoUrl = event.target.value;
                        setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, logoUrl } }) : current);
                        setPersonalization({ logoUrl });
                      }}
                      placeholder="Logo URL or uploaded image data"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100">
                        {uploadingLogo ? "Uploading..." : "Upload logo"}
                        <input type="file" accept="image/*" onChange={(event) => void onLogoUpload(event)} className="hidden" disabled={uploadingLogo} />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, logoUrl: "" } }) : current);
                          setPersonalization({ logoUrl: "" });
                        }}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-rose-700 hover:bg-rose-100"
                      >
                        Clear logo
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                    Primary color
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.platformProfile.brandPrimaryColor ?? "#4f46e5"}
                        onChange={(event) => {
                          const nextColor = sanitizeColor(event.target.value, "#4f46e5");
                          setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, brandPrimaryColor: nextColor } }) : current);
                          setPersonalization({ brandPrimaryColor: nextColor });
                        }}
                        className="h-9 w-12 rounded-md border border-slate-300 bg-white"
                      />
                      <input
                        value={settings.platformProfile.brandPrimaryColor ?? "#4f46e5"}
                        onChange={(event) => {
                          const nextColor = sanitizeColor(event.target.value, "#4f46e5");
                          setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, brandPrimaryColor: nextColor } }) : current);
                          setPersonalization({ brandPrimaryColor: nextColor });
                        }}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                      />
                    </div>
                  </label>

                  <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                    Accent color
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={settings.platformProfile.brandAccentColor ?? "#22c55e"}
                        onChange={(event) => {
                          const nextColor = sanitizeColor(event.target.value, "#22c55e");
                          setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, brandAccentColor: nextColor } }) : current);
                          setPersonalization({ brandAccentColor: nextColor });
                        }}
                        className="h-9 w-12 rounded-md border border-slate-300 bg-white"
                      />
                      <input
                        value={settings.platformProfile.brandAccentColor ?? "#22c55e"}
                        onChange={(event) => {
                          const nextColor = sanitizeColor(event.target.value, "#22c55e");
                          setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, brandAccentColor: nextColor } }) : current);
                          setPersonalization({ brandAccentColor: nextColor });
                        }}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                      />
                    </div>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {BRAND_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, brandPrimaryColor: preset } }) : current);
                        setPersonalization({ brandPrimaryColor: preset });
                      }}
                      className="h-7 w-7 rounded-full border border-slate-200"
                      style={{ backgroundColor: preset }}
                      aria-label={`Set primary color ${preset}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Localization Defaults</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                  Default language
                  <select
                    value={settings.platformProfile.defaultLanguage ?? "en"}
                    onChange={(event) => {
                      const defaultLanguage = event.target.value;
                      setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, defaultLanguage } }) : current);
                      setPersonalization({ defaultLanguage });
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                  Default locale
                  <input
                    value={settings.platformProfile.defaultLocale}
                    onChange={(event) => {
                      const defaultLocale = event.target.value;
                      setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, defaultLocale } }) : current);
                      setPersonalization({ defaultLocale });
                    }}
                    placeholder="en-US"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  />
                </label>

                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                  Default country
                  <select
                    value={settings.platformProfile.defaultCountry ?? "US"}
                    onChange={(event) => {
                      const defaultCountry = event.target.value;
                      setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, defaultCountry } }) : current);
                      setPersonalization({ defaultCountry });
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {COUNTRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                  Default currency
                  <select
                    value={settings.platformProfile.defaultCurrency}
                    onChange={(event) => {
                      const defaultCurrency = event.target.value;
                      setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, defaultCurrency } }) : current);
                      setPersonalization({ defaultCurrency });
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {CURRENCY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500 sm:col-span-2">
                  Default timezone
                  <input
                    value={settings.platformProfile.defaultTimezone}
                    onChange={(event) => setSettings((current) => current ? ({ ...current, platformProfile: { ...current.platformProfile, defaultTimezone: event.target.value } }) : current)}
                    placeholder="UTC"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Supported Languages</h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">Enable the languages available across admin interfaces.</p>
              <div className="mt-3 grid gap-2">
                {LANGUAGE_OPTIONS.map((option) => {
                  const selected = settings.platformProfile.supportedLanguages?.includes(option.value) ?? false;
                  return (
                    <label key={option.value} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setSettings((current) => {
                          if (!current) return current;
                          return {
                            ...current,
                            platformProfile: {
                              ...current.platformProfile,
                              supportedLanguages: toggleListValue(current.platformProfile.supportedLanguages ?? [], option.value),
                            },
                          };
                        })}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Auth & Access Policy</h3>
              <div className="mt-4 grid gap-3">
                <textarea
                  value={settings.authAccessPolicy.superAdminEmails.join("\n")}
                  onChange={(event) => {
                    const rows = normalizeList(event.target.value.split("\n"));
                    setSettings((current) => current ? ({ ...current, authAccessPolicy: { ...current.authAccessPolicy, superAdminEmails: rows } }) : current);
                  }}
                  rows={4}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={settings.authAccessPolicy.googleEnabled} onChange={(event) => setSettings((current) => current ? ({ ...current, authAccessPolicy: { ...current.authAccessPolicy, googleEnabled: event.target.checked } }) : current)} className="h-4 w-4 rounded border-slate-300" />Google enabled</label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={settings.authAccessPolicy.passwordEnabled} onChange={(event) => setSettings((current) => current ? ({ ...current, authAccessPolicy: { ...current.authAccessPolicy, passwordEnabled: event.target.checked } }) : current)} className="h-4 w-4 rounded border-slate-300" />Password enabled</label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={settings.authAccessPolicy.otpEnabled} onChange={(event) => setSettings((current) => current ? ({ ...current, authAccessPolicy: { ...current.authAccessPolicy, otpEnabled: event.target.checked } }) : current)} className="h-4 w-4 rounded border-slate-300" />OTP enabled</label>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Notification Policy</h3>
              <div className="mt-4 grid gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={notificationPolicy.channels.inApp} onChange={(event) => setNotificationPolicy((current) => current ? ({ ...current, channels: { ...current.channels, inApp: event.target.checked } }) : current)} className="h-4 w-4 rounded border-slate-300" />In-app delivery</label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={notificationPolicy.channels.email} onChange={(event) => setNotificationPolicy((current) => current ? ({ ...current, channels: { ...current.channels, email: event.target.checked } }) : current)} className="h-4 w-4 rounded border-slate-300" />Email delivery</label>
                <input
                  value={notificationPolicy.renewalCadenceDays.join(",")}
                  onChange={(event) => {
                    const nextCadence = event.target.value
                      .split(",")
                      .map((value) => Number.parseInt(value.trim(), 10))
                      .filter((value) => Number.isFinite(value) && value > 0);
                    setNotificationPolicy((current) => current ? ({ ...current, renewalCadenceDays: nextCadence }) : current);
                  }}
                  placeholder="Renewal cadence days (e.g. 7,3,1)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {Object.entries(notificationPolicy.categories).map(([key, config]) => (
                    <div key={key} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-600">{categoryLabel(key)}</p>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={config.inApp}
                          onChange={(event) => setNotificationPolicy((current) => current ? ({ ...current, categories: { ...current.categories, [key]: { ...current.categories[key], inApp: event.target.checked } } }) : current)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        In-app
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={config.email}
                          onChange={(event) => setNotificationPolicy((current) => current ? ({ ...current, categories: { ...current.categories, [key]: { ...current.categories[key], email: event.target.checked } } }) : current)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Email
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Billing & Retention</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                  Default trial days
                  <input type="number" value={settings.billingPolicy.defaultTrialDays} onChange={(event) => setSettings((current) => current ? ({ ...current, billingPolicy: { ...current.billingPolicy, defaultTrialDays: Number.parseInt(event.target.value, 10) || 0 } }) : current)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
                </label>
                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                  Grace period days
                  <input type="number" value={settings.billingPolicy.gracePeriodDays} onChange={(event) => setSettings((current) => current ? ({ ...current, billingPolicy: { ...current.billingPolicy, gracePeriodDays: Number.parseInt(event.target.value, 10) || 0 } }) : current)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
                </label>
                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                  Audit retention days
                  <input type="number" value={settings.auditRetention.auditLogRetentionDays} onChange={(event) => setSettings((current) => current ? ({ ...current, auditRetention: { ...current.auditRetention, auditLogRetentionDays: Number.parseInt(event.target.value, 10) || 0 } }) : current)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
                </label>
                <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                  Notification retention days
                  <input type="number" value={settings.auditRetention.notificationRetentionDays} onChange={(event) => setSettings((current) => current ? ({ ...current, auditRetention: { ...current.auditRetention, notificationRetentionDays: Number.parseInt(event.target.value, 10) || 0 } }) : current)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700" />
                </label>
              </div>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold text-slate-600">
              <p>Default language: <span className="font-black text-slate-900">{optionLabel(LANGUAGE_OPTIONS, settings.platformProfile.defaultLanguage ?? "en")}</span></p>
              <p>Default country: <span className="font-black text-slate-900">{optionLabel(COUNTRY_OPTIONS, settings.platformProfile.defaultCountry ?? "US")}</span></p>
              <p>Default currency: <span className="font-black text-slate-900">{settings.platformProfile.defaultCurrency}</span></p>
            </div>
            <button type="submit" disabled={saving} className="rounded-lg nx-brand-btn px-4 py-2 text-xs font-black uppercase tracking-wider hover:opacity-90 disabled:opacity-60">
              {saving ? "Saving..." : "Save Platform Settings"}
            </button>
          </div>
        </form>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-900">Release Controls</h3>
          <input value={flagSearch} onChange={(event) => setFlagSearch(event.target.value)} placeholder="Search flags" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Flags</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{releaseSummary.total}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Enabled</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{releaseSummary.enabled}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Internal Stage</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{releaseSummary.internal}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Key</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {releaseFlags.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">No release flags found.</td>
                </tr>
              ) : (
                releaseFlags.map((flag) => (
                  <tr key={flag.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{flag.key}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{flag.rolloutStage}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flag.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {flag.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <button type="button" onClick={() => void toggleFlag(flag)} className="font-semibold text-indigo-600 hover:text-indigo-500">
                        {flag.enabled ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">Additional Super Admin Modules</h3>
        <p className="mt-1 text-xs font-semibold text-slate-500">Open dedicated module pages for feature rollouts, global content, and system controls.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Link href="/super-admin/feature-flags" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 transition hover:border-indigo-300 hover:bg-indigo-50">Feature Flags</Link>
          <Link href="/super-admin/content" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 transition hover:border-indigo-300 hover:bg-indigo-50">Content Hub</Link>
          <Link href="/super-admin/system" className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-900 transition hover:border-indigo-300 hover:bg-indigo-50">System Controls</Link>
        </div>
      </section>
    </div>
  );
}
