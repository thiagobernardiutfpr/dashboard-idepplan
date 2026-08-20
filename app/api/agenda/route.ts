import { and, asc, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { agendaItems, moduleAssignments } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import { isResponsibleName } from "@/lib/responsibles";

export const dynamic = "force-dynamic";

const TYPES = ["Compromisso", "Reunião"] as const;
const STATUSES = ["Agendado", "Realizado", "Cancelado"] as const;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDateTime(value: unknown, optional = false) {
  if (optional && (value == null || value === "")) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

function validate(payload: Record<string, unknown>) {
  const title = cleanText(payload.title, 300);
  const type = cleanText(payload.type, 30);
  const startsAt = cleanDateTime(payload.startsAt);
  const endsAt = cleanDateTime(payload.endsAt, true);
  const location = cleanText(payload.location, 220);
  const status = cleanText(payload.status, 30);
  const notes = cleanText(payload.notes, 2000);
  const participants = Array.isArray(payload.participants)
    ? [...new Set(payload.participants.filter(isResponsibleName))]
    : [];

  if (!title) return { error: "Informe o compromisso ou reunião." } as const;
  if (!TYPES.includes(type as (typeof TYPES)[number])) return { error: "Tipo de agenda inválido." } as const;
  if (startsAt === undefined || endsAt === undefined) return { error: "Informe data e horário válidos." } as const;
  if (endsAt && startsAt && endsAt < startsAt) return { error: "O encerramento não pode ocorrer antes do início." } as const;
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return { error: "Situação inválida." } as const;
  if (participants.length !== (Array.isArray(payload.participants) ? payload.participants.length : 0)) return { error: "Há participantes inválidos." } as const;

  return { value: { title, type, startsAt: startsAt!, endsAt, location, participants: JSON.stringify(participants), status, notes } } as const;
}

function toResponse(record: typeof agendaItems.$inferSelect) {
  let participants: string[] = [];
  try { participants = JSON.parse(record.participants) as string[]; } catch { participants = []; }
  return { ...record, participants };
}

function apiError(error: unknown) {
  console.error("Agenda API error", error);
  return Response.json({ error: "Não foi possível acessar a agenda compartilhada." }, { status: 500 });
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    const records = await getDb().select().from(agendaItems).orderBy(asc(agendaItems.startsAt), desc(agendaItems.updatedAt));
    return Response.json({ agenda: records.map(toResponse) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = validate((await request.json()) as Record<string, unknown>);
    if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    await ensureDashboardSchema();
    const editor = getRequestUser(request);
    const [record] = await getDb().insert(agendaItems).values({ id: crypto.randomUUID(), ...parsed.value, createdBy: editor, updatedBy: editor }).returning();
    return Response.json({ item: toResponse(record) }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanText(payload.id, 160);
    if (!id) return Response.json({ error: "Registro de agenda inválido." }, { status: 400 });
    const parsed = validate(payload);
    if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    await ensureDashboardSchema();
    const [record] = await getDb().update(agendaItems).set({ ...parsed.value, updatedBy: getRequestUser(request), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(agendaItems.id, id)).returning();
    if (!record) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
    return Response.json({ item: toResponse(record) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: unknown };
    const id = cleanText(payload.id, 160);
    if (!id) return Response.json({ error: "Registro de agenda inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const db = getDb();
    const [record] = await db.delete(agendaItems).where(eq(agendaItems.id, id)).returning();
    if (!record) return Response.json({ error: "Registro não encontrado." }, { status: 404 });
    await db.delete(moduleAssignments).where(and(eq(moduleAssignments.module, "agenda"), eq(moduleAssignments.itemId, id)));
    return Response.json({ item: toResponse(record) });
  } catch (error) { return apiError(error); }
}
