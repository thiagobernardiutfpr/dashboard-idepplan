import initialDataset from "@/data/empresa-facil-data.json";
import { ensureDashboardSchema, getD1Binding } from "@/db";
import type { EmpresaFacilImportRecord } from "@/lib/dashboard-types";

const INITIAL_IMPORT_ID = "empresa-facil-seed-relatorio-1";
const INITIAL_SOURCE_FILE = "Relatorio (1).xlsx";
const INITIAL_IMPORTED_AT = "2026-08-03T17:00:00-03:00";
const BATCH_SIZE = 60;

const INSERT_SQL = `
  INSERT INTO empresa_facil_records (
    id, code, status, action_type, protocol, requested_at, risk_level,
    property_code, property_registration, primary_activity_code,
    primary_activity_description, cnpj, classification, applicant_code,
    applicant_name, economic_registration, company_name, indicators,
    source_file, imported_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`;

const UPSERT_SQL = `${INSERT_SQL}
  ON CONFLICT(id) DO UPDATE SET
    code = excluded.code,
    status = excluded.status,
    action_type = excluded.action_type,
    protocol = excluded.protocol,
    requested_at = excluded.requested_at,
    risk_level = excluded.risk_level,
    property_code = excluded.property_code,
    property_registration = excluded.property_registration,
    primary_activity_code = excluded.primary_activity_code,
    primary_activity_description = excluded.primary_activity_description,
    cnpj = excluded.cnpj,
    classification = excluded.classification,
    applicant_code = excluded.applicant_code,
    applicant_name = excluded.applicant_name,
    economic_registration = excluded.economic_registration,
    company_name = excluded.company_name,
    indicators = excluded.indicators,
    source_file = excluded.source_file,
    imported_at = excluded.imported_at,
    updated_at = CURRENT_TIMESTAMP
`;

function recordBindings(
  record: EmpresaFacilImportRecord,
  sourceFile: string,
  importedAt: string,
) {
  return [
    record.id,
    record.code,
    record.status,
    record.actionType,
    record.protocol,
    record.requestedAt,
    record.riskLevel,
    record.propertyCode,
    record.propertyRegistration,
    record.primaryActivityCode,
    record.primaryActivityDescription,
    record.cnpj,
    record.classification,
    record.applicantCode,
    record.applicantName,
    record.economicRegistration,
    record.companyName,
    record.indicators,
    sourceFile,
    importedAt,
  ];
}

async function runRecordBatches(
  records: EmpresaFacilImportRecord[],
  sql: string,
  sourceFile: string,
  importedAt: string,
) {
  const binding = getD1Binding();
  let changes = 0;
  for (let index = 0; index < records.length; index += BATCH_SIZE) {
    const chunk = records.slice(index, index + BATCH_SIZE);
    const results = await binding.batch(
      chunk.map((record) =>
        binding.prepare(sql).bind(...recordBindings(record, sourceFile, importedAt)),
      ),
    );
    changes += results.reduce((total, result) => total + (result.meta.changes ?? 0), 0);
  }
  return changes;
}

export async function ensureEmpresaFacilSeed() {
  await ensureDashboardSchema();
  const binding = getD1Binding();
  const marker = await binding
    .prepare("SELECT id FROM report_imports WHERE id = ? LIMIT 1")
    .bind(INITIAL_IMPORT_ID)
    .first<{ id: string }>();
  if (marker) return;

  const records = initialDataset.records as EmpresaFacilImportRecord[];
  const changes = await runRecordBatches(
    records,
    `${INSERT_SQL} ON CONFLICT(id) DO NOTHING`,
    INITIAL_SOURCE_FILE,
    INITIAL_IMPORTED_AT,
  );

  await binding
    .prepare(`
      INSERT OR IGNORE INTO report_imports (
        id, module, file_name, file_type, file_size, row_count,
        inserted_count, updated_count, status, error_message, imported_by, created_at
      ) VALUES (?, 'empresa-facil', ?, ?, ?, ?, ?, 0, 'Concluído', '', ?, ?)
    `)
    .bind(
      INITIAL_IMPORT_ID,
      INITIAL_SOURCE_FILE,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      0,
      records.length,
      changes,
      "Carga inicial do painel",
      INITIAL_IMPORTED_AT,
    )
    .run();
}

export async function importEmpresaFacilRecords(options: {
  records: EmpresaFacilImportRecord[];
  fileName: string;
  fileType: string;
  fileSize: number;
  importedBy: string;
}) {
  await ensureEmpresaFacilSeed();
  const binding = getD1Binding();
  const deduplicated = [...new Map(options.records.map((record) => [record.id, record])).values()];
  const existing = await binding
    .prepare("SELECT id FROM empresa_facil_records")
    .all<{ id: string }>();
  const existingIds = new Set(existing.results.map((record) => record.id));
  const insertedCount = deduplicated.filter((record) => !existingIds.has(record.id)).length;
  const updatedCount = deduplicated.length - insertedCount;
  const importedAt = new Date().toISOString();

  await runRecordBatches(
    deduplicated,
    UPSERT_SQL,
    options.fileName,
    importedAt,
  );

  for (let index = 0; index < deduplicated.length; index += 50) {
    await binding.batch(deduplicated.slice(index, index + 50).map((record) =>
      binding.prepare("DELETE FROM item_states WHERE module = 'empresa-facil' AND item_id = ?").bind(record.id),
    ));
  }

  const importId = crypto.randomUUID();
  await binding
    .prepare(`
      INSERT INTO report_imports (
        id, module, file_name, file_type, file_size, row_count,
        inserted_count, updated_count, status, error_message, imported_by
      ) VALUES (?, 'empresa-facil', ?, ?, ?, ?, ?, ?, 'Concluído', '', ?)
    `)
    .bind(
      importId,
      options.fileName,
      options.fileType,
      options.fileSize,
      deduplicated.length,
      insertedCount,
      updatedCount,
      options.importedBy,
    )
    .run();

  return {
    importId,
    rowCount: deduplicated.length,
    insertedCount,
    updatedCount,
    importedAt,
  };
}
