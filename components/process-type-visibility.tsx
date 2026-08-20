"use client";

import { Eye, EyeOff, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ProcessTypeOption = {
  label: string;
  count: number;
};

export function ProcessTypeVisibility({
  options,
  hiddenTypes,
  defaultMode,
  onChange,
  onRestoreDefault,
}: {
  options: ProcessTypeOption[];
  hiddenTypes: Set<string>;
  defaultMode: boolean;
  onChange: (next: Set<string>) => void;
  onRestoreDefault: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggle(label: string) {
    const next = new Set(hiddenTypes);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange(next);
  }

  return (
    <div className="process-type-visibility" ref={root}>
      <span>Tipos de processo</span>
      <button
        type="button"
        className={hiddenTypes.size ? "has-hidden-types" : ""}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        {hiddenTypes.size ? <EyeOff size={17} /> : <Eye size={17} />}
        <span>{hiddenTypes.size ? `${hiddenTypes.size} oculto${hiddenTypes.size === 1 ? "" : "s"}` : "Todos visíveis"}</span>
      </button>

      {open ? (
        <div className="process-type-visibility-menu" role="dialog" aria-label="Escolher tipos de processo visíveis">
          <header>
            <div>
              <strong>Visibilidade nas estatísticas</strong>
              <small>{defaultMode ? "Seleção padrão do IDEPPLAN ativa." : "Seleção personalizada neste navegador."} Desmarque os tipos que não devem aparecer.</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar"><X size={18} /></button>
          </header>
          <div className="process-type-options">
            {options.map((option) => {
              const visible = !hiddenTypes.has(option.label);
              return (
                <label key={option.label}>
                  <input type="checkbox" checked={visible} onChange={() => toggle(option.label)} />
                  <span><strong>{option.label}</strong><small>{option.count} processo{option.count === 1 ? "" : "s"}</small></span>
                  {visible ? <Eye size={16} /> : <EyeOff size={16} />}
                </label>
              );
            })}
          </div>
          <footer>
            <button type="button" className={defaultMode ? "active" : ""} onClick={onRestoreDefault}><SlidersHorizontal size={15} /> Restaurar padrão</button>
            <button type="button" onClick={() => onChange(new Set())}><RotateCcw size={15} /> Mostrar todos</button>
            <button type="button" onClick={() => onChange(new Set(options.map((option) => option.label)))}><EyeOff size={15} /> Ocultar todos</button>
          </footer>
        </div>
      ) : null}
    </div>
  );
}
