export const DASHBOARD_SESSION_COOKIE = "idepplan_dashboard_session";
export const DASHBOARD_SESSION_SECONDS = 8 * 60 * 60;

export type DashboardSession = {
  username: string;
  displayName: string;
  expiresAt: number;
};

type SessionPayload = {
  sub: string;
  name: string;
  iat: number;
  exp: number;
  nonce: string;
};

type ConfiguredUser = {
  username: string;
  displayName: string;
  password: string;
};

const encoder = new TextEncoder();

function env(name: string) {
  return process.env[name] ?? "";
}

function normalizeUsername(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function configuredUsers(): ConfiguredUser[] {
  const raw = env("DASHBOARD_USERS_JSON").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const users = parsed.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const record = value as Record<string, unknown>;
        const username =
          typeof record.username === "string"
            ? normalizeUsername(record.username)
            : "";
        const displayName =
          typeof record.displayName === "string"
            ? record.displayName.trim()
            : username;
        const password =
          typeof record.password === "string" ? record.password : "";
        return username && displayName && password
          ? [{ username, displayName, password }]
          : [];
      });
      return users.filter(
        (user, index) =>
          users.findIndex((candidate) => candidate.username === user.username) ===
          index,
      );
    } catch {
      return [];
    }
  }

  const username = normalizeUsername(env("DASHBOARD_ADMIN_USERNAME"));
  const password = env("DASHBOARD_ADMIN_PASSWORD");
  if (!username || !password) return [];
  return [
    {
      username,
      displayName:
        env("DASHBOARD_ADMIN_DISPLAY_NAME").trim() || username,
      password,
    },
  ];
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodePayload(payload: SessionPayload) {
  return toBase64Url(encoder.encode(JSON.stringify(payload)));
}

async function sessionKey() {
  const secret = env("DASHBOARD_SESSION_SECRET");
  if (secret.length < 32) return null;
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );
}

async function secureEqual(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([
    digest(left),
    digest(right),
  ]);
  let difference = 0;
  for (let index = 0; index < leftDigest.length; index += 1) {
    difference |= leftDigest[index] ^ rightDigest[index];
  }
  return difference === 0;
}

export function isDashboardAuthConfigured() {
  return Boolean(
    configuredUsers().length &&
      env("DASHBOARD_SESSION_SECRET").length >= 32,
  );
}

export async function validateDashboardCredentials(
  username: string,
  password: string,
) {
  if (!isDashboardAuthConfigured()) return null;
  const normalizedUsername = normalizeUsername(username);
  const matches = await Promise.all(
    configuredUsers().map(async (user) => {
      const [usernameMatches, passwordMatches] = await Promise.all([
        secureEqual(normalizedUsername, user.username),
        secureEqual(password, user.password),
      ]);
      return usernameMatches && passwordMatches ? user : null;
    }),
  );
  return matches.find((user): user is ConfiguredUser => user !== null) ?? null;
}

export async function createDashboardSession(
  user: Pick<ConfiguredUser, "username" | "displayName">,
): Promise<string> {
  const key = await sessionKey();
  if (!key) throw new Error("Autenticação do dashboard não configurada.");
  const now = Math.floor(Date.now() / 1000);
  const payload = encodePayload({
    sub: user.username,
    name: user.displayName,
    iat: now,
    exp: now + DASHBOARD_SESSION_SECONDS,
    nonce: crypto.randomUUID(),
  });
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
  return `${payload}.${toBase64Url(signature)}`;
}

export async function verifyDashboardSession(
  token: string | undefined,
): Promise<DashboardSession | null> {
  if (!token) return null;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;
  try {
    const key = await sessionKey();
    if (!key) return null;
    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(encodedSignature),
      encoder.encode(encodedPayload),
    );
    if (!signatureValid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    ) as Partial<SessionPayload>;
    const now = Math.floor(Date.now() / 1000);
    const configuredUser = configuredUsers().find(
      (user) => user.username === payload.sub,
    );
    if (
      typeof payload.sub !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.exp !== "number" ||
      !configuredUser ||
      payload.exp <= now
    )
      return null;
    return {
      username: payload.sub,
      displayName: payload.name,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function loginAttemptKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  const address =
    request.headers.get("cf-connecting-ip") || forwarded?.trim() || "unknown";
  return toBase64Url(await digest(address));
}
