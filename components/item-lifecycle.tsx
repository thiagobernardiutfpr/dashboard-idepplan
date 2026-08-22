"use client";

import {
  CheckCircle2,
  Circle,
  Eye,
  File,
  LoaderCircle,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ItemAttachmentRecord,
  ItemModule,
  ItemStateRecord,
} from "@/lib/dashboard-types";
import { readApiJson, uploadAttachment } from "@/lib/api-client";

type LifecycleContextValue = {
  states: Record<string, ItemStateRecord>;
  getState: (module: ItemModule, itemId: string) => ItemStateRecord | undefined;
  setState: (
    module: ItemModule,
    itemId: string,
    patch: Partial<Pick<ItemStateRecord, "completed" | "removed">>,
  ) => Promise<boolean>;
};

const Context = createContext<LifecycleContextValue | null>(null);
const stateKey = (module: ItemModule, itemId: string) => `${module}:${itemId}`;

export function ItemLifecycleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [states, setStates] = useState<Record<string, ItemStateRecord>>({});
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/item-states", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          states?: ItemStateRecord[];
        };
        if (response.ok)
          setStates(
            Object.fromEntries(
              (payload.states ?? []).map((state) => [
                stateKey(state.module, state.itemId),
                state,
              ]),
            ),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const getState = useCallback(
    (module: ItemModule, itemId: string) => states[stateKey(module, itemId)],
    [states],
  );
  const setState = useCallback(
    async (
      module: ItemModule,
      itemId: string,
      patch: Partial<Pick<ItemStateRecord, "completed" | "removed">>,
    ) => {
      const current = states[stateKey(module, itemId)];
      const response = await fetch("/api/item-states", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          module,
          itemId,
          completed: patch.completed ?? current?.completed ?? false,
          removed: patch.removed ?? current?.removed ?? false,
        }),
      });
      const payload = (await response.json()) as { state?: ItemStateRecord };
      if (response.ok && payload.state) {
        setStates((value) => ({
          ...value,
          [stateKey(module, itemId)]: payload.state!,
        }));
        return true;
      }
      return false;
    },
    [states],
  );
  const value = useMemo(
    () => ({ states, getState, setState }),
    [states, getState, setState],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useItemLifecycle() {
  const value = useContext(Context);
  if (!value) throw new Error("ItemLifecycleProvider ausente");
  return value;
}

export function ItemLifecycleActions({
  module,
  itemId,
  label = "item",
}: {
  module: ItemModule;
  itemId: string;
  label?: string;
}) {
  const { getState, setState } = useItemLifecycle();
  const state = getState(module, itemId);
  const [saving, setSaving] = useState(false);
  async function update(
    patch: Partial<Pick<ItemStateRecord, "completed" | "removed">>,
  ) {
    setSaving(true);
    await setState(module, itemId, patch);
    setSaving(false);
  }
  return (
    <div className="lifecycle-actions">
      <button
        type="button"
        className={`row-action icon-row-action ${state?.completed ? "completed" : ""}`}
        title={state?.completed ? "Reabrir" : "Marcar como concluído"}
        aria-label={state?.completed ? `Reabrir ${label}` : `Concluir ${label}`}
        disabled={saving}
        onClick={() => void update({ completed: !state?.completed })}
      >
        {saving ? (
          <LoaderCircle size={15} className="spin" />
        ) : state?.completed ? (
          <CheckCircle2 size={16} />
        ) : (
          <Circle size={16} />
        )}
      </button>
      <button
        type="button"
        className="row-action icon-row-action danger-row-action"
        title="Remover"
        aria-label={`Remover ${label}`}
        disabled={saving}
        onClick={() => {
          if (
            window.confirm(
              `Remover ${label}? Você poderá restaurá-lo pela base administrativa.`,
            )
          )
            void update({ removed: true });
        }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function fileSize(value: number) {
  return value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function ItemFilesButton({
  module,
  itemId,
  title,
  text = false,
  label = "Arquivos",
  accept,
  onChange,
}: {
  module: ItemModule;
  itemId: string;
  title: string;
  text?: boolean;
  label?: string;
  accept?: string;
  onChange?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<ItemAttachmentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [batchStatus, setBatchStatus] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [preview, setPreview] = useState<ItemAttachmentRecord | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/attachments?module=${encodeURIComponent(module)}&itemId=${encodeURIComponent(itemId)}`,
        { cache: "no-store" },
      );
      const payload = await readApiJson<{
        attachments?: ItemAttachmentRecord[];
        error?: string;
      }>(response);
      if (!response.ok) throw new Error(payload.error);
      setFiles(payload.attachments ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha ao carregar anexos.",
      );
    } finally {
      setLoading(false);
    }
  }, [module, itemId]);
  async function upload(selectedFiles: FileList | File[]) {
    const queue = Array.from(selectedFiles);
    if (!queue.length) return;
    setLoading(true);
    setError("");
    setUploadProgress(0);
    const failures: string[] = [];
    let uploaded = 0;
    try {
      for (const [index, file] of queue.entries()) {
        setBatchStatus({
          current: index + 1,
          total: queue.length,
          fileName: file.name,
        });
        setUploadProgress(0);
        try {
          await uploadAttachment({
            file,
            module,
            itemId,
            onProgress: setUploadProgress,
          });
          uploaded += 1;
        } catch (reason) {
          const message =
            reason instanceof Error ? reason.message : "Falha no upload.";
          failures.push(`${file.name}: ${message}`);
        }
      }
      if (uploaded) {
        await load();
        onChange?.();
      }
      if (failures.length) {
        const visibleFailures = failures.slice(0, 3).join(" · ");
        const remaining = failures.length - 3;
        setError(
          `${uploaded} de ${queue.length} arquivo(s) enviado(s). ${visibleFailures}${remaining > 0 ? ` · e mais ${remaining} falha(s)` : ""}`,
        );
      }
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setBatchStatus(null);
      if (input.current) input.current.value = "";
    }
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir este anexo?")) return;
    const response = await fetch("/api/attachments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      setFiles((value) => value.filter((file) => file.id !== id));
      onChange?.();
    }
  }

  return (
    <>
      <button
        type="button"
        className={
          text
            ? "secondary-button files-text-button"
            : "row-action icon-row-action"
        }
        title={`Anexar ${label.toLocaleLowerCase("pt-BR")}`}
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        <Paperclip size={16} />
        {text ? <span>{label}</span> : null}
      </button>
      {open ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true">
          <div className="attachment-modal">
            <header>
              <div>
                <span className="panel-kicker">Arquivos compartilhados</span>
                <h2>{title}</h2>
              </div>
              <button
                className="icon-only-button"
                type="button"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="attachment-upload">
              <input
                ref={input}
                className="sr-only"
                type="file"
                multiple
                accept={accept}
                onChange={(event) => {
                  if (event.target.files?.length)
                    void upload(event.target.files);
                }}
              />
              <button
                className="primary-button"
                type="button"
                onClick={() => input.current?.click()}
                disabled={loading}
              >
                <UploadCloud size={18} />
                {batchStatus
                  ? `Enviando ${batchStatus.current}/${batchStatus.total}`
                  : "Anexar arquivos"}
              </button>
              <span aria-live="polite">
                {batchStatus
                  ? `Arquivo ${batchStatus.current} de ${batchStatus.total}: ${batchStatus.fileName} · ${uploadProgress}%`
                  : "Selecione um ou vários arquivos. Até 500 MB por arquivo, com envio automático em partes. PDFs, imagens e áudios abrem aqui mesmo."}
              </span>
            </div>
            {error ? (
              <div className="form-error" role="alert">
                {error}
              </div>
            ) : null}
            <div className="attachment-list">
              {loading && !files.length ? (
                <div className="attachment-empty">
                  <LoaderCircle className="spin" /> Carregando…
                </div>
              ) : (
                files.map((file) => (
                  <article key={file.id}>
                    <File size={22} />
                    <div>
                      <strong>{file.fileName}</strong>
                      <span>
                        {fileSize(file.fileSize)} · {file.uploadedBy}
                      </span>
                    </div>
                    <div className="row-actions">
                      {file.contentType === "application/pdf" ||
                      file.contentType.startsWith("image/") ||
                      file.contentType.startsWith("audio/") ? (
                        <button
                          className="row-action icon-row-action"
                          type="button"
                          onClick={() => setPreview(file)}
                          title="Pré-visualizar"
                        >
                          <Eye size={16} />
                        </button>
                      ) : null}
                      <a
                        className="row-action icon-row-action"
                        href={`/api/attachments/${file.id}`}
                        download
                        title="Baixar"
                      >
                        <Paperclip size={16} />
                      </a>
                      <button
                        className="row-action icon-row-action danger-row-action"
                        type="button"
                        onClick={() => void remove(file.id)}
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))
              )}
              {!loading && !files.length ? (
                <div className="attachment-empty">
                  <Paperclip size={24} /> Nenhum arquivo anexado.
                </div>
              ) : null}
            </div>
            {preview ? (
              <div className="attachment-preview">
                <header>
                  <strong>{preview.fileName}</strong>
                  <button type="button" onClick={() => setPreview(null)}>
                    <X size={18} />
                  </button>
                </header>
                {preview.contentType === "application/pdf" ? (
                  <iframe
                    src={`/api/attachments/${preview.id}`}
                    title={preview.fileName}
                  />
                ) : preview.contentType.startsWith("audio/") ? (
                  <audio controls src={`/api/attachments/${preview.id}`} />
                ) : (
                  <img
                    src={`/api/attachments/${preview.id}`}
                    alt={preview.fileName}
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
