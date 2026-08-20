"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileClock,
  LoaderCircle,
  MessageSquarePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ItemFilesButton } from "@/components/item-lifecycle";
import { SelectionIconButton } from "@/components/responsibility-controls";
import { WorkspaceCalendar } from "@/components/workspace-calendar";
import type { MasterPlanRecord } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type Draft = Omit<
  MasterPlanRecord,
  "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;
const PHASES = [
  "Preparação",
  "Diagnóstico",
  "Propostas",
  "Minuta de Lei",
  "Participação Social",
  "Aprovação Legislativa",
  "Monitoramento",
];
const TYPES = [
  "Ação",
  "Produto",
  "Reunião técnica",
  "Audiência pública",
  "Consulta pública",
  "Sugestão",
  "Entrega",
];
const STATUSES: Draft["status"][] = [
  "Não iniciado",
  "Em andamento",
  "Em validação",
  "Concluído",
];
const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};
const emptyDraft = (): Draft => ({
  title: "",
  phase: PHASES[0],
  itemType: TYPES[0],
  description: "",
  startDate: today(),
  dueDate: plusDays(30),
  status: "Não iniciado",
  progress: 0,
  responsible: RESPONSIBLE_OPTIONS[0],
  stakeholders: "",
  legalReference: "",
  notes: "",
});
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;

