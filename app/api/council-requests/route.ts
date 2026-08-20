import { and, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { councilBodies, councilRequests } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import { isResponsibleName } from "@/lib/responsibles";

export const dynamic = "force-dynamic";

const STATUSES = ["Recebida", "Em análise", "Respondida", "Arquivada"] as const;
const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const date = (value: unknown, optional = false) => {
  const result = text(value, 10);
  return (!result && optional) || /^\d{4}-\d{2}-\d{2}$/.test(result)
    ? result
    : null;
};

function validate(payload: Record<string, unknown>) {
  const requestDate = date(payload.requestDate);
  const dueDate = date(payload.dueDate, true);
  const value = {
    bodyId: text(payload.bodyId, 160),
    title: text(payload.title, 220),
    requester: text(payload.requester, 180),
    requestDate: requestDate ?? "",
    dueDate: dueDate ?? "",
    status: text(payload.status, 30) as (typeof STATUSES)[number],
    responsible: text(payload.responsible, 120),
    description: text(payload.description, 6000),
    response: text(payload.response, 6000),
  };
  if (
    !value.bodyId ||
    !value.title ||
    requestDate === null ||
    dueDate === null ||
    !STATUSES.includes(value.status) ||
    !isResponsibleName(value.responsible)
  )
    return null;
  return value;
}

const failure = (error: unknown) => {
  console.error("Council requests API error", error);
  return Response.json(
    { error: "Não foi possível acessar as solicitações do colegiado." },
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
      requests: await getDb()
        .select()
        .from(councilRequests)
        .where(eq(councilRequests.bodyId, bodyId))
        .orderBy(
          desc(councilRequests.requestDate),
          desc(councilRequests.updatedAt),
        ),
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
        { error: "Revise o título, as datas, a situação e o responsável." },
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
    const [councilRequest] = await db
      .insert(councilRequests)
      .values({
        id: crypto.randomUUID(),
        ...value,
        createdBy: editor,
        updatedBy: editor,
      })
      .returning();
    return Response.json({ request: councilRequest }, { status: 201 });
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
        { error: "Revise o título, as datas, a situação e o responsável." },
        { status: 400 },
      );
    await ensureDashboardSchema();
    const [councilRequest] = await getDb()
      .update(councilRequests)
      .set({
        ...value,
        updatedBy: getRequestUser(request),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(councilRequests.id, id),
          eq(councilRequests.bodyId, value.bodyId),
        ),
      )
      .returning();
    return councilRequest
      ? Response.json({ request: councilRequest })
      : Response.json(
          { error: "Solicitação não encontrada." },
          { status: 404 },
        );
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: unknown };
    if (typeof id !== "string" || !id.trim())
      return Response.json({ error: "Solicitação inválida." }, { status: 400 });
    await ensureDashboardSchema();
    const [councilRequest] = await getDb()
      .delete(councilRequests)
      .where(eq(councilRequests.id, id.trim()))
      .returning();
    return councilRequest
      ? Response.json({ request: councilRequest })
      : Response.json(
          { error: "Solicitação não encontrada." },
          { status: 404 },
        );
  } catch (error) {
    return failure(error);
  }
}
