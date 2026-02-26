import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

const FALLBACK_METRICS = {
  churchCount: 30,
  activeUsers: 120,
  branchCount: 45,
  trialDays: 14,
  setupMinutes: 15,
  onboardingMode: "Google + Password + OTP",
};

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/public/tenants/metrics`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(FALLBACK_METRICS, { status: 200 });
    }

    const payload = (await response.json().catch(() => FALLBACK_METRICS)) as Record<string, unknown>;
    return NextResponse.json({ ...FALLBACK_METRICS, ...payload }, { status: 200 });
  } catch {
    return NextResponse.json(FALLBACK_METRICS, { status: 200 });
  }
}
