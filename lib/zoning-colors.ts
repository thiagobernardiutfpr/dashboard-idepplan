export const ZONING_PALETTE = [
  { zone: "Lagos", color: "#a5bfdd" },
  { zone: "ZC1", color: "#1b2270" },
  { zone: "ZC2", color: "#007bff" },
  { zone: "ZC3", color: "#6db1d5" },
  { zone: "ZC4", color: "#c9ddff" },
  { zone: "ZC5", color: "#cffced" },
  { zone: "ZE", color: "#909090" },
  { zone: "ZEA", color: "#00a4bf" },
  { zone: "ZC28", color: "#ff3ed9" },
  { zone: "ZEIS", color: "#db3e3f" },
  { zone: "ZEPC", color: "#94ec1f" },
  { zone: "ZR28", color: "#f18db7" },
  { zone: "ZI1", color: "#dcb7e3" },
  { zone: "ZI2", color: "#a176aa" },
  { zone: "ZOC", color: "#ffc5dc" },
  { zone: "ZP", color: "#d0ff90" },
  { zone: "ZR1", color: "#ffffcd" },
  { zone: "ZR2", color: "#ffdf9d" },
  { zone: "ZR3", color: "#ffc02f" },
  { zone: "ZR4", color: "#ff7a39" },
  { zone: "ZR5", color: "#562d18" },
  { zone: "ZRCH", color: "#009300" },
] as const;

export type OfficialZoningZone = (typeof ZONING_PALETTE)[number]["zone"];

const COLORS = new Map<string, string>(
  ZONING_PALETTE.map(({ zone, color }) => [
    zone.toLocaleUpperCase("pt-BR"),
    color,
  ]),
);

const ALIASES: Record<string, string> = {
  ZEC28: "ZC28",
  ZER28: "ZR28",
  LAGO: "LAGOS",
};

export const ZONING_DEFAULT_COLOR = "#b7c4ce";

export function normalizeZoningZone(zone: string | null | undefined) {
  const normalized = (zone ?? "").trim().toLocaleUpperCase("pt-BR");
  return ALIASES[normalized] ?? normalized;
}

export function zoningColor(zone: string | null | undefined) {
  return COLORS.get(normalizeZoningZone(zone)) ?? ZONING_DEFAULT_COLOR;
}

export function zoningTextColor(zone: string | null | undefined) {
  const color = zoningColor(zone).slice(1);
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150
    ? "#17212b"
    : "#ffffff";
}

export const ZONING_SWATCH_GRADIENT =
  "linear-gradient(135deg, #a5bfdd 0 17%, #1b2270 17% 34%, #007bff 34% 51%, #6db1d5 51% 68%, #c9ddff 68% 85%, #cffced 85% 100%)";
