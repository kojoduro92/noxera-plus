import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export async function GET() {
  const response = await fetch(`${API_BASE_URL}/public/tenants/plans`, {
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return NextResponse.json(
      [
        { name: "Basic", price: 49, trialDays: 14, description: "Core church operations for growing ministries." },
        { name: "Pro", price: 99, trialDays: 14, description: "Advanced workflows for multi-branch operations." },
        { name: "Enterprise", price: 199, trialDays: 14, description: "Platform-scale governance and premium support." },
      ],
      { status: 200 },
    );
  }

  const payload = await response.json().catch(() => []);
  return NextResponse.json(payload);
}
