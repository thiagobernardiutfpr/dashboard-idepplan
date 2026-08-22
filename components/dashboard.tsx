"use client";

import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Database,
  Download,
  EyeOff,
  FileText,
  FileClock,
  FilterX,
  FolderKanban,
  Gift,
  Gavel,
  LayoutDashboard,
  Landmark,
  ListTodo,
  LoaderCircle,
  LogOut,
  MapPinned,
  Monitor,
  Plus,
  Save,
  Search,
  Trash2,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DistributionBars, MonthlyAreaChart, Sparkline, StatusDonut } from "@/components/dashboard-charts";
import { AgendaModule } from "@/components/agenda-module";
import { GeoprocessingModule } from "@/components/geoprocessing-module";
import { EmpresaFacilModule } from "@/components/empresa-facil-module";
import { ProcurementModule } from "@/components/procurement-module";
import { ProcessMap } from "@/components/process-map";
import { ProjectsModule } from "@/components/projects-module";
import { ReportImportModal } from "@/components/report-import-modal";
import { ManualProcessForm } from "@/components/manual-process-form";
import { FestivalsModule } from "@/components/festivals-module";
import { GeneralConsultationModule } from "@/components/general-consultation-module";
import { ItemFilesButton, ItemLifecycleActions, useItemLifecycle } from "@/components/item-lifecycle";
import { StaffDemandsModule } from "@/components/staff-demands-module";
import { MasterPlanModule } from "@/components/master-plan-module";
import { CouncilsModule } from "@/components/councils-module";
import { ImportedReportData } from "@/components/imported-report-data";
import {
  BulkAssignmentBar,
  ResponsibleSelect,
  SelectionIconButton,
} from "@/components/responsibility-controls";
import { assignmentKey } from "@/lib/assignments";
import type {
  AssignmentMap,
  AssignmentRecord,
  AssignResponsible,
  CoordinateRecord,
  DashboardDataset,
  EmpresaFacilRecord,
  ManualProcessRecord,
  MappedProcess,
  ItemModule,
  ProcessEnrichmentRecord,
  ProcessRecord,
  ProjectsDataset,
} from "@/lib/dashboard-types";
import { manualProcessToProcessRecord } from "@/lib/manual-records";
import { loadPropertyCoordinates, normalizePropertyRegistration } from "@/lib/property-coordinates-client";
import { lookupPropertyByRegistration } from "@/lib/property-consultation-client";
import { ClearModuleButton } from "@/components/clear-module-button";
import { TvProcessPanel } from "@/components/tv-process-panel";
import { PaiModule } from "@/components/pai-module";
import { ZoningBadge } from "@/components/zoning-badge";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { ProcessDocumentAnalyzer } from "@/components/process-document-analyzer";
import { ProcessDocumentGenerator } from "@/components/process-document-generator";
import { EivAnalyzer } from "@/components/eiv-analyzer";
import { ProcessTypeVisibility } from "@/components/process-type-visibility";
import { normalizeProcessClassification } from "@/lib/process-category-normalization";
import { isDefaultActiveProcessType } from "@/lib/process-type-defaults";

const PAGE_SIZE = 12;
const APUCARANA_CENTER = { latitude: -23.5505, longitude: -51.4614 };
const PROCESS_TYPE_VISIBILITY_STORAGE_KEY = "idepplan:process-type-visibility:v2";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value.replace(" ", "T") + (value.includes("Z") ? "" : "Z"));
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(parsed);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function monthLabel(key: string, style: "chart" | "filter" = "chart") {
  const [year, month] = key.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const monthText = label.replace(".", "").replace(/^./, (letter) => letter.toUpperCase());
  return style === "filter" ? `${monthText} ${year}` : `${monthText}/${String(year).slice(-2)}`;
}

function statusClass(value: string) {
  if (value === "Encerramento") return "badge-blue";
  if (value === "Trâmite") return "badge-cyan";
  if (value === "Em Análise") return "badge-violet";
  if (value === "Paralisado" || value === "Readequação") return "badge-amber";
  if (value === "Cancelamento") return "badge-slate";
  return "badge-neutral";
}

function deadlineClass(value: string) {
  if (value === "Prazo vencido" || value === "Encerrado após o prazo") return "badge-amber";
  if (value === "Vence em até 7 dias") return "badge-violet";
  if (value === "Encerrado no prazo" || value === "No prazo") return "badge-green";
  if (value === "Aguardando recebimento" || value.includes("recebimento não informado")) return "badge-slate";
  return "badge-neutral";
}

