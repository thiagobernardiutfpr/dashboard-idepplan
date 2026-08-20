import type {
  ManualProcessRecord,
  ManualProjectRecord,
  ProcessRecord,
  ProjectRecord,
} from "@/lib/dashboard-types";

function processState(status: string): ProcessRecord["operationalState"] {
  const normalized = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalized.includes("cancel")) return "Cancelado";
  if (normalized.includes("encerr") || normalized.includes("conclu")) return "Encerrado";
  return "Em andamento";
}

export function manualProcessToProcessRecord(record: ManualProcessRecord): ProcessRecord {
  const operationalState = processState(record.status);
  const daysToDeadline = record.plannedCloseAt
    ? Math.ceil((new Date(`${record.plannedCloseAt}T23:59:59`).getTime() - Date.now()) / 86_400_000)
    : null;
  const deadlineState = operationalState === "Cancelado"
    ? "Cancelado"
    : operationalState === "Encerrado"
      ? "Encerrado"
      : daysToDeadline == null
        ? "Prazo não informado"
        : daysToDeadline < 0
          ? "Prazo vencido"
          : daysToDeadline <= 7
            ? "Vence em até 7 dias"
            : "No prazo";

  return {
    id: record.id,
    displayId: record.processNumber,
    manual: true,
    year: Number(record.openedAt?.slice(0, 4) ?? new Date().getFullYear()),
    area: record.area,
    status: record.status,
    actionType: record.actionType || null,
    applicant: record.applicant,
    companyName: record.companyName || null,
    cnpj: record.cnpj || null,
    propertyRegistration: record.propertyRegistration || null,
    openedAt: record.openedAt,
    openedMonth: record.openedAt?.slice(0, 7) ?? null,
    plannedCloseAt: record.plannedCloseAt,
    processingDaysToReport: null,
    plannedCycleDays: null,
    operationalState,
    deadlineState,
    daysToDeadline,
    subjectCode: null,
    subject: record.category,
    subsubjectCode: null,
    category: record.category,
    observation: record.observation,
    sourceFile: "Cadastro manual",
  };
}

export function manualProjectToProjectRecord(record: ManualProjectRecord): ProjectRecord {
  return {
    id: record.id,
    manual: true,
    sheetRow: 0,
    priority: record.priority,
    project: record.project,
    areaToBuildM2: record.areaToBuildM2,
    areaToRenovateM2: record.areaToRenovateM2,
    responsible: null,
    department: record.department || null,
    deadline: record.deadline,
    currentStatus: record.currentStatus,
    stage: record.stage,
    process: record.processNumber || null,
    propertyRegistration: record.propertyRegistration || null,
    dependency: record.dependency || null,
    fundingSource: record.fundingSource || null,
    value: record.value,
  };
}
