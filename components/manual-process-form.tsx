"use client";

import { LoaderCircle, Save, X } from "lucide-react";
import { useState } from "react";
import type { AssignResponsible, ManualProcessRecord } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type ManualProcessFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (record: ManualProcessRecord) => void;
  onAssign: AssignResponsible;
  assignmentSaving: boolean;
};

function todayValue() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const EMPTY = {
  processNumber: "",
  area: "Urbanismo" as const,
  applicant: "",
  companyName: "",
  cnpj: "",
  propertyRegistration: "",
  category: "",
  status: "Em Análise",
  actionType: "",
  openedAt: todayValue(),
  plannedCloseAt: "",
  observation: "",
  responsible: "",
};

export function ManualProcessForm({ open, onClose, onCreated, onAssign, assignmentSaving }: ManualProcessFormProps) {
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/manual-processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, openedAt: draft.openedAt || null, plannedCloseAt: draft.plannedCloseAt || null }),
      });
      const payload = (await response.json()) as { process?: ManualProcessRecord; error?: string };
      if (!response.ok || !payload.process) throw new Error(payload.error ?? "Não foi possível cadastrar o processo.");
      onCreated(payload.process);
      if (draft.responsible && !(await onAssign("processes", [payload.process.id], draft.responsible))) {
        onClose();
        return;
      }
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível cadastrar o processo.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="procurement-form-overlay" role="dialog" aria-modal="true" aria-labelledby="manual-process-title"><form className="procurement-form-panel" onSubmit={(event) => void submit(event)}>
    <div className="procurement-form-heading"><div><p className="panel-kicker">Cadastro complementar</p><h2 id="manual-process-title">Novo processo</h2></div><button className="icon-only-button" type="button" onClick={onClose} aria-label="Fechar formulário"><X size={19} /></button></div>
    <div className="procurement-form-grid">
      <label><span>Número do processo *</span><input value={draft.processNumber} onChange={(event) => setDraft((current) => ({ ...current, processNumber: event.target.value }))} maxLength={100} required placeholder="Ex.: 32145/2026" /></label>
      <label><span>Área *</span><select value={draft.area} onChange={(event) => setDraft((current) => ({ ...current, area: event.target.value as typeof EMPTY.area }))}><option>Urbanismo</option><option>Abertura de empresa</option></select></label>
      <label><span>Responsável</span><select value={draft.responsible} onChange={(event) => setDraft((current) => ({ ...current, responsible: event.target.value }))}><option value="">Não atribuído</option>{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label className="wide-field"><span>Requerente *</span><input value={draft.applicant} onChange={(event) => setDraft((current) => ({ ...current, applicant: event.target.value }))} maxLength={220} required placeholder="Nome do requerente" /></label>
      <label><span>Empresa / razão social</span><input value={draft.companyName} onChange={(event) => setDraft((current) => ({ ...current, companyName: event.target.value }))} maxLength={220} /></label>
      <label><span>CNPJ</span><input value={draft.cnpj} onChange={(event) => setDraft((current) => ({ ...current, cnpj: event.target.value }))} maxLength={30} placeholder="00.000.000/0000-00" /></label>
      <label><span>Inscrição imobiliária</span><input value={draft.propertyRegistration} onChange={(event) => setDraft((current) => ({ ...current, propertyRegistration: event.target.value }))} maxLength={40} placeholder="101.001.0012.001" /></label>
      <label><span>Situação *</span><input value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} maxLength={100} required placeholder="Em Análise" /></label>
      <label><span>Categoria / assunto *</span><input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} maxLength={180} required /></label>
      <label><span>Tipo de ação</span><input value={draft.actionType} onChange={(event) => setDraft((current) => ({ ...current, actionType: event.target.value }))} maxLength={180} /></label>
      <label><span>Data de abertura</span><input type="date" value={draft.openedAt} onChange={(event) => setDraft((current) => ({ ...current, openedAt: event.target.value }))} /></label>
      <label><span>Previsão de encerramento</span><input type="date" value={draft.plannedCloseAt} onChange={(event) => setDraft((current) => ({ ...current, plannedCloseAt: event.target.value }))} /></label>
      <label className="wide-field"><span>Observações</span><textarea value={draft.observation} onChange={(event) => setDraft((current) => ({ ...current, observation: event.target.value }))} maxLength={2000} rows={3} /></label>
    </div>
    {error ? <div className="form-error">{error}</div> : null}
    <div className="procurement-form-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving || assignmentSaving}>{saving ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />} Cadastrar processo</button></div>
  </form></div>;
}
