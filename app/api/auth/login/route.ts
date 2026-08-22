import { NextResponse } from "next/server";
import { ensureDashboardSchema, getD1Binding } from "@/db";
import {
  createDashboardSession,
  DASHBOARD_SESSION_COOKIE,
  DASHBOARD_SESSION_SECONDS,
  isDashboardAuthConfigured,
  loginAttemptKey,
  validateDashboardCredentials,
} from "@/lib/dashboard-auth";

export const dynamic = "force-dynamic";
const MAX_FAILURES = 5;
const LOCK_SECONDS = 15 * 60;

type Attempt = {
  failures: number;
  blocked_until: number;
};

async function currentAttempt(key: string) {
  try {
    await ensureDashboardSchema();
    return await getD1Binding()
      .prepare(
        "SELECT failures, blocked_until FROM dashboard_login_attempts WHERE attempt_key = ?",
      )
      .bind(key)
      .first<Attempt>();
  } catch (error) {
    console.error("Falha ao consultar limite de login", error);
    return null;
  }
}

async function recordFailure(key: string, previous: Attempt | null) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const failures = (previous?.failures ?? 0) + 1;
    const blockedUntil = failures >= MAX_FAILURES ? now + LOCK_SECONDS : 0;
    await getD1Binding()
      .prepare(
        `INSERT INTO dashboard_login_attempts (attempt_key, failures, blocked_until, updated_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(attempt_key) DO UPDATE SET
           failures = excluded.failures,
           blocked_until = excluded.blocked_until,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(key, failures, blockedUntil)
      .run();
  } catch (error) {
    console.error("Falha ao registrar tentativa de login", error);
  }
}

async function clearFailures(key: string) {
  try {
    await getD1Binding()
      .prepare("DELETE FROM dashboard_login_attempts WHERE attempt_key = ?")
      .bind(key)
      .run();
  } catch (error) {
    console.error("Falha ao limpar tentativas de login", error);
  }
}

export async function POST(request: Request) {
  if (!isDashboardAuthConfigured()) {
    return NextResponse.json(
      { error: "O acesso institucional ainda não foi configurado." },
      { status: 503 },
    );
  }

  const attemptKey = await loginAttemptKey(request);
  const attempt = await currentAttempt(attemptKey);
  const now = Math.floor(Date.now() / 1000);
  if (attempt?.blocked_until && attempt.blocked_until > now) {
    const retryAfter = attempt.blocked_until - now;
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers: { "retry-after": String(retryAfter) } },
    );
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dados de acesso inválidos." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const authenticatedUser = await validateDashboardCredentials(
    username,
    password,
  );
  if (!authenticatedUser) {
    await recordFailure(attemptKey, attempt);
    return NextResponse.json(
      { error: "Usuário ou senha inválidos." },
      { status: 401 },
    );
  }

  await clearFailures(attemptKey);
  const token = await createDashboardSession(authenticatedUser);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DASHBOARD_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: DASHBOARD_SESSION_SECONDS,
  });
  return response;
}
