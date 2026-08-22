import type {
  ProcurementModality,
  ProcurementPhase,
  ProcurementSituation,
} from "@/lib/procurement-options";

export type ProcessRecord = {
  id: string;
  displayId?: string;
  manual?: boolean;
  year: number;
  area: "Urbanismo" | "Abertura de empresa";
  requestCode?: string;
  status: string;
  actionType?: string | null;
  applicant: string;
  applicantCode?: string | null;
  companyName?: string | null;
  cnpj?: string | null;
  openedAt: string | null;
  openedAtText?: string;
  openedMonth: string | null;
  receivedAt?: string | null;
  receivedAtText?: string | null;
  responsible?: string | null;
  plannedCloseAt: string | null;
  closedAt?: string | null;
  closedAtText?: string;
  closingUser?: string;
  closingReason?: string;
  processingDaysToReport: number | null;
  plannedCycleDays: number | null;
  completionDays?: number | null;
  operationalState: "Em andamento" | "Encerrado" | "Cancelado";
  deadlineState: string;
  daysToDeadline: number | null;
  subjectCode: number | null;
  subject: string;
  subsubjectCode: number | null;
  category: string;
  riskLevel?: string | null;
  propertyCode?: string | null;
  propertyRegistration?: string | null;
  lot?: string | null;
  block?: string | null;
  neighborhood?: string | null;
  address?: string | null;
  postalCode?: string | null;
  requestDescription?: string | null;
  sourceCategory?: string | null;
  sourceActionType?: string | null;
  activityCode?: string | null;
  activityDescription?: string | null;
  legalFramework?: string | null;
  economicRegistration?: string | null;
  indicators?: string | null;
  observation: string;
  sourceFile: string;
};

