"use client";

import { AlertTriangle, CheckCircle2, FileSearch, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ItemAttachmentRecord, ProcessEnrichmentRecord, ProcessRecord } from "@/lib/dashboard-types";
import {
  analyzeProcessText,
  extractSearchableText,
  type ExtractedProcessFields,
} from "@/lib/process-document-analysis";

const FIELD_LABELS: Record<keyof ExtractedProcessFields, string> = {
  propertyRegistration: "Inscrição imobiliária",
  lot: "Lote",
  block: "Quadra",
  neighborhood: "Bairro",
  applicant: "Requerente",
  address: "Endereço",
  postalCode: "CEP",
  request: "Solicitação",
  category: "Categoria consolidada",
  actionType: "Ação consolidada",
};

const EMPTY_FIELDS: ExtractedProcessFields = {
  propertyRegistration: "",
  lot: "",
  block: "",
  neighborhood: "",
  applicant: "",
  address: "",
  postalCode: "",
  request: "",
  category: "",
  actionType: "",
};

function supported(file: ItemAttachmentRecord) {
  return /\.(pdf|docx?|png|jpe?g|dwg|xlsx?|csv|txt|md|json)$/i.test(file.fileName) || file.contentType.startsWith("text/");
}

function confidenceLabel(value: number) {
  if (value >= 0.8) return "alta";
  if (value >= 0.55) return "média";
  return "revisar";
}

