import { desc, eq, sql } from "drizzle-orm";
import dataset from "@/data/dashboard-data.json";
import { ensureDashboardSchema, getDb } from "@/db";
import { manualProcesses, processEnrichments } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const knownProcesses = new Set(dataset.processes.map((process) => process.id));

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => (typeof item === "string" ? [item.slice(0, 180)] : [])).slice(0, 30)
    : [];
}

function confidence(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .flatMap(([key, score]) =>
        typeof score === "number" && Number.isFinite(score)
          ? [[key.slice(0, 60), Math.max(0, Math.min(1, score))]]
          : [],
      )
      .slice(0, 30),
  );
}

async function validProcessId(value: unknown) {
  const processId = text(value, 160);
  if (!processId) return "";
  if (knownProcesses.has(processId)) return processId;
  const [record] = await getDb()
    .select({ id: manualProcesses.id })
    .from(manualProcesses)
    .where(eq(manualProcesses.id, processId));
  return record ? processId : "";
}

function serialize(record: typeof processEnrichments.$inferSelect) {
  let sourceFiles: string[] = [];
  let confidence: Record<string, number> = {};
  try { sourceFiles = JSON.parse(record.sourceFiles) as string[]; } catch {}
  try { confidence = JSON.parse(record.confidenceJson) as Record<string, number>; } catch {}
  return { ...record, sourceFiles, confidence, confidenceJson: undefined };
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    const records = await getDb()
      .select()
      .from(processEnrichments)
      .orderBy(desc(processEnrichments.updatedAt));
    return Response.json({ enrichments: records.map(serialize) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível carregar os dados extraídos." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureDashboardSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const processId = await validProcessId(payload.processId);
    if (!processId) return Response.json({ error: "Processo inválido." }, { status: 400 });

    const values = {
      propertyRegistration: text(payload.propertyRegistration, 60),
      lot: text(payload.lot, 100),
      block: text(payload.block, 100),
      neighborhood: text(payload.neighborhood, 180),
      applicant: text(payload.applicant, 240),
      address: text(payload.address, 300),
      postalCode: text(payload.postalCode, 20),
      request: text(payload.request, 1000),
      category: text(payload.category, 200),
      actionType: text(payload.actionType, 200),
      sourceFiles: JSON.stringify(stringArray(payload.sourceFiles)),
      confidenceJson: JSON.stringify(confidence(payload.confidence)),
      analyzedAt: new Date().toISOString(),
      updatedBy: getRequestUser(request),
    };
    const [record] = await getDb()
      .insert(processEnrichments)
      .values({ processId, ...values })
      .onConflictDoUpdate({
        target: processEnrichments.processId,
        set: { ...values, updatedAt: sql`CURRENT_TIMESTAMP` },
      })
      .returning();
    return Response.json({ enrichment: serialize(record) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível integrar os dados ao processo." }, { status: 500 });
  }
}
