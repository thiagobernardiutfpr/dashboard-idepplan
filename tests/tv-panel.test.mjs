import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("o módulo de televisão reúne as cinco tipologias e os controles públicos", async () => {
  const dashboard = await readFile(new URL("components/dashboard.tsx", root), "utf8");
  const panel = await readFile(new URL("components/tv-process-panel.tsx", root), "utf8");
  const types = await readFile(new URL("lib/process-public-types.ts", root), "utf8");
  assert.match(dashboard, /Painel TV/);
  assert.match(dashboard, /60_000/);
  assert.match(dashboard, /loadEmpresaFacilProcesses/);
  assert.match(dashboard, /crossEmpresaFacilCoordinates/);
  assert.match(dashboard, /processes=\{tvAllProcesses\}/);
  assert.match(dashboard, /mapTotalProcesses=\{tvAllProcesses\.length\}/);
  assert.match(panel, /Todos os processos, em diferentes recortes/);
  assert.match(panel, /Processos por responsável/);
  assert.match(panel, /Processos por categoria/);
  assert.match(panel, /Processos por ação/);
  assert.match(panel, /Recebimentos por mês/);
  assert.match(panel, /Tempo desde o recebimento/);
  assert.match(panel, /requestFullscreen/);
  assert.match(panel, /Hero 30s/);
  assert.match(panel, /\[heroMode, setHeroMode\] = useState\(true\)/);
  assert.match(panel, /30_000/);
  assert.match(panel, /tv-hero-stage/);
  assert.match(panel, /tv-chart-animated/);
  assert.match(types, /Laudo de Viabilidade/);
  assert.match(types, /Certidão de Uso e Ocupação do Solo/);
  assert.match(types, /Estudo de Impacto de Vizinhança/);
  assert.match(types, /Diretriz de Loteamento/);
  assert.match(types, /PRP/);
});

test("o mapa público usa imagem híbrida e intensidade por tipologia", async () => {
  const map = await readFile(new URL("components/tv-process-map.tsx", root), "utf8");
  assert.match(map, /World_Imagery/);
  assert.match(map, /World_Boundaries_and_Places/);
  assert.match(map, /processHeatPane/);
  assert.match(map, /fillOpacity/);
  assert.match(map, /Mapa de calor dos processos/);
  assert.match(map, /DEFAULT_ACTIVE_MUNICIPAL_LAYERS/);
  assert.match(map, /renderStaticMunicipalLayer/);
  assert.match(map, /renderVisibleObsoleteLots/);
  assert.match(map, /TV_ZONING_OPACITY = 0\.1/);
  assert.match(map, /zoningFillOpacity: TV_ZONING_OPACITY/);
  assert.match(map, /zoningStrokeOpacity: TV_ZONING_OPACITY/);
  assert.match(map, /Zoneamento 90% transparente/);
  assert.match(map, /Nascentes desativadas/);
  assert.match(map, /EMPRESA_FACIL_COLOR = "#10b981"/);
  assert.match(map, /process\.sourceCategory === "Empresa Fácil"/);
  assert.match(map, /do Empresa Fácil/);
  assert.match(map, /TV_MAP_TOUR_INTERVAL_MS = 12_000/);
  assert.match(map, /map\.flyTo/);
  assert.match(map, /Mapa animado · roteiro de 12s/);
  assert.match(map, /overdue: 260, regular: 195/);
  assert.doesNotMatch(map, /\? 520 : 390/);
});
