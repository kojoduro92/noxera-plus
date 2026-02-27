import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  if (!token?.trim()) {
    return NextResponse.json({ message: "Preview token is required." }, { status: 400 });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/public/website/preview/${encodeURIComponent(token)}`, {
      method: "GET",
      cache: "no-store",
    });

    const payload = await response.text();

    if (!response.ok) {
      return NextResponse.json({ message: "Unable to load preview." }, { status: response.status });
    }

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json({ message: "Unable to reach API service." }, { status: 502 });
  }
}
