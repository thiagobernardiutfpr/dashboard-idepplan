import { NextResponse } from "next/server";
import { DASHBOARD_SESSION_COOKIE } from "@/lib/dashboard-auth";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
