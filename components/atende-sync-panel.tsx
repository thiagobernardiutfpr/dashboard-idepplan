"use client";

import { useEffect, useMemo, useState } from "react";

type CredentialStatus = {
  configured: boolean;
  createdBy: string;
  createdAt: string | null;
  revokedAt: string | null;
  environmentFallback: boolean;
};

type SyncRun = {
  id: string;
  source_file?: string;
  report_id?: string;
  status?: string;
  row_count?: number;
  inserted_count?: number;
  updated_count?: number;
  unchanged_count?: number;
  error_message?: string;
  generated_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
};

type AdminPayload = {
  credential?: CredentialStatus;
  runs?: SyncRun[];
  token?: string;
  error?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

const cardStyle: React.CSSProperties = {
  border: "1px solid rgba(148, 163, 184, 0.22)",
  borderRadius: 18,
  padding: 20,
  background: "rgba(15, 23, 42, 0.42)",
};

const buttonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 12,
  padding: "11px 16px",
  cursor: "pointer",
  fontWeight: 700,
};

export function AtendeSyncPanel() {
  const [credential, setCredential] = useState<CredentialStatus | null>(null);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const latest = runs[0];
  const statusText = credential?.configured
    ? "Chave D1 ativa"
    : credential?.environmentFallback
      ? "Somente fallback de ambiente"
      : "Sem chave ativa";

  const totals = useMemo(() => ({
    novos: Number(latest?.inserted_count ?? 0),
    atualizados: Number(latest?.updated_count ?? 0),
    inalterados: Number(latest?.unchanged_count ?? 0),
  }), [latest]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/integrations/atende/admin", { cache: "no-store" });
      const payload = await response.json() as AdminPayload;
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar a integração.");
      setCredential(payload.credential ?? null);
      setRuns(payload.runs ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao consultar a integração.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function generateKey() {
    if (!window.confirm("Gerar uma nova chave invalida imediatamente a chave D1 anterior. Continuar?")) return;
    setWorking(true);
    setError("");
    setToken("");
    try {
      const response = await fetch("/api/integrations/atende/admin", { method: "POST" });
      const payload = await response.json() as AdminPayload;
      if (!response.ok || !payload.token) throw new Error(payload.error ?? "Não foi possível gerar a chave.");
      setToken(payload.token);
      setCredential(payload.credential ?? null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao gerar a chave.");
    } finally {
      setWorking(false);
    }
  }

  async function revokeKey() {
    if (!window.confirm("Revogar a chave D1 impedirá novas sincronizações que dependam dela. Continuar?")) return;
    setWorking(true);
    setError("");
    setToken("");
    try {
      const response = await fetch("/api/integrations/atende/admin", { method: "DELETE" });
      const payload = await response.json() as AdminPayload;
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível revogar a chave.");
      setCredential(payload.credential ?? null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao revogar a chave.");
    } finally {
      setWorking(false);
    }
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, opacity: 0.7, fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em" }}>Segurança da integração</p>
            <h2 style={{ margin: "6px 0 6px" }}>{loading ? "Carregando…" : statusText}</h2>
            <p style={{ margin: 0, opacity: 0.78, maxWidth: 700 }}>
              O Dashboard armazena apenas o hash SHA-256 da chave. A chave completa aparece somente no momento da geração.
            </p>
            {credential?.createdAt ? <p style={{ marginBottom: 0, opacity: 0.68 }}>Gerada em {formatDateTime(credential.createdAt)}{credential.createdBy ? ` por ${credential.createdBy}` : ""}.</p> : null}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" disabled={working} onClick={generateKey} style={{ ...buttonStyle, background: "#e2e8f0", color: "#0f172a" }}>
              Gerar nova chave
            </button>
            <button type="button" disabled={working || !credential?.configured} onClick={revokeKey} style={{ ...buttonStyle, background: "rgba(248,113,113,.14)", color: "#fecaca", border: "1px solid rgba(248,113,113,.3)" }}>
              Revogar chave
            </button>
          </div>
        </div>

        {token ? (
          <div style={{ marginTop: 18, padding: 16, borderRadius: 14, background: "rgba(34,197,94,.10)", border: "1px solid rgba(34,197,94,.25)" }}>
            <strong>Copie agora. Esta chave não será exibida novamente.</strong>
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <code style={{ overflowWrap: "anywhere", flex: 1, minWidth: 260 }}>{token}</code>
              <button type="button" onClick={copyToken} style={{ ...buttonStyle, background: "rgba(255,255,255,.12)", color: "inherit" }}>Copiar chave</button>
            </div>
          </div>
        ) : null}
        {error ? <p style={{ marginBottom: 0, color: "#fca5a5" }}>{error}</p> : null}
      </section>

      <section style={cardStyle}>
        <p style={{ margin: 0, opacity: 0.7, fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em" }}>Última sincronização</p>
        <h2 style={{ margin: "6px 0 14px" }}>{latest ? (latest.status ?? "Sem status") : "Nenhuma sincronização registrada"}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div><small style={{ opacity: 0.65 }}>Processos</small><div style={{ fontSize: 28, fontWeight: 800 }}>{Number(latest?.row_count ?? 0).toLocaleString("pt-BR")}</div></div>
          <div><small style={{ opacity: 0.65 }}>Novos</small><div style={{ fontSize: 28, fontWeight: 800 }}>{totals.novos.toLocaleString("pt-BR")}</div></div>
          <div><small style={{ opacity: 0.65 }}>Atualizados</small><div style={{ fontSize: 28, fontWeight: 800 }}>{totals.atualizados.toLocaleString("pt-BR")}</div></div>
          <div><small style={{ opacity: 0.65 }}>Sem alteração</small><div style={{ fontSize: 28, fontWeight: 800 }}>{totals.inalterados.toLocaleString("pt-BR")}</div></div>
        </div>
        {latest ? <p style={{ marginBottom: 0, opacity: 0.7 }}>Início: {formatDateTime(latest.started_at)} · Término: {formatDateTime(latest.finished_at)}</p> : null}
        {latest?.error_message ? <p style={{ color: "#fca5a5" }}>{latest.error_message}</p> : null}
      </section>

      <section style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, opacity: 0.7, fontSize: 13, textTransform: "uppercase", letterSpacing: ".08em" }}>Histórico</p>
            <h2 style={{ margin: "6px 0 0" }}>Sincronizações recentes</h2>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ ...buttonStyle, background: "rgba(255,255,255,.08)", color: "inherit" }}>Atualizar</button>
        </div>
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead><tr>{["Data", "Status", "Processos", "Novos", "Atualizados", "Sem alteração", "Relatório"].map((label) => <th key={label} style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid rgba(148,163,184,.2)", opacity: .7 }}>{label}</th>)}</tr></thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td style={{ padding: "10px 8px" }}>{formatDateTime(run.started_at)}</td>
                  <td style={{ padding: "10px 8px" }}>{run.status ?? "—"}</td>
                  <td style={{ padding: "10px 8px" }}>{Number(run.row_count ?? 0).toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "10px 8px" }}>{Number(run.inserted_count ?? 0).toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "10px 8px" }}>{Number(run.updated_count ?? 0).toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "10px 8px" }}>{Number(run.unchanged_count ?? 0).toLocaleString("pt-BR")}</td>
                  <td style={{ padding: "10px 8px" }}>{run.report_id || run.source_file || "—"}</td>
                </tr>
              ))}
              {!runs.length && !loading ? <tr><td colSpan={7} style={{ padding: 16, opacity: .65 }}>Ainda não há sincronizações registradas.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
