import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const SESSION_COOKIE_NAME = "noxera_admin_token";
const IMPERSONATION_COOKIE_NAME = "noxera_admin_impersonation";
const ALLOWED_ROOT_PATHS = new Set([
  "members",
  "services",
  "attendance",
  "giving",
  "groups",
  "events",
  "followups",
  "messages",
  "branches",
  "users",
  "roles",
  "website",
  "integrations",
  "notifications",
  "reports",
]);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function isAllowedPath(path: string[]) {
  return path.length > 0 && ALLOWED_ROOT_PATHS.has(path[0]);
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;

  if (!isAllowedPath(path)) {
    return NextResponse.json({ message: "Not found.", code: "ROUTE_NOT_FOUND" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value ?? cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized.", code: "MISSING_SESSION" }, { status: 401 });
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const targetUrl = `${API_BASE_URL}/${path.join("/")}${request.nextUrl.search}`;

  try {
    const upstreamResponse = await fetch(targetUrl, init);
    const payload = await upstreamResponse.text();

    if (!upstreamResponse.ok) {
      let message = `Request failed with status ${upstreamResponse.status}.`;
      let code = "UPSTREAM_ERROR";

      try {
        const parsed = JSON.parse(payload) as { message?: string; code?: string };
        if (parsed.message) {
          message = parsed.message;
        }
        if (parsed.code) {
          code = parsed.code;
        }
      } catch {
        if (payload.trim()) {
          message = payload.trim();
        }
      }

      return NextResponse.json({ message, code }, { status: upstreamResponse.status });
    }

    const upstreamContentType = upstreamResponse.headers.get("content-type") ?? "application/json; charset=utf-8";
    return new NextResponse(payload, {
      status: upstreamResponse.status,
      headers: { "content-type": upstreamContentType },
    });
  } catch {
    return NextResponse.json({ message: "Unable to reach API service.", code: "API_UNREACHABLE" }, { status: 502 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}
