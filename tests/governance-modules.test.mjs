import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("o painel inclui os dois novos módulos de governança", async () => {
  const dashboard = await readFile(new URL("components/dashboard.tsx", root), "utf8");
  assert.match(dashboard, /Revisão do Plano Diretor/);
  assert.match(dashboard, /Conselhos e Comissões/);
  assert.match(dashboard, /<MasterPlanModule/);
  assert.match(dashboard, /<CouncilsModule/);
});

test("os módulos possuem persistência, seleção, anexos e conclusão", async () => {
  const plan = await readFile(new URL("components/master-plan-module.tsx", root), "utf8");
  const councils = await readFile(new URL("components/councils-module.tsx", root), "utf8");
  const schema = await readFile(new URL("db/schema.ts", root), "utf8");
  assert.match(plan, /SelectionIconButton/);
  assert.match(plan, /module="master-plan"/);
  assert.match(plan, /Concluído/);
  assert.match(councils, /SelectionIconButton/);
  assert.match(councils, /module="councils"/);
  assert.match(councils, /Deliberações/);
  assert.match(schema, /master_plan_items/);
  assert.match(schema, /council_bodies/);
  assert.match(schema, /council_meetings/);
});
