import { loadPropertyCoordinates, normalizePropertyRegistration } from "@/lib/property-coordinates-client";

export type SearchMode = "registration" | "owner" | "address" | "identifier" | "territory";

export type ConsultationManifest = {
  records: number;
  zoneRows: number;
  qgisRows: number;
  masterShards: number;
  modes: Record<SearchMode, { label: string; minimum: number; prefixSize: number }>;
};

export type PropertyRecord = {
  id: string;
  registration: string;
  baseRegistration: string;
  zone: string;
  propertyType: string;
  owner: string;
  document: string;
  neighborhood: string;
  street: string;
  number: string;
  postalCode: string;
  block: string;
  lot: string;
  qgisNumber: string;
  onSiteNumber: string;
  cadastralNumber: string;
  numberingStatus: string;
  side: string;
  parity: string;
  initialRange: string;
  finalRange: string;
  qgisObservation: string;
  latitude?: number;
  longitude?: number;
};

type IndexEntry = [string, string, string];
const cache = new Map<string, unknown>();

async function compressedJson<T>(url: string): Promise<T> {
  if (cache.has(url)) return cache.get(url) as T;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Índice não encontrado para esta pesquisa.");
  const stream = response.body?.pipeThrough(new DecompressionStream("gzip"));
  if (!stream) throw new Error("O navegador não pôde abrir a base compactada.");
  const value = (await new Response(stream).json()) as T;
  cache.set(url, value);
  return value;
}

export function normalizeConsultationQuery(value: string, mode: SearchMode) {
  return mode === "registration"
    ? value.replace(/\D/g, "")
    : value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function loadConsultationManifest() {
  const response = await fetch("/consultation-data/manifest.json");
  if (!response.ok) throw new Error("Não foi possível carregar a base cadastral.");
  return (await response.json()) as ConsultationManifest;
}

export async function searchPropertyRecords(mode: SearchMode, query: string, limit = 80) {
  const manifest = await loadConsultationManifest();
  const normalized = normalizeConsultationQuery(query, mode);
  const config = manifest.modes[mode];
  if (normalized.length < config.minimum) throw new Error(`Digite ao menos ${config.minimum} caracteres.`);
  const prefix = normalized.slice(0, config.prefixSize);
  const index = await compressedJson<IndexEntry[]>(`/consultation-data/${mode}/${encodeURIComponent(prefix)}.json.gzbin`);
  const matches = index
    .filter(([key]) => key.includes(normalized))
    .sort((a, b) => Number(b[0] === normalized) - Number(a[0] === normalized) || Number(b[0].startsWith(normalized)) - Number(a[0].startsWith(normalized)));
  const unique = new Map<string, IndexEntry>();
  for (const entry of matches) {
    unique.set(`${entry[1]}:${entry[2]}`, entry);
    if (unique.size >= limit) break;
  }
  const byShard = new Map<string, Set<string>>();
  for (const [, shard, id] of unique.values()) {
    const ids = byShard.get(shard) ?? new Set<string>();
    ids.add(id);
    byShard.set(shard, ids);
  }
  const rows = (await Promise.all([...byShard].map(async ([shard, ids]) =>
    (await compressedJson<PropertyRecord[]>(`/consultation-data/master/${shard}.json.gzbin`)).filter((row) => ids.has(row.id)),
  ))).flat();
  const coordinateLookup = await loadPropertyCoordinates(rows.map((row) => row.registration));
  return rows.map((row) => {
    const point = coordinateLookup.get(normalizePropertyRegistration(row.registration));
    return point ? { ...row, latitude: point.latitude, longitude: point.longitude } : row;
  });
}

export async function lookupPropertyByRegistration(registration: string) {
  const normalized = normalizePropertyRegistration(registration);
  const rows = await searchPropertyRecords("registration", normalized, 20);
  return rows.find((row) => normalizePropertyRegistration(row.registration) === normalized) ?? rows[0] ?? null;
}
