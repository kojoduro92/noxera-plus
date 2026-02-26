"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth as firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useBranch } from "@/contexts/BranchContext";
import { ConsoleNavItem, ConsoleProfileAction, ConsoleShell } from "@/components/console/console-shell";
import { PortalLink } from "@/components/console/portal-switcher";
import { TenantBranchToolbar } from "@/components/console/tenant-branch-toolbar";

const navItems: ConsoleNavItem[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: "Members",
    href: "/admin/members",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5V4H2v16h5m10 0v-6a3 3 0 10-6 0v6m6 0H7" />
      </svg>
    ),
  },
  {
    name: "Services",
    href: "/admin/services",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h13M8 12h13M8 17h13M3 7h.01M3 12h.01M3 17h.01" />
      </svg>
    ),
  },
  {
    name: "Groups",
    href: "/admin/groups",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5V4H2v16h5m10 0v-6a3 3 0 10-6 0v6m6 0H7" />
      </svg>
    ),
  },
  {
    name: "Events",
    href: "/admin/events",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10m-12 9h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Giving",
    href: "/admin/giving",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: "Communication",
    href: "/admin/communication",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  },
  {
    name: "Website",
    href: "/admin/website",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
      </svg>
    ),
  },
  {
    name: "Reports",
    href: "/admin/reports",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3v18M6 8v13M16 11v10M21 6v15" />
      </svg>
    ),
  },
  {
    name: "Notifications",
    href: "/admin/notifications",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
      </svg>
    ),
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317a1.724 1.724 0 013.35 0l.253 1.267a1.724 1.724 0 001.34 1.34l1.267.253a1.724 1.724 0 010 3.35l-1.267.253a1.724 1.724 0 00-1.34 1.34l-.253 1.267a1.724 1.724 0 01-3.35 0l-.253-1.267a1.724 1.724 0 00-1.34-1.34l-1.267-.253a1.724 1.724 0 010-3.35l1.267-.253a1.724 1.724 0 001.34-1.34l.253-1.267z" />
      </svg>
    ),
  },
];

