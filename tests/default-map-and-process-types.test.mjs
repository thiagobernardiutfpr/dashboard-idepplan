import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const defaultProcessTypes = [
  "Acesso a informação",
  "Ampliação do Sistema de Iluminação",
  "Análise Prévia do EIV",
  "Certidão de Uso e Ocupação do Solo",
  "Denúncia",
  "Diretriz de Loteamento",
  "Documentos Administrativos",
  "Estudo de Impacto de Vizinhança - EIV",
  "Estudo de Impacto e Vizinhança - EIV",
  "Laudo de Viabilidade e Localização",
  "Parecer Jurídico",
  "Pedido de Informação",
  "Perímetro Urbano",
  "Procuradoria PMA",
  "Providencias",
  "Reclamação",
  "Requerimento",
  "Solicitação de Regularização de Engenho Publicitário",
  "Uso Espaço Público",
  "Uso de Espaço Público",
  "Uso e Ocupação do Solo",
  "Viabilidade de Passeio Público",
];

test("o mapa inicia com todas as camadas geométricas, exceto nascentes", async () => {
  const layers = await source("lib/municipal-map-layers.ts");
  const processMap = await source("components/process-map.tsx");
  const projectMap = await source("components/project-map.tsx");
  const tvMap = await source("components/tv-process-map.tsx");
  const renderer = await source("lib/municipal-map-renderer.ts");
  assert.match(layers, /DEFAULT_ACTIVE_MUNICIPAL_LAYERS/);
  assert.match(layers, /layer\.geometryAvailable && layer\.id !== "springs"/);
  assert.match(processMap, /new Set\(DEFAULT_ACTIVE_MUNICIPAL_LAYERS\)/);
  assert.match(projectMap, /new Set\(DEFAULT_ACTIVE_MUNICIPAL_LAYERS\)/);
  assert.match(tvMap, /DEFAULT_ACTIVE_MUNICIPAL_LAYERS/);
  assert.match(tvMap, /Nascentes desativadas/);
  assert.match(renderer, /fillOpacity:\s*options\.zoningFillOpacity \?\? 0\.24/);
});

test("a seleção padrão contém exatamente os tipos solicitados", async () => {
  const defaults = await source("lib/process-type-defaults.ts");
  for (const type of defaultProcessTypes) assert.ok(defaults.includes(JSON.stringify(type)), `tipo padrão ausente: ${type}`);
  const matches = defaults.match(/^\s{2}".*",$/gm) ?? [];
  assert.equal(matches.length, defaultProcessTypes.length);
});
