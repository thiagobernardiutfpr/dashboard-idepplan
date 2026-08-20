"use client";

import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ItemFilesButton } from "@/components/item-lifecycle";
import { WorkspaceCalendar } from "@/components/workspace-calendar";
import type {
  CouncilBodyRecord,
  CouncilMeetingRecord,
  CouncilMemberRecord,
  CouncilRequestRecord,
  ItemAttachmentRecord,
} from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

type Tab = "overview" | "meetings" | "members" | "requests" | "agenda";
type MemberDraft = Omit<
  CouncilMemberRecord,
  "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;
type RequestDraft = Omit<
  CouncilRequestRecord,
  "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;
type MeetingDraft = Omit<
  CouncilMeetingRecord,
  "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;

const today = () => new Date().toISOString().slice(0, 10);
const defaultDateTime = () => {
  const date = new Date(Date.now() + 7 * 86_400_000);
  date.setHours(9, 0, 0, 0);
  return `${date.toISOString().slice(0, 10)}T09:00`;
};
const emptyMember = (bodyId: string): MemberDraft => ({
  bodyId,
  name: "",
  role: "",
  entity: "",
  phone: "",
  email: "",
  requests: "",
  notes: "",
  status: "Ativo",
});
const emptyRequest = (bodyId: string): RequestDraft => ({
  bodyId,
  title: "",
  requester: "",
  requestDate: today(),
  dueDate: "",
  status: "Recebida",
  responsible: RESPONSIBLE_OPTIONS[0],
  description: "",
  response: "",
});
const emptyMeeting = (bodyId: string): MeetingDraft => ({
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
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeZone: "UTC",
      }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
    : "—";
const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

function useFirstImage(itemId: string, refreshKey = 0) {
  const [image, setImage] = useState<ItemAttachmentRecord | null>(null);
  const load = useCallback(() => {
    fetch(
      `/api/attachments?module=councils&itemId=${encodeURIComponent(itemId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const payload = (await response.json()) as {
          attachments?: ItemAttachmentRecord[];
        };
        if (response.ok)
          setImage(
            (payload.attachments ?? []).find((file) =>
              file.contentType.startsWith("image/"),
            ) ?? null,
          );
      })
      .catch(() => {});
  }, [itemId]);
  useEffect(load, [load, refreshKey]);
  return { image, load };
}

function MemberPortrait({ member }: { member: CouncilMemberRecord }) {
  const [version, setVersion] = useState(0);
  const { image } = useFirstImage(`member:${member.id}`, version);
  return (
    <div className="council-member-portrait">
      <div className="council-member-photo">
        {image ? (
          <img
            src={`/api/attachments/${image.id}`}
            alt={`Foto de ${member.name}`}
          />
        ) : (
          <UserRound size={42} />
        )}
      </div>
      <ItemFilesButton
        module="councils"
        itemId={`member:${member.id}`}
        title={`Foto e documentos · ${member.name}`}
        text
        label="Foto / arquivo"
        accept="image/png,image/jpeg,application/pdf"
        onChange={() => setVersion((value) => value + 1)}
      />
    </div>
  );
}

export function CouncilWorkspace({
  body,
  onBack,
}: {
  body: CouncilBodyRecord;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [members, setMembers] = useState<CouncilMemberRecord[]>([]);
  const [requests, setRequests] = useState<CouncilRequestRecord[]>([]);
  const [meetings, setMeetings] = useState<CouncilMeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(() =>
    emptyMember(body.id),
  );
  const [requestDraft, setRequestDraft] = useState<RequestDraft>(() =>
    emptyRequest(body.id),
  );
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft>(() =>
    emptyMeeting(body.id),
  );
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<"member" | "request" | "meeting" | null>(
    null,
  );
  const [coverVersion, setCoverVersion] = useState(0);
  const { image: cover } = useFirstImage(`cover:${body.id}`, coverVersion);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [memberResponse, requestResponse, meetingResponse] =
          await Promise.all([
            fetch(
              `/api/council-members?bodyId=${encodeURIComponent(body.id)}`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
            fetch(
              `/api/council-requests?bodyId=${encodeURIComponent(body.id)}`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
            fetch("/api/council-meetings", {
              cache: "no-store",
              signal: controller.signal,
            }),
          ]);
        const memberPayload = (await memberResponse.json()) as {
          members?: CouncilMemberRecord[];
          error?: string;
        };
        const requestPayload = (await requestResponse.json()) as {
          requests?: CouncilRequestRecord[];
          error?: string;
        };
        const meetingPayload = (await meetingResponse.json()) as {
          meetings?: CouncilMeetingRecord[];
          error?: string;
        };
        if (!memberResponse.ok) throw new Error(memberPayload.error);
        if (!requestResponse.ok) throw new Error(requestPayload.error);
        if (!meetingResponse.ok) throw new Error(meetingPayload.error);
        setMembers(memberPayload.members ?? []);
        setRequests(requestPayload.requests ?? []);
        setMeetings(
          (meetingPayload.meetings ?? []).filter(
            (meeting) => meeting.bodyId === body.id,
          ),
        );
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Falha ao carregar o módulo do conselho.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [body.id]);

  const activeMembers = members.filter(
    (member) => member.status === "Ativo",
  ).length;
  const openRequests = requests.filter(
    (request) => !["Respondida", "Arquivada"].includes(request.status),
  ).length;
  const nextMeetings = useMemo(
    () =>
      meetings
        .filter(
          (meeting) =>
            meeting.status === "Agendada" &&
            meeting.meetingDate.slice(0, 10) >= today(),
        )
        .slice(0, 4),
    [meetings],
  );

  function openMember(member?: CouncilMemberRecord) {
    setEditingId(member?.id ?? "");
    setMemberDraft(
      member
        ? {
            bodyId: member.bodyId,
            name: member.name,
            role: member.role,
            entity: member.entity,
            phone: member.phone,
            email: member.email,
            requests: member.requests,
            notes: member.notes,
            status: member.status,
          }
        : emptyMember(body.id),
    );
    setError("");
    setForm("member");
  }
  function openRequest(request?: CouncilRequestRecord) {
    setEditingId(request?.id ?? "");
    setRequestDraft(
      request
        ? {
            bodyId: request.bodyId,
            title: request.title,
            requester: request.requester,
            requestDate: request.requestDate,
            dueDate: request.dueDate,
            status: request.status,
            responsible: request.responsible,
            description: request.description,
            response: request.response,
          }
        : emptyRequest(body.id),
    );
    setError("");
    setForm("request");
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
        : emptyMeeting(body.id),
    );
    setError("");
    setForm("meeting");
  }
  function closeForm() {
    setForm(null);
    setEditingId("");
    setError("");
  }

  async function saveMember(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/council-members", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...memberDraft, id: editingId || undefined }),
      });
      const payload = (await response.json()) as {
        member?: CouncilMemberRecord;
        error?: string;
      };
      if (!response.ok || !payload.member) throw new Error(payload.error);
      setMembers((current) =>
        editingId
          ? current.map((member) =>
              member.id === editingId ? payload.member! : member,
            )
          : [...current, payload.member!].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
      );
      closeForm();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o membro.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveRequest(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/council-requests", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...requestDraft, id: editingId || undefined }),
      });
      const payload = (await response.json()) as {
        request?: CouncilRequestRecord;
        error?: string;
      };
      if (!response.ok || !payload.request) throw new Error(payload.error);
      setRequests((current) =>
        editingId
          ? current.map((request) =>
              request.id === editingId ? payload.request! : request,
            )
          : [payload.request!, ...current],
      );
      closeForm();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a solicitação.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveMeeting(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
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
      if (!response.ok || !payload.meeting) throw new Error(payload.error);
      setMeetings((current) =>
        editingId
          ? current.map((meeting) =>
              meeting.id === editingId ? payload.meeting! : meeting,
            )
          : [...current, payload.meeting!].sort((a, b) =>
              a.meetingDate.localeCompare(b.meetingDate),
            ),
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

  async function remove(
    kind: "member" | "request" | "meeting",
    id: string,
    label: string,
  ) {
    if (!window.confirm(`Excluir “${label}”?`)) return;
    const endpoint =
      kind === "member"
        ? "/api/council-members"
        : kind === "request"
          ? "/api/council-requests"
          : "/api/council-meetings";
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "Não foi possível excluir o registro.");
      return;
    }
    if (kind === "member")
      setMembers((current) => current.filter((item) => item.id !== id));
    else if (kind === "request")
      setRequests((current) => current.filter((item) => item.id !== id));
    else setMeetings((current) => current.filter((item) => item.id !== id));
  }

  return (
    <>
      <button className="council-back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} /> Voltar para Conselhos e Comissões
      </button>
      <section className={`council-workspace-hero ${cover ? "has-cover" : ""}`}>
        {cover ? (
          <img
            src={`/api/attachments/${cover.id}`}
            alt={`Capa de ${body.name}`}
          />
        ) : (
          <div className="council-cover-placeholder">
            <Landmark size={78} />
            <span>Adicione a capa ou o logotipo deste conselho</span>
          </div>
        )}
        <div className="council-cover-shade" />
        <div className="council-cover-content">
          <span>
            {body.bodyType} · {body.status}
          </span>
          <h1>{body.name}</h1>
          <p>
            {body.acronym ? `${body.acronym} · ` : ""}
            {body.purpose || "Espaço institucional do colegiado"}
          </p>
          <div>
            <ItemFilesButton
              module="councils"
              itemId={`cover:${body.id}`}
              title={`Capa · ${body.name}`}
              text
              label="Inserir / alterar capa"
              accept="image/png,image/jpeg,image/webp"
              onChange={() => setCoverVersion((value) => value + 1)}
            />
            <ItemFilesButton
              module="councils"
              itemId={body.id}
              title={`Acervo geral · ${body.name}`}
              text
              label="Arquivos gerais"
            />
          </div>
        </div>
      </section>
      <section className="council-workspace-kpis">
        <div>
          <UsersRound size={19} />
          <strong>{activeMembers}</strong>
          <span>membros ativos</span>
        </div>
        <div>
          <FileText size={19} />
          <strong>{meetings.length}</strong>
          <span>reuniões registradas</span>
        </div>
        <div>
          <Clock3 size={19} />
          <strong>{openRequests}</strong>
          <span>solicitações abertas</span>
        </div>
        <div>
          <CalendarCheck size={19} />
          <strong>{nextMeetings.length}</strong>
          <span>próximas reuniões</span>
        </div>
      </section>
      <div className="module-tabs council-workspace-tabs">
        {(
          ["overview", "meetings", "members", "requests", "agenda"] as Tab[]
        ).map((value) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {value === "overview" ? (
              <Landmark size={16} />
            ) : value === "meetings" ? (
              <FileText size={16} />
            ) : value === "members" ? (
              <UsersRound size={16} />
            ) : value === "requests" ? (
              <CheckCircle2 size={16} />
            ) : (
              <CalendarCheck size={16} />
            )}{" "}
            {value === "overview"
              ? "Visão geral"
              : value === "meetings"
                ? "Atas e presença"
                : value === "members"
                  ? "Membros"
                  : value === "requests"
                    ? "Solicitações"
                    : "Agenda"}
          </button>
        ))}
      </div>
      {error ? <div className="module-error">{error}</div> : null}
      {tab === "overview" ? (
        <div className="council-overview-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Identidade institucional</p>
                <h2>Dados do colegiado</h2>
              </div>
            </div>
            <dl className="council-definition-list">
              <div>
                <dt>Ato legal</dt>
                <dd>{body.legalAct || "Não informado"}</dd>
              </div>
              <div>
                <dt>Presidência</dt>
                <dd>{body.president || "Não informada"}</dd>
              </div>
              <div>
                <dt>Secretaria</dt>
                <dd>{body.secretary || "Não informada"}</dd>
              </div>
              <div>
                <dt>Responsável IDEPPLAN</dt>
                <dd>{body.responsible}</dd>
              </div>
              <div>
                <dt>Mandato</dt>
                <dd>
                  {date(body.termStart)} a {date(body.termEnd)}
                </dd>
              </div>
            </dl>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">Próximos encontros</p>
                <h2>Agenda imediata</h2>
              </div>
              <button
                className="secondary-button compact-button"
                onClick={() => setTab("agenda")}
              >
                Abrir calendário
              </button>
            </div>
            <div className="council-upcoming-list">
              {nextMeetings.map((meeting) => (
                <article key={meeting.id}>
                  <span>{dateTime(meeting.meetingDate)}</span>
                  <strong>{meeting.title}</strong>
                  <small>
                    {meeting.location || meeting.agenda || "Local a definir"}
                  </small>
                </article>
              ))}
              {!nextMeetings.length ? <p>Nenhuma reunião agendada.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
      {tab === "meetings" ? (
        <section className="panel process-section">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Memória colegiada</p>
              <h2>Atas, listas de presença e áudios</h2>
              <p>
                {meetings.length} reunião{meetings.length === 1 ? "" : "ões"}
              </p>
            </div>
            <button className="primary-button" onClick={() => openMeeting()}>
              <Plus size={17} /> Nova reunião
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Reunião</th>
                  <th>Data / local</th>
                  <th>Pauta e deliberações</th>
                  <th>Situação</th>
                  <th>Documentos</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => (
                  <tr key={meeting.id}>
                    <td>
                      <strong>{meeting.title}</strong>
                      <small>{meeting.responsible}</small>
                    </td>
                    <td>
                      <strong>{dateTime(meeting.meetingDate)}</strong>
                      <small>{meeting.location || "Local não informado"}</small>
                    </td>
                    <td>
                      <strong>{meeting.agenda || "Pauta não informada"}</strong>
                      <small>
                        {meeting.deliberations || "Sem deliberações"}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${meeting.status === "Realizada" ? "badge-green" : meeting.status === "Cancelada" ? "badge-slate" : "badge-blue"}`}
                      >
                        {meeting.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions council-meeting-files">
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
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="row-action icon-row-action danger-row-action"
                          onClick={() =>
                            void remove("meeting", meeting.id, meeting.title)
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!meetings.length ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      {loading ? (
                        <>
                          <LoaderCircle className="spin" /> Carregando…
                        </>
                      ) : (
                        "Nenhuma reunião cadastrada."
                      )}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {tab === "members" ? (
        <section className="panel council-members-section">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Composição</p>
              <h2>Membros e representações</h2>
              <p>Fotos, contatos, entidades e solicitações individuais.</p>
            </div>
            <button className="primary-button" onClick={() => openMember()}>
              <Plus size={17} /> Novo membro
            </button>
          </div>
          <div className="council-member-grid">
            {members.map((member) => (
              <article
                key={member.id}
                className={member.status === "Inativo" ? "inactive" : ""}
              >
                <MemberPortrait member={member} />
                <div className="council-member-content">
                  <span
                    className={`status-badge ${member.status === "Ativo" ? "badge-green" : "badge-slate"}`}
                  >
                    {member.status}
                  </span>
                  <h3>{member.name}</h3>
                  <strong>{member.role || "Membro"}</strong>
                  <p>{member.entity || "Entidade não informada"}</p>
                  {member.phone ? (
                    <a href={`tel:${member.phone}`}>
                      <Phone size={14} /> {member.phone}
                    </a>
                  ) : null}
                  {member.email ? (
                    <a href={`mailto:${member.email}`}>
                      <Mail size={14} /> {member.email}
                    </a>
                  ) : null}
                  {member.requests ? (
                    <div className="member-requests">
                      <span>Solicitações</span>
                      <p>{member.requests}</p>
                    </div>
                  ) : null}
                  <div className="row-actions">
                    <button
                      className="row-action icon-row-action"
                      onClick={() => openMember(member)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="row-action icon-row-action danger-row-action"
                      onClick={() =>
                        void remove("member", member.id, member.name)
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!members.length ? (
              <div className="empty-state">
                {loading ? "Carregando membros…" : "Nenhum membro cadastrado."}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      {tab === "requests" ? (
        <section className="panel process-section">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Controle de demandas</p>
              <h2>Solicitações do conselho</h2>
              <p>{openRequests} em andamento</p>
            </div>
            <button className="primary-button" onClick={() => openRequest()}>
              <Plus size={17} /> Nova solicitação
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Solicitação</th>
                  <th>Solicitante</th>
                  <th>Datas</th>
                  <th>Responsável</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <strong>{request.title}</strong>
                      <small>{request.description || "Sem descrição"}</small>
                    </td>
                    <td>{request.requester || "Não informado"}</td>
                    <td>
                      <strong>{date(request.requestDate)}</strong>
                      <small>
                        {request.dueDate
                          ? `prazo ${date(request.dueDate)}`
                          : "Sem prazo"}
                      </small>
                    </td>
                    <td>{request.responsible}</td>
                    <td>
                      <span
                        className={`status-badge ${request.status === "Respondida" ? "badge-green" : request.status === "Arquivada" ? "badge-slate" : request.status === "Em análise" ? "badge-violet" : "badge-blue"}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <ItemFilesButton
                          module="councils"
                          itemId={`request:${request.id}`}
                          title={`Solicitação · ${request.title}`}
                        />
                        <button
                          className="row-action icon-row-action"
                          onClick={() => openRequest(request)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="row-action icon-row-action danger-row-action"
                          onClick={() =>
                            void remove("request", request.id, request.title)
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!requests.length ? (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Nenhuma solicitação cadastrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {tab === "agenda" ? (
        <WorkspaceCalendar
          contextType="council"
          contextId={body.id}
          title={`Agenda · ${body.acronym || body.name}`}
        />
      ) : null}
      {form === "member" ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true">
          <form
            className="attachment-modal record-form-modal"
            onSubmit={saveMember}
          >
            <header>
              <div>
                <span className="panel-kicker">Composição do colegiado</span>
                <h2>{editingId ? "Editar membro" : "Novo membro"}</h2>
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
                <span>Nome *</span>
                <input
                  required
                  value={memberDraft.name}
                  onChange={(event) =>
                    setMemberDraft({ ...memberDraft, name: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Função no conselho</span>
                <input
                  value={memberDraft.role}
                  onChange={(event) =>
                    setMemberDraft({ ...memberDraft, role: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Entidade representada</span>
                <input
                  value={memberDraft.entity}
                  onChange={(event) =>
                    setMemberDraft({
                      ...memberDraft,
                      entity: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Telefone</span>
                <input
                  value={memberDraft.phone}
                  onChange={(event) =>
                    setMemberDraft({
                      ...memberDraft,
                      phone: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={memberDraft.email}
                  onChange={(event) =>
                    setMemberDraft({
                      ...memberDraft,
                      email: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Situação</span>
                <select
                  value={memberDraft.status}
                  onChange={(event) =>
                    setMemberDraft({
                      ...memberDraft,
                      status: event.target.value as MemberDraft["status"],
                    })
                  }
                >
                  <option>Ativo</option>
                  <option>Inativo</option>
                </select>
              </label>
              <label className="form-span-2">
                <span>Solicitações do membro</span>
                <textarea
                  rows={4}
                  value={memberDraft.requests}
                  onChange={(event) =>
                    setMemberDraft({
                      ...memberDraft,
                      requests: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-span-2">
                <span>Observações</span>
                <textarea
                  value={memberDraft.notes}
                  onChange={(event) =>
                    setMemberDraft({
                      ...memberDraft,
                      notes: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="editor-actions">
              <button className="primary-button" disabled={saving}>
                <CheckCircle2 size={18} /> Salvar
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
      {form === "request" ? (
        <div className="attachment-overlay" role="dialog" aria-modal="true">
          <form
            className="attachment-modal record-form-modal"
            onSubmit={saveRequest}
          >
            <header>
              <div>
                <span className="panel-kicker">Demandas do colegiado</span>
                <h2>{editingId ? "Editar solicitação" : "Nova solicitação"}</h2>
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
                <span>Título *</span>
                <input
                  required
                  value={requestDraft.title}
                  onChange={(event) =>
                    setRequestDraft({
                      ...requestDraft,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Solicitante</span>
                <input
                  value={requestDraft.requester}
                  onChange={(event) =>
                    setRequestDraft({
                      ...requestDraft,
                      requester: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Responsável</span>
                <select
                  value={requestDraft.responsible}
                  onChange={(event) =>
                    setRequestDraft({
                      ...requestDraft,
                      responsible: event.target.value,
                    })
                  }
                >
                  {RESPONSIBLE_OPTIONS.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Data da solicitação</span>
                <input
                  required
                  type="date"
                  value={requestDraft.requestDate}
                  onChange={(event) =>
                    setRequestDraft({
                      ...requestDraft,
                      requestDate: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Prazo</span>
                <input
                  type="date"
                  value={requestDraft.dueDate}
                  onChange={(event) =>
                    setRequestDraft({
                      ...requestDraft,
                      dueDate: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Situação</span>
                <select
                  value={requestDraft.status}
                  onChange={(event) =>
                    setRequestDraft({
                      ...requestDraft,
                      status: event.target.value as RequestDraft["status"],
                    })
                  }
                >
                  <option>Recebida</option>
                  <option>Em análise</option>
                  <option>Respondida</option>
                  <option>Arquivada</option>
                </select>
              </label>
              <label className="form-span-2">
                <span>Descrição</span>
                <textarea
                  rows={4}
                  value={requestDraft.description}
                  onChange={(event) =>
                    setRequestDraft({
                      ...requestDraft,
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label className="form-span-2">
                <span>Resposta / encaminhamento</span>
                <textarea
                  rows={4}
                  value={requestDraft.response}
                  onChange={(event) =>
                    setRequestDraft({
                      ...requestDraft,
                      response: event.target.value,
                    })
                  }
                />
              </label>
            </div>
            {error ? <div className="form-error">{error}</div> : null}
            <div className="editor-actions">
              <button className="primary-button" disabled={saving}>
                <CheckCircle2 size={18} /> Salvar
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
                <span className="panel-kicker">Memória do colegiado</span>
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
              <label className="form-span-2">
                <span>Título *</span>
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
                <span>Data e horário *</span>
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
                  {RESPONSIBLE_OPTIONS.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
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
                  <option>Agendada</option>
                  <option>Realizada</option>
                  <option>Cancelada</option>
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
                />
              </label>
              <label className="form-span-2">
                <span>Pauta</span>
                <textarea
                  rows={3}
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
                <span>Deliberações</span>
                <textarea
                  rows={4}
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
                <CheckCircle2 size={18} /> Salvar
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
