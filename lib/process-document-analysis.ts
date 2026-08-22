import type { ProcessRecord } from "@/lib/dashboard-types";
import { canonicalCategoryText } from "@/lib/process-category-normalization";

export type ExtractedProcessFields = {
  propertyRegistration: string;
  lot: string;
  block: string;
  neighborhood: string;
  applicant: string;
  address: string;
  postalCode: string;
  request: string;
  category: string;
  actionType: string;
};

export type ProcessDocumentAnalysis = {
  fields: ExtractedProcessFields;
  confidence: Record<keyof ExtractedProcessFields, number>;
  searchableCharacters: number;
};

type PdfTextItem = { str?: string; transform?: number[] };
export type DocumentReadProgress = (message: string) => void;
export type DocumentReadOptions = { maxOcrPages?: number };

const FIELD_LABELS = {
  propertyRegistration: ["inscri(?:ç|c)(?:ã|a)o imobili(?:á|a)ria", "cadastro imobili(?:á|a)rio"],
  lot: ["lote"],
  block: ["quadra"],
  neighborhood: ["bairro"],
  applicant: ["requerente", "solicitante", "interessado", "propriet(?:á|a)rio"],
  address: ["endere(?:ç|c)o", "local do im(?:ó|o)vel"],
  postalCode: ["cep"],
  request: ["solicita(?:ç|c)(?:ã|a)o", "assunto", "objeto", "pedido"],
} as const;

function compact(value: unknown, max = 300) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function afterLabel(text: string, labels: readonly string[], max = 220) {
  const boundary = "inscri(?:ç|c)(?:ã|a)o imobili(?:á|a)ria|cadastro imobili(?:á|a)rio|lote|quadra|bairro|requerente|solicitante|interessado|propriet(?:á|a)rio|endere(?:ç|c)o|local do im(?:ó|o)vel|cep|solicita(?:ç|c)(?:ã|a)o|assunto|objeto|pedido";
  for (const label of labels) {
    const match = text.match(new RegExp(`(?:${label})\\s*(?:n[ºo°.]*)?\\s*[:=\\-]?\\s*([^\\n\\r;|]{2,${max}}?)(?=\\s+(?:${boundary})\\b|$)`, "i"));
    if (match?.[1]) return compact(match[1].replace(/\s{2,}.*$/, ""), max);
  }
  return "";
}

function bestRegistration(text: string) {
  const labeled = afterLabel(text, FIELD_LABELS.propertyRegistration, 80);
  const candidate = labeled.match(/\d[\d.\-\/ ]{7,28}\d/)?.[0]
    ?? text.match(/\b\d{2,3}[.\- ]\d{2,3}[.\- ]\d{3,4}[.\- ]\d{2,4}\b/)?.[0]
    ?? "";
  return compact(candidate, 60).replace(/\s+/g, "");
}

function bestAddress(text: string) {
  const labeled = afterLabel(text, FIELD_LABELS.address, 260);
  if (labeled) return labeled;
  return compact(text.match(/\b(?:Rua|Avenida|Av\.?|Travessa|Alameda|Rodovia|Estrada|Praça)\s+[^\n\r;|]{3,180}/i)?.[0], 300);
}

function extractFromText(text: string, process: ProcessRecord): ProcessDocumentAnalysis {
  const propertyRegistration = bestRegistration(text);
  const lot = compact(afterLabel(text, FIELD_LABELS.lot, 80).match(/^[\w.\/-]+(?:\s+[A-Z])?/i)?.[0], 100);
  const block = compact(afterLabel(text, FIELD_LABELS.block, 80).match(/^[\w.\/-]+(?:\s+[A-Z])?/i)?.[0], 100);
  const neighborhood = compact(afterLabel(text, FIELD_LABELS.neighborhood, 160), 180);
  const applicant = compact(afterLabel(text, FIELD_LABELS.applicant, 220), 240);
  const address = bestAddress(text);
  const postalCode = compact(afterLabel(text, FIELD_LABELS.postalCode, 30).match(/\d{5}-?\d{3}/)?.[0] ?? text.match(/\b\d{5}-?\d{3}\b/)?.[0], 20);
  const request = compact(afterLabel(text, FIELD_LABELS.request, 800), 1000);
  const categoryDetected = canonicalCategoryText(`${request} ${text.slice(0, 5000)}`);
  const category = categoryDetected === "Sem categoria informada" || categoryDetected.length > 150 ? "" : categoryDetected;
  const fields = {
    propertyRegistration,
    lot,
    block,
    neighborhood,
    applicant: applicant || process.applicant,
    address,
    postalCode,
    request,
    category,
    actionType: category,
  };
  const confidence = Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key,
    value ? (key === "applicant" && value === process.applicant ? 0.35 : key === "category" || key === "actionType" ? 0.72 : 0.88) : 0,
  ])) as Record<keyof ExtractedProcessFields, number>;
  return { fields, confidence, searchableCharacters: text.length };
}

