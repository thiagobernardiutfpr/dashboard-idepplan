import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("cada processo oferece anexos e integração revisável dos dados extraídos", async () => {
  const dashboard = await source("components/dashboard.tsx");
  const analyzer = await source("components/process-document-analyzer.tsx");
  const route = await source("app/api/process-enrichments/route.ts");
  const schema = await source("db/schema.ts");
  assert.match(dashboard, /label="Anexar arquivos"/);
  assert.match(dashboard, /<ProcessDocumentAnalyzer/);
  assert.match(analyzer, /Enviar dados/);
  assert.match(analyzer, /Integrar ao processo/);
  for (const field of ["propertyRegistration", "lot", "block", "neighborhood", "applicant", "address", "postalCode", "request"]) {
    assert.match(analyzer, new RegExp(field));
    assert.match(route, new RegExp(field));
  }
  assert.match(schema, /process_enrichments/);
});

test("categorias equivalentes são consolidadas antes dos gráficos e filtros", async () => {
  const normalizer = await source("lib/process-category-normalization.ts");
  const dashboard = await source("components/dashboard.tsx");
  assert.match(normalizer, /CERTIDAO/);
  assert.match(normalizer, /USO/);
  assert.match(normalizer, /OCUPACAO/);
  assert.match(normalizer, /Certidão de Uso e Ocupação do Solo/);
  assert.match(normalizer, /replace\(\/\^\(\?:\(\?:\\d/);
  assert.match(dashboard, /map\(normalizeProcessClassification\)/);
});

test("painel TV alterna entre pizza, rosca, barras e linhas", async () => {
  const panel = await source("components/tv-process-panel.tsx");
  for (const mode of ["pie", "donut", "bar", "line"]) assert.match(panel, new RegExp(`chartMode === "${mode}"|HERO_GRAPHIC_MODES.*"${mode}"`));
  assert.match(panel, /tv-bar-chart/);
  assert.match(panel, /tv-line-chart/);
  assert.match(panel, /tv-donut-chart/);
  assert.match(panel, /Hero 30s/);
  assert.match(panel, /setInterval/);
  assert.match(panel, /30_000/);
});