export function ProcessDocumentAnalyzer({
  process,
  onIntegrated,
}: {
  process: ProcessRecord;
  onIntegrated: (record: ProcessEnrichmentRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<ItemAttachmentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fields, setFields] = useState<ExtractedProcessFields>(EMPTY_FIELDS);
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<"idle" | "loading" | "analyzing" | "ready" | "saving">("idle");
  const [error, setError] = useState("");
  const [analysisNote, setAnalysisNote] = useState("");
  const [progress, setProgress] = useState("");

  const selectedFiles = useMemo(() => files.filter((file) => selectedIds.has(file.id)), [files, selectedIds]);

  async function openAnalyzer() {
    setOpen(true);
    setPhase("loading");
    setError("");
    setAnalysisNote("");
    setProgress("");
    try {
      const response = await fetch(`/api/attachments?module=processes&itemId=${encodeURIComponent(process.id)}`, { cache: "no-store" });
      const payload = (await response.json()) as { attachments?: ItemAttachmentRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar os anexos.");
      const nextFiles = payload.attachments ?? [];
      setFiles(nextFiles);
      setSelectedIds(new Set(nextFiles.filter(supported).map((file) => file.id)));
      setFields({
        ...EMPTY_FIELDS,
        propertyRegistration: String(process.propertyRegistration ?? ""),
        applicant: process.applicant,
        category: process.category,
        actionType: process.actionType ?? "",
      });
      setConfidence({});
      setPhase("idle");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar os anexos.");
      setPhase("idle");
    }
  }

  async function analyze() {
    if (!selectedFiles.length) {
      setError("Selecione ao menos um PDF, Word, imagem, DWG, Excel, CSV ou arquivo de texto.");
      return;
    }
    setPhase("analyzing");
    setError("");
    try {
      const textBlocks: string[] = [];
      const skipped: string[] = [];
      for (const attachment of selectedFiles) {
        try {
          setProgress(`Lendo ${attachment.fileName}…`);
          const response = await fetch(`/api/attachments/${attachment.id}`, { cache: "no-store" });
          if (!response.ok) throw new Error("Falha ao baixar");
          const blob = await response.blob();
          textBlocks.push(await extractSearchableText(new File([blob], attachment.fileName, { type: attachment.contentType }), setProgress));
        } catch {
          skipped.push(attachment.fileName);
        }
      }
      const text = textBlocks.join("\n");
      if (!text.trim()) throw new Error("Nenhum texto recuperável foi encontrado nos arquivos selecionados.");
      const result = analyzeProcessText(text, process);
      setFields((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(result.fields).map(([key, value]) => [key, value || current[key as keyof ExtractedProcessFields]])),
      } as ExtractedProcessFields));
      setConfidence(result.confidence);
      setAnalysisNote(`${Object.values(result.fields).filter(Boolean).length} campos sugeridos a partir de ${textBlocks.length} arquivo${textBlocks.length === 1 ? "" : "s"}${skipped.length ? `; ${skipped.length} sem leitura textual` : ""}.`);
      setPhase("ready");
      setProgress("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível analisar os documentos.");
      setPhase("idle");
      setProgress("");
    }
  }

  async function integrate() {
    setPhase("saving");
    setError("");
    try {
      const response = await fetch("/api/process-enrichments", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          processId: process.id,
          ...fields,
          sourceFiles: selectedFiles.map((file) => file.fileName),
          confidence,
        }),
      });
      const payload = (await response.json()) as { enrichment?: ProcessEnrichmentRecord; error?: string };
      if (!response.ok || !payload.enrichment) throw new Error(payload.error ?? "Falha ao integrar os dados.");
      onIntegrated(payload.enrichment);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao integrar os dados.");
      setPhase("ready");
    }
  }

  return (
    <>
      <button type="button" className="primary-button process-send-data-button" onClick={() => void openAnalyzer()}>
        <Send size={17} /> Enviar dados
      </button>
      {open ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true" aria-label={`Leitura inteligente do processo ${process.displayId ?? process.id}`}>
          <div className="attachment-modal process-analysis-modal">
            <header>
              <div><span className="panel-kicker">Leitura inteligente de documentos</span><h2>Integrar dados ao processo</h2><p>{process.displayId ?? process.id} · confira as sugestões antes de salvar.</p></div>
              <button className="icon-only-button" type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={20} /></button>
            </header>

            <section className="process-analysis-files">
              <div><FileSearch size={19} /><strong>Arquivos anexados</strong></div>
              {phase === "loading" ? <p><LoaderCircle size={17} className="spin" /> Carregando anexos…</p> : files.length ? files.map((file) => (
                <label key={file.id} className={!supported(file) ? "unsupported" : ""}>
                  <input type="checkbox" disabled={!supported(file) || phase === "analyzing"} checked={selectedIds.has(file.id)} onChange={() => setSelectedIds((current) => { const next = new Set(current); if (next.has(file.id)) next.delete(file.id); else next.add(file.id); return next; })} />
                  <span>{file.fileName}</span><small>{supported(file) ? "pronto para leitura" : "mantido como anexo; leitura textual indisponível"}</small>
                </label>
              )) : <p><AlertTriangle size={17} /> Nenhum arquivo anexado. Use o botão “Anexar arquivos” primeiro.</p>}
              <button type="button" className="secondary-button" onClick={() => void analyze()} disabled={phase === "loading" || phase === "analyzing" || !selectedFiles.length}>
                {phase === "analyzing" ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />} {phase === "analyzing" ? "Analisando…" : "Analisar documentos"}
              </button>
              {progress ? <p className="analysis-progress"><LoaderCircle size={15} className="spin" /> {progress}</p> : null}
            </section>

            {analysisNote ? <div className="analysis-success"><CheckCircle2 size={17} /> {analysisNote}</div> : null}
            <div className="record-form-grid process-analysis-grid">
              {(Object.keys(FIELD_LABELS) as Array<keyof ExtractedProcessFields>).map((key) => (
                <label key={key} className={key === "address" || key === "request" ? "form-span-2" : ""}>
                  <span>{FIELD_LABELS[key]}{confidence[key] ? <small className={`confidence-${confidenceLabel(confidence[key])}`}>confiança {confidenceLabel(confidence[key])}</small> : null}</span>
                  {key === "request" ? <textarea value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} /> : <input value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} />}
                </label>
              ))}
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="analysis-disclaimer"><Sparkles size={16} /> A leitura sugere dados; a confirmação humana evita que um “lote 12” aventureiro vire “quadra 12”.</div>
            <div className="editor-actions">
              <button type="button" className="primary-button" onClick={() => void integrate()} disabled={phase === "saving" || phase === "loading" || phase === "analyzing"}>
                {phase === "saving" ? <LoaderCircle size={18} className="spin" /> : <CheckCircle2 size={18} />} Integrar ao processo
              </button>
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
