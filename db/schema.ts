import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const processCoordinates = sqliteTable(
  "process_coordinates",
  {
    processId: text("process_id").primaryKey(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    locationLabel: text("location_label").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("process_coordinates_updated_at_idx").on(table.updatedAt)],
);

export const moduleAssignments = sqliteTable(
  "module_assignments",
  {
    module: text("module").notNull(),
    itemId: text("item_id").notNull(),
    responsible: text("responsible").notNull(),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.module, table.itemId] }),
    index("module_assignments_responsible_idx").on(table.responsible),
    index("module_assignments_updated_at_idx").on(table.updatedAt),
  ],
);

export const procurements = sqliteTable(
  "procurements",
  {
    id: text("id").primaryKey(),
    object: text("object").notNull(),
    modality: text("modality").notNull(),
    processNumber: text("process_number").notNull().default(""),
    phase: text("phase").notNull(),
    situation: text("situation").notNull(),
    plannedPublicationDate: text("planned_publication_date"),
    sessionDate: text("session_date"),
    estimatedValue: real("estimated_value"),
    fundingSource: text("funding_source").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("procurements_phase_idx").on(table.phase),
    index("procurements_situation_idx").on(table.situation),
    index("procurements_updated_at_idx").on(table.updatedAt),
  ],
);

export const manualProcesses = sqliteTable(
  "manual_processes",
  {
    id: text("id").primaryKey(),
    processNumber: text("process_number").notNull(),
    area: text("area").notNull(),
    applicant: text("applicant").notNull(),
    companyName: text("company_name").notNull().default(""),
    cnpj: text("cnpj").notNull().default(""),
    propertyRegistration: text("property_registration").notNull().default(""),
    category: text("category").notNull(),
    status: text("status").notNull(),
    actionType: text("action_type").notNull().default(""),
    openedAt: text("opened_at"),
    plannedCloseAt: text("planned_close_at"),
    observation: text("observation").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("manual_processes_opened_at_idx").on(table.openedAt),
    index("manual_processes_updated_at_idx").on(table.updatedAt),
  ],
);

export const manualProjects = sqliteTable(
  "manual_projects",
  {
    id: text("id").primaryKey(),
    project: text("project").notNull(),
    priority: integer("priority"),
    areaToBuildM2: real("area_to_build_m2"),
    areaToRenovateM2: real("area_to_renovate_m2"),
    department: text("department").notNull().default(""),
    deadline: text("deadline"),
    currentStatus: text("current_status").notNull(),
    stage: text("stage").notNull(),
    processNumber: text("process_number").notNull().default(""),
    propertyRegistration: text("property_registration").notNull().default(""),
    dependency: text("dependency").notNull().default(""),
    fundingSource: text("funding_source").notNull().default(""),
    value: real("value"),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("manual_projects_stage_idx").on(table.stage),
    index("manual_projects_updated_at_idx").on(table.updatedAt),
  ],
);

export const agendaItems = sqliteTable(
  "agenda_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    type: text("type").notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    location: text("location").notNull().default(""),
    participants: text("participants").notNull().default("[]"),
    status: text("status").notNull(),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("agenda_items_starts_at_idx").on(table.startsAt),
    index("agenda_items_status_idx").on(table.status),
  ],
);

export const geoprocessingDemands = sqliteTable(
  "geoprocessing_demands",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    requester: text("requester").notNull(),
    demandDate: text("demand_date").notNull(),
    description: text("description").notNull().default(""),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    completedAt: text("completed_at"),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("geoprocessing_demands_demand_date_idx").on(table.demandDate),
    index("geoprocessing_demands_completed_idx").on(table.completed),
  ],
);

