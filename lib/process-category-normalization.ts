import type { ProcessRecord } from "@/lib/dashboard-types";

function fold(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function cleanTitle(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/^(?:(?:\d{1,6}|WEB)\s*[-–—:]\s*)+/gi, "")
    .replace(/^WEB\s+/i, "")
    .replace(/\s+\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  const lowerWords = new Set(["A", "AS", "AO", "AOS", "COM", "DA", "DAS", "DE", "DO", "DOS", "E", "EM", "PARA", "POR"]);
  const acronyms = new Set(["APP", "CNAE", "EIV", "PRP"]);
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)(\p{L})/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("pt-BR")}`)
    .split(" ")
    .map((word, index) => {
      const upper = fold(word);
      if (acronyms.has(upper)) return upper;
      if (index > 0 && lowerWords.has(upper)) return word.toLocaleLowerCase("pt-BR");
      return word;
    })
    .join(" ");
}

export function canonicalCategoryText(value: unknown) {
  const cleaned = cleanTitle(value);
  if (!cleaned) return "Sem categoria informada";
  const text = fold(cleaned);

  if ((/\bCERT\b|CERTIDAO/.test(text)) && text.includes("USO") && text.includes("OCUPACAO") && text.includes("SOLO")) return "Certidão de Uso e Ocupação do Solo";
  if ((text.includes("LAUDO") || text.includes("CONSULTA PREVIA")) && (text.includes("VIABILIDADE") || text.includes("LOCALIZACAO") || text.includes("CONSTRUCAO"))) return "Laudo de Viabilidade e Localização";
  if (text === "EIV" || text.includes("ESTUDO DE IMPACTO DE VIZINHANCA")) return "Estudo de Impacto de Vizinhança — EIV";
  if (text.includes("DIRETRIZ") && (text.includes("LOTEAMENTO") || text.includes("PARCELAMENTO"))) return "Diretriz de Loteamento";
  if (/\bPRP\b/.test(text)) return "PRP";
  if (text.includes("INSCRICAO MUNICIPAL")) return "Inscrição Municipal";
  if (text.includes("ALTERACAO")) return "Alteração cadastral";
  if (text.includes("ALVARA") && (text.includes("CONSTRUCAO") || text.includes("OBRA"))) return "Alvará de Construção";
  if (text.includes("HABITE SE") || text.includes("CONCLUSAO DE OBRA")) return "Habite-se / Conclusão de Obra";
  if (text.includes("DESMEMBRAMENTO") || text.includes("SUBDIVISAO")) return "Desmembramento / Subdivisão";
  if (text.includes("REMEMBRAMENTO") || text.includes("UNIFICACAO")) return "Remembramento / Unificação";
  if (text.includes("LOTEAMENTO") || text.includes("PARCELAMENTO DO SOLO")) return "Parcelamento do Solo / Loteamento";
  if (text.includes("CERTIDAO") && text.includes("CONFRONT")) return "Certidão de Confrontantes";
  if (text.includes("ZONEAMENTO") || (text.includes("CONSULTA") && text.includes("USO DO SOLO"))) return "Consulta de Zoneamento";
  if (text.includes("LICENCA") && text.includes("AMBIENT")) return "Licenciamento Ambiental";
  return titleCase(cleaned);
}

export function canonicalActionText(value: unknown) {
  return canonicalCategoryText(value);
}

export function normalizeProcessClassification(process: ProcessRecord): ProcessRecord {
  const sourceCategory = process.sourceCategory || process.category;
  const sourceActionType = process.sourceActionType || process.actionType || "";
  return {
    ...process,
    sourceCategory,
    sourceActionType,
    category: canonicalCategoryText(process.category),
    actionType: process.actionType ? canonicalActionText(process.actionType) : canonicalCategoryText(process.category),
  };
}

