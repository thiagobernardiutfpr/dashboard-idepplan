import { asc, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { paiItems } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import { isResponsibleName } from "@/lib/responsibles";

export const dynamic = "force-dynamic";

const STATUSES = ["Planejado", "Em execução", "Em monitoramento", "Concluído"] as const;
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(text(value, 10)) ? text(value, 10) : "";

function validate(payload: Record<string, unknown>) {
  const rawValue = payload.estimatedValue;
  const estimatedValue = rawValue === "" || rawValue == null ? null : Number(rawValue);
  const value = {
    title: text(payload.title, 260),
    axis: text(payload.axis, 120),
    description: text(payload.description, 4000),
    startDate: date(payload.startDate),
    dueDate: date(payload.dueDate),
    status: text(payload.status, 40) as (typeof STATUSES)[number],
    progress: Math.max(0, Math.min(100, Math.round(Number(payload.progress) || 0))),
    estimatedValue,
    fundingSource: text(payload.fundingSource, 240),
    responsible: text(payload.responsible, 120),
    location: text(payload.location, 300),
    notes: text(payload.notes, 3000),
  };
  if (!value.title || !value.axis || !value.startDate || !value.dueDate || value.dueDate < value.startDate) return null;
  if (!STATUSES.includes(value.status) || !isResponsibleName(value.responsible)) return null;
  if (estimatedValue != null && (!Number.isFinite(estimatedValue) || estimatedValue < 0)) return null;
  return value;
}

function failure(error: unknown) {
  console.error("PAI API error", error);
  return Response.json({ error: "Não foi possível acessar o Plano de Ação e Investimentos." }, { status: 500 });
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    return Response.json({ items: await getDb().select().from(paiItems).orderBy(asc(paiItems.dueDate), desc(paiItems.updatedAt)) });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const value = validate(await request.json() as Record<string, unknown>);
    if (!value) return Response.json({ error: "Revise a ação, o eixo, o período e o responsável." }, { status: 400 });
    await ensureDashboardSchema();
    const editor = getRequestUser(request);
    const [item] = await getDb().insert(paiItems).values({ id: crypto.randomUUID(), ...value, createdBy: editor, updatedBy: editor }).returning();
    return Response.json({ item }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = text(payload.id, 160);
    const value = validate(payload);
    if (!id || !value) return Response.json({ error: "Revise a ação, o eixo, o período e o responsável." }, { status: 400 });
    await ensureDashboardSchema();
    const [item] = await getDb().update(paiItems).set({ ...value, updatedBy: getRequestUser(request), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(paiItems.id, id)).returning();
    return item ? Response.json({ item }) : Response.json({ error: "Ação não encontrada." }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !id.trim()) return Response.json({ error: "Ação inválida." }, { status: 400 });
    await ensureDashboardSchema();
    const [item] = await getDb().delete(paiItems).where(eq(paiItems.id, id.trim())).returning();
    return item ? Response.json({ item }) : Response.json({ error: "Ação não encontrada." }, { status: 404 });
  } catch (error) { return failure(error); }
}
