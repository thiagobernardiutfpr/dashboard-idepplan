import { and, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { manualProcesses, moduleAssignments, processCoordinates } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const AREAS = ["Urbanismo", "Abertura de empresa"] as const;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

function validate(payload: Record<string, unknown>) {
  const processNumber = cleanText(payload.processNumber, 100);
  const area = cleanText(payload.area, 40);
  const applicant = cleanText(payload.applicant, 220);
  const companyName = cleanText(payload.companyName, 220);
  const cnpj = cleanText(payload.cnpj, 30);
  const propertyRegistration = cleanText(payload.propertyRegistration, 40);
  const category = cleanText(payload.category, 180);
  const status = cleanText(payload.status, 100);
  const actionType = cleanText(payload.actionType, 180);
  const openedAt = cleanDate(payload.openedAt);
  const plannedCloseAt = cleanDate(payload.plannedCloseAt);
  const observation = cleanText(payload.observation, 2000);

  if (!processNumber) return { error: "Informe o número do processo." } as const;
  if (!AREAS.includes(area as (typeof AREAS)[number])) return { error: "Área inválida." } as const;
  if (!applicant) return { error: "Informe o requerente." } as const;
  if (!category) return { error: "Informe a categoria ou assunto." } as const;
  if (!status) return { error: "Informe a situação." } as const;
  if (openedAt === undefined || plannedCloseAt === undefined) return { error: "Informe datas válidas." } as const;

  return {
    value: {
      processNumber,
      area,
      applicant,
      companyName,
      cnpj,
      propertyRegistration,
      category,
      status,
      actionType,
      openedAt,
      plannedCloseAt,
      observation,
    },
  } as const;
}

function apiError(error: unknown) {
  console.error("Manual process API error", error);
  return Response.json({ error: "Não foi possível acessar os processos cadastrados." }, { status: 500 });
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    const records = await getDb().select().from(manualProcesses).orderBy(desc(manualProcesses.updatedAt));
    return Response.json({ processes: records });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = validate((await request.json()) as Record<string, unknown>);
    if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    await ensureDashboardSchema();
    const editor = getRequestUser(request);
    const [record] = await getDb()
      .insert(manualProcesses)
      .values({ id: crypto.randomUUID(), ...parsed.value, createdBy: editor, updatedBy: editor })
      .returning();
    return Response.json({ process: record }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanText(payload.id, 160);
    if (!id) return Response.json({ error: "Processo inválido." }, { status: 400 });
    const parsed = validate(payload);
    if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    await ensureDashboardSchema();
    const [record] = await getDb()
      .update(manualProcesses)
      .set({ ...parsed.value, updatedBy: getRequestUser(request), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(manualProcesses.id, id))
      .returning();
    if (!record) return Response.json({ error: "Processo não encontrado." }, { status: 404 });
    return Response.json({ process: record });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: unknown };
    const id = cleanText(payload.id, 160);
    if (!id) return Response.json({ error: "Processo inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const db = getDb();
    const [record] = await db.delete(manualProcesses).where(eq(manualProcesses.id, id)).returning();
    if (!record) return Response.json({ error: "Processo não encontrado." }, { status: 404 });
    await db.delete(processCoordinates).where(eq(processCoordinates.processId, id));
    await db.delete(moduleAssignments).where(and(eq(moduleAssignments.module, "processes"), eq(moduleAssignments.itemId, id)));
    return Response.json({ process: record });
  } catch (error) {
    return apiError(error);
  }
}
