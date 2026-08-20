export type AutomaticPropertyCoordinate = {
  registration: string;
  latitude: number;
  longitude: number;
};

type CoordinateBucket = Record<string, [number, number]>;

const bucketCache = new Map<string, Promise<CoordinateBucket>>();

export function normalizePropertyRegistration(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizedHeader(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function registrationFromRow(row: Record<string, unknown>) {
  const entry = Object.entries(row).find(([header]) => {
    const normalized = normalizedHeader(header);
    return normalized === "propertyregistration" || normalized === "cadastroimobiliario" || (normalized.includes("inscricao") && (normalized.includes("imobiliaria") || normalized.includes("imovel")));
  });
  return normalizePropertyRegistration(entry?.[1]);
}

async function loadBucket(prefix: string) {
  let cached = bucketCache.get(prefix);
  if (!cached) {
    cached = fetch(`/property-coordinates/${encodeURIComponent(prefix)}.json.gzbin`).then(async (response) => {
      if (response.status === 404) return {};
      if (!response.ok) throw new Error("Não foi possível consultar a base geográfica de inscrições.");
      const stream = response.body?.pipeThrough(new DecompressionStream("gzip"));
      if (!stream) throw new Error("O navegador não pôde abrir a base geográfica compactada.");
      return new Response(stream).json() as Promise<CoordinateBucket>;
    });
    bucketCache.set(prefix, cached);
  }
  return cached;
}

export async function loadPropertyCoordinates(values: unknown[]) {
  const registrations = [...new Set(values.map(normalizePropertyRegistration).filter((value) => value.length >= 10))];
  const prefixes = [...new Set(registrations.map((value) => value.slice(0, 4)))];
  const buckets = await Promise.all(prefixes.map(async (prefix) => [prefix, await loadBucket(prefix)] as const));
  const byPrefix = new Map(buckets);
  return new Map(registrations.flatMap((registration) => {
    const point = byPrefix.get(registration.slice(0, 4))?.[registration];
    return point ? [[registration, { registration, latitude: point[0], longitude: point[1] } as AutomaticPropertyCoordinate]] : [];
  }));
}

export async function enrichRowsWithPropertyCoordinates(rows: Array<Record<string, unknown>>) {
  const registrations = rows.map(registrationFromRow);
  const coordinates = await loadPropertyCoordinates(registrations);
  let matched = 0;
  const enriched = rows.map((row, index) => {
    const registration = registrations[index];
    const point = coordinates.get(registration);
    if (!point) return row;
    matched += 1;
    return {
      ...row,
      "Latitude automática": point.latitude.toFixed(6),
      "Longitude automática": point.longitude.toFixed(6),
      "Origem da coordenada": "Coordenadas_Inscricoes_QGIS.xlsx",
    };
  });
  return { rows: enriched, matched };
}
