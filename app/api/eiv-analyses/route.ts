import { eq, sql } from "drizzle-orm";
import dataset from "@/data/dashboard-data.json";
import { ensureDashboardSchema, getDb } from "@/db";
import { eivAnalyses, manualProcesses } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const knownProcesses = new Set(dataset.processes.map((process) => process.id));

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sourceFiles(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" ? [item.slice(0, 180)] : []).slice(0, 80)
    : [];
}

async function validProcessId(value: unknown) {
  const processId = text(value, 160);
  if (!processId) return "";
  if (knownProcesses.has(processId)) return processId;
  const [record] = await getDb().select({ id: manualProcesses.id }).from(manualProcesses).where(eq(manualProcesses.id, processId));
  return record ? processId : "";
}

function serialize(record: typeof eivAnalyses.$inferSelect) {
  let result: Record<string, unknown> = {};
  let files: string[] = [];
  try { result = JSON.parse(record.resultJson) as Record<string, unknown>; } catch {}
  try { files = JSON.parse(record.sourceFiles) as string[]; } catch {}
  return { ...record, result, sourceFiles: files, resultJson: undefined };
}

export async function GET(request: Request) {
  try {
    await ensureDashboardSchema();
    const processId = await validProcessId(new URL(request.url).searchParams.get("processId"));
    if (!processId) return Response.json({ error: "Processo inválido." }, { status: 400 });
    const [record] = await getDb().select().from(eivAnalyses).where(eq(eivAnalyses.processId, processId));
    return Response.json({ analysis: record ? serialize(record) : null });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível carregar a análise do EIV." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDashboardSchema();
    const payload = await request.json() as Record<string, unknown>;
    const processId = await validProcessId(payload.processId);
    if (!processId) return Response.json({ error: "Processo inválido." }, { status: 400 });
    if (!payload.result || typeof payload.result !== "object" || Array.isArray(payload.result)) return Response.json({ error: "Resultado de análise inválido." }, { status: 400 });
    const resultJson = JSON.stringify(payload.result);
    if (resultJson.length > 300_000) return Response.json({ error: "A análise excedeu o tamanho permitido." }, { status: 413 });
    const result = payload.result as Record<string, unknown>;
    const score = typeof result.coverageScore === "number" && Number.isFinite(result.coverageScore)
      ? Math.max(0, Math.min(100, Math.round(result.coverageScore)))
      : 0;
    const analyzedAt = typeof result.analyzedAt === "string" && !Number.isNaN(Date.parse(result.analyzedAt))
      ? result.analyzedAt
      : new Date().toISOString();
    const values = {
      resultJson,
      sourceFiles: JSON.stringify(sourceFiles(payload.sourceFiles)),
      coverageScore: score,
      conclusion: text(result.conclusion, 200),
      analyzedAt,
      updatedBy: getRequestUser(request),
    };
    const [record] = await getDb().insert(eivAnalyses).values({ processId, ...values }).onConflictDoUpdate({
      target: eivAnalyses.processId,
      set: { ...values, updatedAt: sql`CURRENT_TIMESTAMP` },
    }).returning();
    return Response.json({ analysis: serialize(record) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível salvar a análise do EIV." }, { status: 500 });
  }
}

