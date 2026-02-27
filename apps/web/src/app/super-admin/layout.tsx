"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { auth as firebaseAuth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { ConsoleNavItem, ConsoleProfileAction, ConsoleShell } from "@/components/console/console-shell";
import { PortalLink } from "@/components/console/portal-switcher";
import { usePlatformPersonalization } from "@/contexts/PlatformPersonalizationContext";

const navItems: ConsoleNavItem[] = [
  {
    name: "Dashboard",
    href: "/super-admin",
    group: "Overview",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: "Analytics",
    href: "/super-admin/analytics",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3v18M6 8v13M16 11v10M21 6v15" />
      </svg>
    ),
  },
  {
    name: "Churches",
    href: "/super-admin/churches",
    group: "Platform",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    name: "Users",
    href: "/super-admin/users",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 14a4 4 0 10-8 0m8 0a6 6 0 013 5.196M8 14a6 6 0 00-3 5.196M13 8a4 4 0 11-2 0" />
      </svg>
    ),
  },
  {
    name: "Roles",
    href: "/super-admin/roles",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6l3 3-3 3-3-3 3-3zm0 0V3m0 9v9m9-9h-3M6 12H3" />
      </svg>
    ),
  },
  {
    name: "Onboarding",
    href: "/super-admin/onboarding",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    name: "Billing & Plans",
    href: "/super-admin/billing",
    group: "Governance",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    name: "Security & Audit",
    href: "/super-admin/audit-logs",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    name: "Feature Flags",
    href: "/super-admin/feature-flags",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 7h14M5 12h14M5 17h14M8 7v10m8-10v10" />
      </svg>
    ),
  },
  {
    name: "Content Hub",
    href: "/super-admin/content",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h10M7 16h6M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    name: "System",
    href: "/super-admin/system",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 3a2.25 2.25 0 00-2.122 1.5l-.222.666a2.25 2.25 0 01-1.424 1.424l-.666.222a2.25 2.25 0 000 4.244l.666.222a2.25 2.25 0 011.424 1.424l.222.666a2.25 2.25 0 004.244 0l.222-.666a2.25 2.25 0 011.424-1.424l.666-.222a2.25 2.25 0 000-4.244l-.666-.222a2.25 2.25 0 01-1.424-1.424l-.222-.666A2.25 2.25 0 009.75 3zM12 15.75A3.75 3.75 0 1012 8.25a3.75 3.75 0 000 7.5z" />
      </svg>
    ),
  },
  {
    name: "Support",
    href: "/super-admin/support",
    group: "Operations",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    name: "Notifications",
    href: "/super-admin/notifications",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
      </svg>
    ),
  },
  {
    name: "Platform Settings",
    href: "/super-admin/settings",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l.7 2.147a1 1 0 00.95.69h2.258c.969 0 1.371 1.24.588 1.81l-1.827 1.328a1 1 0 00-.364 1.118l.698 2.148c.3.921-.755 1.688-1.538 1.118l-1.828-1.328a1 1 0 00-1.175 0l-1.827 1.328c-.784.57-1.838-.197-1.539-1.118l.699-2.148a1 1 0 00-.364-1.118L6.553 7.574c-.783-.57-.38-1.81.588-1.81h2.257a1 1 0 00.951-.69l.7-2.147zM4 18h16M7 22h10" />
      </svg>
    ),
  },
];

