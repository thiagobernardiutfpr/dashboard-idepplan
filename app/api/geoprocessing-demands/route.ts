import { and, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { geoprocessingDemands, moduleAssignments } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : undefined;
}

function validate(payload: Record<string, unknown>) {
  const title = cleanText(payload.title, 400);
  const requester = cleanText(payload.requester, 220);
  const demandDate = cleanDate(payload.demandDate);
  const description = cleanText(payload.description, 2000);
  const completed = payload.completed === true;
  if (!title) return { error: "Informe a demanda de geoprocessamento." } as const;
  if (!requester) return { error: "Informe o demandante." } as const;
  if (!demandDate) return { error: "Informe uma data válida." } as const;
  return { value: { title, requester, demandDate, description, completed } } as const;
}

function apiError(error: unknown) {
  console.error("Geoprocessing demand API error", error);
  return Response.json({ error: "Não foi possível acessar as demandas de geoprocessamento." }, { status: 500 });
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    const records = await getDb().select().from(geoprocessingDemands).orderBy(desc(geoprocessingDemands.demandDate), desc(geoprocessingDemands.updatedAt));
    return Response.json({ demands: records });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = validate((await request.json()) as Record<string, unknown>);
    if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    await ensureDashboardSchema();
    const editor = getRequestUser(request);
    const [record] = await getDb().insert(geoprocessingDemands).values({
      id: crypto.randomUUID(),
      ...parsed.value,
      completedAt: parsed.value.completed ? new Date().toISOString() : null,
      createdBy: editor,
      updatedBy: editor,
    }).returning();
    return Response.json({ demand: record }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanText(payload.id, 160);
    if (!id) return Response.json({ error: "Demanda inválida." }, { status: 400 });
    const parsed = validate(payload);
    if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    await ensureDashboardSchema();
    const [record] = await getDb().update(geoprocessingDemands).set({
      ...parsed.value,
      completedAt: parsed.value.completed ? new Date().toISOString() : null,
      updatedBy: getRequestUser(request),
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(geoprocessingDemands.id, id)).returning();
    if (!record) return Response.json({ error: "Demanda não encontrada." }, { status: 404 });
    return Response.json({ demand: record });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: unknown };
    const id = cleanText(payload.id, 160);
    if (!id) return Response.json({ error: "Demanda inválida." }, { status: 400 });
    await ensureDashboardSchema();
    const db = getDb();
    const [record] = await db.delete(geoprocessingDemands).where(eq(geoprocessingDemands.id, id)).returning();
    if (!record) return Response.json({ error: "Demanda não encontrada." }, { status: 404 });
    await db.delete(moduleAssignments).where(and(eq(moduleAssignments.module, "geoprocessing"), eq(moduleAssignments.itemId, id)));
    return Response.json({ demand: record });
  } catch (error) { return apiError(error); }
}