function decodeXmlText(value: string) {
  if (typeof DOMParser === "undefined") return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return new DOMParser().parseFromString(`<span>${value}</span>`, "text/xml").documentElement.textContent ?? value;
}

function readableBinaryText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const latin = new TextDecoder("latin1").decode(bytes);
  const utf16 = new TextDecoder("utf-16le").decode(bytes);
  const collect = (value: string) => value
    .match(/[\p{L}\p{N}\p{P}\p{Zs}]{4,}/gu)
    ?.map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => /[\p{L}\p{N}]/u.test(item)) ?? [];
  return [...new Set([...collect(latin), ...collect(utf16)])].join("\n").slice(0, 400_000);
}

async function runOcr(image: File | Blob | HTMLCanvasElement, onProgress?: DocumentReadProgress) {
  const { createWorker, OEM } = await import("tesseract.js");
  const worker = await createWorker(["por", "eng"], OEM.LSTM_ONLY, {
    logger: (message) => {
      if (message.status === "recognizing text") onProgress?.(`OCR em andamento · ${Math.round(message.progress * 100)}%`);
      else if (message.status) onProgress?.(`OCR · ${message.status}`);
    },
  });
  try {
    const result = await worker.recognize(image);
    return result.data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

async function readPdf(file: File, onProgress?: DocumentReadProgress, options?: DocumentReadOptions) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  const maxOcrPages = Math.max(1, options?.maxOcrPages ?? 12);
  let ocrPages = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    onProgress?.(`Lendo PDF · página ${pageNumber} de ${document.numPages}`);
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const searchable = (content.items as PdfTextItem[]).map((item) => compact(item.str, 1000)).filter(Boolean).join(" ");
    if (searchable.replace(/\s+/g, "").length >= 40) {
      pages.push(searchable);
      continue;
    }
    if (ocrPages >= maxOcrPages) {
      pages.push(`[Página ${pageNumber} sem texto pesquisável; OCR não executado por limite operacional]`);
      continue;
    }
    const viewport = page.getViewport({ scale: 1.65 });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) continue;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    ocrPages += 1;
    onProgress?.(`Aplicando OCR · página ${pageNumber} de ${document.numPages} · ${ocrPages}/${maxOcrPages} páginas digitalizadas`);
    pages.push(await runOcr(canvas, onProgress));
  }
  return pages.join("\n");
}

export async function extractSearchableText(file: File, onProgress?: DocumentReadProgress, options?: DocumentReadOptions) {
  const lower = file.name.toLocaleLowerCase("pt-BR");
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) {
    return readPdf(file, onProgress, options);
  }
  if (lower.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    onProgress?.("Lendo conteúdo do documento Word…");
    const { default: PizZip } = await import("pizzip");
    const zip = new PizZip(await file.arrayBuffer());
    return Object.keys(zip.files)
      .filter((name) => /^word\/(?:document|header\d*|footer\d*)\.xml$/.test(name))
      .map((name) => zip.file(name)?.asText() ?? "")
      .map((xml) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXmlText(match[1])).join(" "))
      .join("\n");
  }
  if (/\.(xlsx?|csv)$/i.test(lower)) {
    onProgress?.("Lendo planilha…");
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
    return workbook.SheetNames.map((name) => XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join("\n");
  }
  if (/\.(txt|md|json)$/i.test(lower) || file.type.startsWith("text/")) return file.text();
  if (/\.(png|jpe?g)$/i.test(lower) || /^image\/(?:png|jpeg)$/.test(file.type)) {
    onProgress?.("Preparando imagem para OCR…");
    return runOcr(file, onProgress);
  }
  if (/\.(doc|dwg)$/i.test(lower)) {
    onProgress?.(lower.endsWith(".dwg") ? "Lendo textos e metadados disponíveis no DWG…" : "Lendo conteúdo recuperável do documento legado…");
    return readableBinaryText(await file.arrayBuffer());
  }
  throw new Error(`${file.name}: formato sem leitura textual automática.`);
}

export function analyzeProcessText(text: string, process: ProcessRecord) {
  return extractFromText(text, process);
}
