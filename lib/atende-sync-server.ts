import { getD1Binding } from "@/db";

export type AtendeProcessInput = {
  processNumber: string;
  applicant?: string;
  status?: string;
  openedAt?: string | null;
  subject?: string;
  subsubject?: string;
  lot?: string;
  block?: string;
  propertyRegistration?: string;
  neighborhood?: string;
  street?: string;
  observation?: string;
  closedAt?: string | null;
  closeReason?: string;
};

type SyncOptions = {
  sourceFile: string;
  reportId?: string;
  generatedAt?: string;
  processes: AtendeProcessInput[];
};

const INTEGRATION_USER = "integração Atende.Net";
const CREDENTIAL_ID = "primary";

function clean(value: unknown, maxLength = 4000) {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanDate(value: unknown) {
  const input = clean(value, 40);
  if (!input) return null;
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = input.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return null;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function shortHash(value: string) {
  return (await sha256Hex(value)).slice(0, 32);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function buildObservation(process: AtendeProcessInput) {
  const parts = [
    clean(process.observation),
    clean(process.lot) ? `Lote: ${clean(process.lot, 120)}` : "",
    clean(process.block) ? `Quadra: ${clean(process.block, 120)}` : "",
    clean(process.neighborhood) ? `Bairro: ${clean(process.neighborhood, 180)}` : "",
    clean(process.street) ? `Logradouro: ${clean(process.street, 240)}` : "",
    clean(process.closedAt) ? `Encerramento: ${clean(process.closedAt, 80)}` : "",
    clean(process.closeReason) ? `Motivo do encerramento: ${clean(process.closeReason, 500)}` : "",
  ].filter(Boolean);
  return parts.join(" | ").slice(0, 2000);
}

function sameProcess(current: Record<string, unknown> | undefined, incoming: {
  processNumber: string; applicant: string; propertyRegistration: string; category: string; status: string;
  actionType: string; openedAt: string | null; observation: string;
}) {
  if (!current) return false;
  return clean(current.process_number, 100) === incoming.processNumber
    && clean(current.applicant, 220) === incoming.applicant
    && clean(current.property_registration, 100) === incoming.propertyRegistration
    && clean(current.category, 180) === incoming.category
    && clean(current.status, 100) === incoming.status
    && clean(current.action_type, 180) === incoming.actionType
    && cleanDate(current.opened_at) === incoming.openedAt
    && clean(current.observation, 2000) === incoming.observation;
}

async function ensureTables() {
  const db = getD1Binding();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS atende_sync_runs (
      id TEXT PRIMARY KEY NOT NULL,
      source_file TEXT NOT NULL DEFAULT '', report_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL, row_count INTEGER NOT NULL DEFAULT 0,
      inserted_count INTEGER NOT NULL DEFAULT 0, updated_count INTEGER NOT NULL DEFAULT 0,
      unchanged_count INTEGER NOT NULL DEFAULT 0, error_message TEXT NOT NULL DEFAULT '',
      generated_at TEXT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS atende_sync_runs_started_at_idx ON atende_sync_runs (started_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS process_history (
      id TEXT PRIMARY KEY NOT NULL, process_id TEXT NOT NULL,
      process_number TEXT NOT NULL, previous_status TEXT NOT NULL DEFAULT '',
      current_status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'atende_net',
      sync_run_id TEXT NOT NULL, changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS process_history_process_idx ON process_history (process_id, changed_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS atende_sync_credentials (
      id TEXT PRIMARY KEY NOT NULL,
      token_hash TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revoked_at TEXT
    )`),
  ]);
}

export async function getAtendeSyncCredentialStatus() {
  await ensureTables();
  const credential = await getD1Binding().prepare(
    "SELECT created_by, created_at, revoked_at, token_hash FROM atende_sync_credentials WHERE id = ? LIMIT 1",
  ).bind(CREDENTIAL_ID).first<Record<string, unknown>>();
  return {
    configured: Boolean(clean(credential?.token_hash, 128) && !credential?.revoked_at),
    createdBy: clean(credential?.created_by, 180),
    createdAt: clean(credential?.created_at, 80) || null,
    revokedAt: clean(credential?.revoked_at, 80) || null,
    environmentFallback: Boolean(process.env.ATENDE_SYNC_TOKEN?.trim()),
  };
}

export async function generateAtendeSyncToken(createdBy: string) {
  await ensureTables();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = `atende_${base64Url(bytes)}`;
  const tokenHash = await sha256Hex(token);
  await getD1Binding().prepare(`INSERT INTO atende_sync_credentials
    (id,token_hash,created_by,created_at,revoked_at) VALUES (?,?,?,CURRENT_TIMESTAMP,NULL)
    ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,created_by=excluded.created_by,
      created_at=CURRENT_TIMESTAMP,revoked_at=NULL`)
    .bind(CREDENTIAL_ID, tokenHash, clean(createdBy, 180) || "Dashboard IDEPPLAN").run();
  return token;
}

export async function revokeAtendeSyncToken() {
  await ensureTables();
  await getD1Binding().prepare(
    "UPDATE atende_sync_credentials SET token_hash = '', revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).bind(CREDENTIAL_ID).run();
}

export async function verifyAtendeSyncToken(token: string) {
  const supplied = clean(token, 300);
  if (!supplied) return false;
  await ensureTables();
  const credential = await getD1Binding().prepare(
    "SELECT token_hash, revoked_at FROM atende_sync_credentials WHERE id = ? LIMIT 1",
  ).bind(CREDENTIAL_ID).first<Record<string, unknown>>();
  const storedHash = clean(credential?.token_hash, 128);
  if (storedHash && !credential?.revoked_at) {
    const suppliedHash = await sha256Hex(supplied);
    if (secureEqual(storedHash, suppliedHash)) return true;
  }
  const fallback = process.env.ATENDE_SYNC_TOKEN?.trim() ?? "";
  if (!fallback) return false;
  return secureEqual(await sha256Hex(fallback), await sha256Hex(supplied));
}

export async function listAtendeSyncRuns(limit = 20) {
  await ensureTables();
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  const result = await getD1Binding().prepare(`SELECT * FROM atende_sync_runs ORDER BY started_at DESC LIMIT ?`).bind(safeLimit).all();
  return result.results;
}

export async function synchronizeAtendeProcesses(options: SyncOptions) {
  await ensureTables();
  const db = getD1Binding();
  const runId = crypto.randomUUID();
  const sourceFile = clean(options.sourceFile, 220) || "Relatorio Estatistico por Centro de Custos.xlsx";
  const reportId = clean(options.reportId, 180);
  const generatedAt = clean(options.generatedAt, 80) || null;
  const unique = new Map<string, AtendeProcessInput>();
  for (const raw of options.processes) {
    const number = clean(raw?.processNumber, 100);
    if (!/^\d+\/\d{4}$/.test(number)) continue;
    unique.set(number, { ...raw, processNumber: number });
  }
  const processes = [...unique.values()];
  if (!processes.length) throw new Error("Nenhum processo válido foi recebido do Atende.Net.");

  await db.prepare(`INSERT INTO atende_sync_runs
    (id,source_file,report_id,status,row_count,generated_at)
    VALUES (?,?,?,?,?,?)`).bind(runId, sourceFile, reportId, "Em andamento", processes.length, generatedAt).run();

  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  try {
    for (const raw of processes) {
      const processNumber = clean(raw.processNumber, 100);
      const applicant = clean(raw.applicant, 220) || "Não informado";
      const status = clean(raw.status, 100) || "Em análise";
      const subject = clean(raw.subject, 180);
      const subsubject = clean(raw.subsubject, 180);
      const category = subsubject || subject || "Relatório Atende.Net";
      const actionType = subject;
      const openedAt = cleanDate(raw.openedAt);
      const propertyRegistration = clean(raw.propertyRegistration, 100);
      const observation = buildObservation(raw);

      const importedId = `import-process-${await shortHash(processNumber)}`;
      const byNumber = await db.prepare(`SELECT * FROM manual_processes WHERE process_number = ? ORDER BY updated_at DESC LIMIT 1`).bind(processNumber).first<Record<string, unknown>>();
      const existing = byNumber ?? await db.prepare(`SELECT * FROM manual_processes WHERE id = ? LIMIT 1`).bind(importedId).first<Record<string, unknown>>();
      const id = clean(existing?.id, 160) || importedId;
      const previousStatus = clean(existing?.status, 100);
      const normalized = { processNumber, applicant, propertyRegistration, category, status, actionType, openedAt, observation };

      if (!existing) insertedCount += 1;
      else if (sameProcess(existing, normalized)) unchangedCount += 1;
      else updatedCount += 1;

      await db.prepare(`INSERT INTO manual_processes
        (id,process_number,area,applicant,company_name,cnpj,property_registration,category,status,action_type,opened_at,planned_close_at,observation,created_by,updated_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET process_number=excluded.process_number,area=excluded.area,
          applicant=excluded.applicant,property_registration=excluded.property_registration,
          category=excluded.category,status=excluded.status,action_type=excluded.action_type,
          opened_at=excluded.opened_at,observation=excluded.observation,updated_by=excluded.updated_by,
          updated_at=CURRENT_TIMESTAMP`)
        .bind(id, processNumber, "Urbanismo", applicant, "", "", propertyRegistration, category, status,
          actionType, openedAt, null, observation, INTEGRATION_USER, INTEGRATION_USER).run();

      if (!existing || previousStatus !== status) {
        const historyId = `${id}-${runId}-${await shortHash(`${previousStatus}|${status}`)}`;
        await db.prepare(`INSERT OR IGNORE INTO process_history
          (id,process_id,process_number,previous_status,current_status,source,sync_run_id)
          VALUES (?,?,?,?,?,'atende_net',?)`)
          .bind(historyId, id, processNumber, previousStatus, status, runId).run();
      }
    }

    await db.prepare(`UPDATE atende_sync_runs SET status='Concluído', inserted_count=?, updated_count=?,
      unchanged_count=?, finished_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(insertedCount, updatedCount, unchangedCount, runId).run();
    return { runId, rowCount: processes.length, insertedCount, updatedCount, unchangedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    await db.prepare(`UPDATE atende_sync_runs SET status='Erro', error_message=?, finished_at=CURRENT_TIMESTAMP WHERE id=?`)
      .bind(clean(message, 1000), runId).run();
    throw error;
  }
}
