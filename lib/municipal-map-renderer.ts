import type { LayerGroup, Map as LeafletMap, PathOptions } from "leaflet";
import {
  MUNICIPAL_MAP_LAYERS,
  type CompactLayerPayload,
  type CompactMapFeature,
  type MunicipalLayerId,
  type TiledLayerIndex,
} from "@/lib/municipal-map-layers";
import { zoningColor } from "@/lib/zoning-colors";

type LeafletNamespace = typeof import("leaflet");
export type MunicipalLayerRenderOptions = {
  zoningFillOpacity?: number;
  zoningStrokeOpacity?: number;
};

function styleFor(
  id: MunicipalLayerId,
  color: string,
  options: MunicipalLayerRenderOptions = {},
): PathOptions & { radius?: number } {
  const common = { color, renderer: undefined, interactive: true };
  switch (id) {
    case "springs":
      return {
        ...common,
        radius: 3.5,
        weight: 1.2,
        fillColor: color,
        fillOpacity: 0.92,
      };
    case "power-lines":
      return { ...common, weight: 2.3, opacity: 0.9, dashArray: "7 6" };
    case "urban-perimeter":
      return { ...common, weight: 2.2, opacity: 0.95, fillOpacity: 0.015 };
    case "rivers":
      return { ...common, weight: 1.35, opacity: 0.82 };
    case "road-system":
      return { ...common, weight: 1.0, opacity: 0.62 };
    case "app":
      return {
        ...common,
        weight: 0.75,
        opacity: 0.74,
        fillColor: color,
        fillOpacity: 0.14,
      };
    case "zoning":
      return {
        ...common,
        weight: 0.8,
        opacity: options.zoningStrokeOpacity ?? 0.68,
        fillColor: color,
        fillOpacity: options.zoningFillOpacity ?? 0.24,
      };
    case "municipal-lots":
      return {
        ...common,
        weight: 1.1,
        opacity: 0.92,
        fillColor: color,
        fillOpacity: 0.09,
      };
    case "obsolete-lots":
      return {
        ...common,
        weight: 0.55,
        opacity: 0.52,
        fillColor: color,
        fillOpacity: 0.025,
      };
    default:
      return {
        ...common,
        weight: 1.3,
        opacity: 0.86,
        fillColor: color,
        fillOpacity: 0.12,
      };
  }
}

function drawFeatures(
  L: LeafletNamespace,
  group: LayerGroup,
  id: MunicipalLayerId,
  features: CompactMapFeature[],
  options: MunicipalLayerRenderOptions = {},
) {
  const definition = MUNICIPAL_MAP_LAYERS.find((item) => item.id === id)!;
  for (const feature of features) {
    const [kind, coordinates, label] = feature;
    const color = id === "zoning" ? zoningColor(label) : definition.color;
    const style = styleFor(id, color, options);
    const layer =
      kind === "p"
        ? L.circleMarker(coordinates, style)
        : kind === "l"
          ? L.polyline(coordinates, style)
          : L.polygon(coordinates, style);
    if (label)
      layer.bindTooltip(id === "zoning" ? `Zoneamento ${label}` : label, {
        sticky: true,
        direction: "top",
      });
    layer.addTo(group);
  }
}

async function json<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache: "force-cache" });
  if (!response.ok) throw new Error(`Camada indisponível: ${path}`);
  return response.json() as Promise<T>;
}

function longitudeTile(longitude: number, zoom: number) {
  return Math.floor(((longitude + 180) / 360) * 2 ** zoom);
}

function latitudeTile(latitude: number, zoom: number) {
  const radians = (latitude * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoom,
  );
}

export async function renderStaticMunicipalLayer(
  L: LeafletNamespace,
  group: LayerGroup,
  id: Exclude<MunicipalLayerId, "obsolete-lots">,
  signal: AbortSignal,
  options: MunicipalLayerRenderOptions = {},
) {
  const definition = MUNICIPAL_MAP_LAYERS.find((item) => item.id === id);
  if (!definition?.dataPath) return;
  const payload = await json<CompactLayerPayload>(definition.dataPath, signal);
  if (!signal.aborted) drawFeatures(L, group, id, payload.f, options);
}

export async function renderVisibleObsoleteLots(
  L: LeafletNamespace,
  map: LeafletMap,
  group: LayerGroup,
  signal: AbortSignal,
) {
  const index = await json<TiledLayerIndex>(
    "/map-data/obsolete-lots/index.json",
    signal,
  );
  if (signal.aborted || map.getZoom() < index.minZoom) return;
  const bounds = map.getBounds().pad(0.28);
  const west = longitudeTile(bounds.getWest(), index.z);
  const east = longitudeTile(bounds.getEast(), index.z);
  const north = latitudeTile(bounds.getNorth(), index.z);
  const south = latitudeTile(bounds.getSouth(), index.z);
  const available = new Set(index.tiles);
  const paths: string[] = [];
  for (let x = west; x <= east; x += 1) {
    for (let y = north; y <= south; y += 1) {
      const key = `${x}-${y}`;
      if (available.has(key)) paths.push(`/map-data/obsolete-lots/${key}.json`);
    }
  }
  const payloads = await Promise.all(
    paths.map((path) => json<CompactLayerPayload>(path, signal)),
  );
  if (!signal.aborted)
    drawFeatures(
      L,
      group,
      "obsolete-lots",
      payloads.flatMap((payload) => payload.f),
    );
}
