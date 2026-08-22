import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("anexos grandes usam multipart de 5 MB e permanecem como um arquivo", async () => {
  const client = await source("lib/api-client.ts");
  const route = await source("app/api/attachments/multipart/route.ts");
  const schema = await source("db/schema.ts");
  assert.match(client, /ATTACHMENT_CHUNK_SIZE = 5 \* 1024 \* 1024/);
  assert.match(client, /MAX_ATTACHMENT_SIZE = 500 \* 1024 \* 1024/);
  assert.match(client, /uploadInParts/);
  assert.match(client, /fetchWithRetry/);
  assert.match(route, /createMultipartUpload/);
  assert.match(route, /uploadPart/);
  assert.match(route, /\.complete\(parts\)/);
  assert.match(route, /insert\(itemAttachments\)/);
  assert.match(schema, /multipart_attachment_uploads/);
});

test("todas as telas recebem uma resposta JSON legível quando ocorre HTTP 413", async () => {
  const layout = await source("app/layout.tsx");
  const client = await source("lib/api-client.ts");
  assert.match(layout, /response\.status !== 413/);
  assert.match(layout, /application\/json; charset=utf-8/);
  assert.match(client, /payload too large/i);
  assert.match(client, /readApiJson/);
});

test("anexos comuns e importação de relatórios usam o fluxo protegido", async () => {
  const lifecycle = await source("components/item-lifecycle.tsx");
  const reports = await source("components/report-import-modal.tsx");
  assert.match(lifecycle, /uploadAttachment/);
  assert.match(lifecycle, /multiple/);
  assert.match(lifecycle, /Array\.from\(selectedFiles\)/);
  assert.match(lifecycle, /for \(const \[index, file\] of queue\.entries\(\)\)/);
  assert.match(lifecycle, /failures\.push/);
  assert.match(lifecycle, /Arquivo \$\{batchStatus\.current\} de \$\{batchStatus\.total\}/);
  assert.match(reports, /uploadAttachment/);
  assert.doesNotMatch(reports, /attachmentResponse\.json\(\)/);
});
