import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("integração Atende.Net expõe rota autenticada e registra histórico", async () => {
  const route = await source("app/api/integrations/atende/processes/route.ts");
  const sync = await source("lib/atende-sync-server.ts");
  const env = await source(".env.example");
  assert.match(route, /ATENDE_SYNC_TOKEN/);
  assert.match(route, /Bearer/);
  assert.match(route, /synchronizeAtendeProcesses/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function GET/);
  assert.match(sync, /CREATE TABLE IF NOT EXISTS atende_sync_runs/);
  assert.match(sync, /CREATE TABLE IF NOT EXISTS process_history/);
  assert.match(sync, /import-process-/);
  assert.match(sync, /ON CONFLICT\(id\) DO UPDATE/);
  assert.match(sync, /previous_status/);
  assert.match(env, /ATENDE_SYNC_TOKEN=/);
});

test("cliente Windows reconhece fluxo Atende e relatório vertical", async () => {
  const main = await source("tools/atende-sync/main.go");
  const parser = await source("tools/atende-sync/xlsx.go");
  assert.match(main, /processaDados/);
  assert.match(main, /impRelatorioFila/);
  assert.match(main, /getInformacoesDownload/);
  assert.match(main, /Upload\.idArquivo/);
  assert.match(parser, /processPattern/);
  assert.match(parser, /assunto:/);
  assert.match(parser, /subassunto:/);
  assert.match(parser, /observacao:/);
});