const portalLinks: PortalLink[] = [
  {
    label: "SaaS Home",
    href: "/",
    description: "View the public Noxera Plus website.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2 7-7 7 7 2 2M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    label: "Start Free Trial",
    href: "/signup",
    description: "Create a new church workspace from the public signup flow.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14m7-7H5" />
      </svg>
    ),
  },
  {
    label: "Public Website Preview",
    href: "/grace",
    description: "Open a live church website experience.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8" />
      </svg>
    ),
  },
  {
    label: "Docs & Help",
    href: "/docs",
    description: "Read product guides, onboarding help, and troubleshooting docs.",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

function getPageTitle(pathname: string): string {
  if (pathname === "/admin") return "Church Operations Dashboard";
  if (pathname.startsWith("/admin/members")) return "Members Directory";
  if (pathname.startsWith("/admin/services")) return "Services & Attendance";
  if (pathname.startsWith("/admin/groups")) return "Groups & Ministries";
  if (pathname.startsWith("/admin/events")) return "Events & Programs";
  if (pathname.startsWith("/admin/giving")) return "Giving & Finance";
  if (pathname.startsWith("/admin/communication")) return "Communication Center";
  if (pathname.startsWith("/admin/website")) return "Website Builder";
  if (pathname.startsWith("/admin/reports")) return "Reports";
  if (pathname.startsWith("/admin/notifications")) return "Notifications";
  if (pathname.startsWith("/admin/settings")) return "Settings";
  return "Church Operations";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { setScope } = useBranch();
  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const [session, setSession] = useState<{
    uid: string;
    email: string | null;
    tenantId: string;
    tenantName: string | null;
    roleName: string | null;
    permissions: string[];
    userStatus: string | null;
    branchScopeMode: "ALL" | "RESTRICTED";
    allowedBranchIds: string[];
    signInProvider: string | null;
    defaultBranchId: string | null;
    roleId: string | null;
    impersonation?: {
      superAdminEmail: string;
      tenantId: string;
      startedAt: string;
      expiresAt: string;
    } | null;
  } | null>(null);

  const profileName = user?.displayName?.trim() || "Church Admin";
  const profileEmail = session?.email?.trim() || user?.email?.trim() || "admin@noxera.plus";

  useEffect(() => {
    const loadSession = async () => {
      setSessionLoading(true);
      setSessionError("");

      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as {
          uid?: string;
          email?: string | null;
          tenantId?: string;
          tenantName?: string | null;
          defaultBranchId?: string | null;
          roleId?: string | null;
          roleName?: string | null;
          permissions?: string[];
          userStatus?: string | null;
          branchScopeMode?: "ALL" | "RESTRICTED";
          allowedBranchIds?: string[];
          signInProvider?: string | null;
          message?: string;
          code?: string;
          impersonation?: {
            superAdminEmail: string;
            tenantId: string;
            startedAt: string;
            expiresAt: string;
          } | null;
        };

        if (!response.ok) {
          setSession(null);
          setSessionError(
            payload.message ??
              "Your account is not linked to a church workspace yet. Contact support or ask Super Admin to complete onboarding.",
          );
          return;
        }

        if (!payload.uid || !payload.tenantId) {
          setSession(null);
          setSessionError("Your account is not linked to a church workspace yet. Contact support.");
          return;
        }

        setSession({
          uid: payload.uid,
          email: payload.email ?? null,
          tenantId: payload.tenantId,
          tenantName: payload.tenantName ?? null,
          roleName: payload.roleName ?? null,
          permissions: payload.permissions ?? [],
          userStatus: payload.userStatus ?? null,
          branchScopeMode: payload.branchScopeMode ?? "ALL",
          allowedBranchIds: payload.allowedBranchIds ?? [],
          signInProvider: payload.signInProvider ?? null,
          defaultBranchId: payload.defaultBranchId ?? null,
          roleId: payload.roleId ?? null,
          impersonation: payload.impersonation ?? null,
        });

        try {
          const notificationsResponse = await fetch("/api/admin/notifications?limit=1&unreadOnly=1", { cache: "no-store" });
          if (notificationsResponse.ok) {
            const notificationsPayload = (await notificationsResponse.json().catch(() => ({}))) as { unreadCount?: number };
            setNotificationCount(typeof notificationsPayload.unreadCount === "number" ? notificationsPayload.unreadCount : 0);
          } else {
            setNotificationCount(0);
          }
        } catch {
          setNotificationCount(0);
        }
      } catch {
        setSession(null);
        setSessionError("Unable to verify your admin session. Reload or sign in again.");
      } finally {
        setSessionLoading(false);
      }
    };

    void loadSession();
  }, []);

  useEffect(() => {
    if (!session?.uid || !session.tenantId) return;
    setScope(`admin:${session.uid}:${session.tenantId}`, session.defaultBranchId ?? undefined);
  }, [session?.defaultBranchId, session?.tenantId, session?.uid, setScope]);

  const handleLogout = async () => {
    try {
      await Promise.all([
        fetch("/api/admin/session", { method: "DELETE" }),
        fetch("/api/super-admin/session", { method: "DELETE" }),
      ]);
    } catch {
      // Keep logout resilient even if cookie cleanup fails.
    }

    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }
    router.push("/login");
    router.refresh();
  };

  const quickAction =
    pathname.startsWith("/admin/members")
      ? { label: "Add Member", href: "/admin/members/new" }
      : pathname.startsWith("/admin/services")
        ? { label: "Schedule Service", href: "/admin/services" }
        : pathname.startsWith("/admin/events")
          ? { label: "Create Event", href: "/admin/events" }
          : undefined;

  const profileActions: ConsoleProfileAction[] = [
    {
      label: "Profile settings",
      href: "/admin/settings",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A9.001 9.001 0 1112 21a8.966 8.966 0 01-6.879-3.196zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Reports",
      href: "/admin/reports",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3v18M6 8v13M16 11v10M21 6v15" />
        </svg>
      ),
    },
    {
      label: "Notifications",
      href: "/admin/notifications",
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
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

  if (sessionLoading) {
    return (
      <ConsoleShell
        shellId="noxera_admin_console"
        navItems={navItems}
        activePath={pathname}
        pageTitle={pageTitle}
        consoleLabel="Church Admin Console"
        titlePrefix="Church Operations"
        brandName={
          <>
            NOXERA <span className="text-indigo-400">PLUS</span>
          </>
        }
        searchPlaceholder="Search members, services, attendance, or reports"
        quickAction={quickAction}
        notificationLink={{ href: "/admin/notifications", unreadCount: notificationCount }}
        portalLinks={portalLinks}
        profileName={profileName}
        profileEmail={profileEmail}
        infoBanner={{
          title: "Verifying church-admin session...",
          description: "Please wait while your secure tenant context is loaded.",
        }}
        profileActions={profileActions}
      >
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-6 w-52 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
        </div>
      </ConsoleShell>
    );
  }

  if (!session?.tenantId) {
    return (
      <ConsoleShell
        shellId="noxera_admin_console"
        navItems={navItems}
        activePath={pathname}
        pageTitle="Account Setup Required"
        consoleLabel="Church Admin Console"
        titlePrefix="Church Operations"
        brandName={
          <>
            NOXERA <span className="text-indigo-400">PLUS</span>
          </>
        }
        searchPlaceholder="Search members, services, attendance, or reports"
        quickAction={undefined}
        notificationLink={{ href: "/admin/notifications", unreadCount: notificationCount }}
        portalLinks={portalLinks}
        profileName={profileName}
        profileEmail={profileEmail}
        infoBanner={{
          title: "This account is not linked to a church tenant yet.",
          description: "Data access remains blocked until tenant assignment is completed.",
        }}
        profileActions={profileActions}
      >
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800 shadow-sm">
          <h2 className="text-lg font-black">Account linkage required</h2>
          <p className="mt-2 text-sm font-medium">
            {sessionError || "Your account is not linked to a church workspace. Contact support or ask Super Admin to complete onboarding."}
          </p>
          <p className="mt-2 text-sm font-medium">
            If this is a newly created church, finish onboarding in Super Admin first, then sign in again.
          </p>
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      shellId="noxera_admin_console"
      navItems={navItems}
      activePath={pathname}
      pageTitle={pageTitle}
      consoleLabel="Church Admin Console"
      titlePrefix="Church Operations"
      brandName={
        <>
          NOXERA <span className="text-indigo-400">PLUS</span>
        </>
      }
      searchPlaceholder="Search members, services, attendance, or reports"
      quickAction={quickAction}
      notificationLink={{ href: "/admin/notifications", unreadCount: notificationCount }}
      portalLinks={portalLinks}
      profileName={profileName}
      profileEmail={profileEmail}
      infoBanner={{
        title: "All church-admin updates are logged and scoped to your active tenant/branch context.",
        description: "Tenant is server-locked to your account. Use branch filter to narrow records.",
      }}
      profileActions={profileActions}
    >
      <TenantBranchToolbar
        tenantId={session.tenantId}
        tenantName={session.tenantName ?? "Your Church"}
        defaultBranchId={session.defaultBranchId}
        branchScopeMode={session.branchScopeMode}
        allowedBranchIds={session.allowedBranchIds}
      />
      {session.impersonation && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs font-semibold text-indigo-700">
          Impersonation active from {session.impersonation.superAdminEmail}. Expires{" "}
          {new Date(session.impersonation.expiresAt).toLocaleString()}.
        </div>
      )}
      {children}
    </ConsoleShell>
  );
}
