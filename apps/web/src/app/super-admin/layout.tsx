"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth as firebaseAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

type NavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/super-admin",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: "Analytics",
    href: "/super-admin/analytics",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3v18M6 8v13M16 11v10M21 6v15" />
      </svg>
    ),
  },
  {
    name: "Churches",
    href: "/super-admin/churches",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    name: "Onboarding",
    href: "/super-admin/onboarding",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    name: "Billing & Plans",
    href: "/super-admin/billing",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    name: "Security & Audit",
    href: "/super-admin/audit-logs",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    name: "Support",
    href: "/super-admin/support",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
];

const THEME_STORAGE_KEY = "noxera_super_admin_theme";
const SIDEBAR_STORAGE_KEY = "noxera_super_admin_sidebar_collapsed";

function getPageTitle(pathname: string): string {
  if (pathname === "/super-admin") return "Platform Dashboard";
  if (pathname === "/super-admin/analytics") return "Analytics Report";
  if (pathname.startsWith("/super-admin/churches/")) return "Church Details";
  if (pathname === "/super-admin/churches") return "Churches Directory";
  if (pathname === "/super-admin/onboarding") return "Church Onboarding";
  if (pathname === "/super-admin/billing") return "Billing & Plans";
  if (pathname === "/super-admin/audit-logs") return "Security & Audit";
  if (pathname === "/super-admin/support") return "Support Center";
  return "System Management";
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("super-admin@noxera.plus");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);
  const profileInitials = useMemo(() => {
    const normalized = sessionEmail.split("@")[0]?.replace(/[^a-zA-Z0-9]+/g, " ").trim();
    if (!normalized) return "SA";
    const letters = normalized
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
    return letters || "SA";
  }, [sessionEmail]);

  const handleLogout = async () => {
    try {
      await fetch("/api/super-admin/session", { method: "DELETE" });
    } catch (error) {
      console.error("Failed to clear super-admin session cookie:", error);
    }

    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }

    router.push("/super-admin/login");
    router.refresh();
  };

  useEffect(() => {
    if (pathname === "/super-admin/login") {
      return;
    }

    const loadSession = async () => {
      try {
        const response = await fetch("/api/super-admin/session", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json().catch(() => ({}))) as { email?: string };
        if (payload.email) {
          setSessionEmail(payload.email);
        }
      } catch {
        // Keep layout stable even if session lookup fails temporarily.
      }
    };

    void loadSession();
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark") {
      setIsDarkMode(true);
    }

    const storedSidebarState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (storedSidebarState === "collapsed") {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, isSidebarCollapsed ? "collapsed" : "expanded");
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  if (pathname === "/super-admin/login") {
    return <>{children}</>;
  }

  return (
    <div className={`flex h-screen font-sans antialiased transition-colors duration-300 ${isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"}`}>
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-indigo-900/60 bg-indigo-950 text-white shadow-2xl transition-all duration-300 lg:static lg:inset-auto lg:translate-x-0 ${
          isSidebarCollapsed ? "lg:w-24" : "lg:w-72"
        } ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-indigo-900/60 px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-xs font-black text-white shadow-inner">N+</div>
            <span className={`text-2xl font-black tracking-tighter ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              NOXERA <span className="text-indigo-400">PLUS</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden rounded-lg p-2 text-indigo-300 transition hover:bg-indigo-900/70 hover:text-white lg:inline-flex"
            >
              <svg className={`h-5 w-5 transition-transform ${isSidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-indigo-300 transition hover:bg-indigo-900/70 hover:text-white lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/80 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
          Super Admin Console
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto py-2 ${isSidebarCollapsed ? "px-2" : "px-4"}`}>
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              onClick={() => setIsSidebarOpen(false)}
              className={`group flex items-center rounded-xl px-4 py-3 transition-all duration-200 ${
                isSidebarCollapsed ? "lg:justify-center lg:px-3" : ""
              } ${
                pathname === item.href
                  ? "bg-gradient-to-r from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-900/30"
                  : "text-indigo-100 hover:bg-indigo-900/50 hover:text-white"
              }`}
            >
              <span className={`${pathname === item.href ? "text-white" : "text-indigo-400 group-hover:text-indigo-200"} transition-colors`}>
                {item.icon}
              </span>
              <span className={`ml-3 text-sm font-bold ${isSidebarCollapsed ? "lg:hidden" : ""}`}>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t border-indigo-900/60 p-4">
          <div className={`flex items-center space-x-3 rounded-2xl bg-indigo-900/40 p-4 ${isSidebarCollapsed ? "lg:justify-center lg:space-x-0 lg:px-2 lg:py-3" : ""}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-md">
              <span className="text-sm font-black">{profileInitials}</span>
            </div>
            <div className={`min-w-0 ${isSidebarCollapsed ? "lg:hidden" : ""}`}>
              <p className="text-xs font-black text-white">Super Admin</p>
              <p className="truncate text-[10px] font-bold text-indigo-300">{sessionEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className={`h-20 border-b px-5 lg:px-8 flex items-center justify-between transition-colors duration-300 ${isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-4 min-w-0">
            <button className={`lg:hidden p-2 rounded-lg ${isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`} onClick={() => setIsSidebarOpen(true)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`hidden lg:inline-flex p-2 rounded-lg ${isDarkMode ? "text-slate-300 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 12h10M4 17h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className={`text-[10px] uppercase tracking-[0.3em] font-black ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>System Management</p>
              <h1 className={`text-lg font-black truncate ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{pageTitle}</h1>
            </div>
          </div>

          <div className="hidden xl:flex flex-1 max-w-xl mx-8">
            <div className={`w-full rounded-xl border px-3 py-2 flex items-center gap-2 ${isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search churches, billing records, or audit logs"
                className={`w-full bg-transparent border-none outline-none text-sm ${isDarkMode ? "placeholder:text-slate-500" : "placeholder:text-slate-400"}`}
              />
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}>/</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`relative p-2.5 rounded-xl border transition ${
                isDarkMode ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
              </svg>
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-[9px] font-black text-white flex items-center justify-center">3</span>
            </button>

            <Link
              href="/super-admin/onboarding"
              className="hidden md:inline-flex px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition bg-indigo-600 hover:bg-indigo-500 !text-white shadow-sm"
            >
              Register Church
            </Link>

            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                aria-label="Open profile menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 rounded-xl border px-2 py-2 transition ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-[11px] font-black !text-white">
                  {profileInitials}
                </span>
                <span className="hidden text-left md:block">
                  <span className="block text-[11px] font-black leading-none">Super Admin</span>
                  <span className={`block text-[10px] leading-none mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {sessionEmail}
                  </span>
                </span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {profileMenuOpen && (
                <div
                  className={`absolute right-0 top-12 z-50 w-64 rounded-2xl border shadow-xl ${
                    isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className={`px-4 py-3 border-b ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}>
                    <p className={`text-xs font-black ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>Signed in as</p>
                    <p className={`text-xs font-semibold mt-1 truncate ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>{sessionEmail}</p>
                  </div>
                  <div className="p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDarkMode((prev) => !prev);
                        setProfileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m8.66-5h-1M4.34 12h-1m14.83 6.83l-.7-.7M6.53 6.53l-.7-.7m12.34 0l-.7.7M6.53 17.47l-.7.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Switch to {isDarkMode ? "Light" : "Dark"} mode
                    </button>
                    <Link
                      href="/super-admin/analytics"
                      onClick={() => setProfileMenuOpen(false)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3v18M6 8v13M16 11v10M21 6v15" />
                      </svg>
                      Analytics report
                    </Link>
                    <Link
                      href="/super-admin/onboarding"
                      onClick={() => setProfileMenuOpen(false)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                      </svg>
                      Register a new church
                    </Link>
                    <Link
                      href="/super-admin/audit-logs"
                      onClick={() => setProfileMenuOpen(false)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Security & audit
                    </Link>
                    <Link
                      href="/super-admin/support"
                      onClick={() => setProfileMenuOpen(false)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        isDarkMode ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Support center
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        void handleLogout();
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        isDarkMode ? "text-red-300 hover:bg-red-500/10" : "text-red-500 hover:bg-red-50"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-auto transition-colors duration-300 ${isDarkMode ? "bg-slate-950" : "bg-slate-100"}`}>
          <div className="max-w-7xl mx-auto p-5 lg:p-8">
            <div className={`mb-5 rounded-2xl px-4 py-3 border ${isDarkMode ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-white border-slate-200 text-slate-600"}`}>
              <p className="text-xs font-semibold">
                Signed in as <span className="font-black">{sessionEmail}</span>
              </p>
              <p className={`text-[11px] mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                All activity in this area is audited and protected by server-side session checks.
              </p>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
