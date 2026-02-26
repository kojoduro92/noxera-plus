import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const SESSION_COOKIE_NAME = "noxera_super_admin_token";
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

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();

  if (!token) {
    return NextResponse.json({ message: "Token is required.", code: "TOKEN_REQUIRED" }, { status: 400 });
  }

  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    const payload = response
      ? parseUpstreamError(await response.text(), "Unable to verify super-admin session.")
      : { message: "Unable to verify super-admin session.", code: "SESSION_API_UNREACHABLE" };
    return NextResponse.json(
      payload,
      { status: response?.status ?? 401 },
    );
  }

  const data = (await response.json().catch(() => ({}))) as { isSuperAdmin?: boolean };
  if (!data.isSuperAdmin) {
    return NextResponse.json({ message: "Super-admin access denied.", code: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized.", code: "MISSING_SESSION" }, { status: 401 });
  }

  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    const payload = response
      ? parseUpstreamError(await response.text(), "Unable to verify super-admin session.")
      : { message: "Unable to verify super-admin session.", code: "SESSION_API_UNREACHABLE" };
    return NextResponse.json(payload, { status: response?.status ?? 401 });
  }

  const data = (await response.json().catch(() => ({}))) as {
    uid?: string;
    email?: string;
    isSuperAdmin?: boolean;
  };

  if (!data.isSuperAdmin) {
    return NextResponse.json({ message: "Super-admin access denied.", code: "SUPER_ADMIN_REQUIRED" }, { status: 403 });
  }

  return NextResponse.json({
    uid: data.uid,
    email: data.email,
    isSuperAdmin: true,
  });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
