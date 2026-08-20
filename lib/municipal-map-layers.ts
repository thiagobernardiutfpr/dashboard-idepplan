export type MunicipalLayerId =
  | "app"
  | "power-lines"
  | "springs"
  | "urban-perimeter"
  | "rivers"
  | "road-system"
  | "landfill-buffer"
  | "sewage-buffer"
  | "zoning"
  | "municipal-lots"
  | "obsolete-lots";

export type MunicipalLayerDefinition = {
  id: MunicipalLayerId;
  label: string;
  color: string;
  featureCount: number;
  geometryAvailable: boolean;
  minZoom?: number;
  dataPath?: string;
};

export const MUNICIPAL_MAP_LAYERS: MunicipalLayerDefinition[] = [
  {
    id: "app",
    label: "Áreas de Preservação Permanente",
    color: "#22c55e",
    featureCount: 1,
    geometryAvailable: true,
    dataPath: "/map-data/app.json",
  },
  {
    id: "power-lines",
    label: "Linhas de transmissão de alta tensão",
    color: "#f97316",
    featureCount: 8,
    geometryAvailable: true,
    dataPath: "/map-data/power-lines.json",
  },
  {
    id: "springs",
    label: "Nascentes",
    color: "#38bdf8",
    featureCount: 596,
    geometryAvailable: true,
    dataPath: "/map-data/springs.json",
  },
  {
    id: "urban-perimeter",
    label: "Perímetro urbano",
    color: "#facc15",
    featureCount: 8,
    geometryAvailable: true,
    dataPath: "/map-data/urban-perimeter.json",
  },
  {
    id: "rivers",
    label: "Rios",
    color: "#0ea5e9",
    featureCount: 1_827,
    geometryAvailable: true,
    dataPath: "/map-data/rivers.json",
  },
  {
    id: "road-system",
    label: "Sistema viário",
    color: "#f8fafc",
    featureCount: 6_195,
    geometryAvailable: true,
    dataPath: "/map-data/road-system.json",
  },
  {
    id: "landfill-buffer",
    label: "Amortecimento do aterro sanitário",
    color: "#fb7185",
    featureCount: 1,
    geometryAvailable: true,
    dataPath: "/map-data/landfill-buffer.json",
  },
  {
    id: "sewage-buffer",
    label: "Amortecimento da ETE",
    color: "#a78bfa",
    featureCount: 2,
    geometryAvailable: true,
    dataPath: "/map-data/sewage-buffer.json",
  },
  {
    id: "zoning",
    label: "Zoneamento",
    color: "#007bff",
    featureCount: 1_861,
    geometryAvailable: true,
    dataPath: "/map-data/zoning.json",
  },
  {
    id: "municipal-lots",
    label: "Lotes da Prefeitura",
    color: "#2dd4bf",
    featureCount: 1_786,
    geometryAvailable: true,
    dataPath: "/map-data/municipal-lots.json",
  },
  {
    id: "obsolete-lots",
    label: "Lotes obsoletos",
    color: "#94a3b8",
    featureCount: 67_276,
    geometryAvailable: true,
    minZoom: 15,
    dataPath: "/map-data/obsolete-lots/index.json",
  },
];

export const DEFAULT_ACTIVE_MUNICIPAL_LAYERS = MUNICIPAL_MAP_LAYERS
  .filter((layer) => layer.geometryAvailable && layer.id !== "springs")
  .map((layer) => layer.id);

export type LatLngPoint = [number, number];
export type CompactMapFeature =
  | ["p", LatLngPoint, string?]
  | ["l", LatLngPoint[], string?]
  | ["a", LatLngPoint[][], string?];
export type CompactLayerPayload = { v: 1; f: CompactMapFeature[] };
export type TiledLayerIndex = {
  v: 1;
  z: number;
  minZoom: number;
  count: number;
  tiles: string[];
};
