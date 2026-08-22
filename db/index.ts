import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

declare global {
  var __APUCARANA_D1_DB__: D1Database | undefined;
  var __APUCARANA_R2_BUCKET__: R2Bucket | undefined;
}

export function getD1Binding() {
  const binding = globalThis.__APUCARANA_D1_DB__;
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let the request worker inject the real binding before using the database.",
    );
  }
  return binding;
}

export function getDb() {
  return drizzle(getD1Binding(), { schema });
}

export function getR2Binding() {
  const binding = globalThis.__APUCARANA_R2_BUCKET__;
  if (!binding)
    throw new Error("Cloudflare R2 binding `BUCKET` is unavailable.");
  return binding;
}

let schemaReady: Promise<void> | null = null;

export function ensureDashboardSchema() {
  const binding = getD1Binding();

  schemaReady ??= binding
    .batch([
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS process_coordinates (
          process_id TEXT PRIMARY KEY NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          location_label TEXT NOT NULL DEFAULT '',
          updated_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS process_coordinates_updated_at_idx ON process_coordinates (updated_at)",
      ),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS dashboard_login_attempts (
          attempt_key TEXT PRIMARY KEY NOT NULL,
          failures INTEGER NOT NULL DEFAULT 0,
          blocked_until INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS module_assignments (
          module TEXT NOT NULL,
          item_id TEXT NOT NULL,
          responsible TEXT NOT NULL,
          updated_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (module, item_id)
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS module_assignments_responsible_idx ON module_assignments (responsible)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS module_assignments_updated_at_idx ON module_assignments (updated_at)",
      ),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS procurements (
          id TEXT PRIMARY KEY NOT NULL,
          object TEXT NOT NULL,
          modality TEXT NOT NULL,
          process_number TEXT NOT NULL DEFAULT '',
          phase TEXT NOT NULL,
          situation TEXT NOT NULL,
          planned_publication_date TEXT,
          session_date TEXT,
          estimated_value REAL,
          funding_source TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL DEFAULT '',
          updated_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS procurements_phase_idx ON procurements (phase)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS procurements_situation_idx ON procurements (situation)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS procurements_updated_at_idx ON procurements (updated_at)",
      ),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS manual_processes (
          id TEXT PRIMARY KEY NOT NULL,
          process_number TEXT NOT NULL,
          area TEXT NOT NULL,
          applicant TEXT NOT NULL,
          company_name TEXT NOT NULL DEFAULT '',
          cnpj TEXT NOT NULL DEFAULT '',
          property_registration TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL,
          status TEXT NOT NULL,
          action_type TEXT NOT NULL DEFAULT '',
          opened_at TEXT,
          planned_close_at TEXT,
          observation TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL DEFAULT '',
          updated_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS manual_processes_opened_at_idx ON manual_processes (opened_at)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS manual_processes_updated_at_idx ON manual_processes (updated_at)",
      ),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS manual_projects (
          id TEXT PRIMARY KEY NOT NULL,
          project TEXT NOT NULL,
          priority INTEGER,
          area_to_build_m2 REAL,
          area_to_renovate_m2 REAL,
          department TEXT NOT NULL DEFAULT '',
          deadline TEXT,
          current_status TEXT NOT NULL,
          stage TEXT NOT NULL,
          process_number TEXT NOT NULL DEFAULT '',
          property_registration TEXT NOT NULL DEFAULT '',
          dependency TEXT NOT NULL DEFAULT '',
          funding_source TEXT NOT NULL DEFAULT '',
          value REAL,
          created_by TEXT NOT NULL DEFAULT '',
          updated_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS manual_projects_stage_idx ON manual_projects (stage)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS manual_projects_updated_at_idx ON manual_projects (updated_at)",
      ),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS agenda_items (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          starts_at TEXT NOT NULL,
          ends_at TEXT,
          location TEXT NOT NULL DEFAULT '',
          participants TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '',
          created_by TEXT NOT NULL DEFAULT '',
          updated_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS agenda_items_starts_at_idx ON agenda_items (starts_at)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS agenda_items_status_idx ON agenda_items (status)",
      ),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS geoprocessing_demands (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          requester TEXT NOT NULL,
          demand_date TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_by TEXT NOT NULL DEFAULT '',
          updated_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS geoprocessing_demands_demand_date_idx ON geoprocessing_demands (demand_date)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS geoprocessing_demands_completed_idx ON geoprocessing_demands (completed)",
      ),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS empresa_facil_records (
          id TEXT PRIMARY KEY NOT NULL,
          code TEXT NOT NULL,
          status TEXT NOT NULL,
          action_type TEXT NOT NULL,
          protocol TEXT NOT NULL DEFAULT '',
          requested_at TEXT NOT NULL,
          risk_level TEXT NOT NULL DEFAULT '',
          property_code TEXT NOT NULL DEFAULT '',
          property_registration TEXT NOT NULL DEFAULT '',
          primary_activity_code TEXT NOT NULL DEFAULT '',
          primary_activity_description TEXT NOT NULL DEFAULT '',
          cnpj TEXT NOT NULL DEFAULT '',
          classification TEXT NOT NULL DEFAULT '',
          applicant_code TEXT NOT NULL DEFAULT '',
          applicant_name TEXT NOT NULL DEFAULT '',
          economic_registration TEXT NOT NULL DEFAULT '',
          company_name TEXT NOT NULL DEFAULT '',
          indicators TEXT NOT NULL DEFAULT '',
          source_file TEXT NOT NULL DEFAULT '',
          imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS empresa_facil_records_status_idx ON empresa_facil_records (status)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS empresa_facil_records_requested_at_idx ON empresa_facil_records (requested_at)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS empresa_facil_records_risk_level_idx ON empresa_facil_records (risk_level)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS empresa_facil_records_protocol_idx ON empresa_facil_records (protocol)",
      ),
      binding.prepare(`
        CREATE TABLE IF NOT EXISTS report_imports (
          id TEXT PRIMARY KEY NOT NULL,
          module TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER NOT NULL DEFAULT 0,
          row_count INTEGER NOT NULL DEFAULT 0,
          inserted_count INTEGER NOT NULL DEFAULT 0,
          updated_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          error_message TEXT NOT NULL DEFAULT '',
          imported_by TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS report_imports_module_idx ON report_imports (module)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS report_imports_created_at_idx ON report_imports (created_at)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS report_import_rows (
        id TEXT PRIMARY KEY NOT NULL, module TEXT NOT NULL, source_file TEXT NOT NULL,
        source_sheet TEXT NOT NULL DEFAULT '', source_row INTEGER NOT NULL DEFAULT 0,
        data_json TEXT NOT NULL, search_text TEXT NOT NULL DEFAULT '', imported_by TEXT NOT NULL DEFAULT '',
        imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS report_import_rows_module_idx ON report_import_rows (module)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS report_import_rows_source_idx ON report_import_rows (module, source_file)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS report_import_rows_imported_at_idx ON report_import_rows (imported_at)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS project_locations (
        project_id TEXT PRIMARY KEY NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
        location_label TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS project_locations_updated_at_idx ON project_locations (updated_at)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS item_states (
        module TEXT NOT NULL, item_id TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
        removed INTEGER NOT NULL DEFAULT 0, updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (module, item_id)
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS item_states_module_idx ON item_states (module)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS item_attachments (
        id TEXT PRIMARY KEY NOT NULL, module TEXT NOT NULL, item_id TEXT NOT NULL,
        file_name TEXT NOT NULL, content_type TEXT NOT NULL, file_size INTEGER NOT NULL,
        r2_key TEXT NOT NULL, uploaded_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS item_attachments_item_idx ON item_attachments (module, item_id)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS item_attachments_created_at_idx ON item_attachments (created_at)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS multipart_attachment_uploads (
        id TEXT PRIMARY KEY NOT NULL, upload_id TEXT NOT NULL, module TEXT NOT NULL,
        item_id TEXT NOT NULL, file_name TEXT NOT NULL, content_type TEXT NOT NULL,
        file_size INTEGER NOT NULL, r2_key TEXT NOT NULL, uploaded_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS multipart_attachment_uploads_created_at_idx ON multipart_attachment_uploads (created_at)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS process_enrichments (
        process_id TEXT PRIMARY KEY NOT NULL,
        property_registration TEXT NOT NULL DEFAULT '', lot TEXT NOT NULL DEFAULT '',
        block TEXT NOT NULL DEFAULT '', neighborhood TEXT NOT NULL DEFAULT '',
        applicant TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '',
        postal_code TEXT NOT NULL DEFAULT '', request TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '', action_type TEXT NOT NULL DEFAULT '',
        source_files TEXT NOT NULL DEFAULT '[]', confidence_json TEXT NOT NULL DEFAULT '{}',
        analyzed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS process_enrichments_registration_idx ON process_enrichments (property_registration)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS process_enrichments_updated_at_idx ON process_enrichments (updated_at)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS eiv_analyses (
        process_id TEXT PRIMARY KEY NOT NULL,
        result_json TEXT NOT NULL DEFAULT '{}', source_files TEXT NOT NULL DEFAULT '[]',
        coverage_score INTEGER NOT NULL DEFAULT 0, conclusion TEXT NOT NULL DEFAULT '',
        analyzed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS eiv_analyses_score_idx ON eiv_analyses (coverage_score)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS eiv_analyses_updated_at_idx ON eiv_analyses (updated_at)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS party_expenses (
        id TEXT PRIMARY KEY NOT NULL, event_name TEXT NOT NULL, expense_date TEXT NOT NULL,
        description TEXT NOT NULL, amount REAL NOT NULL, paid_by TEXT NOT NULL,
        debtor TEXT NOT NULL, creditor TEXT NOT NULL, responsible TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Pendente', notes TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS party_expenses_event_idx ON party_expenses (event_name)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS party_expenses_date_idx ON party_expenses (expense_date)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS master_plan_items (
        id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, phase TEXT NOT NULL,
        item_type TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL,
        due_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Não iniciado', progress INTEGER NOT NULL DEFAULT 0,
        responsible TEXT NOT NULL, stakeholders TEXT NOT NULL DEFAULT '', legal_reference TEXT NOT NULL DEFAULT '',
        legal_article TEXT NOT NULL DEFAULT '', legal_paragraph TEXT NOT NULL DEFAULT '',
        legal_letter TEXT NOT NULL DEFAULT '', legal_item TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS master_plan_items_phase_idx ON master_plan_items (phase)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS master_plan_items_due_date_idx ON master_plan_items (due_date)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS master_plan_items_status_idx ON master_plan_items (status)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS pai_items (
        id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, axis TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL, due_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Planejado', progress INTEGER NOT NULL DEFAULT 0,
        estimated_value REAL, funding_source TEXT NOT NULL DEFAULT '', responsible TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS pai_items_axis_idx ON pai_items (axis)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS pai_items_due_date_idx ON pai_items (due_date)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS pai_items_status_idx ON pai_items (status)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS council_bodies (
        id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, acronym TEXT NOT NULL DEFAULT '', body_type TEXT NOT NULL,
        legal_act TEXT NOT NULL DEFAULT '', purpose TEXT NOT NULL DEFAULT '', responsible TEXT NOT NULL,
        president TEXT NOT NULL DEFAULT '', secretary TEXT NOT NULL DEFAULT '', term_start TEXT NOT NULL,
        term_end TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Ativo', members TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_bodies_type_idx ON council_bodies (body_type)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_bodies_status_idx ON council_bodies (status)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_bodies_term_end_idx ON council_bodies (term_end)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS council_meetings (
        id TEXT PRIMARY KEY NOT NULL, body_id TEXT NOT NULL, title TEXT NOT NULL, meeting_date TEXT NOT NULL,
        location TEXT NOT NULL DEFAULT '', agenda TEXT NOT NULL DEFAULT '', participants TEXT NOT NULL DEFAULT '',
        quorum TEXT NOT NULL DEFAULT '', deliberations TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Agendada',
        responsible TEXT NOT NULL, created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_meetings_body_idx ON council_meetings (body_id)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_meetings_date_idx ON council_meetings (meeting_date)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_meetings_status_idx ON council_meetings (status)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS council_members (
        id TEXT PRIMARY KEY NOT NULL, body_id TEXT NOT NULL, name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '', entity TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '', requests TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Ativo', created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_members_body_idx ON council_members (body_id)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_members_name_idx ON council_members (name)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_members_status_idx ON council_members (status)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS council_requests (
        id TEXT PRIMARY KEY NOT NULL, body_id TEXT NOT NULL, title TEXT NOT NULL,
        requester TEXT NOT NULL DEFAULT '', request_date TEXT NOT NULL, due_date TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Recebida', responsible TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '', response TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_requests_body_idx ON council_requests (body_id)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_requests_due_idx ON council_requests (due_date)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS council_requests_status_idx ON council_requests (status)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS workspace_agenda_items (
        id TEXT PRIMARY KEY NOT NULL, context_type TEXT NOT NULL, context_id TEXT NOT NULL,
        title TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'Reunião', starts_at TEXT NOT NULL,
        ends_at TEXT, location TEXT NOT NULL DEFAULT '', participants TEXT NOT NULL DEFAULT '[]',
        responsible TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Agendado', notes TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS workspace_agenda_context_idx ON workspace_agenda_items (context_type, context_id)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS workspace_agenda_starts_idx ON workspace_agenda_items (starts_at)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS workspace_agenda_status_idx ON workspace_agenda_items (status)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS staff_profiles (
        staff_name TEXT PRIMARY KEY NOT NULL, file_name TEXT NOT NULL, content_type TEXT NOT NULL,
        file_size INTEGER NOT NULL, r2_key TEXT NOT NULL, updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS staff_profiles_updated_at_idx ON staff_profiles (updated_at)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS staff_demands (
        id TEXT PRIMARY KEY NOT NULL, staff_name TEXT NOT NULL, title TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT, created_by TEXT NOT NULL DEFAULT '', updated_by TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS staff_demands_staff_idx ON staff_demands (staff_name)",
      ),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS staff_demands_due_idx ON staff_demands (due_date)",
      ),
      binding.prepare(`CREATE TABLE IF NOT EXISTS staff_messages (
        id TEXT PRIMARY KEY NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL,
        message TEXT NOT NULL, message_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`),
      binding.prepare(
        "CREATE INDEX IF NOT EXISTS staff_messages_date_idx ON staff_messages (message_date)",
      ),
    ])
    .then(async () => {
      const [processColumns, projectColumns, masterPlanColumns] = await Promise.all([
        binding
          .prepare("PRAGMA table_info(manual_processes)")
          .all<{ name: string }>(),
        binding
          .prepare("PRAGMA table_info(manual_projects)")
          .all<{ name: string }>(),
        binding
          .prepare("PRAGMA table_info(master_plan_items)")
          .all<{ name: string }>(),
      ]);
      const additions = [];
      if (
        !processColumns.results.some(
          (column) => column.name === "property_registration",
        )
      ) {
        additions.push(
          binding.prepare(
            "ALTER TABLE manual_processes ADD COLUMN property_registration TEXT NOT NULL DEFAULT ''",
          ),
        );
      }
      if (
        !projectColumns.results.some(
          (column) => column.name === "property_registration",
        )
      ) {
        additions.push(
          binding.prepare(
            "ALTER TABLE manual_projects ADD COLUMN property_registration TEXT NOT NULL DEFAULT ''",
          ),
        );
      }
      for (const [name, sql] of [
        ["legal_article", "ALTER TABLE master_plan_items ADD COLUMN legal_article TEXT NOT NULL DEFAULT ''"],
        ["legal_paragraph", "ALTER TABLE master_plan_items ADD COLUMN legal_paragraph TEXT NOT NULL DEFAULT ''"],
        ["legal_letter", "ALTER TABLE master_plan_items ADD COLUMN legal_letter TEXT NOT NULL DEFAULT ''"],
        ["legal_item", "ALTER TABLE master_plan_items ADD COLUMN legal_item TEXT NOT NULL DEFAULT ''"],
      ] as const) {
        if (!masterPlanColumns.results.some((column) => column.name === name))
          additions.push(binding.prepare(sql));
      }
      if (additions.length) await binding.batch(additions);
    })
    .catch((error) => {
      schemaReady = null;
      throw error;
    });

  return schemaReady;
}

export const ensureCoordinateSchema = ensureDashboardSchema;
