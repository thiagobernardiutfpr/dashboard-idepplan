import { NextRequest, NextResponse } from "next/server";
import {
  DASHBOARD_SESSION_COOKIE,
  verifyDashboardSession,
} from "@/lib/dashboard-auth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/favicon.svg",
  "/prefeitura-apucarana.png",
  "/idepplan-2026.png",
]);

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    /\.(?:css|js|mjs|woff2?|ttf|ico|svg|png|jpe?g|webp|gif|avif)$/i.test(
      pathname,
    )
  );
}

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("referrer-policy", "no-referrer");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || isPublicAsset(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  const session = await verifyDashboardSession(
    request.cookies.get(DASHBOARD_SESSION_COOKIE)?.value,
  );
  if (session) {
    const headers = new Headers(request.headers);
    headers.set("x-idepplan-user", encodeURIComponent(session.displayName));
    headers.set("x-idepplan-username", session.username);
    return addSecurityHeaders(NextResponse.next({ request: { headers } }));
  }

  if (pathname.startsWith("/api/")) {
    return addSecurityHeaders(
      NextResponse.json(
        { error: "Sessão expirada. Entre novamente no Dashboard IDEPPLAN." },
        { status: 401 },
      ),
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnTo", `${pathname}${request.nextUrl.search}`);
  return addSecurityHeaders(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/:path*"],
};
