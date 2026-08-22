import type { ItemAttachmentRecord, ItemModule } from "@/lib/dashboard-types";

export const ATTACHMENT_CHUNK_SIZE = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_SIZE = 500 * 1024 * 1024;
const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024;

type ApiPayload = { error?: string };
type UploadPart = { partNumber: number; etag: string };

function withContentType(headers: HeadersInit | undefined, contentType: string) {
  const result = new Headers(headers);
  result.set("content-type", contentType);
  return result;
}

export async function readApiJson<T extends ApiPayload>(
  response: Response,
): Promise<T> {
  const raw = await response.text();
  if (raw) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      if (response.status === 413 || /payload too large/i.test(raw)) {
        return {
          error:
            "O conteúdo excedeu o limite de uma única requisição. O envio automático em partes será utilizado quando disponível.",
        } as T;
      }
      return {
        error: response.ok
          ? "O servidor devolveu uma resposta inválida. Tente novamente."
          : `O servidor recusou a solicitação (HTTP ${response.status}).`,
      } as T;
    }
  }
  return {} as T;
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  attempts = 3,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || response.status < 500 || attempt === attempts)
        return response;
      lastError = new Error(`Falha temporária no servidor (HTTP ${response.status}).`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha no envio.");
}

async function uploadInParts({
  file,
  module,
  itemId,
  endpoint,
  headers,
  onProgress,
}: {
  file: File;
  module: ItemModule;
  itemId: string;
  endpoint: string;
  headers?: HeadersInit;
  onProgress?: (percentage: number) => void;
}) {
  const initResponse = await fetch(endpoint, {
    method: "POST",
    headers: withContentType(headers, "application/json"),
    body: JSON.stringify({
      module,
      itemId,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: file.size,
    }),
  });
  const initPayload = await readApiJson<{ id?: string; error?: string }>(
    initResponse,
  );
  if (!initResponse.ok || !initPayload.id)
    throw new Error(initPayload.error || "Não foi possível iniciar o upload.");

  const parts: UploadPart[] = [];
  try {
    const partCount = Math.ceil(file.size / ATTACHMENT_CHUNK_SIZE);
    for (let index = 0; index < partCount; index += 1) {
      const partNumber = index + 1;
      const start = index * ATTACHMENT_CHUNK_SIZE;
      const chunk = file.slice(start, start + ATTACHMENT_CHUNK_SIZE);
      const response = await fetchWithRetry(
        `${endpoint}?id=${encodeURIComponent(initPayload.id)}&part=${partNumber}`,
        {
          method: "PUT",
          headers: withContentType(headers, "application/octet-stream"),
          body: chunk,
        },
      );
      const payload = await readApiJson<{ etag?: string; error?: string }>(
        response,
      );
      if (!response.ok || !payload.etag)
        throw new Error(
          payload.error || `Não foi possível enviar a parte ${partNumber}.`,
        );
      parts.push({ partNumber, etag: payload.etag });
      onProgress?.(Math.round((partNumber / partCount) * 95));
    }

    const completeResponse = await fetch(endpoint, {
      method: "PATCH",
      headers: withContentType(headers, "application/json"),
      body: JSON.stringify({ id: initPayload.id, parts }),
    });
    const completePayload = await readApiJson<{
      attachment?: ItemAttachmentRecord;
      error?: string;
    }>(completeResponse);
    if (!completeResponse.ok || !completePayload.attachment)
      throw new Error(
        completePayload.error || "Não foi possível concluir o upload.",
      );
    onProgress?.(100);
    return completePayload.attachment;
  } catch (error) {
    void fetch(endpoint, {
      method: "DELETE",
      headers: withContentType(headers, "application/json"),
      body: JSON.stringify({ id: initPayload.id }),
    }).catch(() => {});
    throw error;
  }
}

export async function uploadAttachment({
  file,
  module,
  itemId,
  endpoint = "/api/attachments/multipart",
  directEndpoint = "/api/attachments",
  headers,
  onProgress,
}: {
  file: File;
  module: ItemModule;
  itemId: string;
  endpoint?: string;
  directEndpoint?: string;
  headers?: HeadersInit;
  onProgress?: (percentage: number) => void;
}) {
  if (!file.size) throw new Error("O arquivo selecionado está vazio.");
  if (file.size > MAX_ATTACHMENT_SIZE)
    throw new Error("O arquivo deve ter até 500 MB.");

  if (file.size <= DIRECT_UPLOAD_LIMIT) {
    const form = new FormData();
    form.set("module", module);
    form.set("itemId", itemId);
    form.set("file", file);
    const response = await fetch(directEndpoint, {
      method: "POST",
      headers,
      body: form,
    });
    const payload = await readApiJson<{
      attachment?: ItemAttachmentRecord;
      error?: string;
    }>(response);
    if (response.ok && payload.attachment) {
      onProgress?.(100);
      return payload.attachment;
    }
    if (response.status !== 413)
      throw new Error(payload.error || "Não foi possível enviar o arquivo.");
  }

  return uploadInParts({ file, module, itemId, endpoint, headers, onProgress });
}
