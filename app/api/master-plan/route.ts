import { desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { masterPlanItems } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import { isResponsibleName } from "@/lib/responsibles";

export const dynamic = "force-dynamic";

const STATUSES = ["Não iniciado", "Em andamento", "Em validação", "Concluído"] as const;
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const date = (value: unknown) => {
  const result = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : "";
};

function validate(payload: Record<string, unknown>) {
  const progress = Math.round(Number(payload.progress));
  const value = {
    title: text(payload.title, 220),
    phase: text(payload.phase, 100),
    itemType: text(payload.itemType, 80),
    description: text(payload.description, 3000),
    startDate: date(payload.startDate),
    dueDate: date(payload.dueDate),
    status: text(payload.status, 30) as (typeof STATUSES)[number],
    progress,
    responsible: text(payload.responsible, 120),
    stakeholders: text(payload.stakeholders, 2000),
    legalReference: text(payload.legalReference, 500),
    notes: text(payload.notes, 3000),
  };
  if (!value.title || !value.phase || !value.itemType || !value.startDate || !value.dueDate) return null;
  if (value.dueDate < value.startDate || !STATUSES.includes(value.status)) return null;
  if (!Number.isFinite(progress) || progress < 0 || progress > 100 || !isResponsibleName(value.responsible)) return null;
  return value;
}

function failure(error: unknown) {
  console.error("Master plan API error", error);
  return Response.json({ error: "Não foi possível acessar a revisão do Plano Diretor." }, { status: 500 });
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    const items = await getDb().select().from(masterPlanItems).orderBy(desc(masterPlanItems.dueDate), desc(masterPlanItems.updatedAt));
    return Response.json({ items });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const value = validate(await request.json() as Record<string, unknown>);
    if (!value) return Response.json({ error: "Revise os campos obrigatórios, as datas e o progresso da etapa." }, { status: 400 });
    await ensureDashboardSchema();
    const editor = getRequestUser(request);
    const [item] = await getDb().insert(masterPlanItems).values({ id: crypto.randomUUID(), ...value, createdBy: editor, updatedBy: editor }).returning();
    return Response.json({ item }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = text(payload.id, 160);
    const value = validate(payload);
    if (!id || !value) return Response.json({ error: "Revise os campos obrigatórios, as datas e o progresso da etapa." }, { status: 400 });
    await ensureDashboardSchema();
    const [item] = await getDb().update(masterPlanItems).set({ ...value, updatedBy: getRequestUser(request), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(masterPlanItems.id, id)).returning();
    return item ? Response.json({ item }) : Response.json({ error: "Etapa não encontrada." }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !id.trim()) return Response.json({ error: "Etapa inválida." }, { status: 400 });
    await ensureDashboardSchema();
    const [item] = await getDb().delete(masterPlanItems).where(eq(masterPlanItems.id, id.trim())).returning();
    return item ? Response.json({ item }) : Response.json({ error: "Etapa não encontrada." }, { status: 404 });
  } catch (error) { return failure(error); }
}
