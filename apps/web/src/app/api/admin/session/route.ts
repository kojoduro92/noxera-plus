import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const SESSION_COOKIE_NAME = "noxera_admin_token";
const SUPER_ADMIN_COOKIE_NAME = "noxera_super_admin_token";
const IMPERSONATION_COOKIE_NAME = "noxera_admin_impersonation";
const SESSION_TTL_SECONDS = 60 * 60;

function parseUpstreamError(text: string, fallback: string) {
  try {
    const parsed = JSON.parse(text) as { message?: string; code?: string };
    return {
      message: parsed.message?.trim() || fallback,
      code: parsed.code?.trim() || "SESSION_VALIDATION_FAILED",
    };
  } catch {
    const message = text.trim() || fallback;
    return {
      message,
      code: "SESSION_VALIDATION_FAILED",
    };
  }
}

async function verifySessionToken(token: string) {
  return fetch(`${API_BASE_URL}/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  }).catch(() => null);
}

async function verifyImpersonationToken(token: string) {
  return fetch(`${API_BASE_URL}/auth/impersonation/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  }).catch(() => null);
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();

  if (!token) {
    return NextResponse.json({ message: "Token is required.", code: "TOKEN_REQUIRED" }, { status: 400 });
  }

  const response = await verifySessionToken(token);

  if (!response || !response.ok) {
    const payload = response
      ? parseUpstreamError(await response.text(), "Unable to verify admin session.")
      : { message: "Unable to verify admin session.", code: "SESSION_API_UNREACHABLE" };
    return NextResponse.json(payload, { status: response?.status ?? 401 });
  }

  const data = (await response.json().catch(() => ({}))) as {
    tenantId?: string | null;
    isSuperAdmin?: boolean;
    userStatus?: string | null;
  };

  if (!data.tenantId) {
    return NextResponse.json(
      {
        message: "Your account is not linked to a church workspace yet. Contact support or ask Super Admin to complete onboarding.",
        code: "ACCOUNT_NOT_LINKED",
      },
      { status: 403 },
    );
  }

  if (data.userStatus === "Suspended") {
    return NextResponse.json(
      {
        message: "Your church-admin account is suspended. Contact your workspace owner.",
        code: "ACCOUNT_SUSPENDED",
      },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  cookieStore.delete(SUPER_ADMIN_COOKIE_NAME);
  cookieStore.delete(IMPERSONATION_COOKIE_NAME);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const impersonationToken = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;

  if (!token && !impersonationToken) {
    return NextResponse.json({ message: "Unauthorized.", code: "MISSING_SESSION" }, { status: 401 });
  }

  let response = token ? await verifySessionToken(token) : await verifyImpersonationToken(impersonationToken as string);
  if (token && (!response || !response.ok) && impersonationToken) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    response = await verifyImpersonationToken(impersonationToken);
  }

  if (!response || !response.ok) {
    const payload = response
      ? parseUpstreamError(await response.text(), "Unable to verify admin session.")
      : { message: "Unable to verify admin session.", code: "SESSION_API_UNREACHABLE" };
    cookieStore.delete(SESSION_COOKIE_NAME);
    if (impersonationToken) {
      cookieStore.delete(IMPERSONATION_COOKIE_NAME);
    }
    return NextResponse.json(payload, { status: response?.status ?? 401 });
  }

  const data = (await response.json().catch(() => ({}))) as {
    uid?: string;
    email?: string;
    isSuperAdmin?: boolean;
    userId?: string | null;
    tenantId?: string | null;
    tenantName?: string | null;
    roleId?: string | null;
    roleName?: string | null;
    permissions?: string[];
    userStatus?: string | null;
    branchScopeMode?: "ALL" | "RESTRICTED";
    allowedBranchIds?: string[];
    signInProvider?: string | null;
    defaultBranchId?: string | null;
    impersonation?: {
      superAdminEmail: string;
      tenantId: string;
      startedAt: string;
      expiresAt: string;
    } | null;
  };

  if (!data.tenantId) {
    return NextResponse.json(
      {
        message: "Your account is not linked to a church workspace yet. Contact support or ask Super Admin to complete onboarding.",
        code: "ACCOUNT_NOT_LINKED",
      },
      { status: 403 },
    );
  }

  if (data.userStatus === "Suspended") {
    return NextResponse.json(
      {
        message: "Your church-admin account is suspended. Contact your workspace owner.",
        code: "ACCOUNT_SUSPENDED",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    uid: data.uid,
    email: data.email,
    isSuperAdmin: Boolean(data.isSuperAdmin),
    userId: data.userId ?? null,
    tenantId: data.tenantId,
    tenantName: data.tenantName ?? null,
    roleId: data.roleId ?? null,
    roleName: data.roleName ?? null,
    permissions: data.permissions ?? [],
    userStatus: data.userStatus ?? null,
    branchScopeMode: data.branchScopeMode ?? "ALL",
    allowedBranchIds: data.allowedBranchIds ?? [],
    signInProvider: data.signInProvider ?? null,
    defaultBranchId: data.defaultBranchId ?? null,
    impersonation: data.impersonation ?? null,
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(IMPERSONATION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
