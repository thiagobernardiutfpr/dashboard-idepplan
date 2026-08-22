import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("a agenda disponibiliza calendário mensal navegável", async () => {
  const agenda = await source("components/agenda-module.tsx");
  assert.match(agenda, /Calendário de compromissos/);
  assert.match(agenda, /agenda-month-grid/);
  assert.match(agenda, /Array\.from\(\{ length: 42 \}/);
  assert.match(agenda, /setCalendarMonth/);
});

test("os mapas oferecem satélite, híbrido, camadas municipais e PNG", async () => {
  const controls = await source("components/map-view-controls.tsx");
  const processMap = await source("components/process-map.tsx");
  const projectMap = await source("components/project-map.tsx");
  const layers = await source("lib/municipal-map-layers.ts");
  const renderer = await source("lib/municipal-map-renderer.ts");
  assert.match(controls, /Satélite/);
  assert.match(controls, /Híbrido/);
  assert.match(controls, /map-download-button/);
  assert.match(processMap, /renderStaticMunicipalLayer/);
  assert.match(processMap, /renderVisibleObsoleteLots/);
  assert.match(processMap, /PNG gerado e enviado para downloads/);
  assert.match(projectMap, /renderStaticMunicipalLayer/);
  assert.match(projectMap, /renderVisibleObsoleteLots/);
  assert.match(projectMap, /PNG gerado e enviado para downloads/);
  for (const layer of ["app", "power-lines", "springs", "urban-perimeter", "rivers", "road-system", "landfill-buffer", "sewage-buffer", "zoning", "municipal-lots", "obsolete-lots"]) {
    assert.match(layers, new RegExp(`id: \"${layer}\"`));
  }
  assert.doesNotMatch(layers, /geometryAvailable: false/);
  assert.match(renderer, /obsolete-lots\/index\.json/);
  assert.match(renderer, /map\.getZoom\(\) < index\.minZoom/);
});

test("o módulo PAI tem navegação, API, persistência e gestão completa", async () => {
  const dashboard = await source("components/dashboard.tsx");
  const paiSource = await source("components/pai-module.tsx");
  const schema = await source("db/schema.ts");
  const api = await source("app/api/pai/route.ts");
  assert.match(dashboard, /Plano de Ação e Investimentos/);
  assert.match(dashboard, /<PaiModule/);
  assert.match(paiSource, /Nova ação/);
  assert.match(paiSource, /Investimento estimado/);
  assert.match(paiSource, /ItemFilesButton/);
  assert.match(schema, /paiItems/);
  assert.match(api, /export async function POST/);
  assert.match(api, /export async function DELETE/);
});

test("Plano Diretor recebe sugestões e conselhos recebem acervo completo", async () => {
  const masterPlan = await source("components/master-plan-module.tsx");
  const councils = await source("components/councils-module.tsx");
  const lifecycle = await source("components/item-lifecycle.tsx");
  assert.match(masterPlan, /Inserir sugestão/);
  assert.match(masterPlan, /Proponente ou entidade/);
  for (const label of ["Capa", "Ata", "Presença", "Áudio"]) {
    assert.match(councils, new RegExp(`label=\"${label}\"`));
  }
  assert.match(councils, /accept="audio\/\*/);
  assert.match(lifecycle, /<audio controls/);
});

test("o painel TV mostra seis gráficos ampliados e classifica os demais processos", async () => {
  const panel = await source("components/tv-process-panel.tsx");
  const types = await source("lib/process-public-types.ts");
  const styles = await source("app/globals.css");
  assert.match(panel, /Outros processos/);
  assert.match(panel, /OTHER_PROCESS_GROUPS/);
  assert.match(panel, /classifyOtherProcess/);
  assert.match(types, /Licenciamento e obras/);
  assert.match(types, /Consulta e zoneamento/);
  assert.match(styles, /\.tv-pie-chart/);
  assert.match(styles, /rotateX\(43deg\)/);
});
