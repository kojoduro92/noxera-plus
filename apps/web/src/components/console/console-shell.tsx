"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { PortalLink, PortalSwitcher } from "@/components/console/portal-switcher";
import { usePlatformPersonalization } from "@/contexts/PlatformPersonalizationContext";

export type ConsoleNavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
};

export type ConsoleProfileAction = {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
};

type ConsoleShellProps = {
  shellId: string;
  navItems: ConsoleNavItem[];
  activePath: string;
  pageTitle: string;
  consoleLabel: string;
  titlePrefix: string;
  brandName: React.ReactNode;
  searchPlaceholder: string;
  quickAction?: {
    label: string;
    href: string;
  };
  notificationLink?: {
    href: string;
    unreadCount?: number;
  };
  portalLinks?: PortalLink[];
  profileName: string;
  profileEmail: string;
  infoBanner: {
    title: string;
    description: string;
  };
  profileActions: ConsoleProfileAction[];
  children: React.ReactNode;
};

function normalizeHexColor(value: string | undefined, fallback: string) {
  const candidate = (value ?? "").trim();
  if (!candidate) return fallback;
  const normalized = candidate.startsWith("#") ? candidate.slice(1) : candidate;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  return `#${normalized.toLowerCase()}`;
}

function blendHexColors(base: string, overlay: string, weight: number) {
  const clamp = Math.min(1, Math.max(0, weight));
  const a = base.replace("#", "");
  const b = overlay.replace("#", "");
  const ar = Number.parseInt(a.slice(0, 2), 16);
  const ag = Number.parseInt(a.slice(2, 4), 16);
  const ab = Number.parseInt(a.slice(4, 6), 16);
  const br = Number.parseInt(b.slice(0, 2), 16);
  const bg = Number.parseInt(b.slice(2, 4), 16);
  const bb = Number.parseInt(b.slice(4, 6), 16);
  const rr = Math.round(ar * (1 - clamp) + br * clamp);
  const rg = Math.round(ag * (1 - clamp) + bg * clamp);
  const rb = Math.round(ab * (1 - clamp) + bb * clamp);
  return `#${rr.toString(16).padStart(2, "0")}${rg.toString(16).padStart(2, "0")}${rb.toString(16).padStart(2, "0")}`;
}

