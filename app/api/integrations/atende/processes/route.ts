import {
  listAtendeSyncRuns,
  synchronizeAtendeProcesses,
  verifyAtendeSyncToken,
  type AtendeProcessInput,
} from "@/lib/atende-sync-server";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Credencial de sincronização inválida." }, { status: 401 });
}

async function authorized(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  if (!value.startsWith("Bearer ")) return false;
  const supplied = value.slice("Bearer ".length).trim();
  if (!supplied) return false;
  return verifyAtendeSyncToken(supplied);
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return unauthorized();
  try {
    return Response.json({ runs: await listAtendeSyncRuns(30) });
  } catch (error) {
    console.error("Atende sync GET error", error);
    return Response.json({ error: "Não foi possível consultar o histórico de sincronizações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return unauthorized();
  try {
    const payload = (await request.json()) as {
      sourceFile?: unknown;
      reportId?: unknown;
      generatedAt?: unknown;
      processes?: unknown;
    };
    if (!Array.isArray(payload.processes) || payload.processes.length < 1 || payload.processes.length > 20_000) {
      return Response.json({ error: "Envie entre 1 e 20.000 processos por sincronização." }, { status: 400 });
    }
    const result = await synchronizeAtendeProcesses({
      sourceFile: typeof payload.sourceFile === "string" ? payload.sourceFile : "",
      reportId: typeof payload.reportId === "string" ? payload.reportId : "",
      generatedAt: typeof payload.generatedAt === "string" ? payload.generatedAt : "",
      processes: payload.processes as AtendeProcessInput[],
    });
    return Response.json({ sync: result });
  } catch (error) {
    console.error("Atende sync POST error", error);
    const message = error instanceof Error ? error.message : "Não foi possível sincronizar o relatório do Atende.Net.";
    return Response.json({ error: message }, { status: 500 });
  }
}
