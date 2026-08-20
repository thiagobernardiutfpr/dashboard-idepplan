import { desc, eq } from "drizzle-orm";
import { ensureDashboardSchema, getD1Binding, getDb } from "@/db";
import { reportImportRows } from "@/db/schema";
import { importEmpresaFacilRecords } from "@/lib/empresa-facil-server";
import type { EmpresaFacilImportRecord, ItemModule, ReportImportRowRecord } from "@/lib/dashboard-types";
import { getRequestUser } from "@/lib/request-user";
import { importNativeReportRows, type GenericImportRow } from "@/lib/report-import-native";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_RECORDS = 5000;
const SUPPORTED_EXTENSIONS = [".pdf", ".xls", ".xlsx"];
const MODULES: ItemModule[] = ["processes", "projects", "procurements", "agenda", "geoprocessing", "empresa-facil", "consultation", "festivals", "staff-demands", "master-plan", "councils", "pai"];

function clean(value: unknown, maxLength = 300) {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeEmpresaFacilRecord(value: unknown): EmpresaFacilImportRecord | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const code = clean(source.code ?? source.id, 30);
  const status = clean(source.status, 100);
  const actionType = clean(source.actionType, 120);
  const requestedAt = clean(source.requestedAt, 40);
  if (!/^\d+$/.test(code) || !status || !actionType || !requestedAt) return null;
  return { id: code, code, status, actionType, protocol: clean(source.protocol, 80), requestedAt, riskLevel: clean(source.riskLevel, 80), propertyCode: clean(source.propertyCode, 80), propertyRegistration: clean(source.propertyRegistration, 100), primaryActivityCode: clean(source.primaryActivityCode, 80), primaryActivityDescription: clean(source.primaryActivityDescription, 600), cnpj: clean(source.cnpj, 30), classification: clean(source.classification, 80), applicantCode: clean(source.applicantCode, 80), applicantName: clean(source.applicantName, 240), economicRegistration: clean(source.economicRegistration, 80), companyName: clean(source.companyName, 320), indicators: clean(source.indicators, 160) };
}

async function stableId(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).slice(0, 20).map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function normalizeRows(module: ItemModule, fileName: string, records: unknown[]): Promise<GenericImportRow[]> {
  const rows = await Promise.all(records.map(async (value, index) => {
    if (!value || typeof value !== "object") return null;
    const source = value as Record<string, unknown>;
    const sourceSheet = clean(source._sheet, 120);
    const parsedRow = Number(source._row);
    const sourceRow = Number.isInteger(parsedRow) && parsedRow > 0 ? parsedRow : index + 2;
    const data = Object.fromEntries(Object.entries(source).filter(([key]) => !key.startsWith("_")).flatMap(([key, cell]) => {
      const header = clean(key, 180); const content = clean(cell, 4000);
      return header && content ? [[header, content]] : [];
    }));
    if (!Object.keys(data).length) return null;
    const id = await stableId(`${module}|${fileName}|${sourceSheet}|${sourceRow}`);
    return { id, sourceSheet, sourceRow, data } satisfies GenericImportRow;
  }));
  return rows.filter((row): row is GenericImportRow => row != null);
}

async function storeRows(options: { module: ItemModule; fileName: string; rows: GenericImportRow[]; importedBy: string }) {
  const binding = getD1Binding();
  const existing = await binding.prepare("SELECT id FROM report_import_rows WHERE module = ? AND source_file = ?").bind(options.module, options.fileName).all<{ id: string }>();
  const existingIds = new Set(existing.results.map((row) => row.id));
  for (let index = 0; index < options.rows.length; index += 50) {
    const chunk = options.rows.slice(index, index + 50);
    await binding.batch(chunk.map((row) => binding.prepare(`
      INSERT INTO report_import_rows (id,module,source_file,source_sheet,source_row,data_json,search_text,imported_by)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,search_text=excluded.search_text,
        imported_by=excluded.imported_by,imported_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
    `).bind(row.id, options.module, options.fileName, row.sourceSheet, row.sourceRow, JSON.stringify(row.data), Object.values(row.data).join(" ").slice(0, 12_000), options.importedBy)));
  }
  const insertedCount = options.rows.filter((row) => !existingIds.has(row.id)).length;
  return { insertedCount, updatedCount: options.rows.length - insertedCount };
}

