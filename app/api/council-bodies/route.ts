import { and, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import {
  councilBodies,
  councilMeetings,
  councilMembers,
  councilRequests,
  workspaceAgendaItems,
} from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import { isResponsibleName } from "@/lib/responsibles";

export const dynamic = "force-dynamic";

const TYPES = ["Conselho", "Comissão", "Comitê", "Grupo de Trabalho"] as const;
const STATUSES = ["Ativo", "Em renovação", "Inativo"] as const;
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const date = (value: unknown) =>
  /^\d{4}-\d{2}-\d{2}$/.test(text(value, 10)) ? text(value, 10) : "";

function validate(payload: Record<string, unknown>) {
  const value = {
    name: text(payload.name, 220),
    acronym: text(payload.acronym, 30),
    bodyType: text(payload.bodyType, 40) as (typeof TYPES)[number],
    legalAct: text(payload.legalAct, 300),
    purpose: text(payload.purpose, 3000),
    responsible: text(payload.responsible, 120),
    president: text(payload.president, 160),
    secretary: text(payload.secretary, 160),
    termStart: date(payload.termStart),
    termEnd: date(payload.termEnd),
    status: text(payload.status, 30) as (typeof STATUSES)[number],
    members: text(payload.members, 6000),
    notes: text(payload.notes, 3000),
  };
  if (
    !value.name ||
    !TYPES.includes(value.bodyType) ||
    !isResponsibleName(value.responsible)
  )
    return null;
  if (
    !value.termStart ||
    !value.termEnd ||
    value.termEnd < value.termStart ||
    !STATUSES.includes(value.status)
  )
    return null;
  return value;
}

function failure(error: unknown) {
  console.error("Council bodies API error", error);
  return Response.json(
    { error: "Não foi possível acessar os conselhos e comissões." },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    return Response.json({
      bodies: await getDb()
        .select()
        .from(councilBodies)
        .orderBy(desc(councilBodies.updatedAt)),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const value = validate((await request.json()) as Record<string, unknown>);
    if (!value)
      return Response.json(
        { error: "Revise os campos obrigatórios e a vigência do colegiado." },
        { status: 400 },
      );
    await ensureDashboardSchema();
    const editor = getRequestUser(request);
    const [body] = await getDb()
      .insert(councilBodies)
      .values({
        id: crypto.randomUUID(),
        ...value,
        createdBy: editor,
        updatedBy: editor,
      })
      .returning();
    return Response.json({ body }, { status: 201 });
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
        { error: "Revise os campos obrigatórios e a vigência do colegiado." },
        { status: 400 },
      );
    await ensureDashboardSchema();
    const [body] = await getDb()
      .update(councilBodies)
      .set({
        ...value,
        updatedBy: getRequestUser(request),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(councilBodies.id, id))
      .returning();
    return body
      ? Response.json({ body })
      : Response.json({ error: "Colegiado não encontrado." }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: unknown };
    if (typeof id !== "string" || !id.trim())
      return Response.json({ error: "Colegiado inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const db = getDb();
    await db
      .delete(councilMeetings)
      .where(eq(councilMeetings.bodyId, id.trim()));
    await db.delete(councilMembers).where(eq(councilMembers.bodyId, id.trim()));
    await db
      .delete(councilRequests)
      .where(eq(councilRequests.bodyId, id.trim()));
    await db
      .delete(workspaceAgendaItems)
      .where(
        and(
          eq(workspaceAgendaItems.contextType, "council"),
          eq(workspaceAgendaItems.contextId, id.trim()),
        ),
      );
    const [body] = await db
      .delete(councilBodies)
      .where(eq(councilBodies.id, id.trim()))
      .returning();
    return body
      ? Response.json({ body })
      : Response.json({ error: "Colegiado não encontrado." }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}