export function ConsoleShell({
  shellId,
  navItems,
  activePath,
  pageTitle,
  consoleLabel,
  titlePrefix,
  brandName,
  searchPlaceholder,
  quickAction,
  notificationLink,
  portalLinks = [],
  profileName,
  profileEmail,
  infoBanner,
  profileActions,
  children,
}: ConsoleShellProps) {
  const { personalization } = usePlatformPersonalization();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [themePreference, setThemePreference] = useState<"light" | "dark" | "system">("system");
  const [systemDarkMode, setSystemDarkMode] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const themeKey = `${shellId}_theme`;
  const sidebarKey = `${shellId}_sidebar`;
  const isDarkMode = themePreference === "dark" || (themePreference === "system" && systemDarkMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTheme = window.localStorage.getItem(themeKey);
    const storedSidebar = window.localStorage.getItem(sidebarKey);
    const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
      ? storedTheme
      : personalization.themeMode;
    setThemePreference(theme === "light" || theme === "dark" || theme === "system" ? theme : "system");
    setIsSidebarCollapsed(storedSidebar === "collapsed");
    setSystemDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, [personalization.themeMode, themeKey, sidebarKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(themeKey, themePreference);
  }, [themeKey, themePreference]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(sidebarKey, isSidebarCollapsed ? "collapsed" : "expanded");
  }, [isSidebarCollapsed, sidebarKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onThemeChange = (event: MediaQueryListEvent) => setSystemDarkMode(event.matches);
    mediaQuery.addEventListener("change", onThemeChange);
    return () => mediaQuery.removeEventListener("change", onThemeChange);
  }, []);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  const profileInitials = useMemo(() => {
    const source = profileEmail || profileName;
    const normalized = source.split("@")[0]?.replace(/[^a-zA-Z0-9]+/g, " ").trim();
    if (!normalized) return "AD";
    return normalized
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AD";
  }, [profileEmail, profileName]);
  const primaryColor = normalizeHexColor(personalization.brandPrimaryColor, "#7c3aed");
  const accentColor = normalizeHexColor(personalization.brandAccentColor, "#06b6d4");
  const sidebarStartColor = blendHexColors(primaryColor, "#0f172a", 0.78);
  const sidebarMidColor = blendHexColors(primaryColor, "#0b1220", 0.86);
  const sidebarEndColor = blendHexColors(accentColor, "#0b1220", 0.9);
  const activeBgColor = blendHexColors(primaryColor, "#1f2937", 0.7);
  const activeBorderColor = blendHexColors(primaryColor, "#cbd5e1", 0.66);

  return (
    <div className={`nx-console-theme ${isDarkMode ? "nx-console-dark bg-slate-950 text-slate-100" : "nx-console-light bg-slate-100 text-slate-900"} flex h-screen font-sans antialiased transition-colors duration-300`}>
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 text-white shadow-2xl transition-all duration-300 lg:static lg:inset-auto lg:translate-x-0 ${
          isSidebarCollapsed ? "lg:w-24" : "lg:w-72"
        } ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          backgroundImage: `radial-gradient(140% 75% at 8% -5%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, ${sidebarStartColor} 0%, ${sidebarMidColor} 55%, ${sidebarEndColor} 100%)`,
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-indigo-500 text-xs font-black text-white shadow-inner">
              {personalization.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={personalization.logoUrl} alt="Platform logo" className="h-full w-full object-contain" />
              ) : (
                "N+"
              )}
            </div>
            <span className={`text-2xl font-black tracking-tighter ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{brandName}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="hidden rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white lg:inline-flex"
            >
              <svg className={`h-5 w-5 transition-transform ${isSidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/50 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
          {consoleLabel}
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto py-2 ${isSidebarCollapsed ? "px-2" : "px-4"}`}>
          {navItems.map((item) => {
            const active = activePath === item.href || (item.href !== "/admin" && activePath.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                title={item.name}
                onClick={() => setIsSidebarOpen(false)}
                className={`group flex items-center rounded-xl border border-transparent px-4 py-3 transition-all duration-200 ${
                  isSidebarCollapsed ? "lg:justify-center lg:px-3" : ""
                } ${active ? "text-white shadow-md shadow-slate-950/30" : "text-white/85 hover:bg-white/10 hover:text-white"}`}
                style={active ? { backgroundColor: activeBgColor, borderColor: activeBorderColor } : undefined}
              >
                <span className={`${active ? "text-white" : "text-white/70 group-hover:text-white"} transition-colors`}>{item.icon}</span>
                <span className={`ml-3 text-sm font-bold ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className={`flex items-center space-x-3 rounded-2xl border border-white/10 bg-slate-900/35 p-4 ${isSidebarCollapsed ? "lg:justify-center lg:space-x-0 lg:px-2 lg:py-3" : ""}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white shadow-md" style={{ background: `linear-gradient(135deg, ${personalization.brandPrimaryColor}, ${personalization.brandAccentColor})` }}>
              {profileInitials}
            </div>
            <div className={`min-w-0 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="text-xs font-black text-white">{profileName}</p>
              <p className="truncate text-[10px] font-bold text-white/70">{profileEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className={`flex h-20 items-center justify-between border-b px-5 lg:px-8 transition-colors duration-300 ${isDarkMode ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
          <div className="flex min-w-0 items-center gap-4">
            <button className={`rounded-lg p-2 lg:hidden ${isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`} onClick={() => setIsSidebarOpen(true)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`hidden rounded-lg p-2 lg:inline-flex ${isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 12h10M4 17h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{titlePrefix}</p>
              <h1 className={`truncate text-lg font-black ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{pageTitle}</h1>
            </div>
          </div>

          <div className="mx-8 hidden max-w-xl flex-1 xl:flex">
            <div className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 ${isDarkMode ? "border-slate-700 bg-slate-800 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder={searchPlaceholder} className={`w-full border-none bg-transparent text-sm outline-none ${isDarkMode ? "placeholder:text-slate-500" : "placeholder:text-slate-400"}`} />
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}>/</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {notificationLink && (
              <Link
                href={notificationLink.href}
                aria-label="Open notifications"
                className={`relative inline-flex items-center rounded-xl border p-2.5 transition ${
                  isDarkMode
                    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
                </svg>
                {(notificationLink.unreadCount ?? 0) > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white" style={{ backgroundColor: personalization.brandPrimaryColor }}>
                    {Math.min(notificationLink.unreadCount ?? 0, 9)}
                  </span>
                )}
              </Link>
            )}
            <PortalSwitcher links={portalLinks} isDarkMode={isDarkMode} />
            {quickAction && (
              <Link href={quickAction.href} className="hidden rounded-xl nx-brand-btn px-4 py-2.5 text-xs font-black uppercase tracking-wider transition hover:opacity-90 md:inline-flex !text-white shadow-sm">
                {quickAction.label}
              </Link>
            )}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                aria-label="Open profile menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl border px-2 py-2 transition ${
                  isDarkMode ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black !text-white" style={{ background: `linear-gradient(135deg, ${personalization.brandPrimaryColor}, ${personalization.brandAccentColor})` }}>
                  {profileInitials}
                </span>
                <span className="hidden text-left md:block">
                  <span className="block text-[11px] font-black leading-none">{profileName}</span>
                  <span className={`mt-1 block text-[10px] leading-none ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{profileEmail}</span>
                </span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {profileMenuOpen && (
                <div className={`absolute right-0 top-12 z-50 w-64 rounded-2xl border shadow-xl ${isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
                  <div className={`border-b px-4 py-3 ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}>
                    <p className={`text-xs font-black ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Signed in as</p>
                    <p className={`mt-1 truncate text-xs font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>{profileEmail}</p>
                  </div>
                  <div className="space-y-1 p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setThemePreference(isDarkMode ? "light" : "dark");
                        setProfileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m8.66-5h-1M4.34 12h-1m14.83 6.83l-.7-.7M6.53 6.53l-.7-.7m12.34 0l-.7.7M6.53 17.47l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Switch to {isDarkMode ? "Light" : "Dark"} mode
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setThemePreference("system");
                        setProfileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"}`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                      Use system theme ({themePreference === "system" ? "on" : "off"})
                    </button>
                    {profileActions.map((action) => {
                      const className = `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        action.danger
                          ? isDarkMode
                            ? "text-red-300 hover:bg-red-500/10"
                            : "text-red-500 hover:bg-red-50"
                          : isDarkMode
                            ? "text-slate-200 hover:bg-slate-800"
                            : "text-slate-700 hover:bg-slate-100"
                      }`;

                      if (action.href) {
                        return (
                          <Link key={action.label} href={action.href} onClick={() => setProfileMenuOpen(false)} className={className}>
                            {action.icon}
                            {action.label}
                          </Link>
                        );
                      }

                      return (
                        <button
                          key={action.label}
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            action.onClick?.();
                          }}
                          className={className}
                        >
                          {action.icon}
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-auto transition-colors duration-300 ${isDarkMode ? "bg-slate-950" : "bg-slate-100"}`}>
          <div className="mx-auto max-w-7xl p-5 lg:p-8">
            <div className={`mb-5 rounded-2xl border px-4 py-3 ${isDarkMode ? "border-slate-800 bg-slate-900/60 text-slate-300" : "border-slate-200 bg-white text-slate-600"}`}>
              <p className="text-xs font-semibold">{infoBanner.title}</p>
              <p className={`mt-1 text-[11px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{infoBanner.description}</p>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