export function MasterPlanModule() {
  const [items, setItems] = useState<MasterPlanRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestion, setSuggestion] = useState({
    title: "",
    theme: "Uso e ocupação do solo",
    description: "",
    proposer: "",
    responsible: RESPONSIBLE_OPTIONS[0],
  });
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/master-plan", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          items?: MasterPlanRecord[];
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
              : "Falha ao carregar a revisão do Plano Diretor.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (phase !== "all" && item.phase !== phase) return false;
        if (status !== "all" && item.status !== status) return false;
        const query = normalize(search.trim());
        return (
          !query ||
          normalize(
            [
              item.title,
              item.phase,
              item.itemType,
              item.description,
              item.responsible,
              item.stakeholders,
              item.legalReference,
            ].join(" "),
          ).includes(query)
        );
      }),
    [items, phase, search, status],
  );
  const concluded = items.filter((item) => item.status === "Concluído").length;
  const overdue = items.filter(
    (item) => item.status !== "Concluído" && item.dueDate < today(),
  ).length;
  const averageProgress = items.length
    ? Math.round(
        items.reduce((sum, item) => sum + item.progress, 0) / items.length,
      )
    : 0;
  const allSelected =
    Boolean(filtered.length) && filtered.every((item) => selected.has(item.id));

  function toggleSelection(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      filtered.forEach((item) =>
        allSelected ? next.delete(item.id) : next.add(item.id),
      );
      return next;
    });
  }
  function edit(item: MasterPlanRecord) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      phase: item.phase,
      itemType: item.itemType,
      description: item.description,
      startDate: item.startDate,
      dueDate: item.dueDate,
      status: item.status,
      progress: item.progress,
      responsible: item.responsible,
      stakeholders: item.stakeholders,
      legalReference: item.legalReference,
      notes: item.notes,
    });
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingId("");
    setDraft(emptyDraft());
    setError("");
  }

  async function persist(next: Draft, id?: string) {
    const response = await fetch("/api/master-plan", {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...next, id }),
    });
    const payload = (await response.json()) as {
      item?: MasterPlanRecord;
      error?: string;
    };
    if (!response.ok || !payload.item)
      throw new Error(payload.error ?? "Não foi possível salvar a etapa.");
    setItems((current) =>
      id
        ? current.map((item) => (item.id === id ? payload.item! : item))
        : [payload.item!, ...current],
    );
    return payload.item;
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await persist(draft, editingId || undefined);
      closeForm();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a etapa.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveSuggestion(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await persist({
        title: suggestion.title,
        phase: "Propostas",
        itemType: "Sugestão",
        description: suggestion.description,
        startDate: today(),
        dueDate: plusDays(90),
        status: "Em validação",
        progress: 0,
        responsible: suggestion.responsible,
        stakeholders: suggestion.proposer,
        legalReference: suggestion.theme,
        notes:
          "Sugestão inserida para análise durante a revisão do Plano Diretor.",
      });
      setSuggestionOpen(false);
      setSuggestion({
        title: "",
        theme: "Uso e ocupação do solo",
        description: "",
        proposer: "",
        responsible: RESPONSIBLE_OPTIONS[0],
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível registrar a sugestão.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function toggleComplete(item: MasterPlanRecord) {
    try {
      await persist(
        {
          ...item,
          status: item.status === "Concluído" ? "Em andamento" : "Concluído",
          progress:
            item.status === "Concluído" ? Math.min(item.progress, 95) : 100,
        },
        item.id,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível atualizar a etapa.",
      );
    }
  }
  async function remove(item: MasterPlanRecord, confirm = true) {
    if (confirm && !window.confirm(`Excluir a etapa “${item.title}”?`))
      return false;
    const response = await fetch("/api/master-plan", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    if (response.ok) {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      return true;
    }
    return false;
  }
  async function completeSelected() {
    setSaving(true);
    for (const item of items.filter(
      (entry) => selected.has(entry.id) && entry.status !== "Concluído",
    ))
      await persist({ ...item, status: "Concluído", progress: 100 }, item.id);
    setSelected(new Set());
    setSaving(false);
  }
  async function deleteSelected() {
    if (!window.confirm(`Excluir ${selected.size} etapa(s) selecionada(s)?`))
      return;
    setSaving(true);
    for (const item of items.filter((entry) => selected.has(entry.id)))
      await remove(item, false);
    setSelected(new Set());
    setSaving(false);
  }
  function exportCsv() {
    const rows = [
      [
        "Etapa",
        "Fase",
        "Tipo",
        "Início",
        "Prazo",
        "Responsável",
        "Progresso",
        "Situação",
        "Atores envolvidos",
        "Referência legal",
      ],
      ...filtered.map((item) => [
        item.title,
        item.phase,
        item.itemType,
        item.startDate,
        item.dueDate,
        item.responsible,
        `${item.progress}%`,
        item.status,
        item.stakeholders,
        item.legalReference,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        [`\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "revisao-plano-diretor.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className="dashboard-header module-header">
        <div>
          <p className="eyebrow">
            Planejamento urbano · governança e participação
          </p>
          <h1>Revisão do Plano Diretor</h1>
          <p>
            Controle de etapas, produtos, audiências, responsáveis, prazos e
            referências legais.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="secondary-button suggestion-button"
            type="button"
            onClick={() => setSuggestionOpen(true)}
          >
            <MessageSquarePlus size={18} /> Inserir sugestão
          </button>
          <button
            className="icon-button export-button"
            type="button"
            onClick={exportCsv}
          >
            <Download size={18} /> <span>Exportar</span>
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => setFormOpen(true)}
          >
            <Plus size={18} /> Nova etapa
          </button>
        </div>
      </section>
      <section className="kpi-grid plan-kpis">
        <div className="kpi-card">
          <span className="kpi-icon">
            <ClipboardCheck size={19} />
          </span>
          <strong>{items.length}</strong>
          <span>etapas e produtos</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon cyan">
            <FileClock size={19} />
          </span>
          <strong>{averageProgress}%</strong>
          <span>avanço médio</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon green">
            <CheckCircle2 size={19} />
          </span>
          <strong>{concluded}</strong>
          <span>concluídos</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon amber">
            <AlertTriangle size={19} />
          </span>
          <strong>{overdue}</strong>
          <span>prazos vencidos</span>
        </div>
      </section>
      <section className="plan-overall">
        <div>
          <strong>Avanço geral da revisão</strong>
          <span>{averageProgress}%</span>
        </div>
        <div className="progress-track">
          <i style={{ width: `${averageProgress}%` }} />
        </div>
      </section>
      <WorkspaceCalendar
        contextType="master-plan"
        contextId="revisao-plano-diretor"
        title="Agenda da Revisão do Plano Diretor"
      />
      <section className="filter-panel plan-filters">
        <label className="search-field">
          <span>Buscar</span>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Etapa, responsável ou referência"
          />
        </label>
        <label>
          <span>Fase</span>
          <select
            value={phase}
            onChange={(event) => setPhase(event.target.value)}
          >
            <option value="all">Todas as fases</option>
            {PHASES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Situação</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">Todas</option>
            {STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </section>
      {selected.size ? (
        <div className="bulk-module-actions">
          <strong>{selected.size}</strong>
          <span>selecionado{selected.size === 1 ? "" : "s"}</span>
          <button
            className="primary-button compact-button"
            disabled={saving}
            onClick={() => void completeSelected()}
          >
            <CheckCircle2 size={16} /> Concluir
          </button>
          <button
            className="secondary-button compact-button danger-text"
            disabled={saving}
            onClick={() => void deleteSelected()}
          >
            <Trash2 size={16} /> Excluir
          </button>
          <button
            className="icon-only-button"
            onClick={() => setSelected(new Set())}
            title="Limpar seleção"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
      {error ? <div className="module-error">{error}</div> : null}
      <section className="panel process-section">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Cronograma integrado</p>
            <h2>Etapas, produtos e participação social</h2>
            <p>
              {filtered.length} registro{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="selection-column">
                  <SelectionIconButton
                    selected={allSelected}
                    onClick={toggleAll}
                    label="Selecionar etapas visíveis"
                  />
                </th>
                <th>Etapa / produto</th>
                <th>Fase</th>
                <th>Período</th>
                <th>Responsável</th>
                <th>Progresso</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const isOverdue =
                  item.status !== "Concluído" && item.dueDate < today();
                return (
                  <tr
                    key={item.id}
                    className={
                      item.status === "Concluído" ? "row-completed" : ""
                    }
                  >
                    <td>
                      <SelectionIconButton
                        selected={selected.has(item.id)}
                        onClick={() => toggleSelection(item.id)}
                        label={`Selecionar ${item.title}`}
                      />
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                      <small>
                        {item.itemType}
                        {item.legalReference ? ` · ${item.legalReference}` : ""}
                      </small>
                    </td>
                    <td>{item.phase}</td>
                    <td>
                      <strong>{date(item.startDate)}</strong>
                      <small className={isOverdue ? "deadline-overdue" : ""}>
                        até {date(item.dueDate)}
                      </small>
                    </td>
                    <td>{item.responsible}</td>
                    <td>
                      <div className="row-progress">
                        <div className="progress-track">
                          <i style={{ width: `${item.progress}%` }} />
                        </div>
                        <span>{item.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${item.status === "Concluído" ? "badge-green" : isOverdue ? "badge-amber" : item.status === "Em validação" ? "badge-violet" : "badge-blue"}`}
                      >
                        {isOverdue ? "Atrasado" : item.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="row-action icon-row-action"
                          type="button"
                          onClick={() => void toggleComplete(item)}
                          title={
                            item.status === "Concluído"
                              ? "Reabrir"
                              : "Marcar como concluído"
                          }
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <ItemFilesButton
                          module="master-plan"
                          itemId={item.id}
                          title={item.title}
                        />
                        <button
                          className="row-action icon-row-action"
                          type="button"
                          onClick={() => edit(item)}
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="row-action icon-row-action danger-row-action"
                          type="button"
                          onClick={() => void remove(item)}
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={8} className="empty-state">
                    {loading ? (
                      <>
                        <LoaderCircle className="spin" /> Carregando…
                      </>
                    ) : (
                      "Nenhuma etapa cadastrada."
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {formOpen ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true">
          <form className="attachment-modal record-form-modal" onSubmit={save}>
            <header>
              <div>
                <span className="panel-kicker">Revisão do Plano Diretor</span>
                <h2>{editingId ? "Editar etapa" : "Nova etapa"}</h2>
              </div>
              <button
                className="icon-only-button"
                type="button"
                onClick={closeForm}
              >
                <X size={20} />
              </button>
            </header>
            <div className="record-form-grid">
              <label className="form-span-2">
                <span>Título da etapa ou produto</span>
                <input
                  required
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Fase</span>
                <select
                  value={draft.phase}
                  onChange={(event) =>
                    setDraft({ ...draft, phase: event.target.value })
                  }
                >
                  {PHASES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Tipo</span>
                <select
                  value={draft.itemType}
                  onChange={(event) =>
                    setDraft({ ...draft, itemType: event.target.value })
                  }
                >
                  {TYPES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Início</span>
                <input
                  required
                  type="date"
                  value={draft.startDate}
                  onChange={(event) =>
                    setDraft({ ...draft, startDate: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Prazo</span>
                <input
                  required
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) =>
                    setDraft({ ...draft, dueDate: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Responsável</span>
                <select
                  value={draft.responsible}
                  onChange={(event) =>
                    setDraft({ ...draft, responsible: event.target.value })
                  }
                >
                  {RESPONSIBLE_OPTIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
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
                  {STATUSES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Progresso (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={draft.progress}
                  onChange={(event) =>
                    setDraft({ ...draft, progress: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                <span>Referência legal</span>
                <input
                  value={draft.legalReference}
                  onChange={(event) =>
                    setDraft({ ...draft, legalReference: event.target.value })
                  }
                  placeholder="Lei, decreto ou processo"
                />
              </label>
              <label className="form-span-2">
                <span>Descrição</span>
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
              </label>
              <label className="form-span-2">
                <span>Atores envolvidos</span>
                <textarea
                  value={draft.stakeholders}
                  onChange={(event) =>
                    setDraft({ ...draft, stakeholders: event.target.value })
                  }
                  placeholder="Secretarias, conselhos, entidades e comunidades"
                />
              </label>
              <label className="form-span-2">
                <span>Observações</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft({ ...draft, notes: event.target.value })
                  }
                />
              </label>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="editor-actions">
              <button className="primary-button" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}{" "}
                Salvar
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={closeForm}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {suggestionOpen ? (
        <div
          className="attachment-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suggestion-title"
        >
          <form
            className="attachment-modal record-form-modal suggestion-modal"
            onSubmit={(event) => void saveSuggestion(event)}
          >
            <header>
              <div>
                <span className="panel-kicker">Participação na revisão</span>
                <h2 id="suggestion-title">Inserir sugestão</h2>
              </div>
              <button
                className="icon-only-button"
                type="button"
                onClick={() => setSuggestionOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            <p className="modal-intro">
              Registre uma proposta para avaliação técnica e incorporação ao
              processo de revisão.
            </p>
            <div className="record-form-grid">
              <label className="form-span-2">
                <span>Título da sugestão</span>
                <input
                  required
                  value={suggestion.title}
                  onChange={(event) =>
                    setSuggestion({ ...suggestion, title: event.target.value })
                  }
                  placeholder="Síntese objetiva da proposta"
                />
              </label>
              <label>
                <span>Tema</span>
                <select
                  value={suggestion.theme}
                  onChange={(event) =>
                    setSuggestion({ ...suggestion, theme: event.target.value })
                  }
                >
                  {[
                    "Uso e ocupação do solo",
                    "Sistema viário",
                    "Habitação",
                    "Meio ambiente",
                    "Mobilidade",
                    "Desenvolvimento econômico",
                    "Equipamentos públicos",
                    "Patrimônio cultural",
                    "Outro",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Responsável pela análise</span>
                <select
                  value={suggestion.responsible}
                  onChange={(event) =>
                    setSuggestion({
                      ...suggestion,
                      responsible: event.target.value,
                    })
                  }
                >
                  {RESPONSIBLE_OPTIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="form-span-2">
                <span>Descrição detalhada</span>
                <textarea
                  required
                  rows={6}
                  value={suggestion.description}
                  onChange={(event) =>
                    setSuggestion({
                      ...suggestion,
                      description: event.target.value,
                    })
                  }
                  placeholder="Explique o problema, a proposta e os benefícios esperados"
                />
              </label>
              <label className="form-span-2">
                <span>Proponente ou entidade</span>
                <input
                  value={suggestion.proposer}
                  onChange={(event) =>
                    setSuggestion({
                      ...suggestion,
                      proposer: event.target.value,
                    })
                  }
                  placeholder="Nome, entidade ou comunidade"
                />
              </label>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="editor-actions">
              <button className="primary-button" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <MessageSquarePlus size={18} />
                )}{" "}
                Registrar sugestão
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSuggestionOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