export async function GET(request: Request) {
  try {
    const itemModule = new URL(request.url).searchParams.get("module") as ItemModule | null;
    if (!itemModule || !MODULES.includes(itemModule)) return Response.json({ error: "Módulo inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const stored = await getDb().select().from(reportImportRows).where(eq(reportImportRows.module, itemModule)).orderBy(desc(reportImportRows.importedAt)).limit(1000);
    const rows: ReportImportRowRecord[] = stored.map((row) => ({ id: row.id, module: row.module as ItemModule, sourceFile: row.sourceFile, sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, data: JSON.parse(row.dataJson) as Record<string, string>, importedBy: row.importedBy, importedAt: row.importedAt, updatedAt: row.updatedAt }));
    return Response.json({ rows });
  } catch (error) {
    console.error("Report import GET error", error);
    return Response.json({ error: "Não foi possível carregar os dados importados." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { module?: unknown; fileName?: unknown; fileType?: unknown; fileSize?: unknown; records?: unknown };
    const itemModule = clean(payload.module, 40) as ItemModule;
    if (!MODULES.includes(itemModule)) return Response.json({ error: "Destino de importação inválido." }, { status: 400 });
    const fileName = clean(payload.fileName, 220);
    const fileType = clean(payload.fileType, 140) || "application/octet-stream";
    const fileSize = typeof payload.fileSize === "number" ? Math.max(0, payload.fileSize) : 0;
    const lowerName = fileName.toLocaleLowerCase("pt-BR");
    if (!fileName || !SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) return Response.json({ error: "Selecione um relatório em PDF, XLS ou XLSX." }, { status: 400 });
    if (fileSize > MAX_FILE_SIZE) return Response.json({ error: "O relatório deve ter no máximo 25 MB." }, { status: 400 });
    if (!Array.isArray(payload.records) || !payload.records.length || payload.records.length > MAX_RECORDS) return Response.json({ error: `O relatório deve conter entre 1 e ${MAX_RECORDS} registros válidos.` }, { status: 400 });

    await ensureDashboardSchema();
    const importedBy = getRequestUser(request);
    const rows = await normalizeRows(itemModule, fileName, payload.records);
    if (!rows.length) return Response.json({ error: "Nenhuma linha preenchida foi reconhecida no relatório." }, { status: 400 });
    const genericResult = await storeRows({ module: itemModule, fileName, rows, importedBy });

    if (itemModule === "empresa-facil") {
      const normalizedRecords = payload.records.map(normalizeEmpresaFacilRecord);
      if (normalizedRecords.some((record) => record == null)) return Response.json({ error: "O relatório contém linhas sem código, situação, ação ou data de solicitação." }, { status: 400 });
      const result = await importEmpresaFacilRecords({ records: normalizedRecords as EmpresaFacilImportRecord[], fileName, fileType, fileSize, importedBy });
      return Response.json({ import: { ...result, storedRowCount: rows.length } });
    }

    const nativeResult = await importNativeReportRows({ module: itemModule, rows, fileName, importedBy });
    const hasNativeRows = nativeResult.insertedCount > 0 || nativeResult.updatedCount > 0;
    const insertedCount = hasNativeRows ? nativeResult.insertedCount : genericResult.insertedCount;
    const updatedCount = hasNativeRows ? nativeResult.updatedCount : genericResult.updatedCount;
    const importId = crypto.randomUUID();
    await getD1Binding().prepare(`INSERT INTO report_imports (id,module,file_name,file_type,file_size,row_count,inserted_count,updated_count,status,error_message,imported_by) VALUES (?,?,?,?,?,?,?,?, 'Concluído','',?)`).bind(importId, itemModule, fileName, fileType, fileSize, rows.length, insertedCount, updatedCount, importedBy).run();
    return Response.json({ import: { importId, rowCount: rows.length, insertedCount, updatedCount, storedRowCount: rows.length, importedAt: new Date().toISOString() } });
  } catch (error) {
    console.error("Report import API error", error);
    return Response.json({ error: "Não foi possível importar o relatório para a base compartilhada." }, { status: 500 });
  }
}
