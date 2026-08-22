"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  MapPinned,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import type { EmpresaFacilImportRecord, ItemModule } from "@/lib/dashboard-types";
import { readApiJson, uploadAttachment } from "@/lib/api-client";
import { enrichRowsWithPropertyCoordinates } from "@/lib/property-coordinates-client";

type ImportSummary = {
  rowCount: number;
  insertedCount: number;
  updatedCount: number;
  fileStored?: boolean;
};

type ReportImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: (summary: ImportSummary, destination: ItemModule) => void;
};

const IMPORT_DESTINATIONS: Array<{ value: ItemModule; label: string }> = [
  { value: "processes", label: "Painel de Processos" },
  { value: "projects", label: "Projetos" },
  { value: "procurements", label: "Licitações" },
  { value: "agenda", label: "Agenda" },
  { value: "geoprocessing", label: "Demandas de Geoprocessamento" },
  { value: "empresa-facil", label: "Empresa Fácil" },
  { value: "consultation", label: "Consulta Geral" },
  { value: "festivals", label: "Festas" },
  { value: "staff-demands", label: "Demandas por Servidor" },
  { value: "master-plan", label: "Revisão do Plano Diretor" },
  { value: "councils", label: "Conselhos e Comissões" },
  { value: "pai", label: "PAI · Plano de Ação e Investimentos" },
];

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

function clean(value: unknown) {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function cleanReportField(value: unknown) {
  const result = clean(value);
  return result === "36" ? "" : result;
}

function normalize(value: unknown) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function normalizeDateTime(value: unknown) {
  const input = clean(value);
  const brazilian = input.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (brazilian) {
    const [, day, month, year, hour = "00", minute = "00", second = "00"] = brazilian;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] = iso;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  }
  return input;
}

function findHeaderColumn(headers: unknown[], terms: string[], fallback: number) {
  const index = headers.findIndex((header) => {
    const normalized = normalize(header);
    return terms.every((term) => normalized.includes(term));
  });
  return index >= 0 ? index : fallback;
}

function parseEmpresaFacilRows(rows: unknown[][]) {
  const headerRowIndex = rows.findIndex((row) => {
    const headers = row.map(normalize);
    return (
      headers.some((value) => value === "codigo") &&
      headers.some((value) => value === "status") &&
      headers.some((value) => value.includes("tipo de acao"))
    );
  });
  if (headerRowIndex < 0) {
    throw new Error("O cabeçalho do relatório Empresa Fácil não foi reconhecido.");
  }

  const headers = rows[headerRowIndex];
  const columns = {
    code: findHeaderColumn(headers, ["codigo"], 0),
    status: findHeaderColumn(headers, ["status"], 1),
    actionType: findHeaderColumn(headers, ["tipo", "acao"], 2),
    protocol: findHeaderColumn(headers, ["protocolo"], 4),
    requestedAt: findHeaderColumn(headers, ["data", "solicitacao"], 6),
    riskLevel: findHeaderColumn(headers, ["grau", "risco"], 7),
    propertyCode: findHeaderColumn(headers, ["cadastro", "imobiliario", "codigo"], 8),
    propertyRegistration: findHeaderColumn(headers, ["inscricao", "imobiliaria"], 9),
    activityCode: findHeaderColumn(headers, ["atividade", "principal", "codigo"], 10),
    activityDescription: findHeaderColumn(headers, ["atividade", "principal", "descricao"], 11),
    cnpj: findHeaderColumn(headers, ["cnpj"], 12),
    classification: findHeaderColumn(headers, ["enquadramento"], 13),
    applicantCode: findHeaderColumn(headers, ["solicitante", "codigo"], 14),
    applicantName: findHeaderColumn(headers, ["solicitante", "nome"], 15),
    economicRegistration: findHeaderColumn(headers, ["economico", "cadastro"], 16),
    companyName: findHeaderColumn(headers, ["economico", "contribuinte", "nome"], 18),
    indicators: findHeaderColumn(headers, ["indicativos"], 21),
  };

  return rows.slice(headerRowIndex + 1).flatMap<EmpresaFacilImportRecord>((row) => {
    const code = clean(row[columns.code]);
    if (!/^\d+$/.test(code)) return [];
    return [{
      id: code,
      code,
      status: clean(row[columns.status]),
      actionType: clean(row[columns.actionType]),
      protocol: clean(row[columns.protocol]),
      requestedAt: normalizeDateTime(row[columns.requestedAt]),
      riskLevel: clean(row[columns.riskLevel]),
      propertyCode: clean(row[columns.propertyCode]),
      propertyRegistration: cleanReportField(row[columns.propertyRegistration]),
      primaryActivityCode: clean(row[columns.activityCode]),
      primaryActivityDescription: clean(row[columns.activityDescription]),
      cnpj: clean(row[columns.cnpj]),
      classification: clean(row[columns.classification]),
      applicantCode: clean(row[columns.applicantCode]),
      applicantName: clean(row[columns.applicantName]),
      economicRegistration: cleanReportField(row[columns.economicRegistration]),
      companyName: cleanReportField(row[columns.companyName]),
      indicators: clean(row[columns.indicators]),
    }];
  }).filter((record) => record.status && record.actionType && record.requestedAt);
}