const portalLinks: PortalLink[] = [
  {
    label: "SaaS Home",
    href: "/",
    description: "Open the public Noxera Plus website.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2 7-7 7 7 2 2M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    label: "Church Admin Portal",
    href: "/login",
    description: "Switch into church-level operations.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3h14a2 2 0 012 2v14H3V5a2 2 0 012-2zm3 6h8M8 13h8" />
      </svg>
    ),
  },
  {
    label: "Public Signup",
    href: "/signup",
    description: "Review the self-serve church onboarding journey.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m7-7H5" />
      </svg>
    ),
  },
  {
    label: "Website Preview",
    href: "/grace",
    description: "Preview a public church website template.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8" />
      </svg>
    ),
  },
  {
    label: "Docs & Help",
    href: "/docs",
    description: "Open product docs, onboarding guides, and troubleshooting.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

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

function getPageTitle(pathname: string): string {
  if (pathname === "/super-admin") return "Platform Dashboard";
  if (pathname === "/super-admin/analytics") return "Analytics Report";
  if (pathname.startsWith("/super-admin/churches/")) return "Church Details";
  if (pathname === "/super-admin/churches") return "Churches Directory";
  if (pathname === "/super-admin/users") return "Platform Users";
  if (pathname === "/super-admin/roles") return "Platform Roles";
  if (pathname === "/super-admin/onboarding") return "Church Onboarding";
  if (pathname === "/super-admin/billing") return "Billing & Plans";
  if (pathname === "/super-admin/audit-logs") return "Security & Audit";
  if (pathname === "/super-admin/feature-flags") return "Feature Flags";
  if (pathname === "/super-admin/content") return "Content Hub";
  if (pathname === "/super-admin/system") return "System Controls";
  if (pathname === "/super-admin/support") return "Support Center";
  if (pathname === "/super-admin/notifications") return "Notifications";
  if (pathname === "/super-admin/settings") return "Platform Settings";
  return "System Management";
}

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentPath = pathname ?? "/super-admin";
  const router = useRouter();
  const { personalization } = usePlatformPersonalization();
  const pageTitle = useMemo(() => getPageTitle(currentPath), [currentPath]);
  const [sessionEmail, setSessionEmail] = useState("super-admin@noxera.plus");
  const [notificationCount, setNotificationCount] = useState(0);

  const brandAccentMuted = useMemo(() => {
    const accentColor = normalizeHexColor(personalization.brandAccentColor, "#06b6d4");
    return blendHexColors(accentColor, "#e2e8f0", 0.62);
  }, [personalization.brandAccentColor]);

  useEffect(() => {
    if (currentPath === "/super-admin/login") return;

    const loadSession = async () => {
      try {
        const [sessionResponse, notificationResponse] = await Promise.all([
          fetch("/api/super-admin/session", { cache: "no-store" }),
          fetch("/api/super-admin/platform/notifications?limit=1&unreadOnly=1", { cache: "no-store" }),
        ]);

        if (sessionResponse.ok) {
          const payload = (await sessionResponse.json().catch(() => ({}))) as { email?: string };
          if (payload.email) {
            setSessionEmail(payload.email);
          }
        }

        if (notificationResponse.ok) {
          const payload = (await notificationResponse.json().catch(() => ({}))) as { unreadCount?: number };
          setNotificationCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
        }
      } catch {
        setNotificationCount(0);
      }
    };

    void loadSession();
  }, [currentPath]);

  const handleLogout = async () => {
    try {
      await fetch("/api/super-admin/session", { method: "DELETE" });
    } catch {
      // Keep logout flow resilient even if cookie cleanup fails.
    }

    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }

    router.push("/super-admin/login");
    router.refresh();
  };

  const profileActions: ConsoleProfileAction[] = [
    {
      label: "Platform settings",
      href: "/super-admin/settings",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l.7 2.147a1 1 0 00.95.69h2.258c.969 0 1.371 1.24.588 1.81l-1.827 1.328a1 1 0 00-.364 1.118l.698 2.148c.3.921-.755 1.688-1.538 1.118l-1.828-1.328a1 1 0 00-1.175 0l-1.827 1.328c-.784.57-1.838-.197-1.539-1.118l.699-2.148a1 1 0 00-.364-1.118L6.553 7.574c-.783-.57-.38-1.81.588-1.81h2.257a1 1 0 00.951-.69l.7-2.147zM4 18h16M7 22h10" />
        </svg>
      ),
    },
    {
      label: "Analytics report",
      href: "/super-admin/analytics",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3v18M6 8v13M16 11v10M21 6v15" />
        </svg>
      ),
    },
    {
      label: "Church admin portal",
      href: "/login",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3h14a2 2 0 012 2v14H3V5a2 2 0 012-2zm3 6h8M8 13h8" />
        </svg>
      ),
    },
    {
      label: "Logout",
      onClick: () => void handleLogout(),
      danger: true,
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
        </svg>
      ),
    },
  ];

  if (currentPath === "/super-admin/login") {
    return <>{children}</>;
  }

  return (
    <ConsoleShell
      shellId="noxera_super_admin_console"
      navItems={navItems}
      activePath={currentPath}
      pageTitle={pageTitle}
      consoleLabel="Super Admin Console"
      titlePrefix="System Management"
      brandName={
        <>
          {personalization.orgName.split(" ")[0]?.toUpperCase() ?? "NOXERA"}{" "}
          <span style={{ color: brandAccentMuted }}>
            {personalization.orgName.split(" ").slice(1).join(" ").toUpperCase() || "PLUS"}
          </span>
        </>
      }
      searchPlaceholder="Search churches, members, transactions..."
      quickAction={currentPath.startsWith("/super-admin/onboarding") ? undefined : { label: "Register Church", href: "/super-admin/onboarding" }}
      notificationLink={{ href: "/super-admin/notifications", unreadCount: notificationCount }}
      portalLinks={portalLinks}
      profileName="Super Admin"
      profileEmail={sessionEmail}
      infoBanner={{
        title: `Signed in as ${sessionEmail}`,
        description: "All platform activity in this area is audited and protected by server-side session checks.",
      }}
      profileActions={profileActions}
    >
      {children}
    </ConsoleShell>
  );
}
