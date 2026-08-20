import { and, asc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { councilBodies, workspaceAgendaItems } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import { isResponsibleName, RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

export const dynamic = "force-dynamic";

const CONTEXTS = ["council", "master-plan"] as const;
const TYPES = ["Compromisso", "Reunião"] as const;
const STATUSES = ["Agendado", "Realizado", "Cancelado"] as const;
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function validate(payload: Record<string, unknown>) {
  const contextType = text(
    payload.contextType,
    40,
  ) as (typeof CONTEXTS)[number];
  const participants = Array.isArray(payload.participants)
    ? [
        ...new Set(
          payload.participants.filter(
            (entry): entry is string =>
              typeof entry === "string" &&
              RESPONSIBLE_OPTIONS.some((name) => name === entry),
          ),
        ),
      ].slice(0, 20)
    : [];
  const value = {
    contextType,
    contextId: text(payload.contextId, 160),
    title: text(payload.title, 220),
    type: text(payload.type, 30) as (typeof TYPES)[number],
    startsAt: text(payload.startsAt, 30),
    endsAt: text(payload.endsAt, 30) || null,
    location: text(payload.location, 300),
    participants: JSON.stringify(participants),
    responsible: text(payload.responsible, 120),
    status: text(payload.status, 30) as (typeof STATUSES)[number],
    notes: text(payload.notes, 5000),
  };
  const start = new Date(value.startsAt);
  const end = value.endsAt ? new Date(value.endsAt) : null;
  if (
    !CONTEXTS.includes(value.contextType) ||
    !value.contextId ||
    !value.title ||
    !TYPES.includes(value.type) ||
    Number.isNaN(start.getTime())
  )
    return null;
  if (end && (Number.isNaN(end.getTime()) || end < start)) return null;
  if (!STATUSES.includes(value.status) || !isResponsibleName(value.responsible))
    return null;
  if (
    value.contextType === "master-plan" &&
    value.contextId !== "revisao-plano-diretor"
  )
    return null;
  return value;
}

const failure = (error: unknown) => {
  console.error("Workspace agenda API error", error);
  return Response.json(
    { error: "Não foi possível acessar esta agenda." },
    { status: 500 },
  );
};

async function validateCouncil(contextType: string, contextId: string) {
  if (contextType !== "council") return true;
  const [body] = await getDb()
    .select({ id: councilBodies.id })
    .from(councilBodies)
    .where(eq(councilBodies.id, contextId));
  return Boolean(body);
}

export async function GET(request: Request) {
  try {
    await ensureDashboardSchema();
    const search = new URL(request.url).searchParams;
    const contextType = text(search.get("contextType"), 40);
    const contextId = text(search.get("contextId"), 160);
    if (!CONTEXTS.includes(contextType as never) || !contextId)
      return Response.json({ error: "Agenda inválida." }, { status: 400 });
    const items = await getDb()
      .select()
      .from(workspaceAgendaItems)
      .where(
        and(
          eq(workspaceAgendaItems.contextType, contextType),
          eq(workspaceAgendaItems.contextId, contextId),
        ),
      )
      .orderBy(asc(workspaceAgendaItems.startsAt));
    return Response.json({ items });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const value = validate((await request.json()) as Record<string, unknown>);
    if (!value)
      return Response.json(
        {
          error: "Revise o título, as datas, os participantes e o responsável.",
        },
        { status: 400 },
      );
    await ensureDashboardSchema();
    if (!(await validateCouncil(value.contextType, value.contextId)))
      return Response.json(
        { error: "O colegiado selecionado não existe." },
        { status: 400 },
      );
    const editor = getRequestUser(request);
    const [item] = await getDb()
      .insert(workspaceAgendaItems)
      .values({
        id: crypto.randomUUID(),
        ...value,
        createdBy: editor,
        updatedBy: editor,
      })
      .returning();
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = text(payload.id, 160);
    const value = validate(payload);
    if (!id || !value)
      return Response.json(
        {
          error: "Revise o título, as datas, os participantes e o responsável.",
        },
        { status: 400 },
      );
    await ensureDashboardSchema();
    const [item] = await getDb()
      .update(workspaceAgendaItems)
      .set({
        ...value,
        updatedBy: getRequestUser(request),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(workspaceAgendaItems.id, id),
          eq(workspaceAgendaItems.contextType, value.contextType),
          eq(workspaceAgendaItems.contextId, value.contextId),
        ),
      )
      .returning();
    return item
      ? Response.json({ item })
      : Response.json({ error: "Evento não encontrado." }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: unknown };
    if (typeof id !== "string" || !id.trim())
      return Response.json({ error: "Evento inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const [item] = await getDb()
      .delete(workspaceAgendaItems)
      .where(eq(workspaceAgendaItems.id, id.trim()))
      .returning();
    return item
      ? Response.json({ item })
      : Response.json({ error: "Evento não encontrado." }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}
