import { NextRequest, NextResponse } from "next/server";

const apiBaseUrl = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.trytarang.app"
).replace(/\/$/, "");

/**
 * Relays feedback through the studio origin. This prevents a browser CORS or
 * API-proxy failure from blocking feedback that the backend can store in Neon.
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const response = await fetch(`${apiBaseUrl}/api/feedback/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: await request.text(),
      cache: "no-store",
    });

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Feedback API relay failed:", error);
    return NextResponse.json(
      { detail: "Feedback service is temporarily unavailable. Please try again." },
      { status: 502 },
    );
  }
}
