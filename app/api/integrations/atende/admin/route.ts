import {
  generateAtendeSyncToken,
  getAtendeSyncCredentialStatus,
  listAtendeSyncRuns,
  revokeAtendeSyncToken,
} from "@/lib/atende-sync-server";

export const dynamic = "force-dynamic";

function userFromRequest(request: Request) {
  const encoded = request.headers.get("x-idepplan-user") ?? "";
  if (!encoded) return "";
  try {
    return decodeURIComponent(encoded).trim();
  } catch {
    return encoded.trim();
  }
}

function unauthorized() {
  return Response.json({ error: "Sessão administrativa inválida." }, { status: 401 });
}

export async function GET(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  try {
    const [credential, runs] = await Promise.all([
      getAtendeSyncCredentialStatus(),
      listAtendeSyncRuns(20),
    ]);
    return Response.json({ credential, runs });
  } catch (error) {
    console.error("Atende admin GET error", error);
    return Response.json({ error: "Não foi possível consultar a integração do Atende.Net." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  try {
    const token = await generateAtendeSyncToken(user);
    const credential = await getAtendeSyncCredentialStatus();
    return Response.json({ token, credential });
  } catch (error) {
    console.error("Atende admin POST error", error);
    return Response.json({ error: "Não foi possível gerar a chave de sincronização." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = userFromRequest(request);
  if (!user) return unauthorized();
  try {
    await revokeAtendeSyncToken();
    const credential = await getAtendeSyncCredentialStatus();
    return Response.json({ credential });
  } catch (error) {
    console.error("Atende admin DELETE error", error);
    return Response.json({ error: "Não foi possível revogar a chave de sincronização." }, { status: 500 });
  }
}
