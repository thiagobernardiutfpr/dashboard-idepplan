export const PROCUREMENT_MODALITIES = [
  "Pregão eletrônico",
  "Concorrência",
  "Dispensa",
  "Inexigibilidade",
  "Credenciamento",
  "Concurso",
  "Leilão",
  "Diálogo competitivo",
  "Outro",
] as const;

export const PROCUREMENT_PHASES = [
  "Planejamento",
  "Preparação",
  "Publicação",
  "Em disputa",
  "Julgamento",
  "Homologação",
  "Concluída",
  "Suspensa",
] as const;

export const PROCUREMENT_SITUATIONS = [
  "No prazo",
  "Atenção",
  "Atrasada",
  "Concluída",
  "Suspensa",
] as const;

export type ProcurementModality = (typeof PROCUREMENT_MODALITIES)[number];
export type ProcurementPhase = (typeof PROCUREMENT_PHASES)[number];
export type ProcurementSituation = (typeof PROCUREMENT_SITUATIONS)[number];

export type ProcurementInput = {
  object: string;
  modality: ProcurementModality;
  processNumber: string;
  phase: ProcurementPhase;
  situation: ProcurementSituation;
  plannedPublicationDate: string | null;
  sessionDate: string | null;
  estimatedValue: number | null;
  fundingSource: string;
  notes: string;
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : value;
}

export function validateProcurementInput(payload: Record<string, unknown>) {
  const object = cleanText(payload.object, 500);
  const modality = cleanText(payload.modality, 60);
  const processNumber = cleanText(payload.processNumber, 80);
  const phase = cleanText(payload.phase, 60);
  const situation = cleanText(payload.situation, 60);
  const plannedPublicationDate = cleanDate(payload.plannedPublicationDate);
  const sessionDate = cleanDate(payload.sessionDate);
  const fundingSource = cleanText(payload.fundingSource, 160);
  const notes = cleanText(payload.notes, 2000);
  const rawValue = payload.estimatedValue;
  const estimatedValue = rawValue == null || rawValue === "" ? null : Number(rawValue);

  if (!object) return { error: "Informe o objeto da licitação." } as const;
  if (!PROCUREMENT_MODALITIES.includes(modality as ProcurementModality)) {
    return { error: "Modalidade inválida." } as const;
  }
  if (!PROCUREMENT_PHASES.includes(phase as ProcurementPhase)) {
    return { error: "Fase inválida." } as const;
  }
  if (!PROCUREMENT_SITUATIONS.includes(situation as ProcurementSituation)) {
    return { error: "Situação inválida." } as const;
  }
  if (plannedPublicationDate === undefined || sessionDate === undefined) {
    return { error: "Informe datas válidas." } as const;
  }
  if (estimatedValue != null && (!Number.isFinite(estimatedValue) || estimatedValue < 0)) {
    return { error: "Valor estimado inválido." } as const;
  }

  return {
    value: {
      object,
      modality: modality as ProcurementModality,
      processNumber,
      phase: phase as ProcurementPhase,
      situation: situation as ProcurementSituation,
      plannedPublicationDate,
      sessionDate,
      estimatedValue,
      fundingSource,
      notes,
    } satisfies ProcurementInput,
  } as const;
}
