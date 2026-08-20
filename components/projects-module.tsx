"use client";

import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CircleDollarSign,
  Download,
  ExternalLink,
  FileText,
  FilterX,
  FolderKanban,
  LoaderCircle,
  MapPinned,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ManualProjectForm } from "@/components/manual-project-form";
import { ItemFilesButton, ItemLifecycleActions, useItemLifecycle } from "@/components/item-lifecycle";
import { ProjectMap } from "@/components/project-map";
import {
  BulkAssignmentBar,
  ResponsibleSelect,
  SelectionIconButton,
} from "@/components/responsibility-controls";
import { assignmentKey } from "@/lib/assignments";
import type {
  AssignmentMap,
  AssignResponsible,
  ManualProjectRecord,
  ProjectRecord,
  ProjectLocationRecord,
  ProjectsDataset,
  ProjectStage,
} from "@/lib/dashboard-types";
import { manualProjectToProjectRecord } from "@/lib/manual-records";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";
import { loadPropertyCoordinates, normalizePropertyRegistration } from "@/lib/property-coordinates-client";

const STAGES: ProjectStage[] = [
  "A iniciar",
  "Em desenvolvimento",
  "Aguardando dependência",
  "Em licitação",
];

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function stageClass(stage: ProjectStage) {
  if (stage === "Em desenvolvimento") return "badge-cyan";
  if (stage === "Aguardando dependência") return "badge-amber";
  if (stage === "Em licitação") return "badge-violet";
  return "badge-neutral";
}

