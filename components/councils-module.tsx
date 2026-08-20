"use client";

import {
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  Landmark,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CouncilWorkspace } from "@/components/council-workspace";
import { ItemFilesButton } from "@/components/item-lifecycle";
import { SelectionIconButton } from "@/components/responsibility-controls";
import type {
  CouncilBodyRecord,
  CouncilMeetingRecord,
} from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type BodyDraft = Omit<
  CouncilBodyRecord,
  "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;
type MeetingDraft = Omit<
  CouncilMeetingRecord,
  "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;
const BODY_TYPES: BodyDraft["bodyType"][] = [
  "Conselho",
  "Comissão",
  "Comitê",
  "Grupo de Trabalho",
];
const BODY_STATUSES: BodyDraft["status"][] = [
  "Ativo",
  "Em renovação",
  "Inativo",
];
const MEETING_STATUSES: MeetingDraft["status"][] = [
  "Agendada",
  "Realizada",
  "Cancelada",
];
const today = () => new Date().toISOString().slice(0, 10);
const plusYear = () => {
  const value = new Date();
  value.setFullYear(value.getFullYear() + 2);
  return value.toISOString().slice(0, 10);
};
const defaultDateTime = () => {
  const value = new Date(Date.now() + 7 * 86_400_000);
  value.setHours(9, 0, 0, 0);
  return `${value.toISOString().slice(0, 10)}T09:00`;
};
const emptyBody = (): BodyDraft => ({
  name: "",
  acronym: "",
  bodyType: "Conselho",
  legalAct: "",
  purpose: "",
  responsible: RESPONSIBLE_OPTIONS[0],
  president: "",
  secretary: "",
  termStart: today(),
  termEnd: plusYear(),
  status: "Ativo",
  members: "",
  notes: "",
});
const emptyMeeting = (bodyId = ""): MeetingDraft => ({
  bodyId,
  title: "Reunião ordinária",
  meetingDate: defaultDateTime(),
  location: "",
  agenda: "",
  participants: "",
  quorum: "",
  deliberations: "",
  status: "Agendada",
  responsible: RESPONSIBLE_OPTIONS[0],
});
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export function CouncilsModule() {
  const [bodies, setBodies] = useState<CouncilBodyRecord[]>([]);
  const [meetings, setMeetings] = useState<CouncilMeetingRecord[]>([]);
  const [tab, setTab] = useState<"bodies" | "meetings">("bodies");
  const [bodyDraft, setBodyDraft] = useState<BodyDraft>(emptyBody);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>(() =>
    emptyMeeting(),
  );
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<"body" | "meeting" | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [workspaceBodyId, setWorkspaceBodyId] = useState("");
  const [todayKey] = useState(today);
  const [referenceTime] = useState(() => Date.now());
  const [renewalLimit] = useState(() =>
    new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10),
  );

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/council-bodies", {
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch("/api/council-meetings", {
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([bodyResponse, meetingResponse]) => {
        const bodyPayload = (await bodyResponse.json()) as {
          bodies?: CouncilBodyRecord[];
          error?: string;
        };
        const meetingPayload = (await meetingResponse.json()) as {
          meetings?: CouncilMeetingRecord[];
          error?: string;
        };
        if (!bodyResponse.ok) throw new Error(bodyPayload.error);
        if (!meetingResponse.ok) throw new Error(meetingPayload.error);
        setBodies(bodyPayload.bodies ?? []);
        setMeetings(meetingPayload.meetings ?? []);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Falha ao carregar conselhos e comissões.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const bodyNames = useMemo(
    () =>
      Object.fromEntries(
        bodies.map((body) => [body.id, body.acronym || body.name]),
      ),
    [bodies],
  );
  const filteredBodies = useMemo(
    () =>
      bodies.filter((body) => {
        if (filterStatus !== "all" && body.status !== filterStatus)
          return false;
        const query = normalize(search.trim());
        return (
          !query ||
          normalize(
            [
              body.name,
              body.acronym,
              body.bodyType,
              body.legalAct,
              body.purpose,
              body.responsible,
              body.president,
              body.members,
            ].join(" "),
          ).includes(query)
        );
      }),
    [bodies, filterStatus, search],
  );
  const filteredMeetings = useMemo(
    () =>
      meetings.filter((meeting) => {
        if (filterStatus !== "all" && meeting.status !== filterStatus)
          return false;
        const query = normalize(search.trim());
        return (
          !query ||
          normalize(
            [
              meeting.title,
              bodyNames[meeting.bodyId] ?? "",
              meeting.location,
              meeting.agenda,
              meeting.participants,
              meeting.deliberations,
              meeting.responsible,
            ].join(" "),
          ).includes(query)
        );
      }),
    [bodyNames, filterStatus, meetings, search],
  );
  const active = bodies.filter((body) => body.status === "Ativo").length;
  const upcoming = meetings.filter(
    (meeting) =>
      meeting.status === "Agendada" &&
      new Date(meeting.meetingDate).getTime() >= referenceTime,
  ).length;
  const renewal = bodies.filter(
    (body) =>
      body.status !== "Inativo" &&
      body.termEnd >= todayKey &&
      body.termEnd <= renewalLimit,
  ).length;
  const visibleIds =
    tab === "bodies"
      ? filteredBodies.map((body) => body.id)
      : filteredMeetings.map((meeting) => meeting.id);
  const allSelected =
    Boolean(visibleIds.length) && visibleIds.every((id) => selected.has(id));

  function setActiveTab(next: "bodies" | "meetings") {
    setTab(next);
    setSearch("");
    setFilterStatus("all");
    setSelected(new Set());
  }
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) =>
        allSelected ? next.delete(id) : next.add(id),
      );
      return next;
    });
  }
  function openBody(body?: CouncilBodyRecord) {
    setEditingId(body?.id ?? "");
    setBodyDraft(
      body
        ? {
            name: body.name,
            acronym: body.acronym,
            bodyType: body.bodyType,
            legalAct: body.legalAct,
            purpose: body.purpose,
            responsible: body.responsible,
            president: body.president,
            secretary: body.secretary,
            termStart: body.termStart,
            termEnd: body.termEnd,
            status: body.status,
            members: body.members,
            notes: body.notes,
          }
        : emptyBody(),
    );
    setForm("body");
  }
  function openMeeting(meeting?: CouncilMeetingRecord) {
    setEditingId(meeting?.id ?? "");
    setMeetingDraft(
      meeting
        ? {
            bodyId: meeting.bodyId,
            title: meeting.title,
            meetingDate: meeting.meetingDate.slice(0, 16),
            location: meeting.location,
            agenda: meeting.agenda,
            participants: meeting.participants,
            quorum: meeting.quorum,
            deliberations: meeting.deliberations,
            status: meeting.status,
            responsible: meeting.responsible,
          }
        : emptyMeeting(bodies[0]?.id),
    );
    setForm("meeting");
  }
  function closeForm() {
    setForm(null);
    setEditingId("");
    setError("");
  }

  async function saveBody(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/council-bodies", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...bodyDraft, id: editingId || undefined }),
      });
      const payload = (await response.json()) as {
        body?: CouncilBodyRecord;
        error?: string;
      };
      if (!response.ok || !payload.body)
        throw new Error(
          payload.error ?? "Não foi possível salvar o colegiado.",
        );
      setBodies((current) =>
        editingId
          ? current.map((body) =>
              body.id === editingId ? payload.body! : body,
            )
          : [payload.body!, ...current],
      );
      closeForm();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o colegiado.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveMeeting(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/council-meetings", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...meetingDraft, id: editingId || undefined }),
      });
      const payload = (await response.json()) as {
        meeting?: CouncilMeetingRecord;
        error?: string;
      };
      if (!response.ok || !payload.meeting)
        throw new Error(payload.error ?? "Não foi possível salvar a reunião.");
      setMeetings((current) =>
        editingId
          ? current.map((meeting) =>
              meeting.id === editingId ? payload.meeting! : meeting,
            )
          : [...current, payload.meeting!],
      );
      closeForm();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a reunião.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function updateBody(
    body: CouncilBodyRecord,
    patch: Partial<BodyDraft>,
  ) {
    const response = await fetch("/api/council-bodies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, ...patch }),
    });
    const payload = (await response.json()) as {
      body?: CouncilBodyRecord;
      error?: string;
    };
    if (response.ok && payload.body)
      setBodies((current) =>
        current.map((entry) => (entry.id === body.id ? payload.body! : entry)),
      );
    else setError(payload.error ?? "Não foi possível atualizar o colegiado.");
  }
  async function updateMeeting(
    meeting: CouncilMeetingRecord,
    patch: Partial<MeetingDraft>,
  ) {
    const response = await fetch("/api/council-meetings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...meeting, ...patch }),
    });
    const payload = (await response.json()) as {
      meeting?: CouncilMeetingRecord;
      error?: string;
    };
    if (response.ok && payload.meeting)
      setMeetings((current) =>
        current.map((entry) =>
          entry.id === meeting.id ? payload.meeting! : entry,
        ),
      );
    else setError(payload.error ?? "Não foi possível atualizar a reunião.");
  }
  async function remove(
    kind: "body" | "meeting",
    id: string,
    label: string,
    confirm = true,
  ) {
    if (confirm && !window.confirm(`Excluir “${label}”?`)) return;
    const response = await fetch(
      kind === "body" ? "/api/council-bodies" : "/api/council-meetings",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      },
    );
    if (response.ok) {
      if (kind === "body") {
        setBodies((current) => current.filter((entry) => entry.id !== id));
        setMeetings((current) =>
          current.filter((entry) => entry.bodyId !== id),
        );
      } else
        setMeetings((current) => current.filter((entry) => entry.id !== id));
    }
  }
  async function completeSelected() {
    setSaving(true);
    if (tab === "bodies") {
      for (const body of bodies.filter((entry) => selected.has(entry.id)))
        await updateBody(body, { status: "Inativo" });
    } else {
      for (const meeting of meetings.filter((entry) => selected.has(entry.id)))
        await updateMeeting(meeting, { status: "Realizada" });
    }
    setSelected(new Set());
    setSaving(false);
  }
  async function deleteSelected() {
    if (!window.confirm(`Excluir ${selected.size} registro(s) selecionado(s)?`))
      return;
    setSaving(true);
    if (tab === "bodies") {
      for (const body of bodies.filter((entry) => selected.has(entry.id)))
        await remove("body", body.id, body.name, false);
    } else {
      for (const meeting of meetings.filter((entry) => selected.has(entry.id)))
        await remove("meeting", meeting.id, meeting.title, false);
    }
    setSelected(new Set());
    setSaving(false);
  }

  const workspaceBody = bodies.find((body) => body.id === workspaceBodyId);
  if (workspaceBody)
    return (
      <CouncilWorkspace
        body={workspaceBody}
        onBack={() => setWorkspaceBodyId("")}
      />
    );

  return (
    <>
      <section className="dashboard-header module-header">
        <div>
          <p className="eyebrow">
            Governança colegiada · participação institucional
          </p>
          <h1>Conselhos e Comissões</h1>
          <p>
            Cadastro de colegiados, composição, mandatos, reuniões, pautas e
            deliberações.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => (tab === "bodies" ? openBody() : openMeeting())}
            disabled={tab === "meetings" && !bodies.length}
          >
            <Plus size={18} />{" "}
            {tab === "bodies" ? "Novo colegiado" : "Nova reunião"}
          </button>
        </div>
      </section>
      <section className="kpi-grid council-kpis">
        <div className="kpi-card">
          <span className="kpi-icon">
            <Landmark size={19} />
          </span>
          <strong>{bodies.length}</strong>
          <span>colegiados cadastrados</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon green">
            <UsersRound size={19} />
          </span>
          <strong>{active}</strong>
          <span>colegiados ativos</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon cyan">
            <CalendarCheck size={19} />
          </span>
          <strong>{upcoming}</strong>
          <span>reuniões agendadas</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-icon amber">
            <CalendarCheck size={19} />
          </span>
          <strong>{renewal}</strong>
          <span>mandatos a vencer</span>
        </div>
      </section>
      <div className="module-tabs">
        <button
          className={tab === "bodies" ? "active" : ""}
          onClick={() => setActiveTab("bodies")}
        >
          <Landmark size={17} /> Colegiados
        </button>
        <button
          className={tab === "meetings" ? "active" : ""}
          onClick={() => setActiveTab("meetings")}
        >
          <CalendarCheck size={17} /> Reuniões e deliberações
        </button>
      </div>
      <section className="filter-panel council-filters">
        <label className="search-field">
          <span>Buscar</span>
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              tab === "bodies"
                ? "Nome, ato legal, membro ou responsável"
                : "Reunião, pauta, participante ou deliberação"
            }
          />
        </label>
        <label>
          <span>Situação</span>
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="all">Todas</option>
            {(tab === "bodies" ? BODY_STATUSES : MEETING_STATUSES).map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
        </label>
      </section>
      {selected.size ? (
        <div className="bulk-module-actions">
          <strong>{selected.size}</strong>
          <span>selecionado{selected.size === 1 ? "" : "s"}</span>
          <button
            className="primary-button compact-button"
            disabled={saving}
            onClick={() => void completeSelected()}
          >
            <CheckCircle2 size={16} />{" "}
            {tab === "bodies" ? "Inativar" : "Marcar realizada"}
          </button>
          <button
            className="secondary-button compact-button danger-text"
            disabled={saving}
            onClick={() => void deleteSelected()}
          >
            <Trash2 size={16} /> Excluir
          </button>
          <button
            className="icon-only-button"
            onClick={() => setSelected(new Set())}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
      {error ? <div className="module-error">{error}</div> : null}
      <section className="panel process-section">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">
              {tab === "bodies"
                ? "Estrutura colegiada"
                : "Agenda e memória decisória"}
            </p>
            <h2>
              {tab === "bodies"
                ? "Conselhos, comissões e comitês"
                : "Reuniões, pautas e deliberações"}
            </h2>
            <p>
              {tab === "bodies"
                ? filteredBodies.length
                : filteredMeetings.length}{" "}
              registro
              {(tab === "bodies"
                ? filteredBodies.length
                : filteredMeetings.length) === 1
                ? ""
                : "s"}
            </p>
          </div>
        </div>
        <div className="table-scroll">
          {tab === "bodies" ? (
            <table>
              <thead>
                <tr>
                  <th className="selection-column">
                    <SelectionIconButton
                      selected={allSelected}
                      onClick={toggleAll}
                      label="Selecionar colegiados visíveis"
                    />
                  </th>
                  <th>Colegiado</th>
                  <th>Ato / finalidade</th>
                  <th>Coordenação</th>
                  <th>Mandato</th>
                  <th>Responsável</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredBodies.map((body) => (
                  <tr
                    key={body.id}
                    className={body.status === "Inativo" ? "row-completed" : ""}
                  >
                    <td>
                      <SelectionIconButton
                        selected={selected.has(body.id)}
                        onClick={() => toggle(body.id)}
                        label={`Selecionar ${body.name}`}
                      />
                    </td>
                    <td>
                      <button
                        className="council-open-link"
                        type="button"
                        onClick={() => setWorkspaceBodyId(body.id)}
                      >
                        <strong>{body.name}</strong>
                        <ArrowUpRight size={15} />
                      </button>
                      <small>
                        {body.bodyType}
                        {body.acronym ? ` · ${body.acronym}` : ""}
                      </small>
                    </td>
                    <td>
                      <strong>{body.legalAct || "Ato não informado"}</strong>
                      <small>
                        {body.purpose || "Finalidade não informada"}
                      </small>
                    </td>
                    <td>
                      <strong>
                        {body.president || "Presidência não informada"}
                      </strong>
                      <small>Secretaria: {body.secretary || "—"}</small>
                    </td>
                    <td>
                      <strong>{date(body.termStart)}</strong>
                      <small>até {date(body.termEnd)}</small>
                    </td>
                    <td>{body.responsible}</td>
                    <td>
                      <span
                        className={`status-badge ${body.status === "Ativo" ? "badge-green" : body.status === "Em renovação" ? "badge-amber" : "badge-slate"}`}
                      >
                        {body.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions council-actions">
                        <button
                          className="secondary-button compact-button council-open-button"
                          type="button"
                          onClick={() => setWorkspaceBodyId(body.id)}
                        >
                          Abrir módulo <ArrowUpRight size={14} />
                        </button>
                        <button
                          className="row-action icon-row-action"
                          onClick={() =>
                            void updateBody(body, {
                              status:
                                body.status === "Inativo" ? "Ativo" : "Inativo",
                            })
                          }
                          title={
                            body.status === "Inativo" ? "Reativar" : "Inativar"
                          }
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <ItemFilesButton
                          module="councils"
                          itemId={`cover:${body.id}`}
                          title={`Capa e logotipo · ${body.name}`}
                          text
                          label="Capa"
                          accept="image/png,image/jpeg,application/pdf"
                        />
                        <ItemFilesButton
                          module="councils"
                          itemId={`body:${body.id}`}
                          title={`Documentos · ${body.name}`}
                        />
                        <button
                          className="row-action icon-row-action"
                          onClick={() => openBody(body)}
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="row-action icon-row-action danger-row-action"
                          onClick={() =>
                            void remove("body", body.id, body.name)
                          }
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredBodies.length ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      {loading ? (
                        <>
                          <LoaderCircle className="spin" /> Carregando…
                        </>
                      ) : (
                        "Nenhum colegiado cadastrado."
                      )}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th className="selection-column">
                    <SelectionIconButton
                      selected={allSelected}
                      onClick={toggleAll}
                      label="Selecionar reuniões visíveis"
                    />
                  </th>
                  <th>Reunião</th>
                  <th>Colegiado</th>
                  <th>Data / local</th>
                  <th>Pauta / deliberações</th>
                  <th>Responsável</th>
                  <th>Situação</th>
                  <th>Acervo da reunião</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeetings.map((meeting) => (
                  <tr
                    key={meeting.id}
                    className={
                      meeting.status === "Realizada" ? "row-completed" : ""
                    }
                  >
                    <td>
                      <SelectionIconButton
                        selected={selected.has(meeting.id)}
                        onClick={() => toggle(meeting.id)}
                        label={`Selecionar ${meeting.title}`}
                      />
                    </td>
                    <td>
                      <strong>{meeting.title}</strong>
                      <small>
                        {meeting.quorum
                          ? `Quórum: ${meeting.quorum}`
                          : "Quórum não informado"}
                      </small>
                    </td>
                    <td>{bodyNames[meeting.bodyId] ?? "Colegiado removido"}</td>
                    <td>
                      <strong>{dateTime(meeting.meetingDate)}</strong>
                      <small>{meeting.location || "Local não informado"}</small>
                    </td>
                    <td>
                      <strong>{meeting.agenda || "Pauta não informada"}</strong>
                      <small>
                        {meeting.deliberations ||
                          "Sem deliberações registradas"}
                      </small>
                    </td>
                    <td>{meeting.responsible}</td>
                    <td>
                      <span
                        className={`status-badge ${meeting.status === "Realizada" ? "badge-green" : meeting.status === "Cancelada" ? "badge-slate" : "badge-blue"}`}
                      >
                        {meeting.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions council-meeting-files">
                        <button
                          className="row-action icon-row-action"
                          onClick={() =>
                            void updateMeeting(meeting, {
                              status:
                                meeting.status === "Realizada"
                                  ? "Agendada"
                                  : "Realizada",
                            })
                          }
                          title={
                            meeting.status === "Realizada"
                              ? "Reabrir"
                              : "Marcar realizada"
                          }
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <ItemFilesButton
                          module="councils"
                          itemId={`minutes:${meeting.id}`}
                          title={`Ata · ${meeting.title}`}
                          text
                          label="Ata"
                          accept="application/pdf,.doc,.docx,image/*"
                        />
                        <ItemFilesButton
                          module="councils"
                          itemId={`attendance:${meeting.id}`}
                          title={`Lista de presença · ${meeting.title}`}
                          text
                          label="Presença"
                          accept="application/pdf,.doc,.docx,image/*"
                        />
                        <ItemFilesButton
                          module="councils"
                          itemId={`audio:${meeting.id}`}
                          title={`Áudio · ${meeting.title}`}
                          text
                          label="Áudio"
                          accept="audio/*,.m4a,.mp3,.wav,.aac"
                        />
                        <button
                          className="row-action icon-row-action"
                          onClick={() => openMeeting(meeting)}
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="row-action icon-row-action danger-row-action"
                          onClick={() =>
                            void remove("meeting", meeting.id, meeting.title)
                          }
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredMeetings.length ? (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      {loading ? (
                        <>
                          <LoaderCircle className="spin" /> Carregando…
                        </>
                      ) : bodies.length ? (
                        "Nenhuma reunião cadastrada."
                      ) : (
                        "Cadastre primeiro um colegiado."
                      )}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {form === "body" ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true">
          <form
            className="attachment-modal record-form-modal"
            onSubmit={saveBody}
          >
            <header>
              <div>
                <span className="panel-kicker">Estrutura colegiada</span>
                <h2>{editingId ? "Editar colegiado" : "Novo colegiado"}</h2>
              </div>
              <button
                className="icon-only-button"
                type="button"
                onClick={closeForm}
              >
                <X size={20} />
              </button>
            </header>
            <div className="record-form-grid">
              <label className="form-span-2">
                <span>Nome</span>
                <input
                  required
                  value={bodyDraft.name}
                  onChange={(event) =>
                    setBodyDraft({ ...bodyDraft, name: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Sigla</span>
                <input
                  value={bodyDraft.acronym}
                  onChange={(event) =>
                    setBodyDraft({ ...bodyDraft, acronym: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Tipo</span>
                <select
                  value={bodyDraft.bodyType}
                  onChange={(event) =>
                    setBodyDraft({
                      ...bodyDraft,
                      bodyType: event.target.value as BodyDraft["bodyType"],
                    })
                  }
                >
                  {BODY_TYPES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Ato de criação</span>
                <input
                  value={bodyDraft.legalAct}
                  onChange={(event) =>
                    setBodyDraft({ ...bodyDraft, legalAct: event.target.value })
                  }
                  placeholder="Lei, decreto ou portaria"
                />
              </label>
              <label>
                <span>Responsável</span>
                <select
                  value={bodyDraft.responsible}
                  onChange={(event) =>
                    setBodyDraft({
                      ...bodyDraft,
                      responsible: event.target.value,
                    })
                  }
                >
                  {RESPONSIBLE_OPTIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Presidência</span>
                <input
                  value={bodyDraft.president}
                  onChange={(event) =>
                    setBodyDraft({
                      ...bodyDraft,
                      president: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Secretaria executiva</span>
                <input
                  value={bodyDraft.secretary}
                  onChange={(event) =>
                    setBodyDraft({
                      ...bodyDraft,
                      secretary: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Início do mandato</span>
                <input
                  required
                  type="date"
                  value={bodyDraft.termStart}
                  onChange={(event) =>
                    setBodyDraft({
                      ...bodyDraft,
                      termStart: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Fim do mandato</span>
                <input
                  required
                  type="date"
                  value={bodyDraft.termEnd}
                  onChange={(event) =>
                    setBodyDraft({ ...bodyDraft, termEnd: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Situação</span>
                <select
                  value={bodyDraft.status}
                  onChange={(event) =>
                    setBodyDraft({
                      ...bodyDraft,
                      status: event.target.value as BodyDraft["status"],
                    })
                  }
                >
                  {BODY_STATUSES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="form-span-2">
                <span>Finalidade</span>
                <textarea
                  value={bodyDraft.purpose}
                  onChange={(event) =>
                    setBodyDraft({ ...bodyDraft, purpose: event.target.value })
                  }
                />
              </label>
              <label className="form-span-2">
                <span>Membros e representações</span>
                <textarea
                  value={bodyDraft.members}
                  onChange={(event) =>
                    setBodyDraft({ ...bodyDraft, members: event.target.value })
                  }
                  placeholder="Um membro ou representação por linha"
                />
              </label>
              <label className="form-span-2">
                <span>Observações</span>
                <textarea
                  value={bodyDraft.notes}
                  onChange={(event) =>
                    setBodyDraft({ ...bodyDraft, notes: event.target.value })
                  }
                />
              </label>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="editor-actions">
              <button className="primary-button" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}{" "}
                Salvar
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={closeForm}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {form === "meeting" ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true">
          <form
            className="attachment-modal record-form-modal"
            onSubmit={saveMeeting}
          >
            <header>
              <div>
                <span className="panel-kicker">Memória colegiada</span>
                <h2>{editingId ? "Editar reunião" : "Nova reunião"}</h2>
              </div>
              <button
                className="icon-only-button"
                type="button"
                onClick={closeForm}
              >
                <X size={20} />
              </button>
            </header>
            <div className="record-form-grid">
              <label>
                <span>Colegiado</span>
                <select
                  required
                  value={meetingDraft.bodyId}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      bodyId: event.target.value,
                    })
                  }
                >
                  <option value="">Selecione</option>
                  {bodies.map((body) => (
                    <option key={body.id} value={body.id}>
                      {body.acronym || body.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Data e horário</span>
                <input
                  required
                  type="datetime-local"
                  value={meetingDraft.meetingDate}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      meetingDate: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-span-2">
                <span>Título</span>
                <input
                  required
                  value={meetingDraft.title}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Local</span>
                <input
                  value={meetingDraft.location}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      location: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Responsável</span>
                <select
                  value={meetingDraft.responsible}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      responsible: event.target.value,
                    })
                  }
                >
                  {RESPONSIBLE_OPTIONS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Quórum</span>
                <input
                  value={meetingDraft.quorum}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      quorum: event.target.value,
                    })
                  }
                  placeholder="Ex.: 8 de 12 membros"
                />
              </label>
              <label>
                <span>Situação</span>
                <select
                  value={meetingDraft.status}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      status: event.target.value as MeetingDraft["status"],
                    })
                  }
                >
                  {MEETING_STATUSES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="form-span-2">
                <span>Pauta</span>
                <textarea
                  value={meetingDraft.agenda}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      agenda: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-span-2">
                <span>Participantes</span>
                <textarea
                  value={meetingDraft.participants}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      participants: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-span-2">
                <span>Deliberações e encaminhamentos</span>
                <textarea
                  value={meetingDraft.deliberations}
                  onChange={(event) =>
                    setMeetingDraft({
                      ...meetingDraft,
                      deliberations: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="editor-actions">
              <button className="primary-button" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <CheckCircle2 size={18} />
                )}{" "}
                Salvar
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={closeForm}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