export const empresaFacilRecords = sqliteTable(
  "empresa_facil_records",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    status: text("status").notNull(),
    actionType: text("action_type").notNull(),
    protocol: text("protocol").notNull().default(""),
    requestedAt: text("requested_at").notNull(),
    riskLevel: text("risk_level").notNull().default(""),
    propertyCode: text("property_code").notNull().default(""),
    propertyRegistration: text("property_registration").notNull().default(""),
    primaryActivityCode: text("primary_activity_code").notNull().default(""),
    primaryActivityDescription: text("primary_activity_description")
      .notNull()
      .default(""),
    cnpj: text("cnpj").notNull().default(""),
    classification: text("classification").notNull().default(""),
    applicantCode: text("applicant_code").notNull().default(""),
    applicantName: text("applicant_name").notNull().default(""),
    economicRegistration: text("economic_registration").notNull().default(""),
    companyName: text("company_name").notNull().default(""),
    indicators: text("indicators").notNull().default(""),
    sourceFile: text("source_file").notNull().default(""),
    importedAt: text("imported_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("empresa_facil_records_status_idx").on(table.status),
    index("empresa_facil_records_requested_at_idx").on(table.requestedAt),
    index("empresa_facil_records_risk_level_idx").on(table.riskLevel),
    index("empresa_facil_records_protocol_idx").on(table.protocol),
  ],
);

