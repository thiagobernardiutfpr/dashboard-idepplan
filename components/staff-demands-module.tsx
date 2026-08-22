"use client";

import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, FileText, LoaderCircle, MessageCircle, Plus, Send, Trash2, UploadCloud, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ItemFilesButton } from "@/components/item-lifecycle";
import type { StaffDemandRecord, StaffMessageRecord, StaffProfileRecord } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";
import { readApiJson } from "@/lib/api-client";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const formatDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

function calendarDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return date;
  });
}

export function StaffDemandsModule() {
  const [profiles, setProfiles] = useState<Record<string, StaffProfileRecord>>({});
  const [demands, setDemands] = useState<StaffDemandRecord[]>([]);
  const [messages, setMessages] = useState<StaffMessageRecord[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>(RESPONSIBLE_OPTIONS[0]);
  const [selectedDate, setSelectedDate] = useState(localToday);
  const [visibleMonth, setVisibleMonth] = useState(localToday().slice(0, 7));
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [dueDate, setDueDate] = useState(localToday);
  const [sender, setSender] = useState<string>(RESPONSIBLE_OPTIONS[0]);
  const [recipient, setRecipient] = useState<string>("Todos");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const profileInput = useRef<HTMLInputElement>(null);
  const uploadStaff = useRef<string>("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/staff-profiles", { cache: "no-store", signal: controller.signal }).then((response) => response.json()),
      fetch("/api/staff-demands", { cache: "no-store", signal: controller.signal }).then((response) => response.json()),
      fetch("/api/staff-chat", { cache: "no-store", signal: controller.signal }).then((response) => response.json()),
    ]).then(([profilePayload, demandPayload, chatPayload]) => {
      setProfiles(Object.fromEntries(((profilePayload as { profiles?: StaffProfileRecord[] }).profiles ?? []).map((profile) => [profile.staffName, profile])));
      setDemands((demandPayload as { demands?: StaffDemandRecord[] }).demands ?? []);
      setMessages((chatPayload as { messages?: StaffMessageRecord[] }).messages ?? []);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Falha ao carregar o módulo."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const staffDemands = demands.filter((demand) => demand.staffName === selectedStaff);
  const dayMessages = messages.filter((item) => item.messageDate === selectedDate);
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${visibleMonth}-01T00:00:00Z`));
  const countsByDate = useMemo(() => Object.fromEntries(messages.map((item) => item.messageDate).map((key) => [key, messages.filter((item) => item.messageDate === key).length])), [messages]);

  function moveMonth(delta: number) {
    const [year, month] = visibleMonth.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setVisibleMonth(isoDate(next).slice(0, 7));
  }
  async function createDemand(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/staff-demands", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ staffName: selectedStaff, title, details, dueDate, completed: false }) });
      const payload = await response.json() as { demand?: StaffDemandRecord; error?: string };
      if (!response.ok || !payload.demand) throw new Error(payload.error ?? "Não foi possível criar a demanda.");
      setDemands((current) => [payload.demand!, ...current]); setTitle(""); setDetails("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível criar a demanda."); }
    finally { setSaving(false); }
  }
  async function toggleDemand(demand: StaffDemandRecord) {
    const response = await fetch("/api/staff-demands", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...demand, completed: !demand.completed }) });
    const payload = await response.json() as { demand?: StaffDemandRecord; error?: string };
    if (response.ok && payload.demand) setDemands((current) => current.map((item) => item.id === demand.id ? payload.demand! : item)); else setError(payload.error ?? "Falha ao atualizar a demanda.");
  }
  async function removeDemand(demand: StaffDemandRecord) {
    if (!window.confirm(`Excluir a demanda “${demand.title}”?`)) return;
    const response = await fetch("/api/staff-demands", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: demand.id }) });
    if (response.ok) setDemands((current) => current.filter((item) => item.id !== demand.id));
  }
  async function uploadProfile(file: File) {
    setSaving(true); setError("");
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("A foto ou o PDF de perfil deve ter até 8 MB.");
      const form = new FormData(); form.set("staffName", uploadStaff.current); form.set("file", file);
      const response = await fetch("/api/staff-profiles", { method: "POST", body: form });
      const payload = await readApiJson<{ profile?: StaffProfileRecord; error?: string }>(response);
      if (!response.ok || !payload.profile) throw new Error(payload.error ?? "Falha ao enviar a foto.");
      setProfiles((current) => ({ ...current, [payload.profile!.staffName]: payload.profile! }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao enviar a foto."); }
    finally { setSaving(false); if (profileInput.current) profileInput.current.value = ""; }
  }
  async function sendMessage(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/staff-chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sender, recipient, message, messageDate: selectedDate }) });
      const payload = await response.json() as { message?: StaffMessageRecord; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error ?? "Não foi possível enviar a mensagem.");
      setMessages((current) => [...current, payload.message!]); setMessage("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar a mensagem."); }
    finally { setSaving(false); }
  }

  return <>
    <section className="dashboard-header module-header"><div><p className="eyebrow">Equipe IDEPPLAN · colaboração</p><h1>Demandas por Servidor</h1><p>Solicitações por pessoa, prazos, arquivos e conversas organizadas por calendário.</p></div></section>
    <input ref={profileInput} className="sr-only" type="file" accept="image/png,image/jpeg,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadProfile(file); }}/>
    {error ? <div className="module-error">{error}</div> : null}
    <section className="staff-card-grid" aria-label="Servidores">{RESPONSIBLE_OPTIONS.map((name) => {
      const profile = profiles[name]; const open = demands.filter((demand) => demand.staffName === name && !demand.completed).length;
      return <article className={`staff-card ${selectedStaff === name ? "selected" : ""}`} key={name}><button className="staff-card-main" type="button" onClick={() => setSelectedStaff(name)}>{profile?.contentType.startsWith("image/") ? <img src={`/api/staff-profiles?name=${encodeURIComponent(name)}&content=1`} alt={`Foto de ${name}`}/> : <span className="staff-avatar-placeholder">{profile?.contentType === "application/pdf" ? <FileText size={36}/> : <UserRound size={38}/>}</span>}<strong>{name}</strong><span>{open} demanda{open === 1 ? "" : "s"} aberta{open === 1 ? "" : "s"}</span></button><button className="staff-upload-button" type="button" onClick={() => { uploadStaff.current = name; profileInput.current?.click(); }}><UploadCloud size={15}/> Foto / PDF</button></article>;
    })}</section>
    <section className="staff-workspace">
      <article className="panel staff-demands-panel"><div className="panel-heading"><div><p className="panel-kicker">Fila de trabalho</p><h2>{selectedStaff}</h2><p>{staffDemands.length} demanda{staffDemands.length === 1 ? "" : "s"}</p></div></div><form className="staff-demand-form" onSubmit={createDemand}><label><span>Nova demanda</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título da solicitação"/></label><label><span>Prazo</span><input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label><label className="form-span-2"><span>Detalhes</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Contexto, resultado esperado e orientações"/></label><button className="primary-button" disabled={saving}><Plus size={17}/> Cadastrar demanda</button></form><div className="staff-demand-list">{staffDemands.map((demand) => <article className={demand.completed ? "completed" : ""} key={demand.id}><button type="button" className="demand-check" onClick={() => void toggleDemand(demand)} aria-label={demand.completed ? "Reabrir demanda" : "Concluir demanda"}><CheckCircle2 size={21}/></button><div><strong>{demand.title}</strong><p>{demand.details || "Sem detalhes adicionais."}</p><span>Prazo: {formatDate(demand.dueDate)}</span></div><div className="row-actions"><ItemFilesButton module="staff-demands" itemId={demand.id} title={demand.title}/><button className="row-action icon-row-action danger-row-action" type="button" onClick={() => void removeDemand(demand)} title="Excluir"><Trash2 size={15}/></button></div></article>)}{!staffDemands.length ? <div className="empty-state">{loading ? <><LoaderCircle className="spin"/> Carregando…</> : "Nenhuma demanda para este servidor."}</div> : null}</div></article>
      <article className="panel staff-chat-panel"><div className="panel-heading calendar-heading"><div><p className="panel-kicker">Conversa da equipe</p><h2>Calendário e chat</h2></div><div className="calendar-nav"><button type="button" onClick={() => moveMonth(-1)}><ChevronLeft size={17}/></button><strong>{monthLabel}</strong><button type="button" onClick={() => moveMonth(1)}><ChevronRight size={17}/></button></div></div><div className="staff-calendar"><div className="calendar-weekdays">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-grid">{days.map((day) => { const key = isoDate(day); const currentMonth = key.slice(0, 7) === visibleMonth; return <button className={`${currentMonth ? "" : "outside"} ${selectedDate === key ? "selected" : ""}`} type="button" key={key} onClick={() => setSelectedDate(key)}><span>{day.getUTCDate()}</span>{countsByDate[key] ? <i>{countsByDate[key]}</i> : null}</button>; })}</div></div><div className="chat-day"><div className="chat-day-heading"><CalendarDays size={17}/><strong>{formatDate(selectedDate)}</strong><span>{dayMessages.length} mensagem{dayMessages.length === 1 ? "" : "s"}</span></div><div className="message-list">{dayMessages.map((item) => <div className="message-bubble" key={item.id}><div><strong>{item.sender}</strong><span>para {item.recipient}</span></div><p>{item.message}</p></div>)}{!dayMessages.length ? <p className="chat-empty"><MessageCircle size={22}/> Nenhuma conversa registrada neste dia.</p> : null}</div><form className="chat-form" onSubmit={sendMessage}><select value={sender} onChange={(event) => setSender(event.target.value)} aria-label="Remetente">{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select><select value={recipient} onChange={(event) => setRecipient(event.target.value)} aria-label="Destinatário"><option>Todos</option>{RESPONSIBLE_OPTIONS.map((name) => <option key={name}>{name}</option>)}</select><textarea required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escreva uma mensagem para este dia…"/><button className="primary-button" disabled={saving}><Send size={17}/> Enviar</button></form></div></article>
    </section>
  </>;
}
