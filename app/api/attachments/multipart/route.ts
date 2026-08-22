import { eq } from "drizzle-orm";
import { ensureDashboardSchema, getDb, getR2Binding } from "@/db";
import { itemAttachments, multipartAttachmentUploads } from "@/db/schema";
import type { ItemModule } from "@/lib/dashboard-types";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const MODULES: ItemModule[] = ["processes", "projects", "procurements", "agenda", "geoprocessing", "empresa-facil", "consultation", "festivals", "staff-demands", "master-plan", "councils", "pai"];
const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_CHUNK_SIZE = CHUNK_SIZE + 64 * 1024;
const MAX_FILE_SIZE = 500 * 1024 * 1024;

const validModule = (value: string): value is ItemModule =>
  MODULES.includes(value as ItemModule);
const safeName = (value: string) =>
  value.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-").slice(0, 180) || "arquivo";
const clean = (value: unknown, max = 240) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const itemModule = clean(body.module);
    const itemId = clean(body.itemId);
    const fileName = safeName(clean(body.fileName, 180));
    const contentType = clean(body.contentType, 160) || "application/octet-stream";
    const fileSize = Number(body.fileSize);
    if (!validModule(itemModule) || !itemId || !fileName || !Number.isInteger(fileSize) || fileSize < 1 || fileSize > MAX_FILE_SIZE) {
      return Response.json({ error: "Arquivo ou item inválido. O limite é 500 MB." }, { status: 400 });
    }

    await ensureDashboardSchema();
    const id = crypto.randomUUID();
    const key = `attachments/${itemModule}/${encodeURIComponent(itemId)}/${id}-${fileName}`;
    const upload = await getR2Binding().createMultipartUpload(key, {
      httpMetadata: { contentType },
    });
    await getDb().insert(multipartAttachmentUploads).values({
      id,
      uploadId: upload.uploadId,
      module: itemModule,
      itemId,
      fileName,
      contentType,
      fileSize,
      r2Key: key,
      uploadedBy: getRequestUser(request),
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível iniciar o upload em partes." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const id = clean(url.searchParams.get("id"));
    const partNumber = Number(url.searchParams.get("part"));
    if (!id || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      return Response.json({ error: "Parte do arquivo inválida." }, { status: 400 });
    }
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_CHUNK_SIZE)
      return Response.json({ error: "A parte excede 5 MB." }, { status: 413 });

    await ensureDashboardSchema();
    const [record] = await getDb().select().from(multipartAttachmentUploads).where(eq(multipartAttachmentUploads.id, id));
    if (!record) return Response.json({ error: "Upload não encontrado ou expirado." }, { status: 404 });
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > MAX_CHUNK_SIZE)
      return Response.json({ error: "A parte excede 5 MB." }, { status: 413 });
    const expectedParts = Math.ceil(record.fileSize / CHUNK_SIZE);
    if (partNumber > expectedParts)
      return Response.json({ error: "Número da parte inválido." }, { status: 400 });

    const upload = getR2Binding().resumeMultipartUpload(record.r2Key, record.uploadId);
    const part = await upload.uploadPart(partNumber, bytes);
    return Response.json({ partNumber: part.partNumber, etag: part.etag });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível enviar esta parte do arquivo." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown; parts?: unknown };
    const id = clean(body.id);
    const parts = Array.isArray(body.parts)
      ? body.parts.flatMap((value) => {
          if (!value || typeof value !== "object") return [];
          const partNumber = Number((value as { partNumber?: unknown }).partNumber);
          const etag = clean((value as { etag?: unknown }).etag, 200);
          return Number.isInteger(partNumber) && partNumber > 0 && etag
            ? [{ partNumber, etag }]
            : [];
        })
      : [];
    if (!id || !parts.length)
      return Response.json({ error: "Conclusão do upload inválida." }, { status: 400 });

    await ensureDashboardSchema();
    const db = getDb();
    const [record] = await db.select().from(multipartAttachmentUploads).where(eq(multipartAttachmentUploads.id, id));
    if (!record) return Response.json({ error: "Upload não encontrado ou expirado." }, { status: 404 });
    const expectedParts = Math.ceil(record.fileSize / CHUNK_SIZE);
    if (parts.length !== expectedParts || parts.some((part, index) => part.partNumber !== index + 1)) {
      return Response.json({ error: "O arquivo ainda não foi enviado por completo." }, { status: 409 });
    }

    const upload = getR2Binding().resumeMultipartUpload(record.r2Key, record.uploadId);
    await upload.complete(parts);
    const [attachment] = await db.insert(itemAttachments).values({
      id: record.id,
      module: record.module,
      itemId: record.itemId,
      fileName: record.fileName,
      contentType: record.contentType,
      fileSize: record.fileSize,
      r2Key: record.r2Key,
      uploadedBy: record.uploadedBy,
    }).returning();
    await db.delete(multipartAttachmentUploads).where(eq(multipartAttachmentUploads.id, id));
    return Response.json({ attachment: { ...attachment, r2Key: undefined } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível concluir o upload." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown };
    const id = clean(body.id);
    if (!id) return Response.json({ error: "Upload inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const db = getDb();
    const [record] = await db.select().from(multipartAttachmentUploads).where(eq(multipartAttachmentUploads.id, id));
    if (!record) return Response.json({ ok: true });
    await getR2Binding().resumeMultipartUpload(record.r2Key, record.uploadId).abort();
    await db.delete(multipartAttachmentUploads).where(eq(multipartAttachmentUploads.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Não foi possível cancelar o upload." }, { status: 500 });
  }
}
