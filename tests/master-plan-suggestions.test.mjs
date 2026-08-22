import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("a sugestão exige escolher a lei antes de revelar os campos opcionais", async () => {
  const source = await read("../components/master-plan-module.tsx");
  assert.match(source, /theme: ""/);
  assert.match(source, /Selecione a lei para continuar/);
  assert.match(source, /\{suggestion\.theme \? \(/);
  assert.match(source, /Título da sugestão \(opcional\)/);
  assert.match(source, /Artigo \(opcional\)/);
  assert.match(source, /Parágrafo \(opcional\)/);
  assert.match(source, /Alínea \(opcional\)/);
  assert.match(source, /Item \(opcional\)/);
  assert.match(source, /suggestion\.title\.trim\(\) \|\|/);
});

test("o dispositivo legal é persistido e validado de forma independente", async () => {
  const [schema, route, database] = await Promise.all([
    read("../db/schema.ts"),
    read("../app/api/master-plan/route.ts"),
    read("../db/index.ts"),
  ]);
  for (const field of ["legalArticle", "legalParagraph", "legalLetter", "legalItem"]) {
    assert.match(schema, new RegExp(field));
    assert.match(route, new RegExp(field));
  }
  for (const column of ["legal_article", "legal_paragraph", "legal_letter", "legal_item"])
    assert.match(database, new RegExp(column));
});
