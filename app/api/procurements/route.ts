import { and, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { moduleAssignments, procurements } from "@/db/schema";
import { validateProcurementInput } from "@/lib/procurement-options";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

function apiError(error: unknown) {
  console.error("Procurement API error", error);
  return Response.json(
    { error: "Não foi possível acessar o controle de licitações." },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    const records = await getDb()
      .select()
      .from(procurements)
      .orderBy(desc(procurements.updatedAt));
    return Response.json({ procurements: records });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = validateProcurementInput(payload);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    await ensureDashboardSchema();
    const editor = getRequestUser(request);
    const [record] = await getDb()
      .insert(procurements)
      .values({
        id: crypto.randomUUID(),
        ...parsed.value,
        createdBy: editor,
        updatedBy: editor,
      })
      .returning();

    return Response.json({ procurement: record }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = typeof payload.id === "string" ? payload.id.trim() : "";
    if (!id || id.length > 160) {
      return Response.json({ error: "Licitação inválida." }, { status: 400 });
    }
    const parsed = validateProcurementInput(payload);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    await ensureDashboardSchema();
    const [record] = await getDb()
      .update(procurements)
      .set({
        ...parsed.value,
        updatedBy: getRequestUser(request),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(procurements.id, id))
      .returning();

    if (!record) {
      return Response.json({ error: "Licitação não encontrada." }, { status: 404 });
    }
    return Response.json({ procurement: record });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: unknown };
    const id = typeof payload.id === "string" ? payload.id.trim() : "";
    if (!id || id.length > 160) {
      return Response.json({ error: "Licitação inválida." }, { status: 400 });
    }

    await ensureDashboardSchema();
    const db = getDb();
    const [record] = await db
      .delete(procurements)
      .where(eq(procurements.id, id))
      .returning();
    if (!record) {
      return Response.json({ error: "Licitação não encontrada." }, { status: 404 });
    }
    await db
      .delete(moduleAssignments)
      .where(
        and(
          eq(moduleAssignments.module, "procurements"),
          eq(moduleAssignments.itemId, id),
        ),
      );

    return Response.json({ procurement: record });
  } catch (error) {
    return apiError(error);
  }
}
