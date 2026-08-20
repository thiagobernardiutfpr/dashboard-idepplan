import { eq } from "drizzle-orm";
import { ensureDashboardSchema, getDb, getR2Binding } from "@/db";
import { itemAttachments } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params; await ensureDashboardSchema(); const [record] = await getDb().select().from(itemAttachments).where(eq(itemAttachments.id,id));
    if (!record) return new Response("Anexo não encontrado.",{status:404}); const object = await getR2Binding().get(record.r2Key); if (!object) return new Response("Arquivo não encontrado.",{status:404});
    const inline = record.contentType === "application/pdf" || record.contentType.startsWith("image/") || record.contentType.startsWith("audio/");
    return new Response(object.body,{headers:{"content-type":record.contentType,"content-length":String(record.fileSize),"content-disposition":`${inline?"inline":"attachment"}; filename*=UTF-8''${encodeURIComponent(record.fileName)}`,"cache-control":"private, max-age=60"}});
  } catch (error) { console.error(error); return new Response("Não foi possível abrir o arquivo.",{status:500}); }
}
