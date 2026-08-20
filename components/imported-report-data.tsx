"use client";

import { ChevronDown, Database, FileSpreadsheet, LoaderCircle, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ItemModule, ReportImportRowRecord } from "@/lib/dashboard-types";

function formatDateTime(value: string) {
  const parsed = new Date(value.replace(" ", "T") + (value.includes("Z") || value.includes("+") ? "" : "Z"));
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parsed);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function ImportedReportData({ module, refreshToken }: { module: ItemModule; refreshToken: number }) {
  const [rows, setRows] = useState<ReportImportRowRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/report-imports?module=${encodeURIComponent(module)}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const payload = await response.json() as { rows?: ReportImportRowRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error);
      setRows(payload.rows ?? []);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha ao carregar dados importados."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [module, refreshToken]);

  const filtered = useMemo(() => {
    const query = normalize(search.trim());
    return rows.filter((row) => !query || normalize(`${row.sourceFile} ${row.sourceSheet} ${Object.entries(row.data).flat().join(" ")}`).includes(query));
  }, [rows, search]);
  const columns = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.slice(0, 200).forEach((row) => Object.keys(row.data).forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1)));
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8).map(([key]) => key);
  }, [filtered]);
  const sourceCount = new Set(rows.map((row) => row.sourceFile)).size;

  return <section className={`panel imported-report-panel ${open ? "open" : ""}`}>
    <button className="imported-report-heading" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span className="kpi-icon cyan"><Database size={18}/></span>
      <span><strong>Dados incorporados por relatórios</strong><small>{loading ? "Atualizando a base…" : `${rows.length} ${rows.length === 1 ? "linha" : "linhas"} · ${sourceCount} arquivo${sourceCount === 1 ? "" : "s"}`}</small></span>
      {loading ? <LoaderCircle className="spin" size={18}/> : <ChevronDown className="imported-chevron" size={19}/>} 
    </button>
    {open ? <div className="imported-report-content">
      <label className="imported-report-search"><Search size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar em todas as colunas importadas"/></label>
      {error ? <div className="module-error">{error}</div> : null}
      <div className="table-scroll"><table><thead><tr><th>Origem</th>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{filtered.slice(0, 300).map((row) => <tr key={row.id}><td><strong><FileSpreadsheet size={14}/> {row.sourceFile}</strong><small>{row.sourceSheet ? `${row.sourceSheet} · ` : ""}linha {row.sourceRow} · {formatDateTime(row.importedAt)}</small></td>{columns.map((column) => <td key={column}>{row.data[column] || "—"}</td>)}</tr>)}{!filtered.length ? <tr><td colSpan={Math.max(1, columns.length + 1)} className="empty-state">{loading ? "Carregando dados…" : "Nenhuma linha importada neste módulo."}</td></tr> : null}</tbody></table></div>
      {filtered.length > 300 ? <p className="imported-limit-note">Exibindo as 300 linhas mais recentes desta busca.</p> : null}
    </div> : null}
  </section>;
}
