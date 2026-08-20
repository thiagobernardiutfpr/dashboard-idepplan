"use client";

import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { ItemModule } from "@/lib/dashboard-types";

export function ClearModuleButton({ module, moduleLabel, seedIds, onCleared }: { module: ItemModule; moduleLabel: string; seedIds: string[]; onCleared: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function clearModule() {
    if (confirmation !== "EXCLUIR") return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/module-clear", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ module, seedIds, confirmation }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível limpar o módulo.");
      onCleared();
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível limpar o módulo.");
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="module-clear-button" onClick={() => { setOpen(true); setConfirmation(""); setError(""); }}><Trash2 size={16} /> Limpar módulo</button>
    {open ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setOpen(false); }}>
      <section className="clear-module-modal" role="dialog" aria-modal="true" aria-labelledby="clear-module-title">
        <header><div className="clear-module-icon"><AlertTriangle size={24} /></div><div><p className="panel-kicker">Ação permanente</p><h2 id="clear-module-title">Limpar {moduleLabel}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={() => setOpen(false)} disabled={busy}><X size={20} /></button></header>
        <p>Todos os processos, registros importados, responsáveis, estados e anexos deste módulo serão excluídos. As bases territoriais de consulta, zoneamento e coordenadas serão preservadas.</p>
        <label><span>Digite <strong>EXCLUIR</strong> para confirmar</span><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} placeholder="EXCLUIR" /></label>
        {error ? <div className="form-error">{error}</div> : null}
        <footer><button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={busy}>Cancelar</button><button type="button" className="danger-button" onClick={() => void clearModule()} disabled={confirmation !== "EXCLUIR" || busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <Trash2 size={18} />} Excluir todos os itens</button></footer>
      </section>
    </div> : null}
  </>;
}
