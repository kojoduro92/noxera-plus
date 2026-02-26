import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const SESSION_COOKIE_NAME = "noxera_super_admin_token";

function redirectToLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/super-admin/login";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

function clearSessionAndRedirect(request: NextRequest) {
  const response = redirectToLogin(request);
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/super-admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(request);
  }

  try {
    const verificationResponse = await fetch(`${API_BASE_URL}/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });

    if (!verificationResponse.ok) {
      return clearSessionAndRedirect(request);
    }

    const payload = (await verificationResponse.json().catch(() => ({}))) as { isSuperAdmin?: boolean };
    if (!payload.isSuperAdmin) {
      return clearSessionAndRedirect(request);
    }
  } catch {
    return clearSessionAndRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/super-admin/:path*"],
};
