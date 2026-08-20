function foldProcessType(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

export const DEFAULT_ACTIVE_PROCESS_TYPES = [
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
] as const;

const DEFAULT_ACTIVE_PROCESS_TYPE_KEYS = new Set(
  DEFAULT_ACTIVE_PROCESS_TYPES.map(foldProcessType),
);

export function isDefaultActiveProcessType(value: unknown) {
  return DEFAULT_ACTIVE_PROCESS_TYPE_KEYS.has(foldProcessType(value));
}

