import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("o botão Analisar EIV fica no editor antes de salvar coordenadas", async () => {
  const dashboard = await source("components/dashboard.tsx");
  const component = await source("components/eiv-analyzer.tsx");
  const analyzerPosition = dashboard.indexOf("<EivAnalyzer");
  const savePosition = dashboard.indexOf("Salvar coordenadas");
  assert.ok(analyzerPosition > 0 && analyzerPosition < savePosition);
  assert.match(component, /Analisar EIV/);
  assert.match(component, /Parecer técnico \+ Plano Diretor \+ Estatuto da Cidade/);
});

test("a análise recebe os sete formatos solicitados e trata anexos grandes", async () => {
  const component = await source("components/eiv-analyzer.tsx");
  for (const format of [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".dwg"]) assert.match(component, new RegExp(format.replace(".", "\\.")));
  assert.match(component, /leitura local/i);
  assert.match(component, /500 \* 1024 \* 1024/);
  assert.match(component, /extractSearchableText\(local\.file/);
  assert.doesNotMatch(component, /form\.set\("file", file\)/);
});

test("a matriz contempla o parecer, o Plano Diretor e o Estatuto da Cidade", async () => {
  const analysis = await source("lib/eiv-analysis.ts");
  for (const topic of [
    "Adensamento populacional",
    "Equipamentos urbanos e comunitários",
    "Uso e ocupação do solo",
    "Valorização e desvalorização imobiliária",
    "Mobilidade, tráfego e transporte público",
    "Ventilação, iluminação e insolação",
    "Paisagem urbana e patrimônio",
    "Matriz de impactos positivos e negativos",
    "Prevenção, recuperação, mitigação e compensação",
  ]) assert.match(analysis, new RegExp(topic));
  assert.match(analysis, /Lei nº 14\.849\/2024/);
  assert.match(analysis, /arts\. 66 a 103/i);
  assert.match(analysis, /arts\. 36 a 38/i);
});

test("o resultado é revisável, exportável e salvo na base compartilhada", async () => {
  const component = await source("components/eiv-analyzer.tsx");
  const api = await source("app/api/eiv-analyses/route.ts");
  const schema = await source("db/schema.ts");
  assert.match(component, /Baixar análise/);
  assert.match(component, /Evidência localizada/);
  assert.match(component, /api\/eiv-analyses/);
  assert.match(api, /onConflictDoUpdate/);
  assert.match(schema, /eiv_analyses/);
});
