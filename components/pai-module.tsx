"use client";

import { Banknote, CheckCircle2, CircleDollarSign, ClipboardList, Download, Landmark, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ItemFilesButton } from "@/components/item-lifecycle";
import { SelectionIconButton } from "@/components/responsibility-controls";
import type { PaiRecord } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type Draft = Omit<PaiRecord, "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt">;
const AXES = ["Desenvolvimento urbano", "Mobilidade", "Habitação", "Meio ambiente", "Infraestrutura", "Desenvolvimento econômico", "Gestão e governança", "Patrimônio público"];
const STATUSES: Draft["status"][] = ["Planejado", "Em execução", "Em monitoramento", "Concluído"];
const today = () => new Date().toISOString().slice(0, 10);
const plusYear = () => { const value = new Date(); value.setFullYear(value.getFullYear() + 1); return value.toISOString().slice(0, 10); };
const emptyDraft = (): Draft => ({ title: "", axis: AXES[0], description: "", startDate: today(), dueDate: plusYear(), status: "Planejado", progress: 0, estimatedValue: null, fundingSource: "", responsible: RESPONSIBLE_OPTIONS[0], location: "", notes: "" });
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function PaiModule() {
  const [items, setItems] = useState<PaiRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [axis, setAxis] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pai", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const payload = await response.json() as { items?: PaiRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error);
      setItems(payload.items ?? []);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha ao carregar o PAI."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => items.filter((item) => {
    if (axis !== "all" && item.axis !== axis) return false;
    if (status !== "all" && item.status !== status) return false;
    const query = normalize(search.trim());
    return !query || normalize([item.title, item.axis, item.description, item.fundingSource, item.responsible, item.location].join(" ")).includes(query);
  }), [axis, items, search, status]);
  const estimated = items.reduce((sum, item) => sum + (item.estimatedValue ?? 0), 0);
  const inExecution = items.filter((item) => item.status === "Em execução" || item.status === "Em monitoramento").length;
  const concluded = items.filter((item) => item.status === "Concluído").length;
  const averageProgress = items.length ? Math.round(items.reduce((sum, item) => sum + item.progress, 0) / items.length) : 0;
  const allSelected = Boolean(filtered.length) && filtered.every((item) => selected.has(item.id));

  async function persist(next: Draft, id?: string) {
    const response = await fetch("/api/pai", { method: id ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...next, id }) });
    const payload = await response.json() as { item?: PaiRecord; error?: string };
    if (!response.ok || !payload.item) throw new Error(payload.error ?? "Não foi possível salvar a ação.");
    setItems((current) => id ? current.map((item) => item.id === id ? payload.item! : item) : [payload.item!, ...current]);
  }
  async function save(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { await persist(draft, editingId || undefined); closeForm(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar a ação."); } finally { setSaving(false); } }
  async function toggleComplete(item: PaiRecord) { const complete = item.status !== "Concluído"; try { await persist({ ...item, status: complete ? "Concluído" : "Em execução", progress: complete ? 100 : Math.min(item.progress, 95) }, item.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a ação."); } }
  async function remove(item: PaiRecord) { if (!window.confirm(`Excluir a ação “${item.title}”?`)) return; const response = await fetch("/api/pai", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id }) }); if (response.ok) setItems((current) => current.filter((entry) => entry.id !== item.id)); }
  function closeForm() { setFormOpen(false); setEditingId(""); setDraft(emptyDraft()); setError(""); }
  function openEdit(item: PaiRecord) { setEditingId(item.id); setDraft({ title: item.title, axis: item.axis, description: item.description, startDate: item.startDate, dueDate: item.dueDate, status: item.status, progress: item.progress, estimatedValue: item.estimatedValue, fundingSource: item.fundingSource, responsible: item.responsible, location: item.location, notes: item.notes }); setFormOpen(true); }
  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleAll() { setSelected((current) => { const next = new Set(current); filtered.forEach((item) => allSelected ? next.delete(item.id) : next.add(item.id)); return next; }); }
  function exportCsv() { const rows = [["Ação", "Eixo", "Início", "Prazo", "Situação", "Progresso", "Investimento estimado", "Fonte", "Responsável", "Local"], ...filtered.map((item) => [item.title, item.axis, item.startDate, item.dueDate, item.status, item.progress, item.estimatedValue, item.fundingSource, item.responsible, item.location])]; const url = URL.createObjectURL(new Blob([`\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "pai-plano-acao-investimentos.csv"; anchor.click(); URL.revokeObjectURL(url); }

  return <>
    <section className="dashboard-header module-header"><div><p className="eyebrow">Planejamento estratégico · investimentos municipais</p><h1>PAI — Plano de Ação e Investimentos</h1><p>Carteira de ações, cronograma, responsáveis, fontes de recursos e acompanhamento da execução.</p></div><div className="header-actions"><button className="icon-button export-button" type="button" onClick={exportCsv} disabled={!filtered.length}><Download size={18}/><span>Exportar</span></button><button className="primary-button" type="button" onClick={() => setFormOpen(true)}><Plus size={18}/> Nova ação</button></div></section>
    <section className="kpi-grid"><div className="kpi-card"><span className="kpi-icon"><ClipboardList size={19}/></span><strong>{items.length}</strong><span>ações cadastradas</span></div><div className="kpi-card"><span className="kpi-icon cyan"><CircleDollarSign size={19}/></span><strong>{estimated ? currency(estimated) : "—"}</strong><span>investimento estimado</span></div><div className="kpi-card"><span className="kpi-icon amber"><Landmark size={19}/></span><strong>{inExecution}</strong><span>em execução</span></div><div className="kpi-card"><span className="kpi-icon green"><CheckCircle2 size={19}/></span><strong>{concluded}</strong><span>concluídas · {averageProgress}% médio</span></div></section>
    <section className="filter-panel plan-filters"><label className="search-field"><span>Buscar</span><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ação, fonte, local ou responsável"/></label><label><span>Eixo</span><select value={axis} onChange={(event) => setAxis(event.target.value)}><option value="all">Todos os eixos</option>{AXES.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Situação</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todas</option>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label></section>
    {error ? <div className="module-error">{error}</div> : null}
    <section className="panel process-section"><div className="panel-heading"><div><p className="panel-kicker">Carteira de investimentos</p><h2>Ações e entregas prioritárias</h2><p>{filtered.length} registro{filtered.length === 1 ? "" : "s"}</p></div></div><div className="table-scroll"><table><thead><tr><th className="selection-column"><SelectionIconButton selected={allSelected} onClick={toggleAll} label="Selecionar ações visíveis"/></th><th>Ação</th><th>Eixo</th><th>Período</th><th>Investimento / fonte</th><th>Responsável</th><th>Progresso</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className={item.status === "Concluído" ? "row-completed" : ""}><td><SelectionIconButton selected={selected.has(item.id)} onClick={() => toggle(item.id)} label={`Selecionar ${item.title}`}/></td><td><strong>{item.title}</strong><small>{item.location || item.description || "Sem localização informada"}</small></td><td>{item.axis}</td><td><strong>{date(item.startDate)}</strong><small>até {date(item.dueDate)}</small></td><td><strong>{item.estimatedValue == null ? "Não informado" : currency(item.estimatedValue)}</strong><small>{item.fundingSource || "Fonte não informada"}</small></td><td>{item.responsible}</td><td><div className="row-progress"><div className="progress-track"><i style={{ width: `${item.progress}%` }}/></div><span>{item.progress}%</span></div></td><td><span className={`status-badge ${item.status === "Concluído" ? "badge-green" : item.status === "Em execução" ? "badge-cyan" : item.status === "Em monitoramento" ? "badge-violet" : "badge-slate"}`}>{item.status}</span></td><td><div className="row-actions"><button className="row-action icon-row-action" type="button" onClick={() => void toggleComplete(item)} title={item.status === "Concluído" ? "Reabrir" : "Marcar como concluída"}><CheckCircle2 size={16}/></button><ItemFilesButton module="pai" itemId={item.id} title={item.title}/><button className="row-action icon-row-action" type="button" onClick={() => openEdit(item)} title="Editar"><Pencil size={15}/></button><button className="row-action icon-row-action danger-row-action" type="button" onClick={() => void remove(item)} title="Excluir"><Trash2 size={15}/></button></div></td></tr>)}{!filtered.length ? <tr><td colSpan={9} className="empty-state">{loading ? <><LoaderCircle className="spin"/> Carregando…</> : "Nenhuma ação cadastrada. O futuro não se planeja sozinho — ainda."}</td></tr> : null}</tbody></table></div></section>
    {formOpen ? <div className="attachment-overlay" role="dialog" aria-modal="true"><form className="attachment-modal record-form-modal" onSubmit={(event) => void save(event)}><header><div><span className="panel-kicker">Plano de Ação e Investimentos</span><h2>{editingId ? "Editar ação" : "Nova ação"}</h2></div><button className="icon-only-button" type="button" onClick={closeForm}><X size={20}/></button></header><div className="record-form-grid"><label className="form-span-2"><span>Ação ou investimento</span><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label><label><span>Eixo</span><select value={draft.axis} onChange={(event) => setDraft({ ...draft, axis: event.target.value })}>{AXES.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Responsável</span><select value={draft.responsible} onChange={(event) => setDraft({ ...draft, responsible: event.target.value })}>{RESPONSIBLE_OPTIONS.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Início</span><input required type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}/></label><label><span>Prazo</span><input required type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}/></label><label><span>Situação</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft["status"] })}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Progresso (%)</span><input type="number" min="0" max="100" value={draft.progress} onChange={(event) => setDraft({ ...draft, progress: Number(event.target.value) })}/></label><label><span>Investimento estimado (R$)</span><input type="number" min="0" step="0.01" value={draft.estimatedValue ?? ""} onChange={(event) => setDraft({ ...draft, estimatedValue: event.target.value ? Number(event.target.value) : null })}/></label><label><span>Fonte de recursos</span><input value={draft.fundingSource} onChange={(event) => setDraft({ ...draft, fundingSource: event.target.value })}/></label><label className="form-span-2"><span>Localização</span><input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Bairro, endereço, equipamento ou inscrição"/></label><label className="form-span-2"><span>Descrição</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label><label className="form-span-2"><span>Observações</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })}/></label></div>{error ? <div className="form-error">{error}</div> : null}<div className="editor-actions"><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18}/> : <Banknote size={18}/>} Salvar ação</button><button className="secondary-button" type="button" onClick={closeForm}>Cancelar</button></div></form></div> : null}
  </>;
}
