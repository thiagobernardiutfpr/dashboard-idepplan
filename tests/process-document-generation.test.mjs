import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const directory = (path) => readdir(new URL(`../${path}`, import.meta.url));

test("o editor oferece geração de documento e inclusão de zoneamento acima de salvar coordenadas", async () => {
  const dashboard = await source("components/dashboard.tsx");
  const generator = await source("components/process-document-generator.tsx");
  const generatorPosition = dashboard.indexOf("<ProcessDocumentGenerator");
  const savePosition = dashboard.indexOf("Salvar coordenadas");
  assert.ok(generatorPosition > 0 && generatorPosition < savePosition);
  assert.match(generator, /Gerar documento/);
  assert.match(generator, /Incluir zoneamento/);
  assert.match(generator, /Gerar e baixar Word/);
  assert.match(generator, /Revise nomes, números, conclusão técnica/);
});

test("os treze modelos fornecidos estão disponíveis sem os arquivos operacionais", async () => {
  const templates = (await directory("public/document-templates")).filter((name) => name.endsWith(".docx"));
  assert.equal(templates.length, 13);
  const registry = await source("lib/document-templates.ts");
  for (const template of templates) assert.match(registry, new RegExp(template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("as dezoito tabelas oficiais de zoneamento são anexáveis ao DOCX", async () => {
  const zoningFiles = (await directory("public/zoning-uses")).filter((name) => name.endsWith(".pdf"));
  assert.equal(zoningFiles.length, 18);
  const registry = await source("lib/document-templates.ts");
  const generator = await source("lib/docx-generator.ts");
  for (const zone of ["ZC1", "ZC28", "ZEA", "ZEIS", "ZI1", "ZI2", "ZOC", "ZR1", "ZR28", "ZRCH"]) {
    assert.match(registry, new RegExp(`${zone}:`));
  }
  assert.match(generator, /renderPdfPages/);
  assert.match(generator, /Uso e ocupação do solo/);
});

test("a leitura assistida aceita Word, imagens e DWG e o mapa expõe captura com camadas", async () => {
  const analysis = await source("lib/process-document-analysis.ts");
  const dashboard = await source("components/dashboard.tsx");
  const map = await source("components/process-map.tsx");
  for (const format of ["docx", "png", "jpe?g", "dwg"]) assert.match(analysis, new RegExp(format));
  assert.match(analysis, /createWorker/);
  assert.match(analysis, /Aplicando OCR/);
  assert.match(dashboard, /\.pdf,\.doc,\.docx,\.png,\.jpg,\.jpeg,\.dwg/);
  assert.match(map, /onCaptureApi/);
  assert.match(map, /html-to-image/);
  assert.match(dashboard, /mapCaptureRef/);
});