function formatCurrency(value: number | null, compact = false) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatArea(project: ProjectRecord) {
  const parts = [];
  if (project.areaToBuildM2 != null) {
    parts.push(`${project.areaToBuildM2.toLocaleString("pt-BR")} m² construir`);
  }
  if (project.areaToRenovateM2 != null) {
    parts.push(`${project.areaToRenovateM2.toLocaleString("pt-BR")} m² reformar`);
  }
  return parts.join(" · ") || "—";
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

type ProjectsModuleProps = {
  dataset: ProjectsDataset;
  assignments: AssignmentMap;
  onAssign: AssignResponsible;
  assignmentSaving: boolean;
};

export function ProjectsModule({
  dataset,
  assignments,
  onAssign,
  assignmentSaving,
}: ProjectsModuleProps) {
  const { getState } = useItemLifecycle();
  const [stageFilter, setStageFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [bulkResponsible, setBulkResponsible] = useState("");
  const [manualProjectRecords, setManualProjectRecords] = useState<ManualProjectRecord[]>([]);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [moduleError, setModuleError] = useState("");
  const [locations, setLocations] = useState<Record<string, ProjectLocationRecord>>({});
  const [automaticLocations, setAutomaticLocations] = useState<Record<string, ProjectLocationRecord>>({});
  const selectedProjectRef = useRef(dataset.projects[0]?.id ?? "");
  const [selectedProjectId, setSelectedProjectId] = useState(dataset.projects[0]?.id ?? "");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const projects = useMemo(
    () => [...manualProjectRecords.map(manualProjectToProjectRecord), ...dataset.projects],
    [dataset.projects, manualProjectRecords],
  );
  const departments = useMemo(
    () => [...new Set(projects.map((project) => project.department).filter(Boolean))].sort() as string[],
    [projects],
  );

  useEffect(() => {
    const controller = new AbortController();
    async function loadManualProjects() {
      try {
        const response = await fetch("/api/manual-projects", { cache: "no-store", signal: controller.signal });
        const payload = (await response.json()) as { projects?: ManualProjectRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar projetos cadastrados.");
        setManualProjectRecords(payload.projects ?? []);
      } catch (error) {
        if (!controller.signal.aborted) setModuleError(error instanceof Error ? error.message : "Falha ao carregar projetos cadastrados.");
      }
    }
    void loadManualProjects();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    async function crossPropertyCoordinates() {
      try {
        const lookup = await loadPropertyCoordinates(projects.map((project) => project.propertyRegistration));
        if (!active) return;
        const next = Object.fromEntries(projects.flatMap((project) => {
          const registration = normalizePropertyRegistration(project.propertyRegistration);
          const point = lookup.get(registration);
          if (!point) return [];
          const location: ProjectLocationRecord = {
            projectId: project.id,
            latitude: point.latitude,
            longitude: point.longitude,
            locationLabel: `Inscrição ${project.propertyRegistration} · base QGIS`,
            automatic: true,
            propertyRegistration: String(project.propertyRegistration ?? ""),
            updatedBy: "Base geográfica QGIS",
            createdAt: "",
            updatedAt: "",
          };
          return [[project.id, location]];
        })) as Record<string, ProjectLocationRecord>;
        setAutomaticLocations(next);
        const selected = locations[selectedProjectRef.current] ?? next[selectedProjectRef.current];
        if (selected) { setLatitude(String(selected.latitude)); setLongitude(String(selected.longitude)); setLocationLabel(selected.locationLabel); }
      } catch (error) {
        if (active) setModuleError(error instanceof Error ? error.message : "Falha no cruzamento automático por inscrição.");
      }
    }
    void crossPropertyCoordinates();
    return () => { active = false; };
  }, [locations, projects]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/project-locations", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const payload = await response.json() as { locations?: ProjectLocationRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Falha ao carregar o mapa de projetos.");
      const next = Object.fromEntries((payload.locations ?? []).map((location) => [location.projectId, location]));
      setLocations(next);
      const selected = next[selectedProjectRef.current];
      if (selected) { setLatitude(String(selected.latitude)); setLongitude(String(selected.longitude)); setLocationLabel(selected.locationLabel); }
    }).catch((error) => { if (!controller.signal.aborted) setModuleError(error instanceof Error ? error.message : "Falha ao carregar o mapa de projetos."); });
    return () => controller.abort();
  }, []);

  const filteredProjects = useMemo(() => {
    const query = normalizeSearch(search.trim());
    return projects.filter((project) => {
      if (getState("projects", project.id)?.removed) return false;
      const assignedResponsible = assignments[assignmentKey("projects", project.id)]?.responsible ?? "";
      if (stageFilter !== "all" && project.stage !== stageFilter) return false;
      if (
        priorityFilter !== "all" &&
        (priorityFilter === "none" ? project.priority != null : String(project.priority) !== priorityFilter)
      ) {
        return false;
      }
      if (responsibleFilter === "__unassigned" && assignedResponsible) return false;
      if (
        responsibleFilter !== "all" &&
        responsibleFilter !== "__unassigned" &&
        assignedResponsible !== responsibleFilter
      ) return false;
      if (departmentFilter !== "all" && project.department !== departmentFilter) return false;
      if (!query) return true;
      return normalizeSearch(
        [
          project.project,
          assignedResponsible,
          project.responsible,
          project.department,
          project.currentStatus,
          project.process,
          project.propertyRegistration,
          project.dependency,
          project.fundingSource,
        ].join(" "),
      ).includes(query);
    });
  }, [
    assignments,
    departmentFilter,
    priorityFilter,
    responsibleFilter,
    search,
    stageFilter,
    projects,
    getState,
  ]);

  const resolvedLocations = useMemo(() => ({ ...automaticLocations, ...locations }), [automaticLocations, locations]);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedManualLocation = locations[selectedProjectId];
  const selectedLocation = resolvedLocations[selectedProjectId];
  const mappedProjects = filteredProjects.flatMap((project) => resolvedLocations[project.id] ? [{ project, location: resolvedLocations[project.id] }] : []);
  const automaticLocationCount = filteredProjects.filter((project) => automaticLocations[project.id] && !locations[project.id]).length;

  function selectProjectOnMap(projectId: string) {
    selectedProjectRef.current = projectId;
    setSelectedProjectId(projectId);
    const location = resolvedLocations[projectId];
    setLatitude(location ? String(location.latitude) : "");
    setLongitude(location ? String(location.longitude) : "");
    setLocationLabel(location?.locationLabel ?? "");
  }

  async function saveProjectLocation() {
    if (!selectedProject) return;
    const parsedLatitude = Number(latitude), parsedLongitude = Number(longitude);
    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) { setModuleError("Informe latitude e longitude válidas."); return; }
    setSavingLocation(true); setModuleError("");
    try {
      const response = await fetch("/api/project-locations", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: selectedProject.id, latitude: parsedLatitude, longitude: parsedLongitude, locationLabel }) });
      const payload = await response.json() as { location?: ProjectLocationRecord; error?: string };
      if (!response.ok || !payload.location) throw new Error(payload.error ?? "Não foi possível salvar a localização.");
      setLocations((current) => ({ ...current, [selectedProject.id]: payload.location! }));
    } catch (error) { setModuleError(error instanceof Error ? error.message : "Não foi possível salvar a localização."); }
    finally { setSavingLocation(false); }
  }

  async function removeProjectLocation() {
    if (!selectedProject || !selectedManualLocation) return;
    setSavingLocation(true);
    const response = await fetch("/api/project-locations", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: selectedProject.id }) });
    if (response.ok) { setLocations((current) => { const next = { ...current }; delete next[selectedProject.id]; return next; }); const automatic = automaticLocations[selectedProject.id]; setLatitude(automatic ? String(automatic.latitude) : ""); setLongitude(automatic ? String(automatic.longitude) : ""); setLocationLabel(automatic?.locationLabel ?? ""); }
    setSavingLocation(false);
  }

  const stageCounts = Object.fromEntries(
    STAGES.map((stage) => [stage, filteredProjects.filter((project) => project.stage === stage).length]),
  ) as Record<ProjectStage, number>;
  const informedValue = filteredProjects.reduce((sum, project) => sum + (project.value ?? 0), 0);
  const allFilteredProjectsSelected =
    filteredProjects.length > 0 &&
    filteredProjects.every((project) => selectedProjectIds.has(project.id));

  function clearFilters() {
    setStageFilter("all");
    setPriorityFilter("all");
    setResponsibleFilter("all");
    setDepartmentFilter("all");
    setSearch("");
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function toggleFilteredProjectSelection() {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      for (const project of filteredProjects) {
        if (allFilteredProjectsSelected) next.delete(project.id);
        else next.add(project.id);
      }
      return next;
    });
  }

  async function applyBulkAssignment() {
    const itemIds = [...selectedProjectIds];
    if (!itemIds.length) return;
    if (await onAssign("projects", itemIds, bulkResponsible)) {
      setSelectedProjectIds(new Set());
    }
  }

  async function deleteManualProject(project: ProjectRecord) {
    if (!project.manual || !window.confirm(`Excluir o projeto “${project.project}”?`)) return;
    setDeletingProjectId(project.id);
    setModuleError("");
    try {
      const response = await fetch("/api/manual-projects", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: project.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível excluir o projeto.");
      setManualProjectRecords((current) => current.filter((record) => record.id !== project.id));
      setSelectedProjectIds((current) => {
        const next = new Set(current);
        next.delete(project.id);
        return next;
      });
    } catch (error) {
      setModuleError(error instanceof Error ? error.message : "Não foi possível excluir o projeto.");
    } finally {
      setDeletingProjectId("");
    }
  }

  function exportFilteredProjects() {
    const header = [
      "Prioridade",
      "Projeto",
      "Área a construir (m²)",
      "Área a reformar (m²)",
      "Responsável atribuído",
      "Responsável na planilha-fonte",
      "Secretaria",
      "Prazo",
      "Etapa",
      "Situação atual",
      "Processo",
      "Inscrição imobiliária",
      "Latitude",
      "Longitude",
      "Dependência",
      "Fonte do recurso",
      "Valor",
    ];
    const rows = filteredProjects.map((project) => [
      project.priority,
      project.project,
      project.areaToBuildM2,
      project.areaToRenovateM2,
      assignments[assignmentKey("projects", project.id)]?.responsible,
      project.responsible,
      project.department,
      project.deadline,
      project.stage,
      project.currentStatus,
      project.process,
      project.propertyRegistration,
      resolvedLocations[project.id]?.latitude,
      resolvedLocations[project.id]?.longitude,
      project.dependency,
      project.fundingSource,
      project.value,
    ]);
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "controle-e-cronograma-de-projetos.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {projectFormOpen ? <ManualProjectForm
        open={projectFormOpen}
        onClose={() => setProjectFormOpen(false)}
        onCreated={(record) => setManualProjectRecords((current) => [record, ...current])}
        onAssign={onAssign}
        assignmentSaving={assignmentSaving}
      /> : null}
      <section className="dashboard-header module-header">
        <div>
          <p className="eyebrow">Central analítica · portfólio municipal</p>
          <h1>Controle e Cronograma de Projetos</h1>
          <p>{projects.length} iniciativas consolidadas por prioridade, etapa, responsável e secretaria.</p>
        </div>
        <div className="header-actions">
          <a className="database-chip ready source-chip" href={dataset.source.url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Abrir planilha-fonte
          </a>
          <button className="icon-button export-button" type="button" onClick={exportFilteredProjects}>
            <Download size={19} />
            <span>Exportar</span>
          </button>
          <button className="primary-button header-primary-button" type="button" onClick={() => setProjectFormOpen(true)}>
            <Plus size={18} /> Novo projeto
          </button>
        </div>
      </section>

      <section className="filter-panel project-filter-panel" aria-label="Filtros de projetos">
        <label>
          <span>Etapa</span>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
            <option value="all">Todas as etapas</option>
            {STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </label>
        <label>
          <span>Prioridade</span>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">Todas</option>
            <option value="1">Prioridade 1</option>
            <option value="2">Prioridade 2</option>
            <option value="none">Não classificada</option>
          </select>
        </label>
        <label>
          <span>Responsável</span>
          <select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="__unassigned">Não atribuído</option>
            {RESPONSIBLE_OPTIONS.map((responsible) => <option key={responsible} value={responsible}>{responsible}</option>)}
          </select>
        </label>
        <label>
          <span>Secretaria</span>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="all">Todas</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
        </label>
        <label className="search-field">
          <span>Busca</span>
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Projeto, processo ou situação"
          />
        </label>
        <button className="clear-filter" type="button" onClick={clearFilters} title="Limpar filtros">
          <FilterX size={18} /> <span>Limpar</span>
        </button>
      </section>

      <section className="kpi-grid project-kpi-grid" aria-label="Indicadores do portfólio de projetos">
        <button className="kpi-card" type="button" onClick={clearFilters}>
          <span className="kpi-icon"><FolderKanban size={19} /></span>
          <strong>{filteredProjects.length}</strong>
          <span>projetos</span>
          <small>{dataset.summary.total} na planilha-fonte</small>
        </button>
        <button className="kpi-card" type="button" onClick={() => setStageFilter("Em desenvolvimento")}>
          <span className="kpi-icon cyan"><CalendarClock size={19} /></span>
          <strong>{stageCounts["Em desenvolvimento"]}</strong>
          <span>em desenvolvimento</span>
          <small>{stageCounts["Em licitação"]} em licitação</small>
        </button>
        <button className="kpi-card" type="button" onClick={() => setStageFilter("Aguardando dependência")}>
          <span className="kpi-icon amber"><AlertTriangle size={19} /></span>
          <strong>{stageCounts["Aguardando dependência"]}</strong>
          <span>aguardando dependência</span>
          <small>gargalos externos ou internos</small>
        </button>
        <div className="kpi-card">
          <span className="kpi-icon green"><CircleDollarSign size={19} /></span>
          <strong>{formatCurrency(informedValue, true)}</strong>
          <span>valor informado</span>
          <small>{filteredProjects.filter((project) => project.value != null).length} projetos com valor</small>
        </div>
      </section>

      <div className="project-warning">
        <AlertTriangle size={20} />
        <span><strong>{projects.filter((project) => !project.deadline).length} projetos ainda não possuem prazo preenchido.</strong> O cronograma abaixo representa o fluxo operacional por etapa quando não há data contratual.</span>
      </div>

      {moduleError ? <div className="module-error"><AlertTriangle size={18} /> {moduleError}</div> : null}

      <section className="panel project-board-section">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Cronograma operacional</p>
            <h2>Fluxo por etapa</h2>
            <p>Distribuição dos projetos conforme a situação registrada na planilha.</p>
          </div>
          <span>{filteredProjects.length} registros filtrados</span>
        </div>
        <div className="project-board">
          {STAGES.map((stage) => {
            const stageProjects = filteredProjects.filter((project) => project.stage === stage);
            return (
              <article className="project-lane" key={stage}>
                <div className="project-lane-heading">
                  <span className={`status-badge ${stageClass(stage)}`}>{stage}</span>
                  <strong>{stageProjects.length}</strong>
                </div>
                <div className="project-lane-list">
                  {stageProjects.map((project) => (
                    <div className={`project-card ${getState("projects", project.id)?.completed ? "completed" : ""}`} key={project.id}>
                      <div className="project-card-topline">
                        <span>{project.priority ? `P${project.priority}` : "S/P"}</span>
                        {project.process ? <small><FileText size={12} /> {project.process}</small> : null}
                      </div>
                      <strong>{project.project}</strong>
                      {project.manual ? <small className="manual-record-label">Cadastro manual</small> : null}
                      <p>{project.currentStatus}</p>
                      <div className="project-card-meta">
                        <span>
                          <UserRound size={13} />
                          {assignments[assignmentKey("projects", project.id)]?.responsible ?? project.responsible ?? "Responsável não definido"}
                        </span>
                        <span><Building2 size={13} /> {project.department ?? "Secretaria não informada"}</span>
                      </div>
                      <div className="row-actions project-card-actions"><button className="row-action" type="button" onClick={() => selectProjectOnMap(project.id)}><MapPinned size={15}/> Localizar</button><ItemFilesButton module="projects" itemId={project.id} title={project.project}/><ItemLifecycleActions module="projects" itemId={project.id} label={`o projeto ${project.project}`}/></div>
                    </div>
                  ))}
                  {!stageProjects.length ? <div className="lane-empty">Nenhum projeto nesta etapa.</div> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel map-section project-location-section">
        <div className="panel-heading"><div><p className="panel-kicker">Visão territorial</p><h2>Mapa de projetos</h2><p>Imagem de satélite híbrida com cruzamento automático pela inscrição imobiliária e possibilidade de ajuste manual.</p></div><span>{mappedProjects.length} mapeado{mappedProjects.length === 1 ? "" : "s"} · {automaticLocationCount} automático{automaticLocationCount === 1 ? "" : "s"}</span></div>
        <div className="map-layout"><ProjectMap markers={mappedProjects} selectedProjectId={selectedProjectId} onSelectProject={selectProjectOnMap} onPickCoordinate={(lat, lng) => { setLatitude(lat.toFixed(6)); setLongitude(lng.toFixed(6)); }}/><aside className="coordinate-editor"><p className="panel-kicker">{selectedLocation?.automatic ? "Localização automática pela inscrição" : "Localização selecionada"}</p><label><span>Projeto</span><select value={selectedProjectId} onChange={(event) => selectProjectOnMap(event.target.value)}><option value="">Selecione</option>{filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.project}</option>)}</select></label><div className="coordinate-fields"><label><span>Latitude</span><input value={latitude} onChange={(event) => setLatitude(event.target.value.replace(",", "."))} placeholder="-23.550500"/></label><label><span>Longitude</span><input value={longitude} onChange={(event) => setLongitude(event.target.value.replace(",", "."))} placeholder="-51.461400"/></label></div><label><span>Referência do local</span><input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="Bairro, equipamento ou obra"/></label>{selectedLocation?.automatic ? <small className="automatic-coordinate-source">Fonte: Coordenadas_Inscricoes_QGIS.xlsx · inscrição {selectedLocation.propertyRegistration}</small> : null}<div className="editor-actions"><button className="primary-button" type="button" onClick={() => void saveProjectLocation()} disabled={!selectedProject || savingLocation}>{savingLocation ? <LoaderCircle size={18} className="spin"/> : <Save size={18}/>} {selectedManualLocation ? "Atualizar" : selectedLocation?.automatic ? "Substituir" : "Salvar"}</button>{selectedProject && selectedManualLocation ? <button className="danger-button" type="button" onClick={() => void removeProjectLocation()} disabled={savingLocation}><Trash2 size={16}/> Remover</button> : null}</div></aside></div>
      </section>

      <section className="panel process-section project-table-section">
        <div className="panel-heading table-heading">
          <div>
            <p className="panel-kicker">Carteira detalhada</p>
            <h2>Projetos</h2>
            <p>{filteredProjects.length} resultado{filteredProjects.length === 1 ? "" : "s"}</p>
          </div>
          <button type="button" className="secondary-button" onClick={exportFilteredProjects}>
            <Download size={17} /> Exportar filtrados
          </button>
        </div>
        <BulkAssignmentBar
          selectedCount={selectedProjectIds.size}
          value={bulkResponsible}
          onValueChange={setBulkResponsible}
          onApply={() => void applyBulkAssignment()}
          onClearSelection={() => setSelectedProjectIds(new Set())}
          disabled={assignmentSaving}
        />
        <div className="table-scroll">
          <table className="project-table">
            <thead>
              <tr>
                <th className="selection-column">
                  <SelectionIconButton
                    selected={allFilteredProjectsSelected}
                    onClick={toggleFilteredProjectSelection}
                    label={allFilteredProjectsSelected ? "Desmarcar projetos filtrados" : "Selecionar projetos filtrados"}
                    disabled={!filteredProjects.length}
                  />
                </th>
                <th>Projeto</th>
                <th>Responsável</th>
                <th>Prioridade</th>
                <th>Etapa</th>
                <th>Secretaria</th>
                <th>Situação atual</th>
                <th>Dependência</th>
                <th>Processo</th>
                <th>Área prevista</th>
                <th>Recurso</th>
                <th>Valor</th>
                <th>Prazo</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id} className={`${selectedProjectIds.has(project.id) ? "row-selected" : ""} ${getState("projects", project.id)?.completed ? "row-completed" : ""}`}>
                  <td className="selection-column">
                    <SelectionIconButton
                      selected={selectedProjectIds.has(project.id)}
                      onClick={() => toggleProjectSelection(project.id)}
                      label={selectedProjectIds.has(project.id) ? `Desmarcar projeto ${project.project}` : `Selecionar projeto ${project.project}`}
                    />
                  </td>
                  <td><strong>{project.project}</strong>{project.manual ? <small className="manual-record-label">Cadastro manual</small> : null}</td>
                  <td>
                    <ResponsibleSelect
                      value={assignments[assignmentKey("projects", project.id)]?.responsible ?? ""}
                      onChange={(responsible) => void onAssign("projects", [project.id], responsible)}
                      disabled={assignmentSaving}
                      sourceValue={project.responsible}
                      ariaLabel={`Responsável pelo projeto ${project.project}`}
                    />
                  </td>
                  <td>{project.priority ? <span className="priority-pill">P{project.priority}</span> : "—"}</td>
                  <td><span className={`status-badge ${stageClass(project.stage)}`}>{project.stage}</span></td>
                  <td>{project.department ?? "—"}</td>
                  <td><span className="project-status-cell" title={project.currentStatus}>{project.currentStatus}</span></td>
                  <td>{project.dependency ?? "—"}</td>
                  <td>{project.process ?? "—"}{project.propertyRegistration ? <small className="manual-record-label">Inscrição {project.propertyRegistration}</small> : null}</td>
                  <td>{formatArea(project)}</td>
                  <td>{project.fundingSource ?? "—"}</td>
                  <td>{formatCurrency(project.value)}</td>
                  <td>{project.deadline ? formatDate(project.deadline) : <span className="status-badge badge-amber">Não informado</span>}</td>
                  <td><div className="row-actions"><button className="row-action icon-row-action" type="button" onClick={() => selectProjectOnMap(project.id)} title="Localizar no mapa"><MapPinned size={15}/></button><ItemFilesButton module="projects" itemId={project.id} title={project.project}/><ItemLifecycleActions module="projects" itemId={project.id} label={`o projeto ${project.project}`}/>
                    {project.manual ? (
                      <button className="row-action icon-row-action danger-row-action" type="button" onClick={() => void deleteManualProject(project)} disabled={deletingProjectId === project.id} aria-label={`Excluir ${project.project}`} title="Excluir">
                        {deletingProjectId === project.id ? <LoaderCircle size={15} className="spin" /> : <Trash2 size={15} />}
                      </button>
                    ) : null}</div></td>
                </tr>
              ))}
              {!filteredProjects.length ? (
                <tr><td colSpan={14} className="empty-state">Nenhum projeto corresponde aos filtros selecionados.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>Fonte: {dataset.source.title} · aba {dataset.source.sheetName}</span>
        <span>{projects.length} projetos · {dataset.projects.length} importados + {manualProjectRecords.length} cadastrados</span>
      </footer>
    </>
  );
}