export type ProcessEnrichmentRecord = {
  processId: string;
  propertyRegistration: string;
  lot: string;
  block: string;
  neighborhood: string;
  applicant: string;
  address: string;
  postalCode: string;
  request: string;
  category: string;
  actionType: string;
  sourceFiles: string[];
  confidence: Record<string, number>;
  analyzedAt: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardDataset = {
  generatedFrom: Array<{
    fileName: string;
    area: "Urbanismo" | "Abertura de empresa";
    reportType?: string;
    periodStart: string | null;
    periodEnd: string | null;
    subjectCode: number | null;
    subsubjectCode: number | null;
    processCount: number;
    reportedCount: number;
    countMatches: boolean;
    empty: boolean;
  }>;
  summary: Record<string, unknown>;
  processes: ProcessRecord[];
};

export type CoordinateRecord = {
  processId: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  automatic?: boolean;
  propertyRegistration?: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type MappedProcess = {
  process: ProcessRecord;
  coordinate: CoordinateRecord;
};

export type ProjectStage =
  | "A iniciar"
  | "Em desenvolvimento"
  | "Aguardando dependência"
  | "Em licitação";

export type ProjectRecord = {
  id: string;
  manual?: boolean;
  sheetRow: number;
  priority: 1 | 2 | null;
  project: string;
  areaToBuildM2: number | null;
  areaToRenovateM2: number | null;
  responsible: string | null;
  department: string | null;
  deadline: string | null;
  currentStatus: string;
  stage: ProjectStage;
  process: string | null;
  propertyRegistration?: string | null;
  dependency: string | null;
  fundingSource: string | null;
  value: number | null;
};

export type ProjectsDataset = {
  source: {
    title: string;
    url: string;
    spreadsheetId: string;
    sheetName: string;
    capturedAt: string;
  };
  summary: {
    total: number;
    withoutDeadline: number;
    withValue: number;
    informedValue: number;
    byStage: Record<ProjectStage, number>;
    byPriority: Record<string, number>;
  };
  projects: ProjectRecord[];
};

export type AssignmentModule =
  | "processes"
  | "projects"
  | "procurements"
  | "agenda"
  | "geoprocessing"
  | "empresa-facil";

export type ItemModule =
  | "processes"
  | "projects"
  | "procurements"
  | "agenda"
  | "geoprocessing"
  | "empresa-facil"
  | "consultation"
  | "festivals"
  | "staff-demands"
  | "master-plan"
  | "councils"
  | "pai";

export type ItemStateRecord = {
  module: ItemModule;
  itemId: string;
  completed: boolean;
  removed: boolean;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ItemAttachmentRecord = {
  id: string;
  module: ItemModule;
  itemId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
};

export type ReportImportRowRecord = {
  id: string;
  module: ItemModule;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  data: Record<string, string>;
  importedBy: string;
  importedAt: string;
  updatedAt: string;
};

export type ProjectLocationRecord = {
  projectId: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  automatic?: boolean;
  propertyRegistration?: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PartyExpenseRecord = {
  id: string;
  eventName: string;
  expenseDate: string;
  description: string;
  amount: number;
  paidBy: string;
  debtor: string;
  creditor: string;
  responsible: string;
  status: "Pendente" | "Quitado";
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffProfileRecord = {
  staffName: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffDemandRecord = {
  id: string;
  staffName: string;
  title: string;
  details: string;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type StaffMessageRecord = {
  id: string;
  sender: string;
  recipient: string;
  message: string;
  messageDate: string;
  createdAt: string;
};

export type MasterPlanRecord = {
  id: string;
  title: string;
  phase: string;
  itemType: string;
  description: string;
  startDate: string;
  dueDate: string;
  status: "Não iniciado" | "Em andamento" | "Em validação" | "Concluído";
  progress: number;
  responsible: string;
  stakeholders: string;
  legalReference: string;
  legalArticle: string;
  legalParagraph: string;
  legalLetter: string;
  legalItem: string;
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type PaiRecord = {
  id: string;
  title: string;
  axis: string;
  description: string;
  startDate: string;
  dueDate: string;
  status: "Planejado" | "Em execução" | "Em monitoramento" | "Concluído";
  progress: number;
  estimatedValue: number | null;
  fundingSource: string;
  responsible: string;
  location: string;
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CouncilBodyRecord = {
  id: string;
  name: string;
  acronym: string;
  bodyType: "Conselho" | "Comissão" | "Comitê" | "Grupo de Trabalho";
  legalAct: string;
  purpose: string;
  responsible: string;
  president: string;
  secretary: string;
  termStart: string;
  termEnd: string;
  status: "Ativo" | "Em renovação" | "Inativo";
  members: string;
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CouncilMeetingRecord = {
  id: string;
  bodyId: string;
  title: string;
  meetingDate: string;
  location: string;
  agenda: string;
  participants: string;
  quorum: string;
  deliberations: string;
  status: "Agendada" | "Realizada" | "Cancelada";
  responsible: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CouncilMemberRecord = {
  id: string;
  bodyId: string;
  name: string;
  role: string;
  entity: string;
  phone: string;
  email: string;
  requests: string;
  notes: string;
  status: "Ativo" | "Inativo";
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CouncilRequestRecord = {
  id: string;
  bodyId: string;
  title: string;
  requester: string;
  requestDate: string;
  dueDate: string;
  status: "Recebida" | "Em análise" | "Respondida" | "Arquivada";
  responsible: string;
  description: string;
  response: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceAgendaRecord = {
  id: string;
  contextType: "council" | "master-plan";
  contextId: string;
  title: string;
  type: "Compromisso" | "Reunião";
  startsAt: string;
  endsAt: string | null;
  location: string;
  participants: string;
  responsible: string;
  status: "Agendado" | "Realizado" | "Cancelado";
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentRecord = {
  module: AssignmentModule;
  itemId: string;
  responsible: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentMap = Record<string, AssignmentRecord>;

export type AssignResponsible = (
  module: AssignmentModule,
  itemIds: string[],
  responsible: string,
) => Promise<boolean>;

export type ProcurementRecord = {
  id: string;
  object: string;
  modality: ProcurementModality;
  processNumber: string;
  phase: ProcurementPhase;
  situation: ProcurementSituation;
  plannedPublicationDate: string | null;
  sessionDate: string | null;
  estimatedValue: number | null;
  fundingSource: string;
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ManualProcessRecord = {
  id: string;
  processNumber: string;
  area: "Urbanismo" | "Abertura de empresa";
  applicant: string;
  companyName: string;
  cnpj: string;
  propertyRegistration: string;
  category: string;
  status: string;
  actionType: string;
  openedAt: string | null;
  plannedCloseAt: string | null;
  observation: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ManualProjectRecord = {
  id: string;
  project: string;
  priority: 1 | 2 | null;
  areaToBuildM2: number | null;
  areaToRenovateM2: number | null;
  department: string;
  deadline: string | null;
  currentStatus: string;
  stage: ProjectStage;
  processNumber: string;
  propertyRegistration: string;
  dependency: string;
  fundingSource: string;
  value: number | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AgendaItemRecord = {
  id: string;
  title: string;
  type: "Compromisso" | "Reunião";
  startsAt: string;
  endsAt: string | null;
  location: string;
  participants: string[];
  status: "Agendado" | "Realizado" | "Cancelado";
  notes: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type GeoprocessingDemandRecord = {
  id: string;
  title: string;
  requester: string;
  demandDate: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EmpresaFacilRecord = {
  id: string;
  code: string;
  status: string;
  actionType: string;
  protocol: string;
  requestedAt: string;
  riskLevel: string;
  propertyCode: string;
  propertyRegistration: string;
  primaryActivityCode: string;
  primaryActivityDescription: string;
  cnpj: string;
  classification: string;
  applicantCode: string;
  applicantName: string;
  economicRegistration: string;
  companyName: string;
  indicators: string;
  sourceFile: string;
  importedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type EmpresaFacilImportRecord = Omit<
  EmpresaFacilRecord,
  "sourceFile" | "importedAt" | "createdAt" | "updatedAt"
>;

export type ReportImportRecord = {
  id: string;
  module: "empresa-facil";
  fileName: string;
  fileType: string;
  fileSize: number;
  rowCount: number;
  insertedCount: number;
  updatedCount: number;
  status: "Concluído" | "Falhou";
  errorMessage: string;
  importedBy: string;
  createdAt: string;
};
