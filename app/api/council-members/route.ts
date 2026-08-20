import { and, asc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { councilBodies, councilMembers } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const STATUSES = ["Ativo", "Inativo"] as const;
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function validate(payload: Record<string, unknown>) {
  const value = {
    bodyId: text(payload.bodyId, 160),
    name: text(payload.name, 180),
    role: text(payload.role, 160),
    entity: text(payload.entity, 220),
    phone: text(payload.phone, 80),
    email: text(payload.email, 220),
    requests: text(payload.requests, 5000),
    notes: text(payload.notes, 3000),
    status: text(payload.status, 20) as (typeof STATUSES)[number],
  };
  if (!value.bodyId || !value.name || !STATUSES.includes(value.status))
    return null;
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    return null;
  return value;
}

const failure = (error: unknown) => {
  console.error("Council members API error", error);
  return Response.json(
    { error: "Não foi possível acessar os membros do colegiado." },
    { status: 500 },
  );
};

export async function GET(request: Request) {
  try {
    await ensureDashboardSchema();
    const bodyId = text(new URL(request.url).searchParams.get("bodyId"), 160);
    if (!bodyId)
      return Response.json({ error: "Colegiado inválido." }, { status: 400 });
    return Response.json({
      members: await getDb()
        .select()
        .from(councilMembers)
        .where(eq(councilMembers.bodyId, bodyId))
        .orderBy(asc(councilMembers.name)),
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
        { error: "Revise o nome, o e-mail e os campos obrigatórios." },
        { status: 400 },
      );
    await ensureDashboardSchema();
    const db = getDb();
    const [body] = await db
      .select({ id: councilBodies.id })
      .from(councilBodies)
      .where(eq(councilBodies.id, value.bodyId));
    if (!body)
      return Response.json(
        { error: "O colegiado selecionado não existe." },
        { status: 400 },
      );
    const editor = getRequestUser(request);
    const [member] = await db
      .insert(councilMembers)
      .values({
        id: crypto.randomUUID(),
        ...value,
        createdBy: editor,
        updatedBy: editor,
      })
      .returning();
    return Response.json({ member }, { status: 201 });
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
        { error: "Revise o nome, o e-mail e os campos obrigatórios." },
        { status: 400 },
      );
    await ensureDashboardSchema();
    const [member] = await getDb()
      .update(councilMembers)
      .set({
        ...value,
        updatedBy: getRequestUser(request),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(eq(councilMembers.id, id), eq(councilMembers.bodyId, value.bodyId)),
      )
      .returning();
    return member
      ? Response.json({ member })
      : Response.json({ error: "Membro não encontrado." }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: unknown };
    if (typeof id !== "string" || !id.trim())
      return Response.json({ error: "Membro inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const [member] = await getDb()
      .delete(councilMembers)
      .where(eq(councilMembers.id, id.trim()))
      .returning();
    return member
      ? Response.json({ member })
      : Response.json({ error: "Membro não encontrado." }, { status: 404 });
  } catch (error) {
    return failure(error);
  }
}
