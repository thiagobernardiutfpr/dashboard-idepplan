import { and, desc, eq } from "drizzle-orm";
import { ensureDashboardSchema, getDb, getR2Binding } from "@/db";
import { itemAttachments } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import type { ItemModule } from "@/lib/dashboard-types";

export const dynamic = "force-dynamic";
const MODULES: ItemModule[] = ["processes", "projects", "procurements", "agenda", "geoprocessing", "empresa-facil", "consultation", "festivals", "staff-demands", "master-plan", "councils", "pai"];
const MAX_SIZE = 25 * 1024 * 1024;
function valid(itemModule: string): itemModule is ItemModule { return MODULES.includes(itemModule as ItemModule); }
function safeName(value: string) { return value.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-").slice(0, 180) || "arquivo"; }

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const itemModule = url.searchParams.get("module") ?? ""; const itemId = url.searchParams.get("itemId") ?? "";
    if (!valid(itemModule) || !itemId) return Response.json({ error: "Item inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const attachments = await getDb().select({ id:itemAttachments.id, module:itemAttachments.module, itemId:itemAttachments.itemId, fileName:itemAttachments.fileName, contentType:itemAttachments.contentType, fileSize:itemAttachments.fileSize, uploadedBy:itemAttachments.uploadedBy, createdAt:itemAttachments.createdAt }).from(itemAttachments).where(and(eq(itemAttachments.module, itemModule), eq(itemAttachments.itemId, itemId))).orderBy(desc(itemAttachments.createdAt));
    return Response.json({ attachments });
  } catch (error) { console.error(error); return Response.json({ error: "Não foi possível carregar os anexos." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const file = form.get("file"); const itemModule = String(form.get("module") ?? ""); const itemId = String(form.get("itemId") ?? "").trim().slice(0,240);
    if (!valid(itemModule) || !itemId || !(file instanceof File)) return Response.json({ error: "Arquivo ou item inválido." }, { status: 400 });
    if (!file.size || file.size > MAX_SIZE) return Response.json({ error: "O arquivo deve ter até 25 MB." }, { status: 400 });
    await ensureDashboardSchema();
    const id = crypto.randomUUID(); const fileName = safeName(file.name); const key = `attachments/${itemModule}/${encodeURIComponent(itemId)}/${id}-${fileName}`; const contentType = file.type || "application/octet-stream";
    await getR2Binding().put(key, await file.arrayBuffer(), { httpMetadata: { contentType } });
    const [attachment] = await getDb().insert(itemAttachments).values({ id, module:itemModule, itemId, fileName, contentType, fileSize:file.size, r2Key:key, uploadedBy:getRequestUser(request) }).returning();
    return Response.json({ attachment: { ...attachment, r2Key: undefined } }, { status: 201 });
  } catch (error) { console.error(error); return Response.json({ error: "Não foi possível anexar o arquivo." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json() as { id?: unknown }; if (typeof id !== "string" || !id) return Response.json({ error: "Anexo inválido." }, { status: 400 });
    await ensureDashboardSchema(); const db = getDb(); const [record] = await db.select().from(itemAttachments).where(eq(itemAttachments.id,id));
    if (!record) return Response.json({ error: "Anexo não encontrado." }, { status: 404 });
    await getR2Binding().delete(record.r2Key); await db.delete(itemAttachments).where(eq(itemAttachments.id,id)); return Response.json({ ok:true });
  } catch (error) { console.error(error); return Response.json({ error: "Não foi possível excluir o anexo." }, { status: 500 }); }
}
