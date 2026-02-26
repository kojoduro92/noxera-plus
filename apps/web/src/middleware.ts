import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const SUPER_ADMIN_COOKIE_NAME = "noxera_super_admin_token";
const ADMIN_COOKIE_NAME = "noxera_admin_token";
const IMPERSONATION_COOKIE_NAME = "noxera_admin_impersonation";

function redirectToSuperAdminLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/super-admin/login";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function redirectToAdminLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

async function verifyFirebaseSession(token: string) {
  try {
    const verificationResponse = await fetch(`${API_BASE_URL}/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });

    if (!verificationResponse.ok) return null;
    const payload = (await verificationResponse.json().catch(() => ({}))) as {
      isSuperAdmin?: boolean;
      tenantId?: string | null;
      userStatus?: string | null;
    };
    return payload;
  } catch {
    return null;
  }
}

async function verifyImpersonationSession(token: string) {
  try {
    const verificationResponse = await fetch(`${API_BASE_URL}/auth/impersonation/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });

    if (!verificationResponse.ok) return null;
    const payload = (await verificationResponse.json().catch(() => ({}))) as { tenantId?: string };
    return payload;
  } catch {
    return null;
  }
}

function clearSuperAdminSessionAndRedirect(request: NextRequest) {
  const response = redirectToSuperAdminLogin(request);
  response.cookies.delete(SUPER_ADMIN_COOKIE_NAME);
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/super-admin/login" || pathname === "/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/super-admin")) {
    const token = request.cookies.get(SUPER_ADMIN_COOKIE_NAME)?.value;
    if (!token) {
      return clearSuperAdminSessionAndRedirect(request);
    }

    const payload = await verifyFirebaseSession(token);
    if (!payload?.isSuperAdmin) {
      return clearSuperAdminSessionAndRedirect(request);
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const impersonationToken = request.cookies.get(IMPERSONATION_COOKIE_NAME)?.value;

    if (!adminToken && !impersonationToken) {
      const response = redirectToAdminLogin(request);
      response.cookies.delete(ADMIN_COOKIE_NAME);
      response.cookies.delete(IMPERSONATION_COOKIE_NAME);
      return response;
    }

    if (adminToken) {
      const payload = await verifyFirebaseSession(adminToken);
      if (payload && !payload.isSuperAdmin && payload.tenantId && payload.userStatus !== "Suspended") {
        return NextResponse.next();
      }
    }

    if (impersonationToken) {
      const impersonationPayload = await verifyImpersonationSession(impersonationToken);
      if (impersonationPayload?.tenantId) {
        return NextResponse.next();
      }
    }

    const response = redirectToAdminLogin(request);
    response.cookies.delete(ADMIN_COOKIE_NAME);
    response.cookies.delete(IMPERSONATION_COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/super-admin/:path*", "/admin/:path*"],
};
