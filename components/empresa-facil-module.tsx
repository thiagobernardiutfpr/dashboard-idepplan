"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  FileClock,
  FilterX,
  LoaderCircle,
  Plus,
  Save,
  Search,
  ShieldAlert,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ItemFilesButton, ItemLifecycleActions, useItemLifecycle } from "@/components/item-lifecycle";
import {
  BulkAssignmentBar,
  ResponsibleSelect,
  SelectionIconButton,
} from "@/components/responsibility-controls";
import { assignmentKey } from "@/lib/assignments";
import type {
  AssignmentMap,
  AssignResponsible,
  EmpresaFacilRecord,
  ReportImportRecord,
} from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

const PAGE_SIZE = 15;
const newDraft = () => ({ code: "", protocol: "", status: "Em Análise", actionType: "Inscrição Municipal", requestedAt: new Date().toISOString().slice(0, 16), riskLevel: "", applicantName: "", companyName: "", cnpj: "", primaryActivityDescription: "", propertyRegistration: "", classification: "" });

type EmpresaFacilModuleProps = {
  assignments: AssignmentMap;
  onAssign: AssignResponsible;
  assignmentSaving: boolean;
  onOpenImporter: () => void;
  refreshToken: number;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function riskClass(value: string) {
  if (value === "Alto Risco") return "badge-danger";
  if (value === "Médio Risco") return "badge-amber";
  if (value === "Baixo Risco") return "badge-green";
  return "badge-neutral";
}

function statusClass(value: string) {
  if (value === "Em Análise") return "badge-violet";
  if (value === "Aguardando Solicitação") return "badge-amber";
  return "badge-neutral";
}

function actionClass(value: string) {
  if (value === "Inscrição Municipal") return "badge-cyan";
  if (value === "Alteração") return "badge-blue";
  return "badge-neutral";
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function EmpresaFacilModule({
  assignments,
  onAssign,
  assignmentSaving,
  onOpenImporter,
  refreshToken,
}: EmpresaFacilModuleProps) {
  const { getState } = useItemLifecycle();
  const [records, setRecords] = useState<EmpresaFacilRecord[]>([]);
  const [imports, setImports] = useState<ReportImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResponsible, setBulkResponsible] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState(newDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadRecords() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/empresa-facil", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          records?: EmpresaFacilRecord[];
          imports?: ReportImportRecord[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar o Empresa Fácil.");
        setRecords(payload.records ?? []);
        setImports(payload.imports ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(error instanceof Error ? error.message : "Falha ao carregar o Empresa Fácil.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadRecords();
    return () => controller.abort();
  }, [refreshToken]);

  const statuses = useMemo(() => [...new Set(records.map((record) => record.status))].sort(), [records]);
  const actions = useMemo(() => [...new Set(records.map((record) => record.actionType))].sort(), [records]);
  const risks = useMemo(() => [...new Set(records.map((record) => record.riskLevel).filter(Boolean))].sort(), [records]);

  const filteredRecords = useMemo(() => {
    const query = normalizeSearch(search.trim());
    return records.filter((record) => {
      if (getState("empresa-facil", record.id)?.removed) return false;
      const responsible = assignments[assignmentKey("empresa-facil", record.id)]?.responsible ?? "";
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      if (actionFilter !== "all" && record.actionType !== actionFilter) return false;
      if (riskFilter !== "all" && record.riskLevel !== riskFilter) return false;
      if (responsibleFilter === "__unassigned" && responsible) return false;
      if (
        responsibleFilter !== "all" &&
        responsibleFilter !== "__unassigned" &&
        responsible !== responsibleFilter
      ) return false;
      if (!query) return true;
      return normalizeSearch([
        record.code,
        record.protocol,
        record.status,
        record.actionType,
        record.riskLevel,
        record.applicantName,
        record.companyName,
        record.cnpj,
        record.primaryActivityDescription,
        record.propertyRegistration,
        responsible,
      ].join(" ")).includes(query);
    });
  }, [actionFilter, assignments, records, responsibleFilter, riskFilter, search, statusFilter, getState]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = filteredRecords.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => selectedIds.has(record.id));
  const inAnalysis = filteredRecords.filter((record) => record.status === "Em Análise").length;
  const highRisk = filteredRecords.filter((record) => record.riskLevel === "Alto Risco").length;
  const registrations = filteredRecords.filter((record) => record.actionType === "Inscrição Municipal").length;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setActionFilter("all");
    setRiskFilter("all");
    setResponsibleFilter("all");
    setPage(1);
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const record of visibleRecords) {
        if (allVisibleSelected) next.delete(record.id);
        else next.add(record.id);
      }
      return next;
    });
  }

  async function applyBulkAssignment() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (await onAssign("empresa-facil", ids, bulkResponsible)) setSelectedIds(new Set());
  }

  function exportRecords() {
    const header = [
      "Código", "Protocolo", "Responsável", "Situação", "Tipo de ação", "Data da solicitação",
      "Grau de risco", "Solicitante", "Empresa / razão social", "CNPJ", "Enquadramento",
      "Atividade principal - código", "Atividade principal - descrição", "Cadastro imobiliário",
      "Inscrição imobiliária", "Cadastro econômico", "Indicativos", "Arquivo-fonte",
    ];
    const rows = filteredRecords.map((record) => [
      record.code,
      record.protocol,
      assignments[assignmentKey("empresa-facil", record.id)]?.responsible,
      record.status,
      record.actionType,
      record.requestedAt,
      record.riskLevel,
      record.applicantName,
      record.companyName,
      record.cnpj,
      record.classification,
      record.primaryActivityCode,
      record.primaryActivityDescription,
      record.propertyCode,
      record.propertyRegistration,
      record.economicRegistration,
      record.indicators,
      record.sourceFile,
    ]);
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "empresa-facil-apucarana.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function createRecord(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const response = await fetch("/api/empresa-facil", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json() as { record?: EmpresaFacilRecord; error?: string };
      if (!response.ok || !payload.record) throw new Error(payload.error ?? "Não foi possível cadastrar o processo.");
      setRecords((current) => [payload.record!, ...current]); setDraft(newDraft()); setFormOpen(false);
    } catch (error) { setFormError(error instanceof Error ? error.message : "Não foi possível cadastrar o processo."); }
    finally { setSaving(false); }
  }

  return (
    <>
      <section className="dashboard-header">
        <div>
          <p className="eyebrow">Central analítica · desenvolvimento econômico</p>
          <h1>Empresa Fácil</h1>
          <p>Solicitações de viabilidade e inscrição municipal consolidadas na base compartilhada.</p>
        </div>
        <div className="header-actions">
          <span className={`database-chip ${loading ? "loading" : loadError ? "error" : "ready"}`}>
            {loading ? <LoaderCircle size={15} className="spin" /> : <DatabaseStatusIcon error={Boolean(loadError)} />}
            {loading ? "Carregando dados" : loadError ? "Base indisponível" : `${records.length} registros`}
          </span>
          <button className="icon-button export-button" type="button" onClick={exportRecords} disabled={!records.length}>
            <Download size={18} /> <span>Exportar</span>
          </button>
          <button className="primary-button header-primary-button" type="button" onClick={onOpenImporter}>
            <UploadCloud size={18} /> Importar relatório
          </button>
          <button className="primary-button header-primary-button" type="button" onClick={() => setFormOpen(true)}><Plus size={18}/> Novo processo</button>
        </div>
      </section>

      <section className="filter-panel empresa-filter-panel" aria-label="Filtros do Empresa Fácil">
        <label><span>Situação</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">Todas</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        <label><span>Tipo de ação</span><select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); }}><option value="all">Todos</option>{actions.map((action) => <option key={action} value={action}>{action}</option>)}</select></label>
        <label><span>Grau de risco</span><select value={riskFilter} onChange={(event) => { setRiskFilter(event.target.value); setPage(1); }}><option value="all">Todos</option>{risks.map((risk) => <option key={risk} value={risk}>{risk}</option>)}</select></label>
        <label><span>Responsável</span><select value={responsibleFilter} onChange={(event) => { setResponsibleFilter(event.target.value); setPage(1); }}><option value="all">Todos</option><option value="__unassigned">Sem responsável</option>{RESPONSIBLE_OPTIONS.map((responsible) => <option key={responsible} value={responsible}>{responsible}</option>)}</select></label>
        <label className="search-field"><span>Busca</span><Search size={18} /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Código, protocolo, CNPJ ou solicitante" /></label>
        <button className="clear-filter" type="button" onClick={clearFilters}><FilterX size={18} /><span>Limpar</span></button>
      </section>

      <section className="kpi-grid empresa-kpi-grid" aria-label="Indicadores do Empresa Fácil">
        <div className="kpi-card"><span className="kpi-icon"><Building2 size={19} /></span><strong>{filteredRecords.length}</strong><span>solicitações</span></div>
        <div className="kpi-card"><span className="kpi-icon violet"><FileClock size={19} /></span><strong>{inAnalysis}</strong><span>em análise</span></div>
        <div className="kpi-card"><span className="kpi-icon amber"><ShieldAlert size={19} /></span><strong>{highRisk}</strong><span>de alto risco</span></div>
        <div className="kpi-card"><span className="kpi-icon green"><CheckCircle2 size={19} /></span><strong>{registrations}</strong><span>inscrições municipais</span></div>
      </section>

      {loadError ? <div className="module-error"><AlertTriangle size={17} /> {loadError}</div> : null}

      {imports.length ? (
        <section className="panel import-history-panel">
          <div className="panel-heading">
            <div><p className="panel-kicker">Rastreabilidade</p><h2>Últimas importações</h2></div>
            <span>{imports.length} cargas registradas</span>
          </div>
          <div className="import-history-list">
            {imports.slice(0, 4).map((item) => (
              <article key={item.id}>
                <FileClock size={17} />
                <div><strong>{item.fileName}</strong><span>{formatDateTime(item.createdAt)} · {item.importedBy || "usuário autorizado"}</span></div>
                <small>{item.rowCount} linhas · {item.insertedCount} novas · {item.updatedCount} atualizadas</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel process-section empresa-table-section">
        <div className="panel-heading table-heading">
          <div><p className="panel-kicker">Consulta detalhada</p><h2>Solicitações</h2><p>{filteredRecords.length} resultado{filteredRecords.length === 1 ? "" : "s"}</p></div>
          <div className="table-heading-actions">
            <button className="secondary-button" type="button" onClick={exportRecords} disabled={!filteredRecords.length}><Download size={17} /> Exportar filtrados</button>
            <button className="primary-button compact-button" type="button" onClick={onOpenImporter}><UploadCloud size={17} /> Importar</button>
          </div>
        </div>

        <BulkAssignmentBar
          selectedCount={selectedIds.size}
          value={bulkResponsible}
          onValueChange={setBulkResponsible}
          onApply={() => void applyBulkAssignment()}
          onClearSelection={() => setSelectedIds(new Set())}
          disabled={assignmentSaving}
        />

        <div className="table-scroll">
          <table className="empresa-table">
            <thead><tr>
              <th className="selection-column"><SelectionIconButton selected={allVisibleSelected} onClick={toggleVisibleSelection} label={allVisibleSelected ? "Desmarcar solicitações desta página" : "Selecionar solicitações desta página"} disabled={!visibleRecords.length} /></th>
              <th>Código / protocolo</th><th>Responsável</th><th>Situação</th><th>Tipo de ação</th><th>Solicitação</th><th>Risco</th><th>Solicitante / empresa</th><th>CNPJ</th><th>Atividade principal</th><th>Cadastro imobiliário</th><th>Enquadramento</th><th>Ações</th>
            </tr></thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id} className={`${selectedIds.has(record.id) ? "row-selected" : ""} ${getState("empresa-facil", record.id)?.completed ? "row-completed" : ""}`}>
                  <td className="selection-column"><SelectionIconButton selected={selectedIds.has(record.id)} onClick={() => toggleSelection(record.id)} label={selectedIds.has(record.id) ? `Desmarcar solicitação ${record.code}` : `Selecionar solicitação ${record.code}`} /></td>
                  <td><strong>{record.code}</strong><small className="cell-secondary">{record.protocol || "Sem protocolo"}</small></td>
                  <td><ResponsibleSelect value={assignments[assignmentKey("empresa-facil", record.id)]?.responsible ?? ""} onChange={(responsible) => void onAssign("empresa-facil", [record.id], responsible)} disabled={assignmentSaving} ariaLabel={`Responsável pela solicitação ${record.code}`} /></td>
                  <td><span className={`status-badge ${statusClass(record.status)}`}>{record.status}</span></td>
                  <td><span className={`status-badge ${actionClass(record.actionType)}`}>{record.actionType}</span></td>
                  <td>{formatDateTime(record.requestedAt)}</td>
                  <td><span className={`status-badge ${riskClass(record.riskLevel)}`}>{record.riskLevel || "Não informado"}</span></td>
                  <td><span className="empresa-name" title={record.applicantName}>{record.applicantName}</span>{record.companyName ? <small className="cell-secondary" title={record.companyName}>{record.companyName}</small> : null}</td>
                  <td>{record.cnpj || "—"}</td>
                  <td><span className="empresa-activity" title={record.primaryActivityDescription}>{record.primaryActivityDescription || "—"}</span><small className="cell-secondary">{record.primaryActivityCode || "Sem código"}</small></td>
                  <td>{record.propertyRegistration || "—"}</td>
                  <td><span className="status-badge badge-neutral">{record.classification || "—"}</span></td>
                  <td><div className="row-actions"><ItemFilesButton module="empresa-facil" itemId={record.id} title={`Empresa Fácil ${record.code}`}/><ItemLifecycleActions module="empresa-facil" itemId={record.id} label={`a solicitação ${record.code}`}/></div></td>
                </tr>
              ))}
              {!loading && !visibleRecords.length ? <tr><td colSpan={13} className="empty-state">Nenhuma solicitação corresponde aos filtros selecionados.</td></tr> : null}
              {loading ? <tr><td colSpan={13} className="empty-state"><LoaderCircle size={18} className="spin" /> Carregando solicitações…</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>Página {currentPage} de {totalPages}</span>
          <div>
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>Anterior</button>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>Próxima</button>
          </div>
        </div>
      </section>
      {formOpen ? <div className="attachment-overlay" role="dialog" aria-modal="true"><form className="attachment-modal record-form-modal" onSubmit={createRecord}><header><div><span className="panel-kicker">Empresa Fácil</span><h2>Novo processo</h2></div><button className="icon-only-button" type="button" onClick={() => setFormOpen(false)}><X size={20}/></button></header><div className="record-form-grid"><label><span>Código</span><input required value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })}/></label><label><span>Protocolo</span><input value={draft.protocol} onChange={(event) => setDraft({ ...draft, protocol: event.target.value })}/></label><label><span>Situação</span><input required value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}/></label><label><span>Tipo de ação</span><input required value={draft.actionType} onChange={(event) => setDraft({ ...draft, actionType: event.target.value })}/></label><label><span>Data da solicitação</span><input required type="datetime-local" value={draft.requestedAt} onChange={(event) => setDraft({ ...draft, requestedAt: event.target.value })}/></label><label><span>Grau de risco</span><input value={draft.riskLevel} onChange={(event) => setDraft({ ...draft, riskLevel: event.target.value })}/></label><label><span>Solicitante</span><input required value={draft.applicantName} onChange={(event) => setDraft({ ...draft, applicantName: event.target.value })}/></label><label><span>Empresa</span><input value={draft.companyName} onChange={(event) => setDraft({ ...draft, companyName: event.target.value })}/></label><label><span>CNPJ</span><input value={draft.cnpj} onChange={(event) => setDraft({ ...draft, cnpj: event.target.value })}/></label><label><span>Inscrição imobiliária</span><input value={draft.propertyRegistration} onChange={(event) => setDraft({ ...draft, propertyRegistration: event.target.value })}/></label><label className="form-span-2"><span>Atividade principal</span><input value={draft.primaryActivityDescription} onChange={(event) => setDraft({ ...draft, primaryActivityDescription: event.target.value })}/></label><label className="form-span-2"><span>Enquadramento</span><input value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value })}/></label></div>{formError ? <div className="form-error">{formError}</div> : null}<div className="editor-actions"><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle size={18} className="spin"/> : <Save size={18}/>} Cadastrar</button><button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancelar</button></div></form></div> : null}
    </>
  );
}

function DatabaseStatusIcon({ error }: { error: boolean }) {
  return error ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />;
}
