"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ItemFilesButton } from "@/components/item-lifecycle";
import type { ItemModule, WorkspaceAgendaRecord } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type ContextType = WorkspaceAgendaRecord["contextType"];
type Draft = {
  title: string;
  type: WorkspaceAgendaRecord["type"];
  startsAt: string;
  endsAt: string;
  location: string;
  participants: string[];
  responsible: string;
  status: WorkspaceAgendaRecord["status"];
  notes: string;
};

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

const emptyDraft = (dateKey?: string): Draft => ({
  title: "",
  type: "Reunião",
  startsAt: dateKey ? `${dateKey}T09:00` : localDateValue(),
  endsAt: "",
  location: "",
  participants: [],
  responsible: RESPONSIBLE_OPTIONS[0],
  status: "Agendado",
  notes: "",
});

const people = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const statusClass = (status: WorkspaceAgendaRecord["status"]) =>
  status === "Realizado"
    ? "badge-green"
    : status === "Cancelado"
      ? "badge-slate"
      : "badge-cyan";

export function WorkspaceCalendar({
  contextType,
  contextId,
  title,
}: {
  contextType: ContextType;
  contextId: string;
  title: string;
}) {
  const [items, setItems] = useState<WorkspaceAgendaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [month, setMonth] = useState(() => {
    const value = new Date();
    return new Date(value.getFullYear(), value.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() =>
    localDateValue().slice(0, 10),
  );
  const itemModule: ItemModule =
    contextType === "council" ? "councils" : "master-plan";

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/workspace-agenda?contextType=${encodeURIComponent(contextType)}&contextId=${encodeURIComponent(contextId)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          items?: WorkspaceAgendaRecord[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error);
        setItems(payload.items ?? []);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Falha ao carregar a agenda.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [contextId, contextType]);

  const today = localDateValue().slice(0, 10);
  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      const key = localDateValue(day).slice(0, 10);
      return {
        key,
        day: day.getDate(),
        currentMonth: day.getMonth() === month.getMonth(),
        items: items.filter((item) => item.startsAt.slice(0, 10) === key),
      };
    });
  }, [items, month]);
  const selectedItems = items.filter(
    (item) => item.startsAt.slice(0, 10) === selectedDate,
  );
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(month);

  function openNew(dateKey?: string) {
    setEditingId("");
    setDraft(emptyDraft(dateKey));
    setError("");
    setFormOpen(true);
  }
  function openEdit(item: WorkspaceAgendaRecord) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      type: item.type,
      startsAt: item.startsAt.slice(0, 16),
      endsAt: item.endsAt?.slice(0, 16) ?? "",
      location: item.location,
      participants: people(item.participants),
      responsible: item.responsible,
      status: item.status,
      notes: item.notes,
    });
    setError("");
    setFormOpen(true);
  }
  function moveMonth(offset: number) {
    setMonth((current) => {
      const next = new Date(
        current.getFullYear(),
        current.getMonth() + offset,
        1,
      );
      setSelectedDate(localDateValue(next).slice(0, 10));
      return next;
    });
  }
  function toggleParticipant(name: string) {
    setDraft((current) => ({
      ...current,
      participants: current.participants.includes(name)
        ? current.participants.filter((value) => value !== name)
        : [...current.participants, name],
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/workspace-agenda", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          id: editingId || undefined,
          contextType,
          contextId,
          endsAt: draft.endsAt || null,
        }),
      });
      const payload = (await response.json()) as {
        item?: WorkspaceAgendaRecord;
        error?: string;
      };
      if (!response.ok || !payload.item)
        throw new Error(payload.error ?? "Não foi possível salvar o evento.");
      setItems((current) =>
        [
          ...current.filter((item) => item.id !== payload.item!.id),
          payload.item!,
        ].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
      setFormOpen(false);
      setEditingId("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o evento.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: WorkspaceAgendaRecord) {
    if (!window.confirm(`Excluir “${item.title}” desta agenda?`)) return;
    const response = await fetch("/api/workspace-agenda", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (response.ok)
      setItems((current) => current.filter((value) => value.id !== item.id));
    else {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Não foi possível excluir o evento.");
    }
  }

  return (
    <>
      <section
        className="panel agenda-month-panel workspace-calendar"
        aria-label={title}
      >
        <div className="panel-heading agenda-calendar-heading">
          <div>
            <p className="panel-kicker">Visão mensal compartilhada</p>
            <h2>{title}</h2>
            <p>
              {loading
                ? "Carregando agenda…"
                : `${items.length} evento${items.length === 1 ? "" : "s"} na agenda`}
            </p>
          </div>
          <div className="agenda-calendar-nav">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Mês anterior"
            >
              <ChevronLeft size={18} />
            </button>
            <strong>{monthLabel}</strong>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Próximo mês"
            >
              <ChevronRight size={18} />
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => openNew(selectedDate)}
            >
              <Plus size={16} /> Novo evento
            </button>
          </div>
        </div>
        {error ? (
          <div className="module-error">
            <CalendarDays size={17} /> {error}
          </div>
        ) : null}
        <div className="agenda-calendar-layout">
          <div className="agenda-calendar-board">
            <div className="agenda-calendar-weekdays">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="agenda-month-grid">
              {calendarDays.map((day) => (
                <article
                  key={day.key}
                  className={`${day.currentMonth ? "" : "outside"} ${day.key === selectedDate ? "selected" : ""} ${day.key === today ? "today" : ""}`}
                >
                  <button
                    type="button"
                    className="agenda-day-number"
                    onClick={() => setSelectedDate(day.key)}
                  >
                    {day.day}
                  </button>
                  <div>
                    {day.items.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        className={`agenda-calendar-event ${item.type === "Reunião" ? "meeting" : "appointment"}`}
                        type="button"
                        onClick={() => openEdit(item)}
                      >
                        <time>{item.startsAt.slice(11, 16)}</time>
                        <span>{item.title}</span>
                      </button>
                    ))}
                    {day.items.length > 3 ? (
                      <small>+{day.items.length - 3}</small>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <aside className="agenda-day-detail">
            <header>
              <div>
                <span>Dia selecionado</span>
                <strong>
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "full",
                    timeZone: "UTC",
                  }).format(new Date(`${selectedDate}T00:00:00Z`))}
                </strong>
              </div>
              <button type="button" onClick={() => openNew(selectedDate)}>
                <Plus size={16} /> Adicionar
              </button>
            </header>
            <div>
              {selectedItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => openEdit(item)}
                >
                  <i
                    className={
                      item.type === "Reunião" ? "meeting" : "appointment"
                    }
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.startsAt.slice(11, 16)} ·{" "}
                      {item.location || item.responsible}
                    </small>
                  </span>
                  <span className={`status-badge ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </button>
              ))}
              {!selectedItems.length ? (
                <p>Nenhum compromisso neste dia.</p>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
      {formOpen ? (
        <div
          className="procurement-form-overlay"
          role="dialog"
          aria-modal="true"
        >
          <form className="procurement-form-panel" onSubmit={save}>
            <div className="procurement-form-heading">
              <div>
                <p className="panel-kicker">{title}</p>
                <h2>{editingId ? "Editar evento" : "Novo evento"}</h2>
              </div>
              <button
                className="icon-only-button"
                type="button"
                onClick={() => setFormOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="procurement-form-grid">
              <label className="wide-field">
                <span>Título *</span>
                <input
                  required
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Tipo</span>
                <select
                  value={draft.type}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      type: event.target.value as Draft["type"],
                    })
                  }
                >
                  <option>Reunião</option>
                  <option>Compromisso</option>
                </select>
              </label>
              <label>
                <span>Situação</span>
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      status: event.target.value as Draft["status"],
                    })
                  }
                >
                  <option>Agendado</option>
                  <option>Realizado</option>
                  <option>Cancelado</option>
                </select>
              </label>
              <label>
                <span>Responsável</span>
                <select
                  value={draft.responsible}
                  onChange={(event) =>
                    setDraft({ ...draft, responsible: event.target.value })
                  }
                >
                  {RESPONSIBLE_OPTIONS.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Início *</span>
                <input
                  required
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(event) =>
                    setDraft({ ...draft, startsAt: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Encerramento</span>
                <input
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(event) =>
                    setDraft({ ...draft, endsAt: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Local</span>
                <input
                  value={draft.location}
                  onChange={(event) =>
                    setDraft({ ...draft, location: event.target.value })
                  }
                />
              </label>
              <fieldset className="participant-fieldset wide-field">
                <legend>Participantes</legend>
                <div className="participant-options">
                  {RESPONSIBLE_OPTIONS.map((name) => (
                    <label
                      key={name}
                      className={
                        draft.participants.includes(name) ? "selected" : ""
                      }
                    >
                      <input
                        type="checkbox"
                        checked={draft.participants.includes(name)}
                        onChange={() => toggleParticipant(name)}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="wide-field">
                <span>Observações</span>
                <textarea
                  rows={3}
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft({ ...draft, notes: event.target.value })
                  }
                />
              </label>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="procurement-form-actions">
              {editingId ? (
                <>
                  <ItemFilesButton
                    module={itemModule}
                    itemId={`agenda:${editingId}`}
                    title={draft.title || "Evento da agenda"}
                    text
                    label="Arquivos"
                  />
                  <button
                    className="secondary-button danger-text"
                    type="button"
                    onClick={() => {
                      const item = items.find(
                        (value) => value.id === editingId,
                      );
                      if (item) void remove(item);
                      setFormOpen(false);
                    }}
                  >
                    <Trash2 size={16} /> Excluir
                  </button>
                </>
              ) : null}
              <button
                className="secondary-button"
                type="button"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </button>
              <button className="primary-button" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Save size={18} />
                )}{" "}
                Salvar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
