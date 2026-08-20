"use client";

import { Save, Square, SquareCheckBig, UserRound, X } from "lucide-react";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type SelectionIconButtonProps = {
  selected: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
};

export function SelectionIconButton({
  selected,
  onClick,
  label,
  disabled = false,
}: SelectionIconButtonProps) {
  return (
    <button
      className={`selection-icon-button ${selected ? "selected" : ""}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      title={label}
    >
      {selected ? <SquareCheckBig size={18} /> : <Square size={18} />}
    </button>
  );
}

type ResponsibleSelectProps = {
  value: string;
  onChange: (responsible: string) => void;
  disabled?: boolean;
  sourceValue?: string | null;
  ariaLabel: string;
};

export function ResponsibleSelect({
  value,
  onChange,
  disabled = false,
  sourceValue,
  ariaLabel,
}: ResponsibleSelectProps) {
  return (
    <div className="responsible-control">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        <option value="">Não atribuído</option>
        {RESPONSIBLE_OPTIONS.map((responsible) => (
          <option key={responsible} value={responsible}>{responsible}</option>
        ))}
      </select>
      {sourceValue ? <small title={sourceValue}>Fonte: {sourceValue}</small> : null}
    </div>
  );
}

type BulkAssignmentBarProps = {
  selectedCount: number;
  value: string;
  onValueChange: (value: string) => void;
  onApply: () => void;
  onClearSelection: () => void;
  disabled?: boolean;
};

export function BulkAssignmentBar({
  selectedCount,
  value,
  onValueChange,
  onApply,
  onClearSelection,
  disabled = false,
}: BulkAssignmentBarProps) {
  if (!selectedCount) return null;

  return (
    <div className="bulk-assignment-bar" role="region" aria-label="Atribuição em lote">
      <div>
        <SquareCheckBig size={18} />
        <strong>{selectedCount}</strong>
        <span>selecionado{selectedCount === 1 ? "" : "s"}</span>
      </div>
      <label>
        <UserRound size={16} />
        <span className="sr-only">Responsável para os registros selecionados</span>
        <select value={value} onChange={(event) => onValueChange(event.target.value)} disabled={disabled}>
          <option value="">Remover responsável</option>
          {RESPONSIBLE_OPTIONS.map((responsible) => (
            <option key={responsible} value={responsible}>{responsible}</option>
          ))}
        </select>
      </label>
      <button className="primary-button compact-button" type="button" onClick={onApply} disabled={disabled}>
        <Save size={16} /> Aplicar
      </button>
      <button className="icon-only-button" type="button" onClick={onClearSelection} disabled={disabled} aria-label="Limpar seleção" title="Limpar seleção">
        <X size={17} />
      </button>
    </div>
  );
}
