import { normalizeZoningZone } from "@/lib/zoning-colors";

export type DocumentTemplate = {
  id: string;
  label: string;
  path: string;
  keywords: string[];
  mapRecommended?: boolean;
  mapMedia?: string[];
};

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  { id: "pre-eiv", label: "Análise Prévia do EIV", path: "/document-templates/Pre_EIV.docx", keywords: ["pre eiv", "previa eiv", "analise previa"], mapRecommended: true, mapMedia: ["word/media/image3.png"] },
  { id: "autorizacao-espaco-publico", label: "Autorização de Uso do Espaço Público", path: "/document-templates/Autorizacao_Uso_Espaco_Publico.docx", keywords: ["uso espaco publico", "espaco publico", "autorizacao"] },
  { id: "certidao-desapropriacao", label: "Certidão de Desapropriação", path: "/document-templates/Certidao_de_Desapropriacao.docx", keywords: ["desapropriacao"], mapRecommended: true, mapMedia: ["word/media/image1.png"] },
  { id: "eiv", label: "Estudo de Impacto de Vizinhança — EIV", path: "/document-templates/EIV.docx", keywords: ["estudo de impacto", "eiv"] },
  { id: "parecer-urbanistico", label: "Parecer Urbanístico", path: "/document-templates/Parecer_Urbanistico.docx", keywords: ["parecer urbanistico", "urbanistico"], mapRecommended: true, mapMedia: ["word/media/image1.png", "word/media/image2.png", "word/media/image3.png", "word/media/image4.png", "word/media/image5.png", "word/media/image6.png", "word/media/image7.png", "word/media/image8.png", "word/media/image9.png"] },
  { id: "certidao-perimetro", label: "Certidão de Perímetro Urbano", path: "/document-templates/Certidao_de_Perimetro_Urbano.docx", keywords: ["perimetro urbano"], mapRecommended: true, mapMedia: ["word/media/image1.png"] },
  { id: "certidao-uso-solo", label: "Certidão de Uso e Ocupação do Solo", path: "/document-templates/Certidao_de_Uso_e_Ocupacao_do_Solo.docx", keywords: ["uso e ocupacao", "uso do solo", "certidao de uso"] },
  { id: "certidao-tombamento", label: "Certidão de Tombamento", path: "/document-templates/Certidao_Tombamento.docx", keywords: ["tombamento"], mapRecommended: true, mapMedia: ["word/media/image1.png"] },
  { id: "diretriz-loteamento", label: "Diretriz de Loteamento", path: "/document-templates/Diretriz_de_Loteamento.docx", keywords: ["diretriz", "loteamento"], mapRecommended: true, mapMedia: ["word/media/image1.jpg", "word/media/image2.png", "word/media/image3.png", "word/media/image4.png", "word/media/image5.png", "word/media/image6.png"] },
  { id: "engenhos-publicitarios", label: "Autorização de Engenhos Publicitários", path: "/document-templates/Engenhos_Publicitarios.docx", keywords: ["engenho publicitario", "publicitario", "publicidade"] },
  { id: "laudo-viabilidade", label: "Laudo de Viabilidade", path: "/document-templates/Laudo_de_Viabilidade.docx", keywords: ["laudo de viabilidade", "viabilidade"] },
  { id: "parecer-tecnico", label: "Parecer Técnico", path: "/document-templates/Parecer_Tecnico.docx", keywords: ["parecer tecnico"], mapRecommended: true, mapMedia: ["word/media/image1.png", "word/media/image2.png"] },
  { id: "pedido-informacao", label: "Pedido de Informação", path: "/document-templates/Pedido_de_Informacao.docx", keywords: ["pedido de informacao", "acesso a informacao", "informacao"] },
];

const ZONING_USE_FILES: Record<string, string> = {
  ZC1: "ZC1_.pdf",
  ZC2: "ZC2_.pdf",
  ZC3: "ZC3_.pdf",
  ZC4: "ZC4_.pdf",
  ZC5: "ZC5_.pdf",
  ZC28: "ZC28_.pdf",
  ZEA: "ZEA_.pdf",
  ZEIS: "ZEIS_.pdf",
  ZI1: "ZI1_.pdf",
  ZI2: "ZI2_.pdf",
  ZOC: "ZOC_.pdf",
  ZR1: "ZR1_.pdf",
  ZR2: "ZR2_.pdf",
  ZR3: "ZR3_.pdf",
  ZR4: "ZR4_.pdf",
  ZR5: "ZR5_.pdf",
  ZR28: "ZR28_.pdf",
  ZRCH: "ZRCH_.pdf",
};

export function zoningUsePath(zone: string | null | undefined) {
  const normalized = normalizeZoningZone(zone);
  const fileName = ZONING_USE_FILES[normalized];
  return fileName ? `/zoning-uses/${fileName}` : null;
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function suggestDocumentTemplate(category: string, actionType?: string | null, request?: string | null) {
  const source = normalizeSearch(`${category} ${actionType ?? ""} ${request ?? ""}`);
  return DOCUMENT_TEMPLATES.find((template) => template.keywords.some((keyword) => source.includes(keyword))) ?? DOCUMENT_TEMPLATES[0];
}
