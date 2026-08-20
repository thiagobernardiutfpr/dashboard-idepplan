import { asc, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { councilBodies, councilMeetings } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import { isResponsibleName } from "@/lib/responsibles";

export const dynamic = "force-dynamic";

const STATUSES = ["Agendada", "Realizada", "Cancelada"] as const;
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

function validate(payload: Record<string, unknown>) {
  const value = {
    bodyId: text(payload.bodyId, 160), title: text(payload.title, 220), meetingDate: text(payload.meetingDate, 30),
    location: text(payload.location, 300), agenda: text(payload.agenda, 4000), participants: text(payload.participants, 5000),
    quorum: text(payload.quorum, 300), deliberations: text(payload.deliberations, 6000),
    status: text(payload.status, 30) as (typeof STATUSES)[number], responsible: text(payload.responsible, 120),
  };
  const parsedDate = new Date(value.meetingDate);
  if (!value.bodyId || !value.title || Number.isNaN(parsedDate.getTime()) || !STATUSES.includes(value.status) || !isResponsibleName(value.responsible)) return null;
  return value;
}

function failure(error: unknown) {
  console.error("Council meetings API error", error);
  return Response.json({ error: "Não foi possível acessar as reuniões dos colegiados." }, { status: 500 });
}

export async function GET() {
  try { await ensureDashboardSchema(); return Response.json({ meetings: await getDb().select().from(councilMeetings).orderBy(asc(councilMeetings.meetingDate), desc(councilMeetings.updatedAt)) }); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const value = validate(await request.json() as Record<string, unknown>);
    if (!value) return Response.json({ error: "Revise o colegiado, a data, o responsável e os campos obrigatórios." }, { status: 400 });
    await ensureDashboardSchema(); const db = getDb();
    const [body] = await db.select({ id: councilBodies.id }).from(councilBodies).where(eq(councilBodies.id, value.bodyId));
    if (!body) return Response.json({ error: "O colegiado selecionado não existe." }, { status: 400 });
    const editor = getRequestUser(request);
    const [meeting] = await db.insert(councilMeetings).values({ id: crypto.randomUUID(), ...value, createdBy: editor, updatedBy: editor }).returning();
    return Response.json({ meeting }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>; const id = text(payload.id, 160); const value = validate(payload);
    if (!id || !value) return Response.json({ error: "Revise o colegiado, a data, o responsável e os campos obrigatórios." }, { status: 400 });
    await ensureDashboardSchema();
    const [meeting] = await getDb().update(councilMeetings).set({ ...value, updatedBy: getRequestUser(request), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(councilMeetings.id, id)).returning();
    return meeting ? Response.json({ meeting }) : Response.json({ error: "Reunião não encontrada." }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown };
    if (typeof id !== "string" || !id.trim()) return Response.json({ error: "Reunião inválida." }, { status: 400 });
    await ensureDashboardSchema();
    const [meeting] = await getDb().delete(councilMeetings).where(eq(councilMeetings.id, id.trim())).returning();
    return meeting ? Response.json({ meeting }) : Response.json({ error: "Reunião não encontrada." }, { status: 404 });
  } catch (error) { return failure(error); }
}
