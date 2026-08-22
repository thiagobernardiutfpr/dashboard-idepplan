"use client";

import { AlertTriangle, Camera, CheckCircle2, FileText, Layers, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CoordinateRecord, ItemAttachmentRecord, ProcessRecord } from "@/lib/dashboard-types";
import { analyzeProcessText, extractSearchableText } from "@/lib/process-document-analysis";
import { DOCUMENT_TEMPLATES, suggestDocumentTemplate, zoningUsePath } from "@/lib/document-templates";
import {
  downloadGeneratedDocument,
  generateDocxFromTemplate,
  renderPdfPages,
  type GeneratedDocumentFields,
} from "@/lib/docx-generator";
import { lookupPropertyByRegistration } from "@/lib/property-consultation-client";
import { normalizeZoningZone } from "@/lib/zoning-colors";

const FIELD_LABELS: Array<{ key: keyof GeneratedDocumentFields; label: string; wide?: boolean }> = [
  { key: "processNumber", label: "Processo" },
  { key: "applicant", label: "Requerente" },
  { key: "propertyRegistration", label: "Inscrição imobiliária" },
  { key: "zoning", label: "Zoneamento" },
  { key: "lot", label: "Lote" },
  { key: "block", label: "Quadra" },
  { key: "neighborhood", label: "Bairro" },
  { key: "postalCode", label: "CEP" },
  { key: "address", label: "Endereço", wide: true },
  { key: "coordinates", label: "Coordenadas", wide: true },
  { key: "cnpj", label: "CNPJ / CPF" },
  { key: "cnae", label: "CNAE / atividade" },
  { key: "area", label: "Área do imóvel" },
  { key: "category", label: "Categoria" },
  { key: "actionType", label: "Ação" },
  { key: "request", label: "Solicitação", wide: true },
];

function supported(file: ItemAttachmentRecord) {
  return /\.(pdf|docx?|png|jpe?g|dwg|xlsx?|csv|txt|md|json)$/i.test(file.fileName) || file.contentType.startsWith("text/");
}

function initialFields(process: ProcessRecord, coordinate?: CoordinateRecord, zone?: string): GeneratedDocumentFields {
  return {
    processNumber: process.displayId ?? process.id,
    applicant: process.companyName || process.applicant || "",
    propertyRegistration: String(process.propertyRegistration ?? coordinate?.propertyRegistration ?? ""),
    lot: String(process.lot ?? ""),
    block: String(process.block ?? ""),
    neighborhood: String(process.neighborhood ?? ""),
    address: String(process.address ?? ""),
    postalCode: String(process.postalCode ?? ""),
    request: String(process.requestDescription ?? process.subject ?? ""),
    category: process.category,
    actionType: String(process.actionType ?? ""),
    zoning: normalizeZoningZone(zone) || "",
    coordinates: coordinate ? `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}` : "",
    area: "",
    cnae: [process.activityCode, process.activityDescription].filter(Boolean).join(" — "),
    cnpj: String(process.cnpj ?? ""),
  };
}

