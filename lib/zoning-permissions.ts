export type CnaeRecord = { description: string; cnae: string; zones: string };
export type CnaePermissionStatus = "permitted" | "tolerated" | "prohibited" | "technical-review" | "unknown-zone";

type ZoneRule = { permitted: string[]; tolerated?: string[] };
const zoneRules: Record<string, ZoneRule> = {
  ZR1: { permitted: ["CV(A)", "SV(A)"], tolerated: ["H(5)"] },
  ZR2: { permitted: ["CV(A)", "SV(A)", "SV(B)", "I(A)"], tolerated: ["H(5)"] },
  ZR3: { permitted: ["CV(A)", "SV(A)"], tolerated: ["CV(B)", "SV(B)", "I(A)"] },
  ZR4: { permitted: ["CV(A)", "CV(B)", "SV(A)", "SV(B)"], tolerated: ["I(A)"] },
  ZR5: { permitted: ["CV(A)", "SV(A)"], tolerated: ["CV(B)", "SV(B)", "I(A)"] },
  ZR28: { permitted: ["CV(A)", "CV(B)", "SV(A)", "SV(B)", "SV(C)", "SC(A)", "SC(B)"] },
  ZRCH: { permitted: ["CV(A)", "SV(D)"], tolerated: ["CV(B)", "SV(A)", "I(A)"] },
  ZOC: { permitted: ["CV(A)", "SV(A)", "SV(B)"], tolerated: ["I(A)"] },
  ZC1: { permitted: ["CV(A)", "CV(B)", "CV(C)", "CC(A)", "CC(B)", "CC(C)", "SV(A)", "SV(B)", "SV(C)", "SC(A)", "SC(B)", "SC(C)"], tolerated: ["I(A)"] },
  ZC2: { permitted: ["CV(A)", "CV(B)", "CV(C)", "CC(A)", "CC(B)", "CC(C)", "SV(A)", "SV(B)", "SV(C)", "SC(A)", "SC(B)", "SC(C)"], tolerated: ["I(A)"] },
  ZC3: { permitted: ["CV(A)", "CV(B)", "CV(C)", "CC(A)", "CC(B)", "CC(C)", "CS(A)", "SV(A)", "SV(B)", "SV(C)", "SC(A)", "SC(B)", "SC(C)", "SS(A)", "I(A)", "I(B)"] },
  ZC4: { permitted: ["CV(A)", "CV(B)", "CV(C)", "CC(A)", "SV(A)", "SV(B)", "SC(A)", "SC(B)", "I(A)"], tolerated: ["CC(B)"] },
  ZC5: { permitted: ["CV(A)", "CV(B)", "SV(A)", "SV(B)", "SV(C)", "SC(A)", "SC(B)"] },
  ZC28: { permitted: ["CV(A)", "CV(B)", "SV(A)", "SV(B)", "SV(C)", "SC(A)", "SC(B)"], tolerated: ["H(4)"] },
  ZI1: { permitted: ["CV(A)", "CC(A)", "CC(B)", "CC(C)", "CS(A)", "SV(A)", "SC(A)", "SC(B)", "SC(C)", "SS(A)", "I(A)", "I(B)"], tolerated: ["CV(C)", "SV(C)", "SV(D)"] },
  ZI2: { permitted: ["CV(A)", "CC(A)", "CC(C)", "CS(A)", "SS(A)", "SC(A)", "SC(C)", "I(D)"] },
  ZEA: { permitted: ["CV(A)", "CV(B)", "CV(C)", "CC(A)", "SV(A)", "SV(B)", "SV(C)"], tolerated: ["CC(B)", "SC(A)", "SC(B)", "I(A)"] },
  ZEIS: { permitted: ["CV(A)", "CV(B)", "SV(A)", "SV(B)"], tolerated: ["I(A)"] },
  ZEVR: { permitted: [], tolerated: ["SV(D)", "I(A)"] },
  ZRD: { permitted: ["ZRD"] },
};
const specialZones = new Set(["ZE", "ZEPC", "ZP", "ZPC", "LAGOS"]);
let cnaeCache: Promise<CnaeRecord[]> | null = null;

export function normalizeCnae(value: string) { return value.replace(/\D/g, "").slice(0, 7); }
export function normalizeClassification(value: string) { return value.toUpperCase().replace(/\s+/g, ""); }
export function normalizeZone(value: string) { return value.toUpperCase().replace(/\s+/g, ""); }

export async function loadCnaeRecords() {
  cnaeCache ??= (async () => {
    const response = await fetch("/cnae-zoning/cnaes.json.gzbin");
    if (!response.ok) throw new Error("Não foi possível carregar a relação de CNAEs.");
    const stream = response.body?.pipeThrough(new DecompressionStream("gzip"));
    if (!stream) throw new Error("O navegador não pôde abrir a base de CNAEs.");
    return (await new Response(stream).json()) as CnaeRecord[];
  })();
  return cnaeCache;
}

export function getCnaePermission(zone: string, classification: string): CnaePermissionStatus {
  const normalizedZone = normalizeZone(zone);
  if (specialZones.has(normalizedZone)) return "technical-review";
  const rule = zoneRules[normalizedZone];
  if (!rule) return "unknown-zone";
  const normalizedClass = normalizeClassification(classification);
  if (rule.permitted.includes(normalizedClass)) return "permitted";
  if (rule.tolerated?.includes(normalizedClass)) return "tolerated";
  return "prohibited";
}

export async function listCnaesForZone(zone: string) {
  const rows = await loadCnaeRecords();
  return rows.map((record) => ({ ...record, classification: record.zones, status: getCnaePermission(zone, record.zones) }))
    .filter((record) => record.status === "permitted" || record.status === "tolerated");
}

export async function checkCnaeForZone(zone: string, cnae: string) {
  const normalized = normalizeCnae(cnae);
  const record = (await loadCnaeRecords()).find((item) => normalizeCnae(item.cnae) === normalized) ?? null;
  return record ? { ...record, classification: record.zones, status: getCnaePermission(zone, record.zones) } : null;
}