export const reportImports = sqliteTable(
  "report_imports",
  {
    id: text("id").primaryKey(),
    module: text("module").notNull(),
    fileName: text("file_name").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    rowCount: integer("row_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    status: text("status").notNull(),
    errorMessage: text("error_message").notNull().default(""),
    importedBy: text("imported_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("report_imports_module_idx").on(table.module),
    index("report_imports_created_at_idx").on(table.createdAt),
  ],
);

export const reportImportRows = sqliteTable(
  "report_import_rows",
  {
    id: text("id").primaryKey(),
    module: text("module").notNull(),
    sourceFile: text("source_file").notNull(),
    sourceSheet: text("source_sheet").notNull().default(""),
    sourceRow: integer("source_row").notNull().default(0),
    dataJson: text("data_json").notNull(),
    searchText: text("search_text").notNull().default(""),
    importedBy: text("imported_by").notNull().default(""),
    importedAt: text("imported_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("report_import_rows_module_idx").on(table.module),
    index("report_import_rows_source_idx").on(table.module, table.sourceFile),
    index("report_import_rows_imported_at_idx").on(table.importedAt),
  ],
);

export const projectLocations = sqliteTable(
  "project_locations",
  {
    projectId: text("project_id").primaryKey(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    locationLabel: text("location_label").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("project_locations_updated_at_idx").on(table.updatedAt)],
);

export const itemStates = sqliteTable(
  "item_states",
  {
    module: text("module").notNull(),
    itemId: text("item_id").notNull(),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    removed: integer("removed", { mode: "boolean" }).notNull().default(false),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.module, table.itemId] }),
    index("item_states_module_idx").on(table.module),
  ],
);

export const itemAttachments = sqliteTable(
  "item_attachments",
  {
    id: text("id").primaryKey(),
    module: text("module").notNull(),
    itemId: text("item_id").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    r2Key: text("r2_key").notNull(),
    uploadedBy: text("uploaded_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("item_attachments_item_idx").on(table.module, table.itemId),
    index("item_attachments_created_at_idx").on(table.createdAt),
  ],
);

export const multipartAttachmentUploads = sqliteTable(
  "multipart_attachment_uploads",
  {
    id: text("id").primaryKey(),
    uploadId: text("upload_id").notNull(),
    module: text("module").notNull(),
    itemId: text("item_id").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    r2Key: text("r2_key").notNull(),
    uploadedBy: text("uploaded_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("multipart_attachment_uploads_created_at_idx").on(table.createdAt),
  ],
);

export const processEnrichments = sqliteTable(
  "process_enrichments",
  {
    processId: text("process_id").primaryKey(),
    propertyRegistration: text("property_registration").notNull().default(""),
    lot: text("lot").notNull().default(""),
    block: text("block").notNull().default(""),
    neighborhood: text("neighborhood").notNull().default(""),
    applicant: text("applicant").notNull().default(""),
    address: text("address").notNull().default(""),
    postalCode: text("postal_code").notNull().default(""),
    request: text("request").notNull().default(""),
    category: text("category").notNull().default(""),
    actionType: text("action_type").notNull().default(""),
    sourceFiles: text("source_files").notNull().default("[]"),
    confidenceJson: text("confidence_json").notNull().default("{}"),
    analyzedAt: text("analyzed_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("process_enrichments_registration_idx").on(
      table.propertyRegistration,
    ),
    index("process_enrichments_updated_at_idx").on(table.updatedAt),
  ],
);

export const eivAnalyses = sqliteTable(
  "eiv_analyses",
  {
    processId: text("process_id").primaryKey(),
    resultJson: text("result_json").notNull().default("{}"),
    sourceFiles: text("source_files").notNull().default("[]"),
    coverageScore: integer("coverage_score").notNull().default(0),
    conclusion: text("conclusion").notNull().default(""),
    analyzedAt: text("analyzed_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("eiv_analyses_score_idx").on(table.coverageScore),
    index("eiv_analyses_updated_at_idx").on(table.updatedAt),
  ],
);

export const partyExpenses = sqliteTable(
  "party_expenses",
  {
    id: text("id").primaryKey(),
    eventName: text("event_name").notNull(),
    expenseDate: text("expense_date").notNull(),
    description: text("description").notNull(),
    amount: real("amount").notNull(),
    paidBy: text("paid_by").notNull(),
    debtor: text("debtor").notNull(),
    creditor: text("creditor").notNull(),
    responsible: text("responsible").notNull(),
    status: text("status").notNull().default("Pendente"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("party_expenses_event_idx").on(table.eventName),
    index("party_expenses_date_idx").on(table.expenseDate),
  ],
);

export const masterPlanItems = sqliteTable(
  "master_plan_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    phase: text("phase").notNull(),
    itemType: text("item_type").notNull(),
    description: text("description").notNull().default(""),
    startDate: text("start_date").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("Não iniciado"),
    progress: integer("progress").notNull().default(0),
    responsible: text("responsible").notNull(),
    stakeholders: text("stakeholders").notNull().default(""),
    legalReference: text("legal_reference").notNull().default(""),
    legalArticle: text("legal_article").notNull().default(""),
    legalParagraph: text("legal_paragraph").notNull().default(""),
    legalLetter: text("legal_letter").notNull().default(""),
    legalItem: text("legal_item").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("master_plan_items_phase_idx").on(table.phase),
    index("master_plan_items_due_date_idx").on(table.dueDate),
    index("master_plan_items_status_idx").on(table.status),
  ],
);

export const paiItems = sqliteTable(
  "pai_items",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    axis: text("axis").notNull(),
    description: text("description").notNull().default(""),
    startDate: text("start_date").notNull(),
    dueDate: text("due_date").notNull(),
    status: text("status").notNull().default("Planejado"),
    progress: integer("progress").notNull().default(0),
    estimatedValue: real("estimated_value"),
    fundingSource: text("funding_source").notNull().default(""),
    responsible: text("responsible").notNull(),
    location: text("location").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("pai_items_axis_idx").on(table.axis),
    index("pai_items_due_date_idx").on(table.dueDate),
    index("pai_items_status_idx").on(table.status),
  ],
);

export const councilBodies = sqliteTable(
  "council_bodies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    acronym: text("acronym").notNull().default(""),
    bodyType: text("body_type").notNull(),
    legalAct: text("legal_act").notNull().default(""),
    purpose: text("purpose").notNull().default(""),
    responsible: text("responsible").notNull(),
    president: text("president").notNull().default(""),
    secretary: text("secretary").notNull().default(""),
    termStart: text("term_start").notNull(),
    termEnd: text("term_end").notNull(),
    status: text("status").notNull().default("Ativo"),
    members: text("members").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("council_bodies_type_idx").on(table.bodyType),
    index("council_bodies_status_idx").on(table.status),
    index("council_bodies_term_end_idx").on(table.termEnd),
  ],
);

export const councilMeetings = sqliteTable(
  "council_meetings",
  {
    id: text("id").primaryKey(),
    bodyId: text("body_id").notNull(),
    title: text("title").notNull(),
    meetingDate: text("meeting_date").notNull(),
    location: text("location").notNull().default(""),
    agenda: text("agenda").notNull().default(""),
    participants: text("participants").notNull().default(""),
    quorum: text("quorum").notNull().default(""),
    deliberations: text("deliberations").notNull().default(""),
    status: text("status").notNull().default("Agendada"),
    responsible: text("responsible").notNull(),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("council_meetings_body_idx").on(table.bodyId),
    index("council_meetings_date_idx").on(table.meetingDate),
    index("council_meetings_status_idx").on(table.status),
  ],
);

export const councilMembers = sqliteTable(
  "council_members",
  {
    id: text("id").primaryKey(),
    bodyId: text("body_id").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    entity: text("entity").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    requests: text("requests").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("Ativo"),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("council_members_body_idx").on(table.bodyId),
    index("council_members_name_idx").on(table.name),
    index("council_members_status_idx").on(table.status),
  ],
);

export const councilRequests = sqliteTable(
  "council_requests",
  {
    id: text("id").primaryKey(),
    bodyId: text("body_id").notNull(),
    title: text("title").notNull(),
    requester: text("requester").notNull().default(""),
    requestDate: text("request_date").notNull(),
    dueDate: text("due_date").notNull().default(""),
    status: text("status").notNull().default("Recebida"),
    responsible: text("responsible").notNull(),
    description: text("description").notNull().default(""),
    response: text("response").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("council_requests_body_idx").on(table.bodyId),
    index("council_requests_due_idx").on(table.dueDate),
    index("council_requests_status_idx").on(table.status),
  ],
);

export const workspaceAgendaItems = sqliteTable(
  "workspace_agenda_items",
  {
    id: text("id").primaryKey(),
    contextType: text("context_type").notNull(),
    contextId: text("context_id").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull().default("Reunião"),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at"),
    location: text("location").notNull().default(""),
    participants: text("participants").notNull().default("[]"),
    responsible: text("responsible").notNull(),
    status: text("status").notNull().default("Agendado"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("workspace_agenda_context_idx").on(
      table.contextType,
      table.contextId,
    ),
    index("workspace_agenda_starts_idx").on(table.startsAt),
    index("workspace_agenda_status_idx").on(table.status),
  ],
);

export const staffProfiles = sqliteTable(
  "staff_profiles",
  {
    staffName: text("staff_name").primaryKey(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    r2Key: text("r2_key").notNull(),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("staff_profiles_updated_at_idx").on(table.updatedAt)],
);

export const staffDemands = sqliteTable(
  "staff_demands",
  {
    id: text("id").primaryKey(),
    staffName: text("staff_name").notNull(),
    title: text("title").notNull(),
    details: text("details").notNull().default(""),
    dueDate: text("due_date").notNull(),
    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),
    completedAt: text("completed_at"),
    createdBy: text("created_by").notNull().default(""),
    updatedBy: text("updated_by").notNull().default(""),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("staff_demands_staff_idx").on(table.staffName),
    index("staff_demands_due_idx").on(table.dueDate),
  ],
);

export const staffMessages = sqliteTable(
  "staff_messages",
  {
    id: text("id").primaryKey(),
    sender: text("sender").notNull(),
    recipient: text("recipient").notNull(),
    message: text("message").notNull(),
    messageDate: text("message_date").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("staff_messages_date_idx").on(table.messageDate)],
);