function safeFileName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function ProcessDocumentGenerator({
  process,
  coordinate,
  zone,
  captureMap,
}: {
  process: ProcessRecord;
  coordinate?: CoordinateRecord;
  zone?: string;
  captureMap: () => Promise<Blob | null>;
}) {
  const suggested = useMemo(
    () => suggestDocumentTemplate(process.category, process.actionType, process.requestDescription),
    [process.actionType, process.category, process.requestDescription],
  );
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(suggested.id);
  const [includeZoning, setIncludeZoning] = useState(false);
  const [includeMap, setIncludeMap] = useState(suggested.mapRecommended ?? false);
  const [mapImage, setMapImage] = useState<Blob | null>(null);
  const [mapPreview, setMapPreview] = useState("");
  const [fields, setFields] = useState<GeneratedDocumentFields>(() => initialFields(process, coordinate, zone));
  const [files, setFiles] = useState<ItemAttachmentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [phase, setPhase] = useState<"idle" | "loading" | "reading" | "capturing" | "generating">("idle");
  const [progress, setProgress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const template = DOCUMENT_TEMPLATES.find((item) => item.id === templateId) ?? suggested;
  const selectedFiles = useMemo(() => files.filter((file) => selectedIds.has(file.id)), [files, selectedIds]);
  const zonePath = zoningUsePath(fields.zoning);

  useEffect(() => () => {
    if (mapPreview) URL.revokeObjectURL(mapPreview);
  }, [mapPreview]);

  async function enrichFromProperty(current: GeneratedDocumentFields) {
    if (!current.propertyRegistration) return current;
    try {
      const property = await lookupPropertyByRegistration(current.propertyRegistration);
      if (!property) return current;
      return {
        ...current,
        propertyRegistration: property.registration || current.propertyRegistration,
        zoning: normalizeZoningZone(property.zone) || current.zoning,
        lot: property.lot || current.lot,
        block: property.block || current.block,
        neighborhood: property.neighborhood || current.neighborhood,
        address: [property.street, property.number].filter(Boolean).join(", ") || current.address,
        postalCode: property.postalCode || current.postalCode,
        coordinates: property.latitude != null && property.longitude != null
          ? `${property.latitude.toFixed(6)}, ${property.longitude.toFixed(6)}`
          : current.coordinates,
      };
    } catch {
      return current;
    }
  }

  async function openGenerator() {
    setOpen(true);
    setPhase("loading");
    setError("");
    setNote("");
    try {
      const hydrated = await enrichFromProperty(initialFields(process, coordinate, zone));
      setFields(hydrated);
      const response = await fetch(`/api/attachments?module=processes&itemId=${encodeURIComponent(process.id)}`, { cache: "no-store" });
      const payload = (await response.json()) as { attachments?: ItemAttachmentRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar anexos.");
      const nextFiles = payload.attachments ?? [];
      setFiles(nextFiles);
      setSelectedIds(new Set(nextFiles.filter(supported).map((file) => file.id)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível preparar o gerador.");
    } finally {
      setPhase("idle");
    }
  }

  async function readAttachments() {
    if (!selectedFiles.length) {
      setError("Selecione ao menos um anexo compatível para leitura.");
      return;
    }
    setPhase("reading");
    setError("");
    setNote("");
    try {
      const blocks: string[] = [];
      const skipped: string[] = [];
      for (const attachment of selectedFiles) {
        setProgress(`Abrindo ${attachment.fileName}…`);
        try {
          const response = await fetch(`/api/attachments/${attachment.id}`, { cache: "no-store" });
          if (!response.ok) throw new Error("Falha ao baixar anexo");
          const blob = await response.blob();
          blocks.push(await extractSearchableText(new File([blob], attachment.fileName, { type: attachment.contentType }), setProgress));
        } catch {
          skipped.push(attachment.fileName);
        }
      }
      const text = blocks.join("\n");
      if (!text.trim()) throw new Error("Nenhum texto recuperável foi encontrado nos anexos selecionados.");
      const result = analyzeProcessText(text, process);
      const merged = await enrichFromProperty({
        ...fields,
        ...Object.fromEntries(Object.entries(result.fields).map(([key, value]) => [key, value || fields[key as keyof GeneratedDocumentFields]])),
      } as GeneratedDocumentFields);
      setFields(merged);
      setNote(`${Object.values(result.fields).filter(Boolean).length} campos sugeridos em ${blocks.length} arquivo${blocks.length === 1 ? "" : "s"}${skipped.length ? `; ${skipped.length} sem leitura recuperável` : ""}. Revise antes de gerar.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível ler os anexos.");
    } finally {
      setProgress("");
      setPhase("idle");
    }
  }

  async function captureCurrentMap() {
    setPhase("capturing");
    setError("");
    setProgress("Capturando mapa e camadas ativas…");
    try {
      const blob = await captureMap();
      if (!blob) throw new Error("Não foi possível capturar o mapa. Aguarde o carregamento das camadas e tente novamente.");
      if (mapPreview) URL.revokeObjectURL(mapPreview);
      setMapImage(blob);
      setMapPreview(URL.createObjectURL(blob));
      setIncludeMap(true);
      setNote("Mapa capturado com as camadas que estavam ativas no momento da captura.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao capturar o mapa.");
    } finally {
      setProgress("");
      setPhase("idle");
    }
  }

  async function generate() {
    if (includeZoning && !zonePath) {
      setError("O zoneamento informado não possui tabela correspondente no arquivo fornecido. Confira a inscrição ou a zona antes de gerar.");
      return;
    }
    if (includeMap && !mapImage) {
      setError("Capture o mapa atual antes de gerar o documento com imagem.");
      return;
    }
    setPhase("generating");
    setError("");
    setNote("");
    try {
      const zoningPages = includeZoning && zonePath ? await renderPdfPages(zonePath, setProgress) : [];
      setProgress("Preenchendo o modelo e montando o arquivo Word…");
      const blob = await generateDocxFromTemplate({
        templatePath: template.path,
        fields: { ...fields, zoning: normalizeZoningZone(fields.zoning) || fields.zoning },
        mapImage: includeMap ? mapImage : null,
        mapMedia: template.mapMedia,
        zoningPages,
      });
      downloadGeneratedDocument(blob, `${safeFileName(template.label)}_${safeFileName(fields.processNumber || process.id)}.docx`);
      setNote(`Documento gerado${includeZoning ? ` com a tabela ${normalizeZoningZone(fields.zoning)}` : ""}${includeMap ? " e mapa capturado" : ""}. Confira o arquivo antes da assinatura.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível gerar o documento.");
    } finally {
      setProgress("");
      setPhase("idle");
    }
  }

  return (
    <>
      <div className="document-generate-actions">
        <button type="button" className="primary-button document-generate-button" onClick={() => void openGenerator()}>
          <FileText size={17} /> Gerar documento
        </button>
        <button
          type="button"
          className={`secondary-button zoning-include-button ${includeZoning ? "active" : ""}`}
          onClick={() => setIncludeZoning((current) => !current)}
          aria-pressed={includeZoning}
          title="Inclui ao final do Word a tabela oficial de usos permitidos para o zoneamento"
        >
          <Layers size={17} /> {includeZoning ? "Zoneamento incluído" : "Incluir zoneamento"}
        </button>
      </div>

      {open ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true" aria-label={`Gerar documento do processo ${process.displayId ?? process.id}`}>
          <div className="attachment-modal process-document-generator-modal">
            <header>
              <div>
                <span className="panel-kicker">Modelos oficiais + leitura OCR</span>
                <h2>Gerar documento</h2>
                <p>{process.displayId ?? process.id} · revise os campos e o mapa antes de baixar o Word.</p>
              </div>
              <button className="icon-only-button" type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={20} /></button>
            </header>

            <div className="document-generator-top-grid">
              <label>
                <span>Modelo do documento</span>
                <select value={templateId} onChange={(event) => {
                  const next = DOCUMENT_TEMPLATES.find((item) => item.id === event.target.value);
                  setTemplateId(event.target.value);
                  if (next) setIncludeMap(next.mapRecommended ?? false);
                }}>
                  {DOCUMENT_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <div className="document-options-card">
                <label><input type="checkbox" checked={includeZoning} onChange={(event) => setIncludeZoning(event.target.checked)} /> Anexar tabela de uso do solo</label>
                <small>{zonePath ? `Tabela disponível para ${normalizeZoningZone(fields.zoning)}.` : "Informe um zoneamento com tabela disponível."}</small>
                <label><input type="checkbox" checked={includeMap} onChange={(event) => setIncludeMap(event.target.checked)} /> Incorporar mapa com camadas ativas</label>
              </div>
            </div>

            <section className="process-analysis-files document-generator-files">
              <div><Sparkles size={19} /><strong>Pré-preenchimento por OCR</strong></div>
              {phase === "loading" ? <p><LoaderCircle size={17} className="spin" /> Carregando anexos…</p> : files.length ? files.map((file) => (
                <label key={file.id} className={!supported(file) ? "unsupported" : ""}>
                  <input type="checkbox" disabled={!supported(file) || phase !== "idle"} checked={selectedIds.has(file.id)} onChange={() => setSelectedIds((current) => { const next = new Set(current); if (next.has(file.id)) next.delete(file.id); else next.add(file.id); return next; })} />
                  <span>{file.fileName}</span>
                  <small>{supported(file) ? (/\.dwg$/i.test(file.fileName) ? "textos e metadados recuperáveis" : "pronto para leitura") : "formato mantido apenas como anexo"}</small>
                </label>
              )) : <p><AlertTriangle size={17} /> Nenhum anexo encontrado. Use “Anexar arquivos” no painel.</p>}
              <button type="button" className="secondary-button" onClick={() => void readAttachments()} disabled={phase !== "idle" || !selectedFiles.length}>
                {phase === "reading" ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />} Ler anexos e sugerir campos
              </button>
            </section>

            <div className="record-form-grid process-analysis-grid document-generator-fields">
              {FIELD_LABELS.map(({ key, label, wide }) => (
                <label key={key} className={wide ? "form-span-2" : ""}>
                  <span>{label}</span>
                  {key === "request"
                    ? <textarea value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />
                    : <input value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />}
                </label>
              ))}
            </div>

            <section className="document-map-capture">
              <div>
                <Camera size={19} />
                <span><strong>Mapa do documento</strong><small>A captura usa a vista e todas as camadas municipais ativas no mapa.</small></span>
              </div>
              <button type="button" className="secondary-button" onClick={() => void captureCurrentMap()} disabled={phase !== "idle"}>
                {phase === "capturing" ? <LoaderCircle size={17} className="spin" /> : <Camera size={17} />} Capturar mapa atual
              </button>
              {mapPreview ? <img src={mapPreview} alt="Prévia do mapa capturado para o documento" /> : null}
            </section>

            {progress ? <p className="document-generation-progress"><LoaderCircle size={16} className="spin" /> {progress}</p> : null}
            {note ? <div className="analysis-success"><CheckCircle2 size={17} /> {note}</div> : null}
            {error ? <div className="form-error">{error}</div> : null}
            <div className="analysis-disclaimer"><Sparkles size={16} /> O OCR e o preenchimento são assistivos. Revise nomes, números, conclusão técnica e enquadramento antes de assinar ou protocolar.</div>
            <div className="editor-actions">
              <button type="button" className="primary-button" onClick={() => void generate()} disabled={phase !== "idle"}>
                {phase === "generating" ? <LoaderCircle size={18} className="spin" /> : <FileText size={18} />} Gerar e baixar Word
              </button>
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Fechar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
