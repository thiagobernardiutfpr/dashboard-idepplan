"use client";

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  CircleX,
  Download,
  FileSearch,
  LoaderCircle,
  Save,
  Search,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { ItemAttachmentRecord, ProcessRecord } from "@/lib/dashboard-types";
import {
  analyzeEivText,
  EIV_LEGAL_SOURCES,
  type EivAnalysisResult,
  type EivCriterionStatus,
} from "@/lib/eiv-analysis";
import { extractSearchableText } from "@/lib/process-document-analysis";

const ACCEPTED = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,application/pdf,image/png,image/jpeg";
const MAX_LOCAL_FILE_SIZE = 500 * 1024 * 1024;

type LocalEivFile = { id: string; file: File };

const STATUS: Record<EivCriterionStatus, { label: string; className: string }> = {
  atendido: { label: "Atendido", className: "eiv-status-attended" },
  "validacao-tecnica": { label: "Validar tecnicamente", className: "eiv-status-review" },
  parcial: { label: "Parcial", className: "eiv-status-partial" },
  "nao-identificado": { label: "Não identificado", className: "eiv-status-missing" },
};

function supported(file: ItemAttachmentRecord) {
  return /\.(pdf|docx?|png|jpe?g|dwg)$/i.test(file.fileName);
}

function formatDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(parsed);
}

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function responseData<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let payload: { error?: string } & Partial<T> = {};
  try { payload = raw ? JSON.parse(raw) as { error?: string } & Partial<T> : {}; } catch {}
  if (!response.ok) {
    const fallback = response.status === 413 || /payload too large/i.test(raw)
      ? "O servidor não aceitou o tamanho desta solicitação. Os documentos grandes devem ser selecionados para leitura local."
      : raw.slice(0, 220) || `Falha na solicitação (${response.status}).`;
    throw new Error(payload.error || fallback);
  }
  return payload as T;
}

