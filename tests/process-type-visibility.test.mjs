import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("tipos de processo podem ser ocultados sem excluir registros", async () => {
  const dashboard = await source("components/dashboard.tsx");
  const control = await source("components/process-type-visibility.tsx");
  assert.match(dashboard, /PROCESS_TYPE_VISIBILITY_STORAGE_KEY/);
  assert.match(dashboard, /processVisibilityMode === "default"/);
  assert.match(dashboard, /isDefaultActiveProcessType/);
  assert.match(dashboard, /activeHiddenProcessTypes\.has\(process\.category\)/);
  assert.match(dashboard, /const tvAllProcesses = useMemo/);
  assert.match(dashboard, /processes=\{tvAllProcesses\}/);
  assert.match(dashboard, /mappedProcesses=\{tvMappedProcesses\}/);
  assert.match(control, /Visibilidade nas estatísticas/);
  assert.match(control, /Mostrar todos/);
  assert.match(control, /Ocultar todos/);
  assert.match(control, /Restaurar padrão/);
  assert.doesNotMatch(control, /fetch\(/);
});

test("lista, mapa, indicadores e exportação usam a coleção visível", async () => {
  const dashboard = await source("components/dashboard.tsx");
  assert.match(dashboard, /return visibleProcesses\.filter/);
  assert.match(dashboard, /const mappedProcesses = useMemo/);
  assert.match(dashboard, /const rows = filteredProcesses\.map/);
  assert.match(dashboard, /tipo.*de processo oculto.*da lista, mapa e estatísticas/s);
});
