"use client";

import {
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileSearch,
  FilterX,
  Gavel,
  Landmark,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ItemFilesButton } from "@/components/item-lifecycle";
import {
  BulkAssignmentBar,
  ResponsibleSelect,
  SelectionIconButton,
} from "@/components/responsibility-controls";
import { assignmentKey } from "@/lib/assignments";
import type {
  AssignmentMap,
  AssignResponsible,
  ProcurementRecord,
} from "@/lib/dashboard-types";
import {
  PROCUREMENT_MODALITIES,
  PROCUREMENT_PHASES,
  PROCUREMENT_SITUATIONS,
  type ProcurementModality,
  type ProcurementPhase,
  type ProcurementSituation,
} from "@/lib/procurement-options";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type ProcurementModuleProps = {
  assignments: AssignmentMap;
  onAssign: AssignResponsible;
  assignmentSaving: boolean;
};

type ProcurementDraft = {
  object: string;
  modality: ProcurementModality;
  processNumber: string;
  responsible: string;
  phase: ProcurementPhase;
  situation: ProcurementSituation;
  plannedPublicationDate: string;
  sessionDate: string;
  estimatedValue: string;
  fundingSource: string;
  notes: string;
};

const EMPTY_DRAFT: ProcurementDraft = {
  object: "",
  modality: "Pregão eletrônico",
  processNumber: "",
  responsible: "",
  phase: "Planejamento",
  situation: "No prazo",
  plannedPublicationDate: "",
  sessionDate: "",
  estimatedValue: "",
  fundingSource: "",
  notes: "",
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatCurrency(value: number | null, compact = false) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function situationClass(situation: ProcurementSituation) {
  if (situation === "No prazo" || situation === "Concluída") return "badge-green";
  if (situation === "Atenção") return "badge-amber";
  if (situation === "Atrasada") return "badge-danger";
  return "badge-slate";
}

function phaseClass(phase: ProcurementPhase) {
  if (phase === "Concluída" || phase === "Homologação") return "badge-green";
  if (phase === "Em disputa" || phase === "Julgamento") return "badge-violet";
  if (phase === "Suspensa") return "badge-slate";
  return "badge-cyan";
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function ProcurementModule({
  assignments,
  onAssign,
  assignmentSaving,
}: ProcurementModuleProps) {
  const [records, setRecords] = useState<ProcurementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [situationFilter, setSituationFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResponsible, setBulkResponsible] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProcurementDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [savingRecord, setSavingRecord] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProcurements() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/procurements", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          procurements?: ProcurementRecord[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar licitações.");
        setRecords(payload.procurements ?? []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "Falha ao carregar licitações.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProcurements();
    return () => controller.abort();
  }, []);

  const filteredRecords = useMemo(() => {
    const query = normalizeSearch(search.trim());
    return records.filter((record) => {
      const responsible = assignments[assignmentKey("procurements", record.id)]?.responsible ?? "";
      if (
        phaseFilter === "__preparation" &&
        !["Planejamento", "Preparação", "Publicação"].includes(record.phase)
      ) return false;
      if (
        phaseFilter === "__dispute" &&
        !["Em disputa", "Julgamento"].includes(record.phase)
      ) return false;
      if (
        phaseFilter !== "all" &&
        !phaseFilter.startsWith("__") &&
        record.phase !== phaseFilter
      ) return false;
      if (situationFilter !== "all" && record.situation !== situationFilter) return false;
      if (responsibleFilter === "__unassigned" && responsible) return false;
      if (
        responsibleFilter !== "all" &&
        responsibleFilter !== "__unassigned" &&
        responsible !== responsibleFilter
      ) return false;
      if (!query) return true;
      return normalizeSearch(
        [
          record.object,
          record.modality,
          record.processNumber,
          record.phase,
          record.situation,
          record.fundingSource,
          record.notes,
          responsible,
        ].join(" "),
      ).includes(query);
    });
  }, [assignments, phaseFilter, records, responsibleFilter, search, situationFilter]);

  const preparationCount = filteredRecords.filter((record) =>
    ["Planejamento", "Preparação", "Publicação"].includes(record.phase),
  ).length;
  const disputeCount = filteredRecords.filter((record) =>
    ["Em disputa", "Julgamento"].includes(record.phase),
  ).length;
  const completedCount = filteredRecords.filter((record) =>
    ["Homologação", "Concluída"].includes(record.phase),
  ).length;
  const estimatedTotal = filteredRecords.reduce(
    (total, record) => total + (record.estimatedValue ?? 0),
    0,
  );
  const allFilteredSelected =
    filteredRecords.length > 0 && filteredRecords.every((record) => selectedIds.has(record.id));

  function clearFilters() {
    setSearch("");
    setPhaseFilter("all");
    setSituationFilter("all");
    setResponsibleFilter("all");
  }

  function openNewForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormError("");
    setFormOpen(true);
  }

  function openEditForm(record: ProcurementRecord) {
    setEditingId(record.id);
    setDraft({
      object: record.object,
      modality: record.modality,
      processNumber: record.processNumber,
      responsible: assignments[assignmentKey("procurements", record.id)]?.responsible ?? "",
      phase: record.phase,
      situation: record.situation,
      plannedPublicationDate: record.plannedPublicationDate ?? "",
      sessionDate: record.sessionDate ?? "",
      estimatedValue: record.estimatedValue == null ? "" : String(record.estimatedValue),
      fundingSource: record.fundingSource,
      notes: record.notes,
    });
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (savingRecord) return;
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
  }

  function updateDraft<Key extends keyof ProcurementDraft>(key: Key, value: ProcurementDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveProcurement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingRecord(true);
    setFormError("");
    try {
      const response = await fetch("/api/procurements", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          object: draft.object,
          modality: draft.modality,
          processNumber: draft.processNumber,
          phase: draft.phase,
          situation: draft.situation,
          plannedPublicationDate: draft.plannedPublicationDate || null,
          sessionDate: draft.sessionDate || null,
          estimatedValue: draft.estimatedValue === "" ? null : Number(draft.estimatedValue),
          fundingSource: draft.fundingSource,
          notes: draft.notes,
        }),
      });
      const payload = (await response.json()) as {
        procurement?: ProcurementRecord;
        error?: string;
      };
      if (!response.ok || !payload.procurement) {
        throw new Error(payload.error ?? "Não foi possível salvar a licitação.");
      }

      const savedRecord = payload.procurement;
      setRecords((current) => [
        savedRecord,
        ...current.filter((record) => record.id !== savedRecord.id),
      ]);
      const previousResponsible = editingId
        ? assignments[assignmentKey("procurements", editingId)]?.responsible ?? ""
        : "";
      const assignmentSaved =
        draft.responsible === previousResponsible
          ? true
          : await onAssign("procurements", [savedRecord.id], draft.responsible);
      if (!assignmentSaved) {
        setFormError("A licitação foi salva, mas não foi possível atualizar o responsável.");
        return;
      }
      setFormOpen(false);
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar a licitação.");
    } finally {
      setSavingRecord(false);
    }
  }

  async function deleteProcurement(record: ProcurementRecord) {
    if (!window.confirm(`Excluir a licitação “${record.object}”? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setDeletingId(record.id);
    setLoadError("");
    try {
      const response = await fetch("/api/procurements", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: record.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir a licitação.");
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Não foi possível excluir a licitação.");
    } finally {
      setDeletingId("");
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFilteredSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const record of filteredRecords) {
        if (allFilteredSelected) next.delete(record.id);
        else next.add(record.id);
      }
      return next;
    });
  }

  async function applyBulkAssignment() {
    const itemIds = [...selectedIds];
    if (!itemIds.length) return;
    if (await onAssign("procurements", itemIds, bulkResponsible)) {
      setSelectedIds(new Set());
    }
  }

  function exportRecords() {
    const header = [
      "Objeto",
      "Responsável",
      "Modalidade",
      "Processo",
      "Fase",
      "Situação",
      "Publicação prevista",
      "Data da sessão",
      "Valor estimado",
      "Fonte do recurso",
      "Observações",
    ];
    const rows = filteredRecords.map((record) => [
      record.object,
      assignments[assignmentKey("procurements", record.id)]?.responsible,
      record.modality,
      record.processNumber,
      record.phase,
      record.situation,
      record.plannedPublicationDate,
      record.sessionDate,
      record.estimatedValue,
      record.fundingSource,
      record.notes,
    ]);
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "controle-de-licitacoes.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="dashboard-header module-header">
        <div>
          <p className="eyebrow">Central analítica · contratações públicas</p>
          <h1>Controle de Licitações</h1>
          <p>Cadastro e acompanhamento de fases, responsáveis, datas críticas e valores estimados.</p>
        </div>
        <div className="header-actions">
          <span className="database-chip ready">
            <Landmark size={15} /> Base compartilhada ativa
          </span>
          <button className="icon-button export-button" type="button" onClick={exportRecords} disabled={!filteredRecords.length}>
            <Download size={18} /> <span>Exportar</span>
          </button>
          <button className="primary-button header-primary-button" type="button" onClick={openNewForm}>
            <Plus size={18} /> Nova licitação
          </button>
        </div>
      </section>

      {formOpen ? (
        <div className="procurement-form-overlay" role="dialog" aria-modal="true" aria-labelledby="procurement-form-title">
          <form className="procurement-form-panel" onSubmit={(event) => void saveProcurement(event)}>
            <div className="procurement-form-heading">
              <div>
                <p className="panel-kicker">Registro operacional</p>
                <h2 id="procurement-form-title">{editingId ? "Editar licitação" : "Nova licitação"}</h2>
              </div>
              <button className="icon-only-button" type="button" onClick={closeForm} aria-label="Fechar formulário" title="Fechar">
                <X size={19} />
              </button>
            </div>

            <div className="procurement-form-grid">
              <label className="wide-field">
                <span>Objeto *</span>
                <textarea value={draft.object} onChange={(event) => updateDraft("object", event.target.value)} maxLength={500} rows={3} required placeholder="Descreva o objeto da contratação" />
              </label>
              <label>
                <span>Modalidade *</span>
                <select value={draft.modality} onChange={(event) => updateDraft("modality", event.target.value as ProcurementModality)}>
                  {PROCUREMENT_MODALITIES.map((modality) => <option key={modality} value={modality}>{modality}</option>)}
                </select>
              </label>
              <label>
                <span>Nº do processo</span>
                <input value={draft.processNumber} onChange={(event) => updateDraft("processNumber", event.target.value)} maxLength={80} placeholder="Ex.: 123/2026" />
              </label>
              <label>
                <span>Responsável</span>
                <select value={draft.responsible} onChange={(event) => updateDraft("responsible", event.target.value)}>
                  <option value="">Não atribuído</option>
                  {RESPONSIBLE_OPTIONS.map((responsible) => <option key={responsible} value={responsible}>{responsible}</option>)}
                </select>
              </label>
              <label>
                <span>Fase *</span>
                <select value={draft.phase} onChange={(event) => updateDraft("phase", event.target.value as ProcurementPhase)}>
                  {PROCUREMENT_PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
                </select>
              </label>
              <label>
                <span>Situação *</span>
                <select value={draft.situation} onChange={(event) => updateDraft("situation", event.target.value as ProcurementSituation)}>
                  {PROCUREMENT_SITUATIONS.map((situation) => <option key={situation} value={situation}>{situation}</option>)}
                </select>
              </label>
              <label>
                <span>Publicação prevista</span>
                <input type="date" value={draft.plannedPublicationDate} onChange={(event) => updateDraft("plannedPublicationDate", event.target.value)} />
              </label>
              <label>
                <span>Data da sessão</span>
                <input type="date" value={draft.sessionDate} onChange={(event) => updateDraft("sessionDate", event.target.value)} />
              </label>
              <label>
                <span>Valor estimado (R$)</span>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.estimatedValue} onChange={(event) => updateDraft("estimatedValue", event.target.value)} placeholder="0,00" />
              </label>
              <label>
                <span>Fonte do recurso</span>
                <input value={draft.fundingSource} onChange={(event) => updateDraft("fundingSource", event.target.value)} maxLength={160} placeholder="Recurso livre, convênio..." />
              </label>
              <label className="wide-field">
                <span>Observações</span>
                <textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} maxLength={2000} rows={3} placeholder="Pendências, deliberações e próximos passos" />
              </label>
            </div>

            {formError ? <div className="form-error">{formError}</div> : null}
            <div className="procurement-form-actions">
              <button className="secondary-button" type="button" onClick={closeForm} disabled={savingRecord}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={savingRecord || assignmentSaving}>
                {savingRecord ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />}
                {editingId ? "Salvar alterações" : "Cadastrar licitação"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <section className="filter-panel procurement-filter-panel" aria-label="Filtros de licitações">
        <label>
          <span>Fase</span>
          <select value={phaseFilter} onChange={(event) => setPhaseFilter(event.target.value)}>
            <option value="all">Todas as fases</option>
            <option value="__preparation">Fase interna</option>
            <option value="__dispute">Disputa e julgamento</option>
            {PROCUREMENT_PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
          </select>
        </label>
        <label>
          <span>Situação</span>
          <select value={situationFilter} onChange={(event) => setSituationFilter(event.target.value)}>
            <option value="all">Todas as situações</option>
            {PROCUREMENT_SITUATIONS.map((situation) => <option key={situation} value={situation}>{situation}</option>)}
          </select>
        </label>
        <label>
          <span>Responsável</span>
          <select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="__unassigned">Não atribuído</option>
            {RESPONSIBLE_OPTIONS.map((responsible) => <option key={responsible} value={responsible}>{responsible}</option>)}
          </select>
        </label>
        <label className="search-field">
          <span>Busca</span>
          <Search size={18} />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Objeto, processo ou recurso" />
        </label>
        <button className="clear-filter" type="button" onClick={clearFilters} title="Limpar filtros">
          <FilterX size={18} /> <span>Limpar</span>
        </button>
      </section>

      <section className="kpi-grid procurement-kpi-grid" aria-label="Indicadores de licitações">
        <button className="kpi-card" type="button" onClick={clearFilters}>
          <span className="kpi-icon"><ClipboardList size={19} /></span>
          <strong>{filteredRecords.length}</strong>
          <span>licitações</span>
          <small>{records.length} cadastradas na base</small>
        </button>
        <button className="kpi-card" type="button" onClick={() => setPhaseFilter("__preparation")}>
          <span className="kpi-icon cyan"><FileSearch size={19} /></span>
          <strong>{preparationCount}</strong>
          <span>em preparação</span>
          <small>planejamento, preparação e publicação</small>
        </button>
        <button className="kpi-card" type="button" onClick={() => setPhaseFilter("__dispute")}>
          <span className="kpi-icon amber"><Gavel size={19} /></span>
          <strong>{disputeCount}</strong>
          <span>em disputa</span>
          <small>sessões e julgamentos</small>
        </button>
        <div className="kpi-card">
          <span className="kpi-icon green"><BadgeCheck size={19} /></span>
          <strong>{completedCount}</strong>
          <span>homologadas ou concluídas</span>
          <small>{formatCurrency(estimatedTotal, true)} estimados</small>
        </div>
      </section>

      {loadError ? <div className="module-error"><CalendarClock size={18} /> {loadError}</div> : null}

      <section className="panel process-section procurement-table-section">
        <div className="panel-heading table-heading">
          <div>
            <p className="panel-kicker">Carteira detalhada</p>
            <h2>Processos licitatórios</h2>
            <p>{loading ? "Carregando registros..." : `${filteredRecords.length} resultado${filteredRecords.length === 1 ? "" : "s"}`}</p>
          </div>
          <div className="table-heading-actions">
            <span className="estimated-total"><CircleDollarSign size={16} /> {formatCurrency(estimatedTotal)}</span>
            <button className="secondary-button" type="button" onClick={openNewForm}><Plus size={17} /> Cadastrar</button>
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
          <table className="procurement-table">
            <thead>
              <tr>
                <th className="selection-column">
                  <SelectionIconButton
                    selected={allFilteredSelected}
                    onClick={toggleFilteredSelection}
                    label={allFilteredSelected ? "Desmarcar licitações filtradas" : "Selecionar licitações filtradas"}
                    disabled={!filteredRecords.length}
                  />
                </th>
                <th>Objeto</th>
                <th>Responsável</th>
                <th>Modalidade</th>
                <th>Processo</th>
                <th>Fase</th>
                <th>Situação</th>
                <th>Publicação</th>
                <th>Sessão</th>
                <th>Valor estimado</th>
                <th>Recurso</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className={selectedIds.has(record.id) ? "row-selected" : ""}>
                  <td className="selection-column">
                    <SelectionIconButton
                      selected={selectedIds.has(record.id)}
                      onClick={() => toggleSelection(record.id)}
                      label={selectedIds.has(record.id) ? `Desmarcar licitação ${record.object}` : `Selecionar licitação ${record.object}`}
                    />
                  </td>
                  <td><strong className="procurement-object" title={record.object}>{record.object}</strong></td>
                  <td>
                    <ResponsibleSelect
                      value={assignments[assignmentKey("procurements", record.id)]?.responsible ?? ""}
                      onChange={(responsible) => void onAssign("procurements", [record.id], responsible)}
                      disabled={assignmentSaving}
                      ariaLabel={`Responsável pela licitação ${record.object}`}
                    />
                  </td>
                  <td>{record.modality}</td>
                  <td>{record.processNumber || "—"}</td>
                  <td><span className={`status-badge ${phaseClass(record.phase)}`}>{record.phase}</span></td>
                  <td><span className={`status-badge ${situationClass(record.situation)}`}>{record.situation}</span></td>
                  <td>{formatDate(record.plannedPublicationDate)}</td>
                  <td>{formatDate(record.sessionDate)}</td>
                  <td>{formatCurrency(record.estimatedValue)}</td>
                  <td>{record.fundingSource || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <ItemFilesButton module="procurements" itemId={record.id} title={record.object}/>
                      <button className="row-action icon-row-action" type="button" onClick={() => openEditForm(record)} aria-label={`Editar ${record.object}`} title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button className="row-action icon-row-action danger-row-action" type="button" onClick={() => void deleteProcurement(record)} disabled={deletingId === record.id} aria-label={`Excluir ${record.object}`} title="Excluir">
                        {deletingId === record.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filteredRecords.length ? (
                <tr>
                  <td colSpan={12} className="empty-state procurement-empty-state">
                    <ClipboardList size={30} />
                    <strong>{records.length ? "Nenhuma licitação corresponde aos filtros." : "Nenhuma licitação cadastrada."}</strong>
                    <span>{records.length ? "Ajuste os filtros para ampliar a consulta." : "Cadastre o primeiro processo licitatório para iniciar o acompanhamento."}</span>
                    {!records.length ? <button className="primary-button compact-button" type="button" onClick={openNewForm}><Plus size={16} /> Cadastrar primeira licitação</button> : null}
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr><td colSpan={12} className="empty-state"><LoaderCircle size={24} className="spin" /> Carregando licitações...</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>Controle de licitações · dados salvos na base compartilhada</span>
        <span>{records.length} registro{records.length === 1 ? "" : "s"} · responsáveis e acompanhamento por fase</span>
      </footer>
    </>
  );
}
