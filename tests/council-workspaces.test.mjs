import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("cada colegiado abre um módulo próprio com capa, acervo e governança", async () => {
  const list = await source("components/councils-module.tsx");
  const workspace = await source("components/council-workspace.tsx");
  assert.match(list, /CouncilWorkspace/);
  assert.match(list, /Abrir módulo/);
  assert.match(workspace, /Inserir \/ alterar capa/);
  assert.match(workspace, /Atas e presença/);
  assert.match(workspace, /Membros/);
  assert.match(workspace, /Solicitações/);
  assert.match(workspace, /WorkspaceCalendar/);
  for (const attachment of ["minutes:", "attendance:", "audio:", "member:", "request:"]) assert.match(workspace, new RegExp(attachment));
});

test("membros, solicitações e agendas possuem persistência compartilhada", async () => {
  const schema = await source("db/schema.ts");
  const memberApi = await source("app/api/council-members/route.ts");
  const requestApi = await source("app/api/council-requests/route.ts");
  const agendaApi = await source("app/api/workspace-agenda/route.ts");
  for (const table of ["council_members", "council_requests", "workspace_agenda_items"]) assert.match(schema, new RegExp(table));
  for (const api of [memberApi, requestApi, agendaApi]) {
    assert.match(api, /export async function POST/);
    assert.match(api, /export async function PUT/);
    assert.match(api, /export async function DELETE/);
  }
});

test("Plano Diretor incorpora agenda mensal com 42 dias", async () => {
  const masterPlan = await source("components/master-plan-module.tsx");
  const calendar = await source("components/workspace-calendar.tsx");
  assert.match(masterPlan, /Agenda da Revisão do Plano Diretor/);
  assert.match(masterPlan, /contextType="master-plan"/);
  assert.match(calendar, /Array\.from\(\{ length: 42 \}/);
  assert.match(calendar, /Visão mensal compartilhada/);
});
