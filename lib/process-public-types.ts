import type { ProcessRecord } from "@/lib/dashboard-types";

export const PUBLIC_PROCESS_TYPES = [
  { id: "viability", label: "Laudo de Viabilidade para Construção", shortLabel: "Laudo de Viabilidade", color: "#22d3ee" },
  { id: "land-use", label: "Certidão de Uso e Ocupação do Solo", shortLabel: "Uso e Ocupação", color: "#facc15" },
  { id: "eiv", label: "Estudo de Impacto de Vizinhança", shortLabel: "EIV", color: "#a78bfa" },
  { id: "subdivision", label: "Diretriz de Loteamento", shortLabel: "Diretriz", color: "#34d399" },
  { id: "prp", label: "PRP", shortLabel: "PRP", color: "#fb7185" },
] as const;

export type PublicProcessTypeId = (typeof PUBLIC_PROCESS_TYPES)[number]["id"];

export const OTHER_PROCESS_GROUPS = [
  { id: "works", label: "Licenciamento e obras", color: "#60a5fa" },
  { id: "zoning", label: "Consulta e zoneamento", color: "#c084fc" },
  { id: "land", label: "Parcelamento do solo", color: "#2dd4bf" },
  { id: "environment", label: "Meio ambiente", color: "#4ade80" },
  { id: "business", label: "Empresas e atividades", color: "#fbbf24" },
  { id: "administrative", label: "Administrativos", color: "#fb923c" },
  { id: "other", label: "Demais assuntos", color: "#94a3b8" },
] as const;

export type OtherProcessGroupId = (typeof OTHER_PROCESS_GROUPS)[number]["id"];

const NORMALIZE_PATTERN = /[\u0300-\u036f]/g;

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(NORMALIZE_PATTERN, "").toUpperCase();
}

export function classifyPublicProcess(process: ProcessRecord): PublicProcessTypeId | null {
  const identifier = normalize(process.displayId ?? process.id).replace(/\s+/g, "");
  const requestCode = normalize(process.requestCode).replace(/\s+/g, "");
  if (identifier.startsWith("PRP") || requestCode.startsWith("PRP")) return "prp";

  const text = normalize([
    process.category,
    process.subject,
    process.actionType,
    process.observation,
  ].join(" "));
  if (text.includes("IMPACTO") || /\bEIV\b/.test(text)) return "eiv";
  if (text.includes("DIRETRIZ") && (text.includes("LOTE") || text.includes("PARCELAMENTO"))) return "subdivision";
  if ((text.includes("CERT") || text.includes("CERTIDAO")) && text.includes("USO") && text.includes("OCUPACAO")) return "land-use";
  if (text.includes("LAUDO") || text.includes("VIABILIDADE") || text.includes("LOCALIZACAO")) return "viability";
  return null;
}

export function publicProcessType(typeId: PublicProcessTypeId) {
  return PUBLIC_PROCESS_TYPES.find((item) => item.id === typeId)!;
}

export function classifyOtherProcess(process: ProcessRecord) {
  const text = normalize([
    process.category,
    process.subject,
    process.actionType,
    process.activityDescription,
    process.observation,
  ].join(" "));
  let id: OtherProcessGroupId = "other";
  if (/ALVARA|LICEN|OBRA|CONSTR|EDIFIC|REFORMA|HABITE/.test(text)) id = "works";
  else if (/ZONEAMENTO|ZONEAR|CONSULTA|USO DO SOLO|OCUPACAO/.test(text)) id = "zoning";
  else if (/LOTE|PARCELA|SUBDIV|UNIFICA|DESMEMBRA|ARRUAMENTO/.test(text)) id = "land";
  else if (/AMBIENT|NASCENTE|RIO|APP|RESERVA|VEGETA|DRENAGEM/.test(text)) id = "environment";
  else if (/EMPRESA|CNPJ|CNAE|ATIVIDADE|COMERC|INDUSTR/.test(text)) id = "business";
  else if (/OFICIO|PROTOCOLO|REQUER|ADMINISTR|INFORMACAO|CERTIDAO/.test(text)) id = "administrative";
  return OTHER_PROCESS_GROUPS.find((group) => group.id === id)!;
}
