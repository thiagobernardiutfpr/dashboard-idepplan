"use client";

import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FilterX,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  UsersRound,
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
import type { AgendaItemRecord, AssignmentMap, AssignResponsible } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type AgendaModuleProps = {
  assignments: AssignmentMap;
  onAssign: AssignResponsible;
  assignmentSaving: boolean;
};

type AgendaDraft = {
  title: string;
  type: "Compromisso" | "Reunião";
  startsAt: string;
  endsAt: string;
  location: string;
  participants: string[];
  responsible: string;
  status: "Agendado" | "Realizado" | "Cancelado";
  notes: string;
};

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

const EMPTY_DRAFT: AgendaDraft = {
  title: "",
  type: "Reunião",
  startsAt: localDateValue(),
  endsAt: "",
  location: "",
  participants: [],
  responsible: "",
  status: "Agendado",
  notes: "",
};

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: AgendaItemRecord["status"]) {
  if (status === "Realizado") return "badge-green";
  if (status === "Cancelado") return "badge-slate";
  return "badge-cyan";
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function AgendaModule({ assignments, onAssign, assignmentSaving }: AgendaModuleProps) {
  const [items, setItems] = useState<AgendaItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [participantFilter, setParticipantFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkResponsible, setBulkResponsible] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AgendaDraft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const value = new Date();
    return new Date(value.getFullYear(), value.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => localDateValue().slice(0, 10));

  useEffect(() => {
    const controller = new AbortController();
    async function loadAgenda() {
      setLoading(true);
      try {
        const response = await fetch("/api/agenda", { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as { agenda?: AgendaItemRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar a agenda.");
        setItems(payload.agenda ?? []);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Falha ao carregar a agenda.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadAgenda();
    return () => controller.abort();
  }, []);

  const today = localDateValue().slice(0, 10);
  const filteredItems = useMemo(() => {
    const query = normalizeSearch(search.trim());
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (participantFilter !== "all" && !item.participants.includes(participantFilter)) return false;
      if (!query) return true;
      return normalizeSearch([
        item.title,
        item.location,
        item.notes,
        item.participants.join(" "),
        assignments[assignmentKey("agenda", item.id)]?.responsible,
      ].join(" ")).includes(query);
    });
  }, [assignments, items, participantFilter, search, statusFilter, typeFilter]);

  const todayCount = filteredItems.filter((item) => item.startsAt.slice(0, 10) === today).length;
  const upcomingCount = filteredItems.filter((item) => item.startsAt.slice(0, 10) >= today && item.status === "Agendado").length;
  const meetingCount = filteredItems.filter((item) => item.type === "Reunião").length;
  const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setParticipantFilter("all");
  }

  function updateDraft<Key extends keyof AgendaDraft>(key: Key, value: AgendaDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openNew(dateKey?: string) {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, startsAt: dateKey ? `${dateKey}T09:00` : localDateValue(), participants: [] });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(item: AgendaItemRecord) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      type: item.type,
      startsAt: item.startsAt,
      endsAt: item.endsAt ?? "",
      location: item.location,
      participants: [...item.participants],
      responsible: assignments[assignmentKey("agenda", item.id)]?.responsible ?? "",
      status: item.status,
      notes: item.notes,
    });
    setFormError("");
    setFormOpen(true);
  }

  function toggleParticipant(participant: string) {
    setDraft((current) => ({
      ...current,
      participants: current.participants.includes(participant)
        ? current.participants.filter((name) => name !== participant)
        : [...current.participants, participant],
    }));
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/agenda", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...(editingId ? { id: editingId } : {}), ...draft, endsAt: draft.endsAt || null }),
      });
      const payload = (await response.json()) as { item?: AgendaItemRecord; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error ?? "Não foi possível salvar na agenda.");
      const saved = payload.item;
      setItems((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      const previousResponsible = editingId ? assignments[assignmentKey("agenda", editingId)]?.responsible ?? "" : "";
      if (draft.responsible !== previousResponsible && !(await onAssign("agenda", [saved.id], draft.responsible))) {
        setFormError("O registro foi salvo, mas não foi possível atualizar o responsável.");
        setEditingId(saved.id);
        return;
      }
      setFormOpen(false);
      setEditingId(null);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Não foi possível salvar na agenda.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(item: AgendaItemRecord) {
    if (!window.confirm(`Excluir “${item.title}” da agenda?`)) return;
    setDeletingId(item.id);
    try {
      const response = await fetch("/api/agenda", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir o registro.");
      setItems((current) => current.filter((record) => record.id !== item.id));
      setSelectedIds((current) => { const next = new Set(current); next.delete(item.id); return next; });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir o registro.");
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
      filteredItems.forEach((item) => {
        if (allFilteredSelected) next.delete(item.id);
        else next.add(item.id);
      });
      return next;
    });
  }

  async function applyBulkAssignment() {
    const ids = [...selectedIds];
    if (ids.length && await onAssign("agenda", ids, bulkResponsible)) setSelectedIds(new Set());
  }

  function exportItems() {
    const header = ["Título", "Tipo", "Responsável", "Início", "Fim", "Local", "Participantes", "Situação", "Observações"];
    const rows = filteredItems.map((item) => [item.title, item.type, assignments[assignmentKey("agenda", item.id)]?.responsible, item.startsAt, item.endsAt, item.location, item.participants.join(", "), item.status, item.notes]);
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "agenda-municipal.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const calendarDays = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      const key = localDateValue(day).slice(0, 10);
      return {
        key,
        day: day.getDate(),
        currentMonth: day.getMonth() === calendarMonth.getMonth(),
        items: filteredItems.filter((item) => item.startsAt.slice(0, 10) === key),
      };
    });
  }, [calendarMonth, filteredItems]);
  const selectedDayItems = filteredItems.filter((item) => item.startsAt.slice(0, 10) === selectedCalendarDate);
  const calendarLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(calendarMonth);

  function moveMonth(offset: number) {
    setCalendarMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + offset, 1);
      setSelectedCalendarDate(localDateValue(next).slice(0, 10));
      return next;
    });
  }

  return (
    <>
      <section className="dashboard-header module-header">
        <div>
          <p className="eyebrow">Central analítica · organização institucional</p>
          <h1>Agenda</h1>
          <p>Compromissos e reuniões compartilhados, com participantes, responsáveis, horários e locais.</p>
        </div>
        <div className="header-actions">
          <span className="database-chip ready"><CalendarCheck2 size={15} /> Agenda compartilhada</span>
          <button className="icon-button export-button" type="button" onClick={exportItems} disabled={!filteredItems.length}><Download size={18} /> <span>Exportar</span></button>
          <button className="primary-button header-primary-button" type="button" onClick={() => openNew()}><Plus size={18} /> Novo compromisso</button>
        </div>
      </section>

      {formOpen ? (
        <div className="procurement-form-overlay" role="dialog" aria-modal="true" aria-labelledby="agenda-form-title">
          <form className="procurement-form-panel" onSubmit={(event) => void saveItem(event)}>
            <div className="procurement-form-heading">
              <div><p className="panel-kicker">Agenda compartilhada</p><h2 id="agenda-form-title">{editingId ? "Editar compromisso" : "Novo compromisso"}</h2></div>
              <button className="icon-only-button" type="button" onClick={() => setFormOpen(false)} aria-label="Fechar formulário"><X size={19} /></button>
            </div>
            <div className="procurement-form-grid">
              <label className="wide-field"><span>Título *</span><input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} maxLength={300} required placeholder="Ex.: Reunião de alinhamento do geoprocessamento" /></label>
              <label><span>Tipo *</span><select value={draft.type} onChange={(event) => updateDraft("type", event.target.value as AgendaDraft["type"])}><option>Reunião</option><option>Compromisso</option></select></label>
              <label><span>Situação *</span><select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as AgendaDraft["status"])}><option>Agendado</option><option>Realizado</option><option>Cancelado</option></select></label>
              <label><span>Responsável</span><select value={draft.responsible} onChange={(event) => updateDraft("responsible", event.target.value)}><option value="">Não atribuído</option>{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label><span>Início *</span><input type="datetime-local" value={draft.startsAt} onChange={(event) => updateDraft("startsAt", event.target.value)} required /></label>
              <label><span>Encerramento</span><input type="datetime-local" value={draft.endsAt} onChange={(event) => updateDraft("endsAt", event.target.value)} /></label>
              <label><span>Local</span><input value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} maxLength={220} placeholder="Sala, endereço ou link" /></label>
              <fieldset className="participant-fieldset wide-field">
                <legend>Participantes</legend>
                <div className="participant-options">{RESPONSIBLE_OPTIONS.map((name) => <label key={name} className={draft.participants.includes(name) ? "selected" : ""}><input type="checkbox" checked={draft.participants.includes(name)} onChange={() => toggleParticipant(name)} /><span>{name}</span></label>)}</div>
              </fieldset>
              <label className="wide-field"><span>Observações</span><textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} maxLength={2000} rows={3} placeholder="Pauta, documentos necessários e encaminhamentos" /></label>
            </div>
            {formError ? <div className="form-error">{formError}</div> : null}
            <div className="procurement-form-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving || assignmentSaving}>{saving ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />} Salvar</button></div>
          </form>
        </div>
      ) : null}

      <section className="filter-panel agenda-filter-panel" aria-label="Filtros da agenda">
        <label><span>Tipo</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Todos</option><option>Reunião</option><option>Compromisso</option></select></label>
        <label><span>Situação</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Todas</option><option>Agendado</option><option>Realizado</option><option>Cancelado</option></select></label>
        <label><span>Participante</span><select value={participantFilter} onChange={(event) => setParticipantFilter(event.target.value)}><option value="all">Todos</option>{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="search-field"><span>Busca</span><Search size={18} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Título, local ou participante" /></label>
        <button className="clear-filter" type="button" onClick={clearFilters}><FilterX size={18} /> <span>Limpar</span></button>
      </section>

      <section className="kpi-grid" aria-label="Indicadores da agenda">
        <button className="kpi-card" type="button" onClick={clearFilters}><span className="kpi-icon"><CalendarDays size={19} /></span><strong>{filteredItems.length}</strong><span>registros na agenda</span><small>{items.length} no total</small></button>
        <div className="kpi-card"><span className="kpi-icon cyan"><Clock3 size={19} /></span><strong>{todayCount}</strong><span>hoje</span><small>compromissos do dia</small></div>
        <button className="kpi-card" type="button" onClick={() => setStatusFilter("Agendado")}><span className="kpi-icon amber"><CalendarCheck2 size={19} /></span><strong>{upcomingCount}</strong><span>próximos</span><small>itens ainda agendados</small></button>
        <button className="kpi-card" type="button" onClick={() => setTypeFilter("Reunião")}><span className="kpi-icon green"><UsersRound size={19} /></span><strong>{meetingCount}</strong><span>reuniões</span><small>no recorte atual</small></button>
      </section>

      {error ? <div className="module-error"><CalendarDays size={18} /> {error}</div> : null}

      <section className="panel agenda-month-panel" aria-label="Calendário mensal da agenda">
        <div className="panel-heading agenda-calendar-heading">
          <div><p className="panel-kicker">Visão mensal</p><h2>Calendário de compromissos</h2><p>Clique em um evento para editar ou em um dia para consultar a programação.</p></div>
          <div className="agenda-calendar-nav">
            <button type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
            <strong>{calendarLabel}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button>
            <button type="button" className="secondary-button" onClick={() => { const value = new Date(); setCalendarMonth(new Date(value.getFullYear(), value.getMonth(), 1)); setSelectedCalendarDate(today); }}>Hoje</button>
          </div>
        </div>
        <div className="agenda-calendar-layout">
          <div className="agenda-calendar-board">
            <div className="agenda-calendar-weekdays">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="agenda-month-grid">
              {calendarDays.map((day) => (
                <article key={day.key} className={`${day.currentMonth ? "" : "outside"} ${day.key === selectedCalendarDate ? "selected" : ""} ${day.key === today ? "today" : ""}`}>
                  <button type="button" className="agenda-day-number" onClick={() => setSelectedCalendarDate(day.key)} aria-label={`Ver compromissos de ${day.key}`}>{day.day}</button>
                  <div>{day.items.slice(0, 3).map((item) => <button key={item.id} type="button" className={`agenda-calendar-event ${item.type === "Reunião" ? "meeting" : "appointment"}`} onClick={() => openEdit(item)} title={`${formatDateTime(item.startsAt)} · ${item.title}`}><time>{item.startsAt.slice(11, 16)}</time><span>{item.title}</span></button>)}{day.items.length > 3 ? <small>+{day.items.length - 3} evento{day.items.length - 3 === 1 ? "" : "s"}</small> : null}</div>
                </article>
              ))}
            </div>
          </div>
          <aside className="agenda-day-detail">
            <header><div><span>Dia selecionado</span><strong>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${selectedCalendarDate}T00:00:00Z`))}</strong></div><button type="button" onClick={() => openNew(selectedCalendarDate)}><Plus size={16} /> Adicionar</button></header>
            <div>{selectedDayItems.map((item) => <button type="button" key={item.id} onClick={() => openEdit(item)}><i className={item.type === "Reunião" ? "meeting" : "appointment"} /><span><strong>{item.title}</strong><small>{item.startsAt.slice(11, 16)} · {item.location || "Local não informado"}</small></span><span className={`status-badge ${statusClass(item.status)}`}>{item.status}</span></button>)}{!selectedDayItems.length ? <p>Nenhum compromisso neste dia.</p> : null}</div>
          </aside>
        </div>
      </section>

      <section className="panel process-section agenda-table-section">
        <div className="panel-heading table-heading"><div><p className="panel-kicker">Programação detalhada</p><h2>Compromissos e reuniões</h2><p>{loading ? "Carregando agenda..." : `${filteredItems.length} resultado${filteredItems.length === 1 ? "" : "s"}`}</p></div><button className="secondary-button" type="button" onClick={() => openNew()}><Plus size={17} /> Cadastrar</button></div>
        <BulkAssignmentBar selectedCount={selectedIds.size} value={bulkResponsible} onValueChange={setBulkResponsible} onApply={() => void applyBulkAssignment()} onClearSelection={() => setSelectedIds(new Set())} disabled={assignmentSaving} />
        <div className="table-scroll"><table className="agenda-table"><thead><tr>
          <th className="selection-column"><SelectionIconButton selected={allFilteredSelected} onClick={toggleFilteredSelection} label={allFilteredSelected ? "Desmarcar itens filtrados" : "Selecionar itens filtrados"} disabled={!filteredItems.length} /></th>
          <th>Compromisso</th><th>Responsável</th><th>Tipo</th><th>Data e horário</th><th>Participantes</th><th>Local</th><th>Situação</th><th><span className="sr-only">Ações</span></th>
        </tr></thead><tbody>
          {filteredItems.map((item) => <tr key={item.id} className={selectedIds.has(item.id) ? "row-selected" : ""}>
            <td className="selection-column"><SelectionIconButton selected={selectedIds.has(item.id)} onClick={() => toggleSelection(item.id)} label={selectedIds.has(item.id) ? `Desmarcar ${item.title}` : `Selecionar ${item.title}`} /></td>
            <td><strong className="agenda-title">{item.title}</strong>{item.notes ? <small className="cell-secondary" title={item.notes}>{item.notes}</small> : null}</td>
            <td><ResponsibleSelect value={assignments[assignmentKey("agenda", item.id)]?.responsible ?? ""} onChange={(responsible) => void onAssign("agenda", [item.id], responsible)} disabled={assignmentSaving} ariaLabel={`Responsável por ${item.title}`} /></td>
            <td><span className={`status-badge ${item.type === "Reunião" ? "badge-violet" : "badge-blue"}`}>{item.type}</span></td>
            <td><strong>{formatDateTime(item.startsAt)}</strong>{item.endsAt ? <small className="cell-secondary">até {formatDateTime(item.endsAt)}</small> : null}</td>
            <td><div className="participant-chips">{item.participants.length ? item.participants.map((name) => <span key={name}>{name}</span>) : <span className="muted-chip">Não informados</span>}</div></td>
            <td>{item.location ? <span className="location-cell"><MapPin size={13} /> {item.location}</span> : "—"}</td>
            <td><span className={`status-badge ${statusClass(item.status)}`}>{item.status}</span></td>
            <td><div className="row-actions"><ItemFilesButton module="agenda" itemId={item.id} title={item.title}/><button className="row-action icon-row-action" type="button" onClick={() => openEdit(item)} aria-label={`Editar ${item.title}`}><Pencil size={15} /></button><button className="row-action icon-row-action danger-row-action" type="button" onClick={() => void deleteItem(item)} disabled={deletingId === item.id} aria-label={`Excluir ${item.title}`}>{deletingId === item.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}</button></div></td>
          </tr>)}
          {!loading && !filteredItems.length ? <tr><td colSpan={9} className="empty-state">Nenhum compromisso corresponde aos filtros. Use “Novo compromisso” para começar.</td></tr> : null}
          {loading ? <tr><td colSpan={9} className="empty-state"><LoaderCircle size={22} className="spin" /> Carregando agenda...</td></tr> : null}
        </tbody></table></div>
      </section>
      <footer className="dashboard-footer"><span>Agenda institucional · dados salvos na base compartilhada</span><span>{items.length} compromisso{items.length === 1 ? "" : "s"} e reunião{items.length === 1 ? "" : "ões"}</span></footer>
    </>
  );
}
