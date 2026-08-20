"use client";

import { LoaderCircle, Save, X } from "lucide-react";
import { useState } from "react";
import type { AssignResponsible, ManualProjectRecord, ProjectStage } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type ManualProjectFormProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (record: ManualProjectRecord) => void;
  onAssign: AssignResponsible;
  assignmentSaving: boolean;
};

type Draft = {
  project: string;
  priority: string;
  areaToBuildM2: string;
  areaToRenovateM2: string;
  department: string;
  deadline: string;
  currentStatus: string;
  stage: ProjectStage;
  processNumber: string;
  propertyRegistration: string;
  dependency: string;
  fundingSource: string;
  value: string;
  responsible: string;
};

const EMPTY: Draft = {
  project: "",
  priority: "",
  areaToBuildM2: "",
  areaToRenovateM2: "",
  department: "",
  deadline: "",
  currentStatus: "A iniciar",
  stage: "A iniciar",
  processNumber: "",
  propertyRegistration: "",
  dependency: "",
  fundingSource: "",
  value: "",
  responsible: "",
};

const STAGES: ProjectStage[] = ["A iniciar", "Em desenvolvimento", "Aguardando dependência", "Em licitação"];

export function ManualProjectForm({ open, onClose, onCreated, onAssign, assignmentSaving }: ManualProjectFormProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  function update<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/manual-projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          priority: draft.priority || null,
          areaToBuildM2: draft.areaToBuildM2 || null,
          areaToRenovateM2: draft.areaToRenovateM2 || null,
          deadline: draft.deadline || null,
          value: draft.value || null,
        }),
      });
      const payload = (await response.json()) as { project?: ManualProjectRecord; error?: string };
      if (!response.ok || !payload.project) throw new Error(payload.error ?? "Não foi possível cadastrar o projeto.");
      onCreated(payload.project);
      if (draft.responsible && !(await onAssign("projects", [payload.project.id], draft.responsible))) {
        onClose();
        return;
      }
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível cadastrar o projeto.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="procurement-form-overlay" role="dialog" aria-modal="true" aria-labelledby="manual-project-title"><form className="procurement-form-panel" onSubmit={(event) => void submit(event)}>
    <div className="procurement-form-heading"><div><p className="panel-kicker">Portfólio municipal</p><h2 id="manual-project-title">Novo projeto</h2></div><button className="icon-only-button" type="button" onClick={onClose} aria-label="Fechar formulário"><X size={19} /></button></div>
    <div className="procurement-form-grid">
      <label className="wide-field"><span>Projeto *</span><input value={draft.project} onChange={(event) => update("project", event.target.value)} maxLength={400} required placeholder="Nome da iniciativa" /></label>
      <label><span>Prioridade</span><select value={draft.priority} onChange={(event) => update("priority", event.target.value)}><option value="">Não classificada</option><option value="1">Prioridade 1</option><option value="2">Prioridade 2</option></select></label>
      <label><span>Etapa *</span><select value={draft.stage} onChange={(event) => update("stage", event.target.value as ProjectStage)}>{STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
      <label><span>Responsável</span><select value={draft.responsible} onChange={(event) => update("responsible", event.target.value)}><option value="">Não atribuído</option>{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select></label>
      <label><span>Secretaria / setor</span><input value={draft.department} onChange={(event) => update("department", event.target.value)} maxLength={180} /></label>
      <label><span>Prazo</span><input type="date" value={draft.deadline} onChange={(event) => update("deadline", event.target.value)} /></label>
      <label><span>Nº do processo</span><input value={draft.processNumber} onChange={(event) => update("processNumber", event.target.value)} maxLength={100} /></label>
      <label><span>Inscrição imobiliária</span><input value={draft.propertyRegistration} onChange={(event) => update("propertyRegistration", event.target.value)} maxLength={40} placeholder="101.001.0012.001" /></label>
      <label className="wide-field"><span>Situação atual *</span><textarea value={draft.currentStatus} onChange={(event) => update("currentStatus", event.target.value)} maxLength={1000} rows={3} required /></label>
      <label><span>Área a construir (m²)</span><input type="number" min="0" step="0.01" value={draft.areaToBuildM2} onChange={(event) => update("areaToBuildM2", event.target.value)} /></label>
      <label><span>Área a reformar (m²)</span><input type="number" min="0" step="0.01" value={draft.areaToRenovateM2} onChange={(event) => update("areaToRenovateM2", event.target.value)} /></label>
      <label><span>Valor (R$)</span><input type="number" min="0" step="0.01" value={draft.value} onChange={(event) => update("value", event.target.value)} /></label>
      <label><span>Fonte do recurso</span><input value={draft.fundingSource} onChange={(event) => update("fundingSource", event.target.value)} maxLength={180} /></label>
      <label className="wide-field"><span>Dependência / pendência</span><textarea value={draft.dependency} onChange={(event) => update("dependency", event.target.value)} maxLength={500} rows={2} /></label>
    </div>
    {error ? <div className="form-error">{error}</div> : null}
    <div className="procurement-form-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="primary-button" type="submit" disabled={saving || assignmentSaving}>{saving ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />} Cadastrar projeto</button></div>
  </form></div>;
}
