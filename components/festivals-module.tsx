"use client";

import { CheckCircle2, CircleDollarSign, Download, Gift, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ItemFilesButton } from "@/components/item-lifecycle";
import type { PartyExpenseRecord } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type Draft = Omit<PartyExpenseRecord, "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt">;
const today = () => new Date().toISOString().slice(0, 10);
const emptyDraft = (): Draft => ({ eventName: "", expenseDate: today(), description: "", amount: 0, paidBy: "", debtor: "", creditor: "", responsible: RESPONSIBLE_OPTIONS[0], status: "Pendente", notes: "" });
const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function FestivalsModule() {
  const [expenses, setExpenses] = useState<PartyExpenseRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/party-expenses", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const payload = await response.json() as { expenses?: PartyExpenseRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error);
      setExpenses(payload.expenses ?? []);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha ao carregar os gastos."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => expenses.filter((expense) => {
    if (status !== "all" && expense.status !== status) return false;
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return !query || [expense.eventName, expense.description, expense.paidBy, expense.debtor, expense.creditor, expense.responsible].join(" ").toLocaleLowerCase("pt-BR").includes(query);
  }), [expenses, search, status]);
  const pending = expenses.filter((expense) => expense.status === "Pendente");
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const pendingTotal = pending.reduce((sum, expense) => sum + expense.amount, 0);

  function edit(expense: PartyExpenseRecord) {
    setEditingId(expense.id);
    setDraft({ eventName: expense.eventName, expenseDate: expense.expenseDate, description: expense.description, amount: expense.amount, paidBy: expense.paidBy, debtor: expense.debtor, creditor: expense.creditor, responsible: expense.responsible, status: expense.status, notes: expense.notes });
    setFormOpen(true);
  }
  function closeForm() { setFormOpen(false); setEditingId(""); setDraft(emptyDraft()); setError(""); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/party-expenses", { method: editingId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, id: editingId || undefined }) });
      const payload = await response.json() as { expense?: PartyExpenseRecord; error?: string };
      if (!response.ok || !payload.expense) throw new Error(payload.error ?? "Não foi possível salvar o gasto.");
      setExpenses((current) => editingId ? current.map((item) => item.id === editingId ? payload.expense! : item) : [payload.expense!, ...current]);
      closeForm();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o gasto."); }
    finally { setSaving(false); }
  }
  async function toggle(expense: PartyExpenseRecord) {
    const response = await fetch("/api/party-expenses", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...expense, status: expense.status === "Quitado" ? "Pendente" : "Quitado" }) });
    const payload = await response.json() as { expense?: PartyExpenseRecord; error?: string };
    if (response.ok && payload.expense) setExpenses((current) => current.map((item) => item.id === expense.id ? payload.expense! : item));
    else setError(payload.error ?? "Não foi possível atualizar o gasto.");
  }
  async function remove(expense: PartyExpenseRecord) {
    if (!window.confirm(`Excluir o gasto “${expense.description}”?`)) return;
    const response = await fetch("/api/party-expenses", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: expense.id }) });
    if (response.ok) setExpenses((current) => current.filter((item) => item.id !== expense.id));
  }
  function exportCsv() {
    const rows = [["Festa", "Data", "Descrição", "Valor", "Quem pagou", "Quem deve", "Para quem", "Responsável", "Situação"], ...filtered.map((expense) => [expense.eventName, expense.expenseDate, expense.description, expense.amount, expense.paidBy, expense.debtor, expense.creditor, expense.responsible, expense.status])];
    const url = URL.createObjectURL(new Blob([`\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "controle-financeiro-festas.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <>
    <section className="dashboard-header module-header"><div><p className="eyebrow">IDEPPLAN · gestão compartilhada</p><h1>Festas</h1><p>Controle financeiro de gastos, pagamentos e valores pendentes entre participantes.</p></div><div className="header-actions"><button className="icon-button export-button" type="button" onClick={exportCsv}><Download size={18}/> <span>Exportar</span></button><button className="primary-button" type="button" onClick={() => setFormOpen(true)}><Plus size={18}/> Novo gasto</button></div></section>
    <section className="kpi-grid festival-kpis"><div className="kpi-card"><span className="kpi-icon"><Gift size={19}/></span><strong>{expenses.length}</strong><span>lançamentos</span><small>{new Set(expenses.map((expense) => expense.eventName)).size} festas</small></div><div className="kpi-card"><span className="kpi-icon green"><CircleDollarSign size={19}/></span><strong>{currency(total)}</strong><span>gastos registrados</span></div><div className="kpi-card"><span className="kpi-icon amber"><CircleDollarSign size={19}/></span><strong>{currency(pendingTotal)}</strong><span>saldo pendente</span><small>{pending.length} lançamentos</small></div></section>
    <section className="filter-panel festival-filters"><label className="search-field"><span>Buscar</span><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Festa, pessoa ou despesa"/></label><label><span>Situação</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todas</option><option>Pendente</option><option>Quitado</option></select></label></section>
    {error ? <div className="module-error">{error}</div> : null}
    <section className="panel process-section"><div className="panel-heading"><div><p className="panel-kicker">Acerto financeiro</p><h2>Gastos e participantes</h2><p>{filtered.length} lançamento{filtered.length === 1 ? "" : "s"}</p></div></div><div className="table-scroll"><table><thead><tr><th>Festa / data</th><th>Despesa</th><th>Valor</th><th>Quem pagou</th><th>Quem deve</th><th>Para quem</th><th>Responsável</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{filtered.map((expense) => <tr key={expense.id} className={expense.status === "Quitado" ? "row-completed" : ""}><td><strong>{expense.eventName}</strong><small>{date(expense.expenseDate)}</small></td><td>{expense.description}</td><td><strong>{currency(expense.amount)}</strong></td><td>{expense.paidBy}</td><td>{expense.debtor}</td><td>{expense.creditor}</td><td>{expense.responsible}</td><td><span className={`status-badge ${expense.status === "Quitado" ? "badge-green" : "badge-amber"}`}>{expense.status}</span></td><td><div className="row-actions"><button className="row-action icon-row-action" type="button" onClick={() => void toggle(expense)} title={expense.status === "Quitado" ? "Reabrir" : "Marcar como quitado"}><CheckCircle2 size={16}/></button><ItemFilesButton module="festivals" itemId={expense.id} title={expense.description}/><button className="row-action icon-row-action" type="button" onClick={() => edit(expense)} title="Editar"><Pencil size={15}/></button><button className="row-action icon-row-action danger-row-action" type="button" onClick={() => void remove(expense)} title="Excluir"><Trash2 size={15}/></button></div></td></tr>)}{!filtered.length ? <tr><td colSpan={9} className="empty-state">{loading ? <><LoaderCircle className="spin"/> Carregando…</> : "Nenhum gasto cadastrado."}</td></tr> : null}</tbody></table></div></section>
    {formOpen ? <div className="attachment-overlay" role="dialog" aria-modal="true"><form className="attachment-modal record-form-modal" onSubmit={save}><header><div><span className="panel-kicker">Controle de festas</span><h2>{editingId ? "Editar gasto" : "Novo gasto"}</h2></div><button className="icon-only-button" type="button" onClick={closeForm}><X size={20}/></button></header><div className="record-form-grid"><label><span>Festa</span><input required value={draft.eventName} onChange={(event) => setDraft({ ...draft, eventName: event.target.value })}/></label><label><span>Data</span><input required type="date" value={draft.expenseDate} onChange={(event) => setDraft({ ...draft, expenseDate: event.target.value })}/></label><label className="form-span-2"><span>Despesa</span><input required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label><label><span>Valor</span><input required type="number" min="0.01" step="0.01" value={draft.amount || ""} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })}/></label><label><span>Quem pagou</span><input required value={draft.paidBy} onChange={(event) => setDraft({ ...draft, paidBy: event.target.value })}/></label><label><span>Quem deve</span><input required value={draft.debtor} onChange={(event) => setDraft({ ...draft, debtor: event.target.value })}/></label><label><span>Para quem</span><input required value={draft.creditor} onChange={(event) => setDraft({ ...draft, creditor: event.target.value })}/></label><label><span>Responsável</span><select value={draft.responsible} onChange={(event) => setDraft({ ...draft, responsible: event.target.value })}>{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select></label><label><span>Situação</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft["status"] })}><option>Pendente</option><option>Quitado</option></select></label><label className="form-span-2"><span>Observações</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })}/></label></div>{error ? <div className="form-error">{error}</div> : null}<div className="editor-actions"><button className="primary-button" disabled={saving}>{saving ? <LoaderCircle className="spin" size={18}/> : <CheckCircle2 size={18}/>} Salvar</button><button className="secondary-button" type="button" onClick={closeForm}>Cancelar</button></div></form></div> : null}
  </>;
}
