"use client";

import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Download,
  FilterX,
  ListTodo,
  LoaderCircle,
  Map,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
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
import type { AssignmentMap, AssignResponsible, GeoprocessingDemandRecord } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type GeoprocessingModuleProps = {
  assignments: AssignmentMap;
  onAssign: AssignResponsible;
  assignmentSaving: boolean;
};

type DemandDraft = {
  title: string;
  requester: string;
  demandDate: string;
  description: string;
  responsible: string;
  completed: boolean;
};

function todayValue() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const EMPTY_DRAFT: DemandDraft = {
  title: "",
  requester: "",
  demandDate: todayValue(),
  description: "",
  responsible: "",
  completed: false,
};

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function GeoprocessingModule({ assignments, onAssign, assignmentSaving }: GeoprocessingModuleProps) {
  const [demands, setDemands] = useState<GeoprocessingDemandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [requesterFilter, setRequesterFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResponsible, setBulkResponsible] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DemandDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadDemands() {
      setLoading(true);
      try {
        const response = await fetch("/api/geoprocessing-demands", { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as { demands?: GeoprocessingDemandRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar as demandas.");
        setDemands(payload.demands ?? []);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Falha ao carregar as demandas.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadDemands();
    return () => controller.abort();
  }, []);

  const requesters = useMemo(() => [...new Set(demands.map((demand) => demand.requester))].sort(), [demands]);
  const filteredDemands = useMemo(() => {
    const query = normalizeSearch(search.trim());
    return demands.filter((demand) => {
      const responsible = assignments[assignmentKey("geoprocessing", demand.id)]?.responsible ?? "";
      if (statusFilter === "pending" && demand.completed) return false;
      if (statusFilter === "completed" && !demand.completed) return false;
      if (requesterFilter !== "all" && demand.requester !== requesterFilter) return false;
      if (responsibleFilter === "__unassigned" && responsible) return false;
      if (responsibleFilter !== "all" && responsibleFilter !== "__unassigned" && responsible !== responsibleFilter) return false;
      if (!query) return true;
      return normalizeSearch([demand.title, demand.requester, demand.description, responsible].join(" ")).includes(query);
    });
  }, [assignments, demands, requesterFilter, responsibleFilter, search, statusFilter]);

  const completedCount = filteredDemands.filter((demand) => demand.completed).length;
  const pendingCount = filteredDemands.filter((demand) => !demand.completed).length;
  const todayCount = filteredDemands.filter((demand) => demand.demandDate === todayValue()).length;
  const allFilteredSelected = filteredDemands.length > 0 && filteredDemands.every((demand) => selectedIds.has(demand.id));

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setRequesterFilter("all");
    setResponsibleFilter("all");
  }

  function updateDraft<Key extends keyof DemandDraft>(key: Key, value: DemandDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openNew() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, demandDate: todayValue() });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(demand: GeoprocessingDemandRecord) {
    setEditingId(demand.id);
    setDraft({
      title: demand.title,
      requester: demand.requester,
      demandDate: demand.demandDate,
      description: demand.description,
      responsible: assignments[assignmentKey("geoprocessing", demand.id)]?.responsible ?? "",
      completed: demand.completed,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function persistDemand(payload: DemandDraft, id?: string) {
    const response = await fetch("/api/geoprocessing-demands", {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...(id ? { id } : {}), ...payload }),
    });
    const result = (await response.json()) as { demand?: GeoprocessingDemandRecord; error?: string };
    if (!response.ok || !result.demand) throw new Error(result.error ?? "Não foi possível salvar a demanda.");
    return result.demand;
  }

  async function saveDemand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const saved = await persistDemand(draft, editingId ?? undefined);
      setDemands((current) => [saved, ...current.filter((demand) => demand.id !== saved.id)]);
      const previousResponsible = editingId ? assignments[assignmentKey("geoprocessing", editingId)]?.responsible ?? "" : "";
      if (draft.responsible !== previousResponsible && !(await onAssign("geoprocessing", [saved.id], draft.responsible))) {
        setFormError("A demanda foi salva, mas não foi possível atualizar o responsável.");
        setEditingId(saved.id);
        return;
      }
      setFormOpen(false);
      setEditingId(null);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a demanda.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompleted(demand: GeoprocessingDemandRecord) {
    setUpdatingId(demand.id);
    try {
      const saved = await persistDemand({
        title: demand.title,
        requester: demand.requester,
        demandDate: demand.demandDate,
        description: demand.description,
        responsible: assignments[assignmentKey("geoprocessing", demand.id)]?.responsible ?? "",
        completed: !demand.completed,
      }, demand.id);
      setDemands((current) => current.map((item) => item.id === saved.id ? saved : item));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Não foi possível atualizar a demanda.");
    } finally {
      setUpdatingId("");
    }
  }

  async function deleteDemand(demand: GeoprocessingDemandRecord) {
    if (!window.confirm(`Excluir a demanda “${demand.title}”?`)) return;
    setUpdatingId(demand.id);
    try {
      const response = await fetch("/api/geoprocessing-demands", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: demand.id }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir a demanda.");
      setDemands((current) => current.filter((item) => item.id !== demand.id));
      setSelectedIds((current) => { const next = new Set(current); next.delete(demand.id); return next; });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir a demanda.");
    } finally {
      setUpdatingId("");
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
      filteredDemands.forEach((demand) => {
        if (allFilteredSelected) next.delete(demand.id);
        else next.add(demand.id);
      });
      return next;
    });
  }

  async function applyBulkAssignment() {
    const ids = [...selectedIds];
    if (ids.length && await onAssign("geoprocessing", ids, bulkResponsible)) setSelectedIds(new Set());
  }

  function exportDemands() {
    const header = ["Concluída", "Demanda", "Responsável", "Demandante", "Data", "Descrição"];
    const rows = filteredDemands.map((demand) => [demand.completed ? "Sim" : "Não", demand.title, assignments[assignmentKey("geoprocessing", demand.id)]?.responsible, demand.requester, demand.demandDate, demand.description]);
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "demandas-geoprocessamento.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="dashboard-header module-header">
        <div><p className="eyebrow">Central analítica · inteligência territorial</p><h1>Demandas de Geoprocessamento</h1><p>Lista compartilhada de tarefas, com conclusão, demandante, data e responsável.</p></div>
        <div className="header-actions"><span className="database-chip ready"><Map size={15} /> Fila compartilhada</span><button className="icon-button export-button" type="button" onClick={exportDemands} disabled={!filteredDemands.length}><Download size={18} /> <span>Exportar</span></button><button className="primary-button header-primary-button" type="button" onClick={openNew}><Plus size={18} /> Nova demanda</button></div>
      </section>

      {formOpen ? <div className="procurement-form-overlay" role="dialog" aria-modal="true" aria-labelledby="geo-form-title"><form className="procurement-form-panel" onSubmit={(event) => void saveDemand(event)}>
        <div className="procurement-form-heading"><div><p className="panel-kicker">Fila de trabalho</p><h2 id="geo-form-title">{editingId ? "Editar demanda" : "Nova demanda"}</h2></div><button className="icon-only-button" type="button" onClick={() => setFormOpen(false)} aria-label="Fechar formulário"><X size={19} /></button></div>
        <div className="procurement-form-grid">
          <label className="wide-field"><span>Demanda *</span><input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} maxLength={400} required placeholder="Ex.: Atualizar mapa de equipamentos públicos" /></label>
          <label><span>Demandante *</span><input value={draft.requester} onChange={(event) => updateDraft("requester", event.target.value)} maxLength={220} required placeholder="Pessoa, secretaria ou setor" /></label>
          <label><span>Data *</span><input type="date" value={draft.demandDate} onChange={(event) => updateDraft("demandDate", event.target.value)} required /></label>
          <label><span>Responsável</span><select value={draft.responsible} onChange={(event) => updateDraft("responsible", event.target.value)}><option value="">Não atribuído</option>{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label className="wide-field"><span>Descrição</span><textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} maxLength={2000} rows={4} placeholder="Escopo, formato de entrega, base de referência e observações" /></label>
          <label className="completion-form-toggle wide-field"><input type="checkbox" checked={draft.completed} onChange={(event) => updateDraft("completed", event.target.checked)} /><span>Marcar como concluída</span></label>
        </div>
        {formError ? <div className="form-error">{formError}</div> : null}
        <div className="procurement-form-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving || assignmentSaving}>{saving ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />} Salvar demanda</button></div>
      </form></div> : null}

      <section className="filter-panel geoprocessing-filter-panel" aria-label="Filtros das demandas">
        <label><span>Situação</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todas</option><option value="pending">Pendentes</option><option value="completed">Concluídas</option></select></label>
        <label><span>Demandante</span><select value={requesterFilter} onChange={(event) => setRequesterFilter(event.target.value)}><option value="all">Todos</option>{requesters.map((requester) => <option key={requester}>{requester}</option>)}</select></label>
        <label><span>Responsável</span><select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)}><option value="all">Todos</option><option value="__unassigned">Não atribuído</option>{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="search-field"><span>Busca</span><Search size={18} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Demanda, demandante ou descrição" /></label>
        <button className="clear-filter" type="button" onClick={clearFilters}><FilterX size={18} /> <span>Limpar</span></button>
      </section>

      <section className="kpi-grid" aria-label="Indicadores das demandas">
        <button className="kpi-card" type="button" onClick={clearFilters}><span className="kpi-icon"><ListTodo size={19} /></span><strong>{filteredDemands.length}</strong><span>demandas</span><small>{demands.length} na base</small></button>
        <button className="kpi-card" type="button" onClick={() => setStatusFilter("pending")}><span className="kpi-icon amber"><Circle size={19} /></span><strong>{pendingCount}</strong><span>pendentes</span><small>aguardando conclusão</small></button>
        <button className="kpi-card" type="button" onClick={() => setStatusFilter("completed")}><span className="kpi-icon green"><CheckCircle2 size={19} /></span><strong>{completedCount}</strong><span>concluídas</span><small>entregas finalizadas</small></button>
        <div className="kpi-card"><span className="kpi-icon cyan"><ClipboardCheck size={19} /></span><strong>{todayCount}</strong><span>recebidas hoje</span><small>novas entradas do dia</small></div>
      </section>

      {error ? <div className="module-error"><Map size={18} /> {error}</div> : null}
      <section className="panel process-section geoprocessing-table-section">
        <div className="panel-heading table-heading"><div><p className="panel-kicker">Fila operacional</p><h2>Lista de tarefas</h2><p>{loading ? "Carregando demandas..." : `${filteredDemands.length} resultado${filteredDemands.length === 1 ? "" : "s"}`}</p></div><button className="secondary-button" type="button" onClick={openNew}><Plus size={17} /> Cadastrar</button></div>
        <BulkAssignmentBar selectedCount={selectedIds.size} value={bulkResponsible} onValueChange={setBulkResponsible} onApply={() => void applyBulkAssignment()} onClearSelection={() => setSelectedIds(new Set())} disabled={assignmentSaving} />
        <div className="table-scroll"><table className="geoprocessing-table"><thead><tr>
          <th className="selection-column"><SelectionIconButton selected={allFilteredSelected} onClick={toggleFilteredSelection} label={allFilteredSelected ? "Desmarcar demandas filtradas" : "Selecionar demandas filtradas"} disabled={!filteredDemands.length} /></th>
          <th>Concluída</th><th>Demanda</th><th>Responsável</th><th>Demandante</th><th>Data</th><th>Descrição</th><th><span className="sr-only">Ações</span></th>
        </tr></thead><tbody>
          {filteredDemands.map((demand) => <tr key={demand.id} className={`${selectedIds.has(demand.id) ? "row-selected " : ""}${demand.completed ? "task-completed" : ""}`}>
            <td className="selection-column"><SelectionIconButton selected={selectedIds.has(demand.id)} onClick={() => toggleSelection(demand.id)} label={selectedIds.has(demand.id) ? `Desmarcar ${demand.title}` : `Selecionar ${demand.title}`} /></td>
            <td><button className={`completion-button ${demand.completed ? "completed" : ""}`} type="button" onClick={() => void toggleCompleted(demand)} disabled={updatingId === demand.id} aria-label={demand.completed ? `Reabrir demanda ${demand.title}` : `Concluir demanda ${demand.title}`}>{updatingId === demand.id ? <LoaderCircle size={20} className="spin" /> : demand.completed ? <CheckCircle2 size={21} /> : <Circle size={21} />}<span>{demand.completed ? "Concluída" : "Pendente"}</span></button></td>
            <td><strong className="demand-title">{demand.title}</strong></td>
            <td><ResponsibleSelect value={assignments[assignmentKey("geoprocessing", demand.id)]?.responsible ?? ""} onChange={(responsible) => void onAssign("geoprocessing", [demand.id], responsible)} disabled={assignmentSaving} ariaLabel={`Responsável por ${demand.title}`} /></td>
            <td><span className="requester-cell"><UserRound size={13} /> {demand.requester}</span></td><td>{formatDate(demand.demandDate)}</td><td><span className="description-cell" title={demand.description}>{demand.description || "—"}</span></td>
            <td><div className="row-actions"><ItemFilesButton module="geoprocessing" itemId={demand.id} title={demand.title}/><button className="row-action icon-row-action" type="button" onClick={() => openEdit(demand)} aria-label={`Editar ${demand.title}`}><Pencil size={15} /></button><button className="row-action icon-row-action danger-row-action" type="button" onClick={() => void deleteDemand(demand)} disabled={updatingId === demand.id} aria-label={`Excluir ${demand.title}`}><Trash2 size={15} /></button></div></td>
          </tr>)}
          {!loading && !filteredDemands.length ? <tr><td colSpan={8} className="empty-state">Nenhuma demanda corresponde aos filtros. Use “Nova demanda” para registrar uma tarefa.</td></tr> : null}
          {loading ? <tr><td colSpan={8} className="empty-state"><LoaderCircle size={22} className="spin" /> Carregando demandas...</td></tr> : null}
        </tbody></table></div>
      </section>
      <footer className="dashboard-footer"><span>Demandas de geoprocessamento · fila compartilhada</span><span>{demands.filter((demand) => !demand.completed).length} pendentes · {demands.filter((demand) => demand.completed).length} concluídas</span></footer>
    </>
  );
}