function downloadAnalysis(result: EivAnalysisResult, process: ProcessRecord, sourceFiles: string[]) {
  const rows = result.criteria.map((item) => `
    <tr>
      <td>${escapeHtml(item.group)}</td>
      <td><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.requirement)}</small></td>
      <td>${escapeHtml(STATUS[item.status].label)}</td>
      <td>${escapeHtml(item.evidence || "Não localizada automaticamente")}</td>
      <td>${escapeHtml(item.legalBasis)}</td>
      <td>${escapeHtml(item.recommendation)}</td>
    </tr>`).join("");
  const warnings = result.warnings.length
    ? `<ul>${result.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "<p>Nenhum alerta adicional automático.</p>";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Análise EIV</title><style>
    body{font-family:Arial,sans-serif;color:#172431;margin:32px;font-size:10pt}h1{font-size:18pt}h2{font-size:13pt;margin-top:24px}
    .summary{border:1px solid #9fb5c3;background:#eef5f8;padding:14px}.score{font-size:22pt;font-weight:700;color:#087f97}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #aab8c2;padding:7px;vertical-align:top}th{background:#0d3145;color:white}small{color:#4f6471}
    footer{margin-top:24px;border-top:1px solid #ccd6dc;padding-top:10px;color:#4f6471}
  </style></head><body>
    <h1>Relatório automatizado de pré-análise de EIV</h1>
    <div class="summary"><strong>Processo:</strong> ${escapeHtml(process.displayId ?? process.id)}<br>
    <strong>Requerente:</strong> ${escapeHtml(process.companyName || process.applicant || "Não informado")}<br>
    <strong>Arquivos:</strong> ${escapeHtml(sourceFiles.join(", "))}<br>
    <strong>Data:</strong> ${escapeHtml(formatDate(result.analyzedAt))}<br><br>
    <span class="score">${result.coverageScore}%</span> de cobertura textual automatizada<br><strong>${escapeHtml(result.conclusion)}</strong></div>
    <h2>Alertas</h2>${warnings}
    <h2>Matriz de conformidade</h2><table><thead><tr><th>Grupo</th><th>Critério</th><th>Situação</th><th>Evidência localizada</th><th>Fundamento</th><th>Providência</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Base normativa</h2><ul>${EIV_LEGAL_SOURCES.map((source) => `<li>${escapeHtml(source.label)} — ${escapeHtml(source.scope)}</li>`).join("")}</ul>
    <footer>Análise assistiva baseada em presença textual e evidências recuperadas por OCR. Não substitui o parecer da Comissão Técnica de Urbanismo, a deliberação do CMDU, a conferência dos projetos, as manifestações dos órgãos competentes ou a responsabilidade dos profissionais autores.</footer>
  </body></html>`;
  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Analise_EIV_${safeName(process.displayId ?? process.id)}.doc`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
}

export function EivAnalyzer({ process }: { process: ProcessRecord }) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<ItemAttachmentRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localFiles, setLocalFiles] = useState<LocalEivFile[]>([]);
  const [selectedLocalIds, setSelectedLocalIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<EivAnalysisResult | null>(null);
  const [resultFiles, setResultFiles] = useState<string[]>([]);
  const [filter, setFilter] = useState<"todos" | EivCriterionStatus>("todos");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "reading" | "saving">("idle");
  const [progress, setProgress] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const selectedFiles = useMemo(() => files.filter((file) => selectedIds.has(file.id)), [files, selectedIds]);
  const selectedLocalFiles = useMemo(() => localFiles.filter((file) => selectedLocalIds.has(file.id)), [localFiles, selectedLocalIds]);
  const selectedCount = selectedFiles.length + selectedLocalFiles.length;
  const visibleCriteria = useMemo(() => {
    if (!result) return [];
    const search = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return result.criteria.filter((item) => {
      if (filter !== "todos" && item.status !== filter) return false;
      if (!search) return true;
      const source = `${item.group} ${item.title} ${item.requirement} ${item.legalBasis} ${item.evidence}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
      return source.includes(search);
    });
  }, [filter, query, result]);

  async function openAnalyzer() {
    setOpen(true);
    setPhase("loading");
    setError("");
    setNote("");
    setLocalFiles([]);
    setSelectedLocalIds(new Set());
    try {
      const [attachmentsResponse, savedResponse] = await Promise.all([
        fetch(`/api/attachments?module=processes&itemId=${encodeURIComponent(process.id)}`, { cache: "no-store" }),
        fetch(`/api/eiv-analyses?processId=${encodeURIComponent(process.id)}`, { cache: "no-store" }),
      ]);
      const attachmentsPayload = await responseData<{ attachments?: ItemAttachmentRecord[] }>(attachmentsResponse);
      const next = attachmentsPayload.attachments ?? [];
      setFiles(next);
      setSelectedIds(new Set(next.filter(supported).map((file) => file.id)));
      if (savedResponse.ok) {
        const savedPayload = await responseData<{ analysis?: { result: EivAnalysisResult; sourceFiles: string[]; analyzedAt: string } | null }>(savedResponse);
        if (savedPayload.analysis?.result) {
          setResult(savedPayload.analysis.result);
          setResultFiles(savedPayload.analysis.sourceFiles ?? []);
          setNote(`Última análise compartilhada recuperada · ${formatDate(savedPayload.analysis.analyzedAt)}.`);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível preparar a análise do EIV.");
    } finally {
      setPhase("idle");
    }
  }

  function selectLocalFiles(selected: FileList | null) {
    if (!selected?.length) return;
    setError("");
    setNote("");
    try {
      const additions: LocalEivFile[] = [];
      for (const file of Array.from(selected)) {
        if (!/\.(pdf|docx?|png|jpe?g|dwg)$/i.test(file.name)) throw new Error(`${file.name}: formato não aceito para análise de EIV.`);
        if (file.size > MAX_LOCAL_FILE_SIZE) throw new Error(`${file.name}: o limite para leitura local é 500 MB.`);
        additions.push({ id: `local:${crypto.randomUUID()}`, file });
      }
      setLocalFiles((current) => [...current, ...additions]);
      setSelectedLocalIds((current) => new Set([...current, ...additions.map((item) => item.id)]));
      setNote(`${additions.length} arquivo${additions.length === 1 ? "" : "s"} selecionado${additions.length === 1 ? "" : "s"} para leitura local, sem envio ao servidor.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível selecionar os documentos.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function persist(nextResult: EivAnalysisResult, sourceFiles: string[]) {
    setPhase("saving");
    setProgress("Salvando a análise na base compartilhada…");
    const response = await fetch("/api/eiv-analyses", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ processId: process.id, result: nextResult, sourceFiles }),
    });
    await responseData(response);
  }

  async function analyze() {
    if (!selectedCount) {
      setError("Selecione ao menos um documento local ou um anexo do processo.");
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
          const text = await extractSearchableText(
            new File([blob], attachment.fileName, { type: attachment.contentType }),
            setProgress,
            { maxOcrPages: 60 },
          );
          blocks.push(`\n=== ${attachment.fileName} ===\n${text}`);
        } catch {
          skipped.push(attachment.fileName);
        }
      }
      for (const local of selectedLocalFiles) {
        setProgress(`Lendo localmente ${local.file.name}…`);
        try {
          const text = await extractSearchableText(local.file, setProgress, { maxOcrPages: 60 });
          blocks.push(`\n=== ${local.file.name} ===\n${text}`);
        } catch {
          skipped.push(local.file.name);
        }
      }
      const text = blocks.join("\n");
      if (text.replace(/===.*?===/g, "").trim().length < 100) throw new Error("Nenhum conteúdo textual suficiente foi recuperado. Confira o PDF/OCR ou envie volumes com melhor resolução.");
      setProgress("Comparando o conteúdo com o parecer, o Plano Diretor e o Estatuto da Cidade…");
      const nextResult = analyzeEivText(text);
      const sourceFiles = [
        ...selectedFiles.map((file) => file.fileName),
        ...selectedLocalFiles.map((item) => item.file.name),
      ].filter((fileName) => !skipped.includes(fileName));
      setResult(nextResult);
      setResultFiles(sourceFiles);
      await persist(nextResult, sourceFiles);
      setNote(`Análise concluída e salva. ${nextResult.criteria.length} critérios verificados em ${sourceFiles.length} arquivo${sourceFiles.length === 1 ? "" : "s"}${skipped.length ? `; ${skipped.length} sem leitura recuperável` : ""}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível analisar o EIV.");
    } finally {
      setProgress("");
      setPhase("idle");
    }
  }

  function statusIcon(status: EivCriterionStatus) {
    if (status === "atendido") return <CheckCircle2 size={17} />;
    if (status === "nao-identificado") return <CircleX size={17} />;
    if (status === "parcial") return <AlertTriangle size={17} />;
    return <CircleHelp size={17} />;
  }

  return (
    <>
      <button type="button" className="primary-button eiv-analyzer-launch" onClick={() => void openAnalyzer()}>
        <FileSearch size={18} /> Analisar EIV
      </button>
      {open ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true" aria-label={`Analisar EIV do processo ${process.displayId ?? process.id}`}>
          <div className="attachment-modal eiv-analyzer-modal">
            <header>
              <div>
                <span className="panel-kicker">Parecer técnico + Plano Diretor + Estatuto da Cidade</span>
                <h2>Analisar Estudo de Impacto de Vizinhança</h2>
                <p>{process.displayId ?? process.id} · análise documental assistiva com evidências e pendências revisáveis.</p>
              </div>
              <button className="icon-only-button" type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={20} /></button>
            </header>

            <section className="eiv-upload-panel">
              <div className="eiv-upload-heading">
                <span><UploadCloud size={20} /><strong>Documentos do EIV</strong><small>Seleção local de PDF, DOC, DOCX, PNG, JPG, JPEG e DWG — arquivos grandes não são enviados ao servidor.</small></span>
                <input ref={input} className="sr-only" type="file" multiple accept={ACCEPTED} onChange={(event) => selectLocalFiles(event.target.files)} />
                <button type="button" className="secondary-button" onClick={() => input.current?.click()} disabled={phase !== "idle"}>
                  <UploadCloud size={17} /> Selecionar documentos
                </button>
              </div>
              {localFiles.length ? (
                <div className="eiv-file-list eiv-local-file-list">
                  {localFiles.map((item) => (
                    <div key={item.id} className="eiv-local-file-row">
                      <label>
                        <input type="checkbox" disabled={phase !== "idle"} checked={selectedLocalIds.has(item.id)} onChange={() => setSelectedLocalIds((current) => {
                          const next = new Set(current);
                          if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                          return next;
                        })} />
                        <span>{item.file.name}</span>
                        <small>leitura local · {(item.file.size / 1024 / 1024).toFixed(1)} MB</small>
                      </label>
                      <button type="button" className="row-action icon-row-action danger-row-action" aria-label={`Remover ${item.file.name}`} title="Remover da seleção" disabled={phase !== "idle"} onClick={() => {
                        setLocalFiles((current) => current.filter((file) => file.id !== item.id));
                        setSelectedLocalIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
                      }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ) : null}
              {phase === "loading" ? <p><LoaderCircle size={17} className="spin" /> Carregando anexos existentes…</p> : files.length ? (
                <div className="eiv-file-list">
                  {files.map((file) => (
                    <label key={file.id} className={!supported(file) ? "unsupported" : ""}>
                      <input type="checkbox" disabled={!supported(file) || phase !== "idle"} checked={selectedIds.has(file.id)} onChange={() => setSelectedIds((current) => {
                        const next = new Set(current);
                        if (next.has(file.id)) next.delete(file.id); else next.add(file.id);
                        return next;
                      })} />
                      <span>{file.fileName}</span>
                      <small>{supported(file) ? (/\.dwg$/i.test(file.fileName) ? "DWG: leitura textual, não geométrica" : "selecionável") : "formato preservado apenas como anexo"}</small>
                    </label>
                  ))}
                </div>
              ) : localFiles.length ? null : <p><AlertTriangle size={17} /> Nenhum documento selecionado ou anexado a este processo.</p>}
              {files.length ? <p className="eiv-existing-files-note">Arquivos anexados anteriormente ao processo também podem ser incluídos na análise.</p> : null}
              <button type="button" className="primary-button eiv-run-button" onClick={() => void analyze()} disabled={phase !== "idle" || !selectedCount}>
                {phase === "reading" || phase === "saving" ? <LoaderCircle size={18} className="spin" /> : <Search size={18} />} {phase === "reading" ? "Lendo e comparando…" : phase === "saving" ? "Salvando…" : `Analisar ${selectedCount || ""} documento${selectedCount === 1 ? "" : "s"}`}
              </button>
            </section>

            {progress ? <p className="analysis-progress"><LoaderCircle size={15} className="spin" /> {progress}</p> : null}
            {note ? <div className="analysis-success"><CheckCircle2 size={17} /> {note}</div> : null}
            {error ? <div className="form-error">{error}</div> : null}

            {result ? (
              <div className="eiv-results">
                <section className="eiv-summary-card">
                  <div className="eiv-score"><strong>{result.coverageScore}%</strong><span>cobertura textual</span></div>
                  <div><span className="panel-kicker">Conclusão automática preliminar</span><h3>{result.conclusion}</h3><p>{result.searchableCharacters.toLocaleString("pt-BR")} caracteres analisados · {resultFiles.length} arquivo{resultFiles.length === 1 ? "" : "s"}.</p></div>
                  <button type="button" className="secondary-button" onClick={() => downloadAnalysis(result, process, resultFiles)}><Download size={17} /> Baixar análise</button>
                </section>

                <div className="eiv-count-grid">
                  {(Object.keys(STATUS) as EivCriterionStatus[]).map((status) => (
                    <button key={status} type="button" className={`${STATUS[status].className} ${filter === status ? "active" : ""}`} onClick={() => setFilter((current) => current === status ? "todos" : status)}>
                      {statusIcon(status)}<strong>{result.counts[status]}</strong><span>{STATUS[status].label}</span>
                    </button>
                  ))}
                </div>

                {result.warnings.length ? <section className="eiv-warning-list"><strong><AlertTriangle size={17} /> Alertas transversais</strong>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</section> : null}

                <section className="eiv-legal-basis">
                  <BookOpen size={19} />
                  <div><strong>Base normativa aplicada</strong><span>{EIV_LEGAL_SOURCES.map((source) => <a key={source.href} href={source.href} target="_blank" rel="noreferrer">{source.label} · {source.scope}</a>)}</span></div>
                </section>

                <div className="eiv-result-tools">
                  <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tópico, fundamento ou evidência" /></label>
                  {filter !== "todos" ? <button type="button" className="secondary-button" onClick={() => setFilter("todos")}>Mostrar todos</button> : null}
                </div>

                <div className="eiv-criteria-list">
                  {visibleCriteria.map((item) => (
                    <article key={item.id} className={STATUS[item.status].className}>
                      <header><div><span>{item.group} · prioridade {item.importance}</span><h4>{item.title}</h4></div><strong>{statusIcon(item.status)} {STATUS[item.status].label}</strong></header>
                      <p>{item.requirement}</p>
                      <dl>
                        <div><dt>Evidência localizada</dt><dd>{item.evidence || "Nenhum trecho foi localizado automaticamente."}</dd></div>
                        <div><dt>Fundamento</dt><dd>{item.legalBasis}</dd></div>
                        <div><dt>Providência sugerida</dt><dd>{item.recommendation}</dd></div>
                      </dl>
                    </article>
                  ))}
                  {!visibleCriteria.length ? <div className="attachment-empty">Nenhum critério corresponde ao filtro atual.</div> : null}
                </div>
              </div>
            ) : null}

            <div className="analysis-disclaimer"><Save size={16} /> Arquivos selecionados localmente permanecem no computador; somente a análise e os nomes das fontes são salvos na base compartilhada. Evidência textual não comprova suficiência técnica: projetos, quantitativos, fontes, manifestações setoriais e responsabilidade profissional devem ser conferidos antes do parecer.</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