function haversineDistance(
  latitude: number,
  longitude: number,
  targetLatitude: number,
  targetLongitude: number,
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const radius = 6371;
  const deltaLatitude = toRadians(targetLatitude - latitude);
  const deltaLongitude = toRadians(targetLongitude - longitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
      Math.cos(toRadians(targetLatitude)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function withThirtyDayDeadline(process: ProcessRecord): ProcessRecord {
  if (!process.receivedAt) {
    const deadlineState = process.operationalState === "Cancelado"
      ? "Cancelado"
      : process.operationalState === "Encerrado"
        ? "Encerrado · recebimento não informado"
        : "Aguardando recebimento";
    return { ...process, plannedCycleDays: 30, plannedCloseAt: null, deadlineState, daysToDeadline: null };
  }
  const received = new Date(`${process.receivedAt.slice(0, 10)}T00:00:00Z`);
  const planned = new Date(received); planned.setUTCDate(planned.getUTCDate() + 30);
  const ended = process.closedAt ? new Date(`${process.closedAt.slice(0, 10)}T00:00:00Z`) : null;
  const reference = ended ?? new Date();
  const elapsed = Math.max(0, Math.floor((reference.getTime() - received.getTime()) / 86_400_000));
  let deadlineState = process.deadlineState;
  if (process.operationalState === "Cancelado") deadlineState = "Cancelado";
  else if (process.operationalState === "Encerrado") deadlineState = elapsed <= 30 ? "Encerrado no prazo" : "Encerrado após o prazo";
  else if (elapsed > 30) deadlineState = "Prazo vencido";
  else if (30 - elapsed <= 7) deadlineState = "Vence em até 7 dias";
  else deadlineState = "No prazo";
  return { ...process, plannedCycleDays: 30, plannedCloseAt: planned.toISOString().slice(0, 10), deadlineState, daysToDeadline: 30 - elapsed };
}

function empresaFacilToProcessRecord(record: EmpresaFacilRecord, completed: boolean, assignment?: AssignmentRecord): ProcessRecord {
  const openedAt = record.requestedAt ? record.requestedAt.slice(0, 10) : null;
  const operationalState = completed ? "Encerrado" : "Em andamento";
  return withThirtyDayDeadline({
    id: `empresa-facil:${record.id}`,
    displayId: `Empresa Fácil ${record.code}`,
    year: openedAt ? Number(openedAt.slice(0, 4)) : new Date().getFullYear(),
    area: "Abertura de empresa",
    requestCode: record.code,
    status: completed ? "Concluído" : record.status,
    actionType: record.actionType,
    applicant: record.applicantName,
    applicantCode: record.applicantCode,
    companyName: record.companyName,
    cnpj: record.cnpj,
    openedAt,
    openedAtText: record.requestedAt,
    openedMonth: openedAt ? openedAt.slice(0, 7) : null,
    receivedAt: assignment?.updatedAt ?? null,
    receivedAtText: assignment?.updatedAt ?? null,
    responsible: assignment?.responsible ?? null,
    plannedCloseAt: null,
    closedAt: completed ? record.updatedAt.slice(0, 10) : null,
    processingDaysToReport: null,
    plannedCycleDays: 30,
    operationalState,
    deadlineState: completed ? "Encerrado no prazo" : "No prazo",
    daysToDeadline: null,
    subjectCode: null,
    subject: "Empresa Fácil",
    subsubjectCode: null,
    category: "Empresa Fácil",
    riskLevel: record.riskLevel,
    propertyCode: record.propertyCode,
    propertyRegistration: record.propertyRegistration,
    requestDescription: record.primaryActivityDescription,
    sourceCategory: "Empresa Fácil",
    sourceActionType: record.actionType,
    activityCode: record.primaryActivityCode,
    activityDescription: record.primaryActivityDescription,
    economicRegistration: record.economicRegistration,
    indicators: record.indicators,
    observation: [record.classification, record.primaryActivityDescription].filter(Boolean).join(" · "),
    sourceFile: record.sourceFile,
  });
}

type DashboardProps = {
  dataset: DashboardDataset;
  projectsDataset: ProjectsDataset;
};

type DashboardModule = "processes" | "tv-panel" | "projects" | "procurement" | "agenda" | "geoprocessing" | "empresa-facil" | "consultation" | "festivals" | "staff-demands" | "master-plan" | "councils" | "pai";

const moduleFiles: Record<Exclude<DashboardModule, "tv-panel">, { module: ItemModule; label: string }> = {
  processes: { module: "processes", label: "Painel de Processos" }, projects: { module: "projects", label: "Projetos" }, procurement: { module: "procurements", label: "Licitações" }, agenda: { module: "agenda", label: "Agenda" }, geoprocessing: { module: "geoprocessing", label: "Demandas de Geoprocessamento" }, "empresa-facil": { module: "empresa-facil", label: "Empresa Fácil" }, consultation: { module: "consultation", label: "Consulta Geral" }, festivals: { module: "festivals", label: "Festas" }, "staff-demands": { module: "staff-demands", label: "Demandas por Servidor" }, "master-plan": { module: "master-plan", label: "Revisão do Plano Diretor" }, councils: { module: "councils", label: "Conselhos e Comissões" }, pai: { module: "pai", label: "PAI · Plano de Ação e Investimentos" },
};

export default function Dashboard({ dataset, projectsDataset }: DashboardProps) {
  const { getState } = useItemLifecycle();
  const [assignments, setAssignments] = useState<AssignmentMap>({});
  const [manualProcessRecords, setManualProcessRecords] = useState<ManualProcessRecord[]>([]);
  const [empresaFacilRecords, setEmpresaFacilRecords] = useState<EmpresaFacilRecord[]>([]);
  const [empresaFacilCoordinates, setEmpresaFacilCoordinates] = useState<Record<string, CoordinateRecord>>({});
  const [processEnrichments, setProcessEnrichments] = useState<Record<string, ProcessEnrichmentRecord>>({});
  const processes = useMemo<ProcessRecord[]>(
    () => [
      ...manualProcessRecords.map(manualProcessToProcessRecord),
      ...dataset.processes,
    ].map((process) => {
      const enrichment = processEnrichments[process.id];
      if (!enrichment) return process;
      return {
        ...process,
        propertyRegistration: enrichment.propertyRegistration || process.propertyRegistration,
        lot: enrichment.lot || process.lot,
        block: enrichment.block || process.block,
        neighborhood: enrichment.neighborhood || process.neighborhood,
        applicant: enrichment.applicant || process.applicant,
        address: enrichment.address || process.address,
        postalCode: enrichment.postalCode || process.postalCode,
        requestDescription: enrichment.request || process.requestDescription,
        category: enrichment.category || process.category,
        actionType: enrichment.actionType || process.actionType,
      };
    }).map(normalizeProcessClassification).map((process) => {
      const assignment = assignments[assignmentKey("processes", process.id)];
      return withThirtyDayDeadline({
        ...process,
        receivedAt: assignment?.updatedAt ?? null,
        receivedAtText: assignment?.updatedAt ?? null,
        responsible: assignment?.responsible ?? null,
      });
    }).filter((process) => !getState("processes", process.id)?.removed),
    [assignments, dataset.processes, manualProcessRecords, processEnrichments, getState],
  );
  const [hiddenProcessTypes, setHiddenProcessTypes] = useState<Set<string>>(new Set());
  const [processVisibilityMode, setProcessVisibilityMode] = useState<"default" | "custom">("default");
  const [processVisibilityReady, setProcessVisibilityReady] = useState(false);
  const mapSectionRef = useRef<HTMLElement>(null);
  const mapCaptureRef = useRef<(() => Promise<Blob | null>) | null>(null);
  const selectedProcessRef = useRef(dataset.processes[0]?.id ?? "");
  const [activeModule, setActiveModule] = useState<DashboardModule>("processes");
  const [areaFilter, setAreaFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deadlineOnly, setDeadlineOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedProcessId, setSelectedProcessId] = useState(dataset.processes[0]?.id ?? "");
  const [coordinates, setCoordinates] = useState<Record<string, CoordinateRecord>>({});
  const [automaticCoordinates, setAutomaticCoordinates] = useState<Record<string, CoordinateRecord>>({});
  const [lookupCoordinates, setLookupCoordinates] = useState<Record<string, CoordinateRecord>>({});
  const [coordinateStatus, setCoordinateStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [coordinateError, setCoordinateError] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [coordinateRegistration, setCoordinateRegistration] = useState(String(dataset.processes[0]?.propertyRegistration ?? ""));
  const [coordinateZone, setCoordinateZone] = useState("");
  const [coordinateLookupMessage, setCoordinateLookupMessage] = useState("");
  const [searchingRegistration, setSearchingRegistration] = useState(false);
  const [savingCoordinate, setSavingCoordinate] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [selectedProcessIds, setSelectedProcessIds] = useState<Set<string>>(new Set());
  const [bulkProcessResponsible, setBulkProcessResponsible] = useState("");
  const [processFormOpen, setProcessFormOpen] = useState(false);
  const [deletingProcessId, setDeletingProcessId] = useState("");
  const [reportImporterOpen, setReportImporterOpen] = useState(false);
  const [importRefreshToken, setImportRefreshToken] = useState(0);
  const [toast, setToast] = useState("");

  const areas = useMemo(
    () => [...new Set(processes.map((process) => process.area))].sort(),
    [processes],
  );
  const categories = useMemo(
    () => [...new Set(processes.map((process) => process.category))].sort(),
    [processes],
  );
  const activeHiddenProcessTypes = useMemo(
    () => processVisibilityMode === "default"
      ? new Set(categories.filter((type) => !isDefaultActiveProcessType(type)))
      : new Set([...hiddenProcessTypes].filter((type) => categories.includes(type))),
    [categories, hiddenProcessTypes, processVisibilityMode],
  );
  const processTypeOptions = useMemo(
    () => categories.map((label) => ({ label, count: processes.filter((process) => process.category === label).length })),
    [categories, processes],
  );
  const visibleProcesses = useMemo(
    () => processes.filter((process) => !activeHiddenProcessTypes.has(process.category)),
    [activeHiddenProcessTypes, processes],
  );
  const statuses = useMemo(
    () => [...new Set(visibleProcesses.map((process) => process.status))].sort(),
    [visibleProcesses],
  );
  const months = useMemo(
    () => [...new Set(visibleProcesses.map((process) => process.openedMonth).filter(Boolean))].sort() as string[],
    [visibleProcesses],
  );
  const openedDates = useMemo(
    () => visibleProcesses.map((process) => process.openedAt).filter(Boolean).sort() as string[],
    [visibleProcesses],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(PROCESS_TYPE_VISIBILITY_STORAGE_KEY) ?? "null") as unknown;
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
          const preference = saved as { mode?: unknown; hiddenTypes?: unknown };
          if (preference.mode === "custom" || preference.mode === "default") setProcessVisibilityMode(preference.mode);
          if (Array.isArray(preference.hiddenTypes)) setHiddenProcessTypes(new Set(preference.hiddenTypes.filter((value): value is string => typeof value === "string")));
        }
      } catch {}
      setProcessVisibilityReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!processVisibilityReady) return;
    window.localStorage.setItem(PROCESS_TYPE_VISIBILITY_STORAGE_KEY, JSON.stringify({
      mode: processVisibilityMode,
      hiddenTypes: processVisibilityMode === "custom" ? [...activeHiddenProcessTypes] : [],
    }));
  }, [activeHiddenProcessTypes, processVisibilityMode, processVisibilityReady]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadManualProcesses() {
      try {
        const response = await fetch("/api/manual-processes", { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as { processes?: ManualProcessRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar processos cadastrados.");
        setManualProcessRecords(payload.processes ?? []);
      } catch (error) {
        if (!controller.signal.aborted) setToast(error instanceof Error ? error.message : "Falha ao carregar processos cadastrados.");
      }
    }
    void loadManualProcesses();
    return () => controller.abort();
  }, [importRefreshToken]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadEmpresaFacilProcesses() {
      try {
        const response = await fetch("/api/empresa-facil", { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as { records?: EmpresaFacilRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar os processos do Empresa Fácil.");
        setEmpresaFacilRecords(payload.records ?? []);
      } catch (error) {
        if (!controller.signal.aborted) setToast(error instanceof Error ? error.message : "Falha ao carregar os processos do Empresa Fácil.");
      }
    }
    void loadEmpresaFacilProcesses();
    return () => controller.abort();
  }, [importRefreshToken]);

  const tvEmpresaFacilProcesses = useMemo(
    () => empresaFacilRecords
      .filter((record) => !getState("empresa-facil", record.id)?.removed)
      .map((record) => empresaFacilToProcessRecord(
        record,
        Boolean(getState("empresa-facil", record.id)?.completed),
        assignments[assignmentKey("empresa-facil", record.id)],
      )),
    [assignments, empresaFacilRecords, getState],
  );

  const tvEmpresaFacilDistinctProcesses = useMemo(() => {
    const existingRequestCodes = new Set(visibleProcesses.map((process) => String(process.requestCode ?? "").replace(/\D/g, "")).filter(Boolean));
    return tvEmpresaFacilProcesses.filter((process) => !existingRequestCodes.has(String(process.requestCode ?? "").replace(/\D/g, "")));
  }, [tvEmpresaFacilProcesses, visibleProcesses]);

  const tvAllProcesses = useMemo(
    () => [...visibleProcesses, ...tvEmpresaFacilDistinctProcesses],
    [tvEmpresaFacilDistinctProcesses, visibleProcesses],
  );

  useEffect(() => {
    let active = true;
    async function crossEmpresaFacilCoordinates() {
      try {
        const lookup = await loadPropertyCoordinates(tvEmpresaFacilDistinctProcesses.map((process) => process.propertyRegistration));
        if (!active) return;
        const next = Object.fromEntries(tvEmpresaFacilDistinctProcesses.flatMap((process) => {
          const registration = normalizePropertyRegistration(process.propertyRegistration);
          const point = lookup.get(registration);
          if (!point) return [];
          const coordinate: CoordinateRecord = {
            processId: process.id,
            latitude: point.latitude,
            longitude: point.longitude,
            locationLabel: `Empresa Fácil · inscrição ${process.propertyRegistration} · base QGIS`,
            automatic: true,
            propertyRegistration: String(process.propertyRegistration ?? ""),
            updatedBy: "Base geográfica QGIS",
            createdAt: "",
            updatedAt: "",
          };
          return [[process.id, coordinate]];
        })) as Record<string, CoordinateRecord>;
        setEmpresaFacilCoordinates(next);
      } catch (error) {
        if (active) setToast(error instanceof Error ? error.message : "Falha ao localizar os processos do Empresa Fácil.");
      }
    }
    void crossEmpresaFacilCoordinates();
    return () => { active = false; };
  }, [tvEmpresaFacilDistinctProcesses]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadProcessEnrichments() {
      try {
        const response = await fetch("/api/process-enrichments", { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as { enrichments?: ProcessEnrichmentRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar dados extraídos dos processos.");
        setProcessEnrichments(Object.fromEntries((payload.enrichments ?? []).map((record) => [record.processId, record])));
      } catch (error) {
        if (!controller.signal.aborted) setToast(error instanceof Error ? error.message : "Falha ao carregar dados extraídos dos processos.");
      }
    }
    void loadProcessEnrichments();
    return () => controller.abort();
  }, [importRefreshToken]);

  useEffect(() => {
    if (activeModule !== "tv-panel") return;
    const interval = window.setInterval(() => setImportRefreshToken((current) => current + 1), 60_000);
    return () => window.clearInterval(interval);
  }, [activeModule]);

  useEffect(() => {
    let active = true;
    async function crossPropertyCoordinates() {
      try {
        const lookup = await loadPropertyCoordinates(processes.map((process) => process.propertyRegistration));
        if (!active) return;
        const next = Object.fromEntries(processes.flatMap((process) => {
          const registration = normalizePropertyRegistration(process.propertyRegistration);
          const point = lookup.get(registration);
          if (!point) return [];
          const coordinate: CoordinateRecord = {
            processId: process.id,
            latitude: point.latitude,
            longitude: point.longitude,
            locationLabel: `Inscrição ${process.propertyRegistration} · base QGIS`,
            automatic: true,
            propertyRegistration: String(process.propertyRegistration ?? ""),
            updatedBy: "Base geográfica QGIS",
            createdAt: "",
            updatedAt: "",
          };
          return [[process.id, coordinate]];
        })) as Record<string, CoordinateRecord>;
        setAutomaticCoordinates(next);
        const selected = coordinates[selectedProcessRef.current] ?? next[selectedProcessRef.current];
        if (selected) {
          setLatitude(String(selected.latitude));
          setLongitude(String(selected.longitude));
          setLocationLabel(selected.locationLabel);
        }
      } catch (error) {
        if (active) setCoordinateError(error instanceof Error ? error.message : "Falha no cruzamento automático por inscrição.");
      }
    }
    void crossPropertyCoordinates();
    return () => { active = false; };
  }, [coordinates, processes]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCoordinates() {
      setCoordinateStatus("loading");
      setCoordinateError("");
      try {
        const response = await fetch("/api/coordinates", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          coordinates?: CoordinateRecord[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar coordenadas.");
        const next = Object.fromEntries(
          (payload.coordinates ?? []).map((coordinate) => [coordinate.processId, coordinate]),
        );
        setCoordinates(next);
        const selectedCoordinate = next[selectedProcessRef.current];
        if (selectedCoordinate) {
          setLatitude(String(selectedCoordinate.latitude));
          setLongitude(String(selectedCoordinate.longitude));
          setLocationLabel(selectedCoordinate.locationLabel);
        }
        setCoordinateStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setCoordinateStatus("error");
        setCoordinateError(
          error instanceof Error ? error.message : "Falha ao carregar coordenadas.",
        );
      }
    }

    void loadCoordinates();
    return () => controller.abort();
  }, [importRefreshToken]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAssignments() {
      try {
        const response = await fetch("/api/assignments", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          assignments?: AssignmentRecord[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar responsáveis.");
        setAssignments(
          Object.fromEntries(
            (payload.assignments ?? []).map((assignment) => [
              assignmentKey(assignment.module, assignment.itemId),
              assignment,
            ]),
          ),
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setToast(error instanceof Error ? error.message : "Falha ao carregar responsáveis.");
      }
    }

    void loadAssignments();
    return () => controller.abort();
  }, [importRefreshToken]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredProcesses = useMemo(() => {
    const normalizedQuery = normalizeSearch(search.trim());
    return visibleProcesses.filter((process) => {
      if (areaFilter !== "all" && process.area !== areaFilter) return false;
      if (categoryFilter !== "all" && process.category !== categoryFilter) return false;
      if (statusFilter === "__active" && process.operationalState !== "Em andamento") return false;
      if (statusFilter === "__closed" && process.operationalState !== "Encerrado") return false;
      if (
        !statusFilter.startsWith("__") &&
        statusFilter !== "all" &&
        process.status !== statusFilter
      ) {
        return false;
      }
      if (monthFilter !== "all" && process.openedMonth !== monthFilter) return false;
      if (deadlineOnly && process.deadlineState !== "Prazo vencido") return false;
      if (!normalizedQuery) return true;
      const haystack = normalizeSearch(
        [
          process.id,
          process.displayId,
          process.requestCode,
          process.area,
          process.applicant,
          process.companyName,
          process.cnpj,
          process.category,
          process.actionType,
          process.activityDescription,
          process.riskLevel,
          process.propertyRegistration,
          process.lot,
          process.block,
          process.neighborhood,
          process.address,
          process.postalCode,
          process.requestDescription,
          process.status,
          process.observation,
          assignments[assignmentKey("processes", process.id)]?.responsible,
        ].join(" "),
      );
      return haystack.includes(normalizedQuery);
    });
  }, [
    areaFilter,
    assignments,
    categoryFilter,
    deadlineOnly,
    monthFilter,
    visibleProcesses,
    search,
    statusFilter,
  ]);

  const monthlyData = useMemo(
    () =>
      months.map((key) => ({
        key,
        label: monthLabel(key),
        value: filteredProcesses.filter((process) => process.openedMonth === key).length,
      })),
    [filteredProcesses, months],
  );
  const categoryData = useMemo(() => [...new Set(filteredProcesses.map((process) => process.category))].map((label) => ({ label, value: filteredProcesses.filter((process) => process.category === label).length })).sort((a, b) => b.value - a.value).slice(0, 12), [filteredProcesses]);
  const actionData = useMemo(() => [...new Set(filteredProcesses.map((process) => process.actionType || "Sem ação informada"))].map((label) => ({ label, value: filteredProcesses.filter((process) => (process.actionType || "Sem ação informada") === label).length, color: "#a78bfa" })).sort((a, b) => b.value - a.value).slice(0, 12), [filteredProcesses]);
  const activeCount = filteredProcesses.filter(
    (process) => process.operationalState === "Em andamento",
  ).length;
  const closedCount = filteredProcesses.filter(
    (process) => process.operationalState === "Encerrado",
  ).length;
  const cancelledCount = filteredProcesses.filter(
    (process) => process.operationalState === "Cancelado",
  ).length;
  const closedComparable = filteredProcesses.filter((process) =>
    process.deadlineState === "Encerrado no prazo" || process.deadlineState === "Encerrado após o prazo",
  );
  const onTimeRate = closedComparable.length
    ? closedComparable.filter((process) => process.deadlineState === "Encerrado no prazo").length /
      closedComparable.length
    : null;
  const overdueCount = filteredProcesses.filter(
    (process) => process.deadlineState === "Prazo vencido",
  ).length;
  const resolvedCoordinates = useMemo(() => ({ ...automaticCoordinates, ...coordinates, ...lookupCoordinates }), [automaticCoordinates, coordinates, lookupCoordinates]);
  const automaticCoordinateCount = useMemo(() => filteredProcesses.filter((process) => automaticCoordinates[process.id] && !coordinates[process.id]).length, [automaticCoordinates, coordinates, filteredProcesses]);
  const mappedProcesses = useMemo(
    () =>
      filteredProcesses
        .filter((process) => resolvedCoordinates[process.id])
        .map((process) => ({ process, coordinate: resolvedCoordinates[process.id] })) as MappedProcess[],
    [resolvedCoordinates, filteredProcesses],
  );
  const tvMappedProcesses = useMemo(
    () => [
      ...visibleProcesses.filter((process) => resolvedCoordinates[process.id]).map((process) => ({ process, coordinate: resolvedCoordinates[process.id] })),
      ...tvEmpresaFacilDistinctProcesses.filter((process) => empresaFacilCoordinates[process.id]).map((process) => ({ process, coordinate: empresaFacilCoordinates[process.id] })),
    ] as MappedProcess[],
    [empresaFacilCoordinates, resolvedCoordinates, tvEmpresaFacilDistinctProcesses, visibleProcesses],
  );
  const selectedProcess = visibleProcesses.find((process) => process.id === selectedProcessId);
  const selectedManualCoordinate = coordinates[selectedProcessId];
  const selectedCoordinate = resolvedCoordinates[selectedProcessId];
  const hasCoordinateDraft = latitude.trim() !== "" && longitude.trim() !== "";
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  const distanceFromCenter =
    hasCoordinateDraft && Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude)
      ? haversineDistance(
          APUCARANA_CENTER.latitude,
          APUCARANA_CENTER.longitude,
          parsedLatitude,
          parsedLongitude,
        )
      : null;
  const totalPages = Math.max(1, Math.ceil(filteredProcesses.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredProcesses.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const sparkValues = monthlyData.map((item) => item.value);
  const allVisibleProcessesSelected =
    visibleRows.length > 0 && visibleRows.every((process) => selectedProcessIds.has(process.id));

  useEffect(() => {
    if (!visibleProcesses.length || visibleProcesses.some((process) => process.id === selectedProcessId)) return;
    const process = visibleProcesses[0];
    const timer = window.setTimeout(() => {
      selectedProcessRef.current = process.id;
      setSelectedProcessId(process.id);
      const coordinate = resolvedCoordinates[process.id];
      setLatitude(coordinate ? String(coordinate.latitude) : "");
      setLongitude(coordinate ? String(coordinate.longitude) : "");
      setLocationLabel(coordinate?.locationLabel ?? "");
      setCoordinateRegistration(String(process.propertyRegistration ?? ""));
      setCoordinateZone("");
      setCoordinateLookupMessage("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedCoordinates, selectedProcessId, visibleProcesses]);

  const registerMapCapture = useCallback((capture: (() => Promise<Blob | null>) | null) => {
    mapCaptureRef.current = capture;
  }, []);

  const openModule = useCallback((module: DashboardModule) => {
    setActiveModule(module);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const selectProcess = useCallback(
    (processId: string, scrollToMap = false) => {
      selectedProcessRef.current = processId;
      setSelectedProcessId(processId);
      const coordinate = resolvedCoordinates[processId];
      setLatitude(coordinate ? String(coordinate.latitude) : "");
      setLongitude(coordinate ? String(coordinate.longitude) : "");
      setLocationLabel(coordinate?.locationLabel ?? "");
      setCoordinateRegistration(String(processes.find((process) => process.id === processId)?.propertyRegistration ?? ""));
      setCoordinateZone("");
      setCoordinateLookupMessage("");
      setCoordinateError("");
      if (scrollToMap) {
        window.setTimeout(
          () => mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
          0,
        );
      }
    },
    [processes, resolvedCoordinates],
  );

  const pickCoordinate = useCallback((nextLatitude: number, nextLongitude: number) => {
    setLatitude(nextLatitude.toFixed(6));
    setLongitude(nextLongitude.toFixed(6));
  }, []);

  function clearFilters() {
    setAreaFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setMonthFilter("all");
    setSearch("");
    setDeadlineOnly(false);
    setPage(1);
  }

  const assignResponsible: AssignResponsible = useCallback(
    async (module, itemIds, responsible) => {
      setSavingAssignments(true);
      try {
        const response = await fetch("/api/assignments", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ module, itemIds, responsible }),
        });
        const payload = (await response.json()) as {
          assignments?: AssignmentRecord[];
          cleared?: string[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível salvar o responsável.");

        setAssignments((current) => {
          const next = { ...current };
          for (const itemId of payload.cleared ?? []) {
            delete next[assignmentKey(module, itemId)];
          }
          for (const assignment of payload.assignments ?? []) {
            next[assignmentKey(assignment.module, assignment.itemId)] = assignment;
          }
          return next;
        });
        setToast(
          responsible
            ? `${itemIds.length} registro${itemIds.length === 1 ? "" : "s"} atribuído${itemIds.length === 1 ? "" : "s"} a ${responsible}.`
            : `Responsável removido de ${itemIds.length} registro${itemIds.length === 1 ? "" : "s"}.`,
        );
        return true;
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Não foi possível salvar o responsável.");
        return false;
      } finally {
        setSavingAssignments(false);
      }
    },
    [],
  );

  function toggleProcessSelection(processId: string) {
    setSelectedProcessIds((current) => {
      const next = new Set(current);
      if (next.has(processId)) next.delete(processId);
      else next.add(processId);
      return next;
    });
  }

  function toggleVisibleProcessSelection() {
    setSelectedProcessIds((current) => {
      const next = new Set(current);
      for (const process of visibleRows) {
        if (allVisibleProcessesSelected) next.delete(process.id);
        else next.add(process.id);
      }
      return next;
    });
  }

  async function applyBulkProcessAssignment() {
    const itemIds = [...selectedProcessIds];
    if (!itemIds.length) return;
    if (await assignResponsible("processes", itemIds, bulkProcessResponsible)) {
      setSelectedProcessIds(new Set());
    }
  }

  async function deleteManualProcess(process: ProcessRecord) {
    if (!process.manual) return;
    const label = process.displayId ?? process.id;
    if (!window.confirm(`Excluir o processo “${label}”?`)) return;
    setDeletingProcessId(process.id);
    try {
      const response = await fetch("/api/manual-processes", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: process.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir o processo.");
      setManualProcessRecords((current) => current.filter((record) => record.id !== process.id));
      setSelectedProcessIds((current) => {
        const next = new Set(current);
        next.delete(process.id);
        return next;
      });
      setCoordinates((current) => {
        const next = { ...current };
        delete next[process.id];
        return next;
      });
      if (selectedProcessId === process.id && dataset.processes[0]) selectProcess(dataset.processes[0].id);
      setToast(`Processo ${label} excluído.`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Não foi possível excluir o processo.");
    } finally {
      setDeletingProcessId("");
    }
  }

  async function saveCoordinate() {
    if (!selectedProcess) return;
    if (
      latitude.trim() === "" ||
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90
    ) {
      setCoordinateError("Informe uma latitude válida entre -90 e 90.");
      return;
    }
    if (
      longitude.trim() === "" ||
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      setCoordinateError("Informe uma longitude válida entre -180 e 180.");
      return;
    }

    setSavingCoordinate(true);
    setCoordinateError("");
    try {
      const response = await fetch("/api/coordinates", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          processId: selectedProcess.id,
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          locationLabel,
        }),
      });
      const payload = (await response.json()) as {
        coordinate?: CoordinateRecord;
        error?: string;
      };
      if (!response.ok || !payload.coordinate) {
        throw new Error(payload.error ?? "Não foi possível salvar a coordenada.");
      }
      setCoordinates((current) => ({
        ...current,
        [selectedProcess.id]: payload.coordinate!,
      }));
      setLookupCoordinates((current) => {
        const next = { ...current };
        delete next[selectedProcess.id];
        return next;
      });
      setCoordinateStatus("ready");
      setToast(`Coordenadas do processo ${selectedProcess.id} salvas.`);
    } catch (error) {
      setCoordinateError(
        error instanceof Error ? error.message : "Não foi possível salvar a coordenada.",
      );
    } finally {
      setSavingCoordinate(false);
    }
  }

  async function searchRegistrationLocation() {
    if (!selectedProcess) return;
    if (normalizePropertyRegistration(coordinateRegistration).length < 4) {
      setCoordinateLookupMessage("Digite ao menos quatro números da inscrição imobiliária.");
      return;
    }
    setSearchingRegistration(true);
    setCoordinateError("");
    setCoordinateLookupMessage("Buscando imóvel, zoneamento e coordenadas…");
    try {
      const property = await lookupPropertyByRegistration(coordinateRegistration);
      if (!property) {
        setCoordinateZone("");
        setCoordinateLookupMessage("Inscrição imobiliária não encontrada na base cadastral.");
        return;
      }
      setCoordinateZone(property.zone || "Sem zona vinculada");
      if (property.latitude == null || property.longitude == null) {
        setCoordinateLookupMessage(`Inscrição localizada no zoneamento ${property.zone || "não informado"}, mas sem coordenadas QGIS.`);
        return;
      }
      const label = [
        `Inscrição ${property.registration}`,
        property.zone ? `zona ${property.zone}` : "",
        [property.street, property.number].filter(Boolean).join(", "),
      ].filter(Boolean).join(" · ");
      const coordinate: CoordinateRecord = {
        processId: selectedProcess.id,
        latitude: property.latitude,
        longitude: property.longitude,
        locationLabel: label,
        automatic: true,
        propertyRegistration: property.registration,
        updatedBy: "Base cadastral e QGIS",
        createdAt: "",
        updatedAt: "",
      };
      setLookupCoordinates((current) => ({ ...current, [selectedProcess.id]: coordinate }));
      setLatitude(property.latitude.toFixed(6));
      setLongitude(property.longitude.toFixed(6));
      setLocationLabel(label);
      setCoordinateLookupMessage(`Localização encontrada e exibida no mapa · zoneamento ${property.zone || "não informado"}.`);
    } catch (error) {
      setCoordinateLookupMessage(error instanceof Error ? error.message : "Não foi possível buscar a inscrição.");
    } finally {
      setSearchingRegistration(false);
    }
  }

  async function removeCoordinate() {
    if (!selectedProcess || !selectedManualCoordinate) return;
    setSavingCoordinate(true);
    setCoordinateError("");
    try {
      const response = await fetch("/api/coordinates", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ processId: selectedProcess.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível remover a coordenada.");
      setCoordinates((current) => {
        const next = { ...current };
        delete next[selectedProcess.id];
        return next;
      });
      const automatic = automaticCoordinates[selectedProcess.id];
      setLatitude(automatic ? String(automatic.latitude) : "");
      setLongitude(automatic ? String(automatic.longitude) : "");
      setLocationLabel(automatic?.locationLabel ?? "");
      setToast(automatic ? `Coordenada manual removida; o processo ${selectedProcess.id} voltou à localização automática.` : `Coordenadas do processo ${selectedProcess.id} removidas.`);
    } catch (error) {
      setCoordinateError(
        error instanceof Error ? error.message : "Não foi possível remover a coordenada.",
      );
    } finally {
      setSavingCoordinate(false);
    }
  }

  function exportFilteredProcesses() {
    const header = [
      "Processo / protocolo",
      "Código da solicitação",
      "Responsável",
      "Área",
      "Requerente",
      "Empresa / razão social",
      "CNPJ",
      "Categoria",
      "Tipo de ação",
      "Grau de risco",
      "Atividade principal",
      "Inscrição imobiliária",
      "Lote",
      "Quadra",
      "Bairro",
      "Endereço",
      "CEP",
      "Solicitação extraída",
      "Situação",
      "Data de abertura",
      "Recebimento pelo servidor",
      "Previsão de encerramento",
      "Condição do prazo",
      "Latitude",
      "Longitude",
      "Referência do local",
      "Observação",
    ];
    const rows = filteredProcesses.map((process) => {
      const coordinate = resolvedCoordinates[process.id];
      return [
        process.displayId ?? process.id,
        process.requestCode,
        assignments[assignmentKey("processes", process.id)]?.responsible,
        process.area,
        process.applicant,
        process.companyName,
        process.cnpj,
        process.category,
        process.actionType,
        process.riskLevel,
        process.activityDescription,
        process.propertyRegistration,
        process.lot,
        process.block,
        process.neighborhood,
        process.address,
        process.postalCode,
        process.requestDescription,
        process.status,
        process.openedAt,
        process.receivedAt,
        process.plannedCloseAt,
        process.deadlineState,
        coordinate?.latitude,
        coordinate?.longitude,
        coordinate?.locationLabel,
        process.observation,
      ];
    });
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "processos-municipais-apucarana.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`dashboard-app ${activeModule === "tv-panel" ? "tv-mode" : ""}`}>
      <aside className="side-rail" aria-label="Navegação do painel">
        <div className="brand-logos" aria-label="Prefeitura de Apucarana e IDEPPLAN">
          <img src="/prefeitura-apucarana.png" alt="Prefeitura de Apucarana" />
          <img src="/idepplan-2026.png" alt="IDEPPLAN" />
        </div>
        <button className="rail-mark" type="button" onClick={() => openModule("processes")} aria-label="Central Analítica">
          <span />
          <span />
          <span />
          <span />
        </button>
        <nav>
          <button className={activeModule === "processes" ? "active" : ""} type="button" onClick={() => openModule("processes")} title="Processos">
            <LayoutDashboard size={22} />
            <span>Processos</span>
          </button>
          <button className={activeModule === "tv-panel" ? "active" : ""} type="button" onClick={() => openModule("tv-panel")} title="Painel TV para acompanhamento público">
            <Monitor size={22} />
            <span>Painel TV</span>
          </button>
          <button className={activeModule === "projects" ? "active" : ""} type="button" onClick={() => openModule("projects")} title="Projetos">
            <FolderKanban size={22} />
            <span>Projetos</span>
          </button>
          <button className={activeModule === "procurement" ? "active" : ""} type="button" onClick={() => openModule("procurement")} title="Licitações">
            <Gavel size={22} />
            <span>Licitações</span>
          </button>
          <button className={activeModule === "agenda" ? "active" : ""} type="button" onClick={() => openModule("agenda")} title="Agenda">
            <CalendarDays size={22} />
            <span>Agenda</span>
          </button>
          <button className={activeModule === "geoprocessing" ? "active" : ""} type="button" onClick={() => openModule("geoprocessing")} title="Demandas de Geoprocessamento">
            <ListTodo size={22} />
            <span>Geoprocessamento</span>
          </button>
          <button className={activeModule === "empresa-facil" ? "active" : ""} type="button" onClick={() => openModule("empresa-facil")} title="Empresa Fácil">
            <Building2 size={22} />
            <span>Empresa Fácil</span>
          </button>
          <button className={activeModule === "consultation" ? "active" : ""} type="button" onClick={() => openModule("consultation")} title="Consulta Geral">
            <Search size={22} />
            <span>Consulta Geral</span>
          </button>
          <button className={activeModule === "festivals" ? "active" : ""} type="button" onClick={() => openModule("festivals")} title="Festas">
            <Gift size={22} />
            <span>Festas</span>
          </button>
          <button className={activeModule === "staff-demands" ? "active" : ""} type="button" onClick={() => openModule("staff-demands")} title="Demandas por Servidor">
            <UsersRound size={22} />
            <span>Por Servidor</span>
          </button>
          <button className={activeModule === "master-plan" ? "active" : ""} type="button" onClick={() => openModule("master-plan")} title="Revisão do Plano Diretor">
            <FileClock size={22} />
            <span>Plano Diretor</span>
          </button>
          <button className={activeModule === "councils" ? "active" : ""} type="button" onClick={() => openModule("councils")} title="Conselhos e Comissões">
            <Landmark size={22} />
            <span>Conselhos</span>
          </button>
          <button className={activeModule === "pai" ? "active" : ""} type="button" onClick={() => openModule("pai")} title="PAI · Plano de Ação e Investimentos">
            <BarChart3 size={22} />
            <span>PAI</span>
          </button>
          <button className="rail-action-button" type="button" onClick={() => setReportImporterOpen(true)} title="Importar relatório">
            <UploadCloud size={22} />
            <span>Importar</span>
          </button>
          {activeModule === "processes" ? (
            <>
              <a href="#mapa" title="Mapa dos processos">
                <MapPinned size={22} />
                <span>Mapa</span>
              </a>
              <a href="#processos" title="Lista de processos">
                <FileText size={22} />
                <span>Lista</span>
              </a>
            </>
          ) : null}
        </nav>
        <div className="rail-bottom">
          <span title="Base compartilhada ativa">
            <Database size={21} />
          </span>
          <ThemeSwitcher />
          <button
            className="rail-logout"
            type="button"
            title="Sair do dashboard"
            aria-label="Sair do dashboard"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).finally(() =>
                window.location.replace("/login"),
              );
            }}
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        {activeModule !== "tv-panel" ? <div className="global-module-files">
          <ClearModuleButton
            module={moduleFiles[activeModule].module}
            moduleLabel={moduleFiles[activeModule].label}
            seedIds={activeModule === "processes" ? dataset.processes.map((process) => process.id) : activeModule === "projects" ? projectsDataset.projects.map((project) => project.id) : []}
            onCleared={() => setImportRefreshToken((current) => current + 1)}
          />
          <ItemFilesButton module={moduleFiles[activeModule].module} itemId="__module__" title={`Arquivos do módulo ${moduleFiles[activeModule].label}`} text />
        </div> : null}
        {activeModule === "tv-panel" ? (
          <TvProcessPanel
            processes={tvAllProcesses}
            mappedProcesses={tvMappedProcesses}
            mapTotalProcesses={tvAllProcesses.length}
            onExit={() => openModule("processes")}
            onRefresh={() => setImportRefreshToken((current) => current + 1)}
          />
        ) : activeModule === "processes" ? (
          <>
        {processFormOpen ? <ManualProcessForm
          open={processFormOpen}
          onClose={() => setProcessFormOpen(false)}
          onCreated={(record) => {
            setManualProcessRecords((current) => [record, ...current]);
            setToast(`Processo ${record.processNumber} cadastrado.`);
          }}
          onAssign={assignResponsible}
          assignmentSaving={savingAssignments}
        /> : null}
        <section id="visao-geral" className="dashboard-header">
          <div>
            <p className="eyebrow">Central analítica · gestão municipal</p>
            <h1>Painel de Processos Municipais</h1>
            <p>
              Urbanismo e abertura de empresas · {formatDate(openedDates[0])} a {formatDate(openedDates.at(-1))}
            </p>
          </div>
          <div className="header-actions">
            <span className={`database-chip ${coordinateStatus}`}>
              {coordinateStatus === "loading" ? <LoaderCircle size={15} className="spin" /> : <Database size={15} />}
              {coordinateStatus === "loading"
                ? "Conectando à base"
                : coordinateStatus === "ready"
                  ? "Base compartilhada ativa"
                  : "Base indisponível"}
            </span>
            <button className="icon-button export-button" type="button" onClick={exportFilteredProcesses}>
              <Download size={19} />
              <span>Exportar</span>
            </button>
            <button className="primary-button header-primary-button" type="button" onClick={() => setProcessFormOpen(true)}>
              <Plus size={18} /> Novo processo
            </button>
          </div>
        </section>

        <section className="filter-panel" aria-label="Filtros do dashboard">
          <label>
            <span>Área</span>
            <select value={areaFilter} onChange={(event) => { setAreaFilter(event.target.value); setPage(1); }}>
              <option value="all">Todas as áreas</option>
              {areas.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Categoria / ação</span>
            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}>
              <option value="all">Todas as categorias</option>
              {categories.filter((category) => !activeHiddenProcessTypes.has(category)).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <ProcessTypeVisibility
            options={processTypeOptions}
            hiddenTypes={activeHiddenProcessTypes}
            defaultMode={processVisibilityMode === "default"}
            onChange={(next) => {
              setProcessVisibilityMode("custom");
              setHiddenProcessTypes(next);
              if (categoryFilter !== "all" && next.has(categoryFilter)) setCategoryFilter("all");
              setSelectedProcessIds((current) => new Set([...current].filter((id) => {
                const process = processes.find((item) => item.id === id);
                return process && !next.has(process.category);
              })));
              setPage(1);
            }}
            onRestoreDefault={() => {
              setProcessVisibilityMode("default");
              setHiddenProcessTypes(new Set());
              if (categoryFilter !== "all" && !isDefaultActiveProcessType(categoryFilter)) setCategoryFilter("all");
              setPage(1);
            }}
          />
          <label>
            <span>Situação</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
              <option value="all">Todas as situações</option>
              <option value="__active">Todos em andamento</option>
              <option value="__closed">Todos encerrados</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Período</span>
            <select value={monthFilter} onChange={(event) => { setMonthFilter(event.target.value); setPage(1); }}>
              <option value="all">Todo o período</option>
              {months.map((month) => (
                <option key={month} value={month}>{monthLabel(month, "filter")}</option>
              ))}
            </select>
          </label>
          <label className="search-field">
            <span>Busca</span>
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Processo, CNPJ, requerente ou local"
            />
          </label>
          <button className="clear-filter" type="button" onClick={clearFilters} title="Limpar filtros">
            <FilterX size={18} />
            <span>Limpar</span>
          </button>
        </section>

        {deadlineOnly ? (
          <div className="active-filter-chip">
            Exibindo somente processos com prazo vencido
            <button type="button" onClick={() => { setDeadlineOnly(false); setPage(1); }}>Remover filtro</button>
          </div>
        ) : null}

        {activeHiddenProcessTypes.size ? (
          <div className="active-filter-chip visibility-filter-chip">
            <span><EyeOff size={16} /> {activeHiddenProcessTypes.size} tipo{activeHiddenProcessTypes.size === 1 ? "" : "s"} de processo oculto{activeHiddenProcessTypes.size === 1 ? "" : "s"} da lista, mapa e estatísticas</span>
            <button type="button" onClick={() => { setProcessVisibilityMode("custom"); setHiddenProcessTypes(new Set()); setPage(1); }}>Mostrar todos</button>
          </div>
        ) : null}

        <section id="indicadores" className="kpi-grid" aria-label="Indicadores principais">
          <button className="kpi-card" type="button" onClick={clearFilters}>
            <span className="kpi-icon"><CircleGauge size={19} /></span>
            <strong>{filteredProcesses.length}</strong>
            <span>processos</span>
            <Sparkline values={sparkValues} />
          </button>
          <button className="kpi-card" type="button" onClick={() => { setStatusFilter("__active"); setPage(1); }}>
            <span className="kpi-icon cyan"><LoaderCircle size={19} /></span>
            <strong>{activeCount}</strong>
            <span>em andamento</span>
            <Sparkline values={sparkValues.map((value, index) => Math.max(0, value - index))} />
          </button>
          <button className="kpi-card" type="button" onClick={() => { setStatusFilter("__closed"); setPage(1); }}>
            <span className="kpi-icon blue"><CheckCircle2 size={19} /></span>
            <strong>{closedCount}</strong>
            <span>encerrados</span>
            <Sparkline values={sparkValues.map((value, index) => Math.round(value * (0.45 + index * 0.06)))} />
          </button>
          <div className="kpi-card">
            <span className="kpi-icon green"><CheckCircle2 size={19} /></span>
            <strong>{onTimeRate == null ? "—" : formatPercent(onTimeRate)}</strong>
            <span>concluídos no prazo</span>
            <Sparkline values={sparkValues.map((value) => Math.round(value * (onTimeRate ?? 0)))} />
          </div>
        </section>

        <section className="analytics-grid">
          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Fluxo de demanda</p>
                <h2>Entradas por mês</h2>
              </div>
              <span>{filteredProcesses.length} registros filtrados</span>
            </div>
            <MonthlyAreaChart data={monthlyData} />
          </article>
          <article className="panel donut-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Carteira atual</p>
                <h2>Situação dos processos</h2>
              </div>
            </div>
            <StatusDonut
              data={[
                { label: "Em andamento", value: activeCount, color: "#22d3ee" },
                { label: "Encerrados", value: closedCount, color: "#3b82f6" },
                { label: "Cancelados", value: cancelledCount, color: "#58758c" },
              ]}
            />
          </article>
          <article className="panel distribution-panel"><div className="panel-heading"><div><p className="panel-kicker">Composição da carteira</p><h2>Processos por categoria</h2></div></div><DistributionBars data={categoryData} /></article>
          <article className="panel distribution-panel"><div className="panel-heading"><div><p className="panel-kicker">Tipos de atendimento</p><h2>Processos por ação</h2></div></div><DistributionBars data={actionData} /></article>
        </section>

        <button
          type="button"
          className="overdue-alert"
          onClick={() => { setDeadlineOnly(true); setPage(1); }}
          aria-label={`Visualizar ${overdueCount} processos recebidos pelo servidor há mais de 30 dias`}
        >
          <span className="alert-icon"><AlertTriangle size={30} /></span>
          <span><strong>{overdueCount}</strong> processos recebidos pelo servidor há mais de 30 dias</span>
          <span className="alert-cta">Ver processos <ChevronRight size={20} /></span>
        </button>

        <section id="mapa" ref={mapSectionRef} className="panel map-section">
          <div className="panel-heading map-heading">
            <div>
              <p className="panel-kicker">Georreferenciamento compartilhado</p>
              <h2>Mapa dos processos em Apucarana</h2>
              <p>As inscrições imobiliárias são cruzadas automaticamente com a base QGIS; coordenadas manuais continuam disponíveis como substituição.</p>
            </div>
            <div className="coverage-card">
              <span>Processos mapeados</span>
              <strong>{mappedProcesses.length} <small>de {filteredProcesses.length}</small></strong>
              <small>{automaticCoordinateCount} via inscrição imobiliária</small>
              <div><i style={{ width: `${filteredProcesses.length ? (mappedProcesses.length / filteredProcesses.length) * 100 : 0}%` }} /></div>
            </div>
          </div>

          <div className="map-grid">
            <ProcessMap
              markers={mappedProcesses}
              selectedProcessId={selectedProcessId}
              onPickCoordinate={pickCoordinate}
              onSelectProcess={(processId) => selectProcess(processId)}
              onCaptureApi={registerMapCapture}
            />

            <aside className="coordinate-editor" aria-label="Cadastro de coordenadas">
              <div className="editor-title">
                <MapPinned size={21} />
                <div>
                  <strong>Coordenadas do processo</strong>
                  <span>{selectedCoordinate?.automatic ? "Localização automática pela inscrição imobiliária" : "Dados salvos na base compartilhada"}</span>
                </div>
              </div>

              <label>
                <span>Processo selecionado</span>
                <select value={selectedProcessId} onChange={(event) => selectProcess(event.target.value)}>
                  {visibleProcesses.map((process) => (
                    <option key={process.id} value={process.id}>
                      {process.displayId ?? process.id} — {process.area} — {process.applicant}
                    </option>
                  ))}
                </select>
              </label>

              {selectedProcess ? (
                <div className="selected-process-summary">
                  <strong>{selectedProcess.applicant}</strong>
                  {selectedProcess.companyName ? <small>{selectedProcess.companyName}</small> : null}
                  <span>{selectedProcess.area} · {selectedProcess.category}</span>
                  <span className={`status-badge ${statusClass(selectedProcess.status)}`}>
                    {selectedProcess.status}
                  </span>
                </div>
              ) : null}

              <div className="coordinate-fields">
                <label>
                  <span>Latitude</span>
                  <input
                    inputMode="decimal"
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value.replace(",", "."))}
                    placeholder="-23.550500"
                  />
                </label>
                <label>
                  <span>Longitude</span>
                  <input
                    inputMode="decimal"
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value.replace(",", "."))}
                    placeholder="-51.461400"
                  />
                </label>
              </div>

              <label>
                <span>Referência do local <small>opcional</small></span>
                <input
                  value={locationLabel}
                  onChange={(event) => setLocationLabel(event.target.value)}
                  maxLength={180}
                  placeholder="Ex.: Jardim Aviação, lote 19"
                />
              </label>

              <label>
                <span>Inscrição imobiliária</span>
                <input
                  value={coordinateRegistration}
                  onChange={(event) => setCoordinateRegistration(event.target.value)}
                  placeholder="Ex.: 104.003.0070.001"
                />
              </label>

              <button type="button" className="registration-lookup-button" onClick={() => void searchRegistrationLocation()} disabled={searchingRegistration}>
                {searchingRegistration ? <LoaderCircle size={18} className="spin" /> : <MapPinned size={18} />}
                Buscar localização da inscrição
              </button>
              {coordinateZone ? <div className="coordinate-zone-result"><span>Zoneamento</span><ZoningBadge zone={coordinateZone} /></div> : null}
              {coordinateLookupMessage ? <p className="coordinate-lookup-message">{coordinateLookupMessage}</p> : null}

              {distanceFromCenter != null && distanceFromCenter > 60 ? (
                <div className="coordinate-warning">
                  <AlertTriangle size={17} />
                  A coordenada está a aproximadamente {Math.round(distanceFromCenter)} km do centro de Apucarana. Confira antes de salvar.
                </div>
              ) : null}

              {coordinateError ? <div className="form-error">{coordinateError}</div> : null}

              {selectedProcess ? (
                <div className="process-document-actions">
                  <ItemFilesButton
                    module="processes"
                    itemId={selectedProcess.id}
                    title={`Arquivos do processo ${selectedProcess.displayId ?? selectedProcess.id}`}
                    text
                    label="Anexar arquivos"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.xls,.xlsx,.csv,.txt,.md,.json,image/*"
                  />
                  <ProcessDocumentAnalyzer
                    process={selectedProcess}
                    onIntegrated={(record) => {
                      setProcessEnrichments((current) => ({ ...current, [record.processId]: record }));
                      if (record.propertyRegistration) setCoordinateRegistration(record.propertyRegistration);
                      setToast("Dados extraídos integrados ao processo; o mapa será atualizado pela inscrição imobiliária.");
                    }}
                  />
                </div>
              ) : null}

              {selectedProcess ? (
                <>
                  <ProcessDocumentGenerator
                    key={selectedProcess.id}
                    process={selectedProcess}
                    coordinate={selectedCoordinate}
                    zone={coordinateZone}
                    captureMap={async () => mapCaptureRef.current?.() ?? null}
                  />
                  <EivAnalyzer key={`eiv:${selectedProcess.id}`} process={selectedProcess} />
                </>
              ) : null}

              <div className="editor-actions">
                <button type="button" className="primary-button" onClick={saveCoordinate} disabled={savingCoordinate}>
                  {savingCoordinate ? <LoaderCircle size={18} className="spin" /> : <Save size={18} />}
                  {selectedManualCoordinate ? "Atualizar coordenadas" : selectedCoordinate?.automatic ? "Substituir coordenadas" : "Salvar coordenadas"}
                </button>
                {selectedManualCoordinate ? (
                  <button type="button" className="danger-button" onClick={removeCoordinate} disabled={savingCoordinate}>
                    <Trash2 size={17} /> Remover
                  </button>
                ) : null}
              </div>

              {selectedCoordinate ? (
                <div className="update-meta">
                  <Database size={15} />
                  <span>
                    {selectedCoordinate.automatic ? `Localização automática · inscrição ${selectedCoordinate.propertyRegistration}` : `Atualizado por ${selectedCoordinate.updatedBy || "usuário autorizado"}`}<br />
                    {selectedCoordinate.automatic ? "Fonte: Coordenadas_Inscricoes_QGIS.xlsx" : formatDateTime(selectedCoordinate.updatedAt)}
                  </span>
                </div>
              ) : (
                <p className="editor-help">Nenhuma coordenada cadastrada para este processo.</p>
              )}
            </aside>
          </div>
        </section>

        <section id="processos" className="panel process-section">
          <div className="panel-heading table-heading">
            <div>
              <p className="panel-kicker">Consulta detalhada</p>
              <h2>Processos</h2>
              <p>{filteredProcesses.length} resultado{filteredProcesses.length === 1 ? "" : "s"}</p>
            </div>
            <button type="button" className="secondary-button" onClick={exportFilteredProcesses}>
              <Download size={17} /> Exportar filtrados
            </button>
          </div>

          <BulkAssignmentBar
            selectedCount={selectedProcessIds.size}
            value={bulkProcessResponsible}
            onValueChange={setBulkProcessResponsible}
            onApply={() => void applyBulkProcessAssignment()}
            onClearSelection={() => setSelectedProcessIds(new Set())}
            disabled={savingAssignments}
          />

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="selection-column">
                    <SelectionIconButton
                      selected={allVisibleProcessesSelected}
                      onClick={toggleVisibleProcessSelection}
                      label={allVisibleProcessesSelected ? "Desmarcar processos desta página" : "Selecionar processos desta página"}
                      disabled={!visibleRows.length}
                    />
                  </th>
                  <th>Processo</th>
                  <th>Responsável</th>
                  <th>Área</th>
                  <th>Requerente</th>
                  <th>Categoria / ação</th>
                  <th>Situação</th>
                  <th>Abertura</th>
                  <th>Recebimento</th>
                  <th>Prazo</th>
                  <th>Mapa</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((process) => (
                  <tr key={process.id} className={`${selectedProcessIds.has(process.id) ? "row-selected" : ""} ${getState("processes", process.id)?.completed ? "row-completed" : ""}`}>
                    <td className="selection-column">
                      <SelectionIconButton
                        selected={selectedProcessIds.has(process.id)}
                        onClick={() => toggleProcessSelection(process.id)}
                        label={selectedProcessIds.has(process.id) ? `Desmarcar processo ${process.id}` : `Selecionar processo ${process.id}`}
                      />
                    </td>
                    <td>
                      <strong>{process.displayId ?? process.id}</strong>
                      {process.manual ? <small className="manual-record-label">Cadastro manual</small> : null}
                    </td>
                    <td>
                      <ResponsibleSelect
                        value={assignments[assignmentKey("processes", process.id)]?.responsible ?? ""}
                        onChange={(responsible) => void assignResponsible("processes", [process.id], responsible)}
                        disabled={savingAssignments}
                        ariaLabel={`Responsável pelo processo ${process.id}`}
                      />
                    </td>
                    <td>
                      <span className={`status-badge ${process.area === "Abertura de empresa" ? "badge-violet" : "badge-cyan"}`}>
                        {process.area}
                      </span>
                    </td>
                    <td>
                      <span className="applicant-cell" title={process.applicant}>{process.applicant}</span>
                      {process.companyName ? <small className="company-cell" title={process.companyName}>{process.companyName}</small> : null}
                    </td>
                    <td><span className="category-cell" title={process.category}>{process.category}</span></td>
                    <td><span className={`status-badge ${statusClass(process.status)}`}>{process.status}</span></td>
                    <td>{formatDate(process.openedAt)}</td>
                    <td>{formatDate(process.receivedAt)}</td>
                    <td><span className={`status-badge ${deadlineClass(process.deadlineState)}`}>{process.deadlineState}</span></td>
                    <td>
                      <span className={`map-status ${resolvedCoordinates[process.id] ? "mapped" : "unmapped"}`}>
                        <i /> {resolvedCoordinates[process.id] ? (resolvedCoordinates[process.id].automatic ? "Automático" : "Mapeado") : "Pendente"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="row-action" onClick={() => selectProcess(process.id, true)}>
                          <MapPinned size={16} /> {resolvedCoordinates[process.id] ? "Editar" : "Localizar"}
                        </button>
                        <ItemFilesButton module="processes" itemId={process.id} title={`Processo ${process.displayId ?? process.id}`} />
                        <ItemLifecycleActions module="processes" itemId={process.id} label={`o processo ${process.displayId ?? process.id}`} />
                        {process.manual ? (
                          <button type="button" className="row-action icon-row-action danger-row-action" onClick={() => void deleteManualProcess(process)} disabled={deletingProcessId === process.id} aria-label={`Excluir processo ${process.displayId ?? process.id}`} title="Excluir">
                            {deletingProcessId === process.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibleRows.length ? (
                  <tr>
                    <td colSpan={11} className="empty-state">Nenhum processo corresponde aos filtros selecionados.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>Página {currentPage} de {totalPages}</span>
            <div>
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Página anterior">
                <ChevronLeft size={18} />
              </button>
              <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages} aria-label="Próxima página">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>

        <footer className="dashboard-footer">
          <span>Fonte: cinco relatórios municipais consolidados · posição em 03/08/2026</span>
          <span>{visibleProcesses.length} de {processes.length} processos visíveis{activeHiddenProcessTypes.size ? ` · ${activeHiddenProcessTypes.size} tipo${activeHiddenProcessTypes.size === 1 ? "" : "s"} oculto${activeHiddenProcessTypes.size === 1 ? "" : "s"}` : ""}</span>
        </footer>
          </>
        ) : activeModule === "projects" ? (
          <ProjectsModule
            key={`projects-${importRefreshToken}`}
            dataset={projectsDataset}
            assignments={assignments}
            onAssign={assignResponsible}
            assignmentSaving={savingAssignments}
          />
        ) : activeModule === "procurement" ? (
          <ProcurementModule
            key={`procurements-${importRefreshToken}`}
            assignments={assignments}
            onAssign={assignResponsible}
            assignmentSaving={savingAssignments}
          />
        ) : activeModule === "agenda" ? (
          <AgendaModule
            key={`agenda-${importRefreshToken}`}
            assignments={assignments}
            onAssign={assignResponsible}
            assignmentSaving={savingAssignments}
          />
        ) : activeModule === "geoprocessing" ? (
          <GeoprocessingModule
            key={`geoprocessing-${importRefreshToken}`}
            assignments={assignments}
            onAssign={assignResponsible}
            assignmentSaving={savingAssignments}
          />
        ) : activeModule === "empresa-facil" ? (
          <EmpresaFacilModule
            key={`empresa-facil-${importRefreshToken}`}
            assignments={assignments}
            onAssign={assignResponsible}
            assignmentSaving={savingAssignments}
            onOpenImporter={() => setReportImporterOpen(true)}
            refreshToken={importRefreshToken}
          />
        ) : activeModule === "consultation" ? (
          <GeneralConsultationModule key={`consultation-${importRefreshToken}`} />
        ) : activeModule === "festivals" ? (
          <FestivalsModule key={`festivals-${importRefreshToken}`} />
        ) : activeModule === "staff-demands" ? (
          <StaffDemandsModule key={`staff-demands-${importRefreshToken}`} />
        ) : activeModule === "master-plan" ? (
          <MasterPlanModule key={`master-plan-${importRefreshToken}`} />
        ) : activeModule === "councils" ? (
          <CouncilsModule key={`councils-${importRefreshToken}`} />
        ) : (
          <PaiModule key={`pai-${importRefreshToken}`} />
        )}
        {activeModule !== "tv-panel" ? <ImportedReportData key={`imported-report-data-${activeModule}-${importRefreshToken}`} module={moduleFiles[activeModule].module} refreshToken={importRefreshToken} /> : null}
      </main>

      <ReportImportModal
        open={reportImporterOpen}
        onClose={() => setReportImporterOpen(false)}
        onImported={(summary, destination) => {
          setImportRefreshToken((current) => current + 1);
          setActiveModule(destination === "procurements" ? "procurement" : destination);
          const label = moduleFiles[destination === "procurements" ? "procurement" : destination].label;
          setToast(`${summary.rowCount} ${summary.rowCount === 1 ? "registro incorporado" : "registros incorporados"} em ${label}. Painel atualizado.`);
        }}
      />

      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        <CheckCircle2 size={18} /> {toast}
      </div>
    </div>
  );
}
