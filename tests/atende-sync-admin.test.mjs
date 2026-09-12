import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("proxy libera somente GET e POST da rota servidor-servidor do Atende", async () => {
  const proxy = await source("proxy.ts");
  assert.match(proxy, /\/api\/integrations\/atende\/processes/);
  assert.match(proxy, /ATENDE_MACHINE_PATHS/);
  assert.match(proxy, /request\.method === "GET"/);
  assert.match(proxy, /request\.method === "POST"/);
  assert.match(proxy, /isAtendeMachineRequest/);
});

test("admin do Atende gera e revoga token armazenando somente hash", async () => {
  const route = await source("app/api/integrations/atende/admin/route.ts");
  const sync = await source("lib/atende-sync-server.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /export async function DELETE/);
  assert.match(route, /x-idepplan-user/);
  assert.match(sync, /atende_sync_credentials/);
  assert.match(sync, /token_hash/);
  assert.match(sync, /generateAtendeSyncToken/);
  assert.match(sync, /revokeAtendeSyncToken/);
  assert.doesNotMatch(sync, /token_plaintext/);
});

test("rota máquina-a-máquina aceita token D1 além do fallback de ambiente", async () => {
  const route = await source("app/api/integrations/atende/processes/route.ts");
  const sync = await source("lib/atende-sync-server.ts");
  assert.match(route, /verifyAtendeSyncToken/);
  assert.match(sync, /ATENDE_SYNC_TOKEN/);
});

test("dashboard possui página protegida de Integração Atende.Net", async () => {
  const page = await source("app/integracoes/atende/page.tsx");
  const panel = await source("components/atende-sync-panel.tsx");
  assert.match(page, /AtendeSyncPanel/);
  assert.match(page, /Integração Atende.Net/);
  assert.match(panel, /Gerar nova chave/);
  assert.match(panel, /Revogar chave/);
  assert.match(panel, /Última sincronização/);
  assert.match(panel, /Novos/);
  assert.match(panel, /Atualizados/);
  assert.match(panel, /Sem alteração/);
});

test("página principal oferece acesso visível à Integração Atende.Net", async () => {
  const home = await source("app/page.tsx");
  assert.match(home, /href="\/integracoes\/atende"/);
  assert.match(home, /Integração Atende\.Net/);
});