async function parseEmpresaFacilExcel(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha não possui abas disponíveis.");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  return parseEmpresaFacilRows(rows);
}

function uniqueHeaders(row: unknown[]) {
  const used = new Map<string, number>();
  return row.map((cell, index) => {
    const base = clean(cell) || `Coluna ${index + 1}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

function headerRowIndex(rows: unknown[][]) {
  return rows.slice(0, 30).reduce((best, row, index) => {
    const populated = row.filter((cell) => clean(cell));
    const textCells = populated.filter((cell) => !/^[-+]?\d+(?:[.,]\d+)?$/.test(clean(cell))).length;
    const score = populated.length * 2 + textCells;
    return score > best.score ? { index, score } : best;
  }, { index: 0, score: -1 }).index;
}

async function parseWorkbookRows(file: File) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const records: Array<Record<string, unknown>> = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false }) as unknown[][];
    if (!rows.length) continue;
    const headerIndex = headerRowIndex(rows);
    const headers = uniqueHeaders(rows[headerIndex] ?? []);
    rows.slice(headerIndex + 1).forEach((row, offset) => {
      if (!row.some((cell) => clean(cell))) return;
      const record: Record<string, unknown> = { _sheet: sheetName, _row: headerIndex + offset + 2 };
      headers.forEach((header, index) => { if (clean(row[index])) record[header] = clean(row[index]); });
      records.push(record);
    });
  }
  if (!records.length) throw new Error("A planilha não possui linhas preenchidas para importação.");
  return records;
}

async function parseGenericPdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const records: Array<Record<string, unknown>> = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = (content.items as PdfTextItem[]).map((item) => clean(item.str)).filter(Boolean).join(" ");
    if (pageText) records.push({ _sheet: `Página ${pageNumber}`, _row: pageNumber, Página: pageNumber, Conteúdo: pageText });
  }
  if (!records.length) throw new Error("O PDF não possui texto pesquisável. Utilize a versão Excel ou um PDF com reconhecimento de texto.");
  return records;
}

function nearestColumn(xRatio: number) {
  const anchors = [
    0.018, 0.06, 0.105, 0.155, 0.21, 0.27, 0.315, 0.36, 0.41,
    0.48, 0.595, 0.65, 0.70, 0.76, 0.835, 0.89, 0.975,
  ];
  return anchors.reduce(
    (best, anchor, index) =>
      Math.abs(anchor - xRatio) < Math.abs(anchors[best] - xRatio) ? index : best,
    0,
  );
}

function pdfColumnsToRecord(columns: string[][]): EmpresaFacilImportRecord | null {
  const value = (index: number) => clean(columns[index]?.join(" "));
  const code = value(0);
  if (!/^\d+$/.test(code)) return null;
  const actionCell = value(2);
  const protocolFromAction = actionCell.match(/PR[PB][A-Z0-9-]+/i)?.[0] ?? "";
  const protocol = value(3) || protocolFromAction;
  const record: EmpresaFacilImportRecord = {
    id: code,
    code,
    status: value(1),
    actionType: protocolFromAction ? clean(actionCell.replace(protocolFromAction, "")) : actionCell,
    protocol,
    requestedAt: normalizeDateTime(value(4)),
    riskLevel: value(5),
    propertyCode: value(6),
    propertyRegistration: cleanReportField(value(7)),
    primaryActivityCode: value(8),
    primaryActivityDescription: value(9),
    cnpj: value(10),
    classification: value(11),
    applicantCode: value(12),
    applicantName: value(13),
    economicRegistration: cleanReportField(value(14)),
    companyName: cleanReportField(value(15)),
    indicators: value(16),
  };
  return record.status && record.actionType && record.requestedAt ? record : null;
}

async function parsePdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerUrl = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const records: EmpresaFacilImportRecord[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = (content.items as PdfTextItem[])
      .map((item) => ({
        text: clean(item.str),
        x: item.transform?.[4] ?? 0,
        y: item.transform?.[5] ?? 0,
      }))
      .filter((item) => item.text)
      .sort((left, right) => right.y - left.y || left.x - right.x);

    let current: string[][] | null = null;
    for (const item of items) {
      const ratio = item.x / viewport.width;
      if (/^\d{1,10}$/.test(item.text) && ratio < 0.045) {
        if (current) {
          const record = pdfColumnsToRecord(current);
          if (record) records.push(record);
        }
        current = Array.from({ length: 17 }, () => [] as string[]);
        current[0].push(item.text);
        continue;
      }
      if (!current || ratio < 0.03) continue;
      const column = nearestColumn(ratio);
      current[column].push(item.text);
    }
    if (current) {
      const record = pdfColumnsToRecord(current);
      if (record) records.push(record);
    }
  }

  if (!records.length) {
    throw new Error(
      "Não foi possível identificar linhas no PDF. Utilize um PDF com texto pesquisável ou a versão Excel do relatório.",
    );
  }
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(value / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function ReportImportModal({ open, onClose, onImported }: ReportImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [destination, setDestination] = useState<ItemModule>("processes");
  const [file, setFile] = useState<File | null>(null);
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [genericInspection, setGenericInspection] = useState<{ count: number; unit: string } | null>(null);
  const [automaticCoordinateCount, setAutomaticCoordinateCount] = useState(0);
  const [state, setState] = useState<"idle" | "parsing" | "ready" | "importing" | "success">("idle");
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  function closeModal() {
    setFile(null);
    setRecords([]);
    setGenericInspection(null);
    setAutomaticCoordinateCount(0);
    setState("idle");
    setError("");
    setSummary(null);
    setUploadProgress(0);
    if (inputRef.current) inputRef.current.value = "";
    onClose();
  }

  function changeDestination(next: ItemModule) {
    setDestination(next);
    setFile(null);
    setRecords([]);
    setGenericInspection(null);
    setAutomaticCoordinateCount(0);
    setSummary(null);
    setUploadProgress(0);
    setError("");
    setState("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (!open) return null;

  const destinationLabel = IMPORT_DESTINATIONS.find((option) => option.value === destination)?.label ?? "Módulo";
  const empresaPreview = records as unknown as EmpresaFacilImportRecord[];

  async function selectFile(selected: File | null) {
    if (!selected) return;
    setFile(selected);
    setRecords([]);
    setGenericInspection(null);
    setAutomaticCoordinateCount(0);
    setSummary(null);
    setError("");
    if (selected.size > 25 * 1024 * 1024) {
      setState("idle");
      setError("O relatório deve ter no máximo 25 MB.");
      return;
    }
    const lowerName = selected.name.toLocaleLowerCase("pt-BR");
    if (![".pdf", ".xls", ".xlsx"].some((extension) => lowerName.endsWith(extension))) {
      setState("idle");
      setError("Selecione um relatório em PDF, XLS ou XLSX.");
      return;
    }
    setState("parsing");
    try {
      if (destination === "empresa-facil") {
        const parsed = lowerName.endsWith(".pdf") ? await parsePdf(selected) : await parseEmpresaFacilExcel(selected);
        if (!parsed.length) throw new Error("Nenhum registro válido foi encontrado no relatório.");
        const geocoded = await enrichRowsWithPropertyCoordinates(parsed as unknown as Array<Record<string, unknown>>);
        setRecords(geocoded.rows);
        setAutomaticCoordinateCount(geocoded.matched);
        setGenericInspection({ count: parsed.length, unit: "registros reconhecidos" });
      } else {
        const parsed = lowerName.endsWith(".pdf") ? await parseGenericPdf(selected) : await parseWorkbookRows(selected);
        const geocoded = await enrichRowsWithPropertyCoordinates(parsed);
        setRecords(geocoded.rows);
        setAutomaticCoordinateCount(geocoded.matched);
        setGenericInspection({ count: parsed.length, unit: parsed.length === 1 ? "registro reconhecido" : "registros reconhecidos" });
      }
      setState("ready");
    } catch (parseError) {
      setState("idle");
      setError(parseError instanceof Error ? parseError.message : "Não foi possível ler o relatório.");
    }
  }

  async function importReport() {
    if (!file || state !== "ready") return;
    setState("importing");
    setError("");
    setUploadProgress(0);
    try {
      await uploadAttachment({
        file,
        module: destination,
        itemId: "__module__",
        onProgress: (value) => setUploadProgress(Math.round(value * 0.45)),
      });

      const response = await fetch("/api/report-imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          module: destination,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          records,
        }),
      });
      const payload = await readApiJson<{ import?: ImportSummary; error?: string }>(response);
      if (!response.ok || !payload.import) {
        throw new Error(payload.error ?? "Não foi possível importar o relatório.");
      }
      const imported = { ...payload.import, fileStored: true };
      setUploadProgress(100);
      setSummary(imported);
      setState("success");
      onImported(imported, destination);
    } catch (importError) {
      setState("ready");
      setError(importError instanceof Error ? importError.message : "Não foi possível importar o relatório.");
    }
  }

  return (
    <div className="procurement-form-overlay" role="dialog" aria-modal="true" aria-labelledby="report-import-title">
      <section className="procurement-form-panel report-import-panel">
        <div className="procurement-form-heading">
          <div>
            <p className="panel-kicker">Base compartilhada</p>
            <h2 id="report-import-title">Importar relatório</h2>
          </div>
          <button className="icon-button" type="button" onClick={closeModal} aria-label="Fechar importação">
            <X size={18} />
          </button>
        </div>

        {state === "success" && summary ? (
          <div className="import-success-state">
            <span className="import-success-icon"><CheckCircle2 size={30} /></span>
            <h3>Dados e relatório incorporados</h3>
            <p>{`${summary.rowCount} ${summary.rowCount === 1 ? "registro processado" : "registros processados"} · ${summary.insertedCount} ${summary.insertedCount === 1 ? "novo" : "novos"} · ${summary.updatedCount} ${summary.updatedCount === 1 ? "atualizado" : "atualizados"}. O módulo foi recarregado e o arquivo original também foi preservado.`}</p>
            <button className="primary-button" type="button" onClick={closeModal}>
              Ver {destinationLabel} <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <>
            <div className="import-destination-card">
              <Database size={19} />
              <label>
                <strong>Destino do relatório</strong>
                <select value={destination} onChange={(event) => changeDestination(event.target.value as ItemModule)} disabled={state === "parsing" || state === "importing"}>{IMPORT_DESTINATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                <span>As linhas reconhecidas alimentarão o módulo escolhido; o arquivo original também será preservado em Arquivos.</span>
              </label>
            </div>

            <button
              className={`report-drop-zone ${state === "parsing" ? "parsing" : ""}`}
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={state === "parsing" || state === "importing"}
            >
              {state === "parsing" ? <LoaderCircle size={30} className="spin" /> : <UploadCloud size={30} />}
              <strong>{state === "parsing" ? "Lendo e validando o relatório…" : "Selecionar relatório"}</strong>
              <span>PDF pesquisável, XLS ou XLSX · até 25 MB</span>
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => void selectFile(event.target.files?.[0] ?? null)}
              />
            </button>

            {file ? (
              <div className="selected-report-card">
                {file.name.toLocaleLowerCase("pt-BR").endsWith(".pdf") ? <FileText size={21} /> : <FileSpreadsheet size={21} />}
                <div>
                  <strong>{file.name}</strong>
                  <span>{formatBytes(file.size)}</span>
                </div>
                {state === "ready" ? <span className="status-badge badge-green">{`${genericInspection?.count ?? records.length} ${genericInspection?.unit ?? "registros"}`}</span> : null}
              </div>
            ) : null}

            {state === "ready" && automaticCoordinateCount > 0 ? (
              <div className="coordinate-match-note"><MapPinned size={17} /> {automaticCoordinateCount} {automaticCoordinateCount === 1 ? "linha localizada" : "linhas localizadas"} automaticamente pela inscrição imobiliária.</div>
            ) : null}

            {error ? <div className="form-error import-error"><AlertTriangle size={17} /> {error}</div> : null}

            {state === "ready" && destination === "empresa-facil" ? (
              <div className="import-preview">
                <div>
                  <strong>Prévia da importação</strong>
                  <span>Primeiros registros reconhecidos</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Código</th><th>Protocolo</th><th>Situação</th><th>Solicitante</th><th>Risco</th></tr></thead>
                    <tbody>
                      {empresaPreview.slice(0, 4).map((record) => (
                        <tr key={record.id}>
                          <td><strong>{record.code}</strong></td>
                          <td>{record.protocol || "—"}</td>
                          <td>{record.status}</td>
                          <td>{record.applicantName}</td>
                          <td>{record.riskLevel || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <p className="import-privacy-note">{destination === "empresa-facil" ? "No Empresa Fácil, as linhas reconhecidas alimentam a base estruturada e o arquivo original permanece disponível no módulo. PDFs devem conter texto pesquisável." : `As linhas reconhecidas serão incorporadas em ${destinationLabel}; campos conhecidos também alimentarão listas, indicadores e gráficos do módulo. O arquivo original permanecerá disponível em Arquivos.`}</p>

            <div className="procurement-form-actions">
              <button className="secondary-button" type="button" onClick={closeModal} disabled={state === "importing"}>Cancelar</button>
              <button className="primary-button" type="button" onClick={() => void importReport()} disabled={state !== "ready"}>
                {state === "importing" ? <LoaderCircle size={18} className="spin" /> : <Database size={18} />}
                {state === "importing" ? `Importando${uploadProgress ? ` · ${uploadProgress}%` : "…"}` : `Importar para ${destinationLabel}`}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
