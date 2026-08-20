import { and, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { itemStates } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import type { ItemModule } from "@/lib/dashboard-types";

export const dynamic = "force-dynamic";
const MODULES: ItemModule[] = ["processes", "projects", "procurements", "agenda", "geoprocessing", "empresa-facil", "consultation", "festivals", "staff-demands", "master-plan", "councils", "pai"];

export async function GET() {
  try { await ensureDashboardSchema(); return Response.json({ states: await getDb().select().from(itemStates) }); }
  catch (error) { console.error(error); return Response.json({ error: "Não foi possível carregar o estado dos itens." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const itemModule = typeof body.module === "string" ? body.module as ItemModule : "" as ItemModule;
    const itemId = typeof body.itemId === "string" ? body.itemId.trim().slice(0, 240) : "";
    if (!MODULES.includes(itemModule) || !itemId) return Response.json({ error: "Item inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const [state] = await getDb().insert(itemStates).values({ module:itemModule, itemId, completed: Boolean(body.completed), removed: Boolean(body.removed), updatedBy: getRequestUser(request) }).onConflictDoUpdate({ target: [itemStates.module, itemStates.itemId], set: { completed: Boolean(body.completed), removed: Boolean(body.removed), updatedBy: getRequestUser(request), updatedAt: sql`CURRENT_TIMESTAMP` } }).returning();
    return Response.json({ state });
  } catch (error) { console.error(error); return Response.json({ error: "Não foi possível atualizar o item." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const itemModule = typeof body.module === "string" ? body.module as ItemModule : "" as ItemModule;
    const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
    if (!MODULES.includes(itemModule) || !itemId) return Response.json({ error: "Item inválido." }, { status: 400 });
    await ensureDashboardSchema();
    await getDb().delete(itemStates).where(and(eq(itemStates.module, itemModule), eq(itemStates.itemId, itemId)));
    return Response.json({ ok: true });
  } catch (error) { console.error(error); return Response.json({ error: "Não foi possível restaurar o item." }, { status: 500 }); }
}
