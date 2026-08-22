import { getD1Binding } from "@/db";
import type { ItemModule } from "@/lib/dashboard-types";
import { RESPONSIBLE_OPTIONS } from "@/lib/responsibles";

export type GenericImportRow = {
  id: string;
  sourceSheet: string;
  sourceRow: number;
  data: Record<string, string>;
};

type NativeRecord = {
  id: string;
  bindings: unknown[];
  assignment?: { module: string; responsible: string };
};

type NativePlan = {
  table: string;
  sql: string;
  records: NativeRecord[];
};

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, " ")
  .trim()
  .toLocaleLowerCase("pt-BR");

function picker(data: Record<string, string>) {
  const entries = Object.entries(data).map(([key, value]) => [normalize(key), value.trim()] as const);
  return (...aliases: string[]) => {
    const targets = aliases.map(normalize);
    const exact = entries.find(([key]) => targets.includes(key));
    if (exact?.[1]) return exact[1];
    const partial = entries.find(([key, value]) => value && targets.some((target) => key.includes(target)));
    return partial?.[1] ?? "";
  };
}

function dateValue(value: string, fallback: string | null = null) {
  const input = value.trim();
  if (!input) return fallback;
  const brazilian = input.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2].padStart(2, "0")}-${brazilian[1].padStart(2, "0")}`;
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const serial = Number(input.replace(",", "."));
  if (Number.isFinite(serial) && serial > 25_000 && serial < 80_000) {
    return new Date(Date.UTC(1899, 11, 30 + Math.floor(serial))).toISOString().slice(0, 10);
  }
  return fallback;
}

function dateTimeValue(value: string, fallback: string) {
  const input = value.trim();
  const brazilian = input.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2].padStart(2, "0")}-${brazilian[1].padStart(2, "0")}T${(brazilian[4] ?? "09").padStart(2, "0")}:${brazilian[5] ?? "00"}`;
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T${(iso[4] ?? "09").padStart(2, "0")}:${iso[5] ?? "00"}`;
  return fallback;
}

function numberValue(value: string) {
  const input = value.trim().replace(/R\$\s*/gi, "").replace(/\s/g, "");
  if (!input) return null;
  const normalized = input.includes(",") ? input.replace(/\./g, "").replace(",", ".") : input;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function responsibleValue(value: string) {
  const wanted = normalize(value);
  return RESPONSIBLE_OPTIONS.find((name) => normalize(name) === wanted) ?? "";
}

function yes(value: string) {
  const normalized = normalize(value);
  return ["sim", "concluido", "concluida", "realizado", "realizada", "quitado", "finalizado", "finalizada", "1", "true"].some((term) => normalized.includes(term));
}

async function shortHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).slice(0, 16).map((part) => part.toString(16).padStart(2, "0")).join("");
}

function inferredText(get: ReturnType<typeof picker>, row: GenericImportRow, fileName: string) {
  return get("titulo", "nome", "objeto", "descricao", "assunto", "conteudo") || `${fileName} · linha ${row.sourceRow}`;
}

async function planFor(module: ItemModule, rows: GenericImportRow[], fileName: string, importedBy: string): Promise<NativePlan | null> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString().slice(0, 16);
  const termEndDate = new Date(); termEndDate.setUTCFullYear(termEndDate.getUTCFullYear() + 2);
  const termEnd = termEndDate.toISOString().slice(0, 10);

  if (module === "consultation" || module === "empresa-facil") return null;

  if (module === "processes") {
    const records = await Promise.all(rows.map(async (row) => {
      const get = picker(row.data); const processNumber = get("numero do processo", "n processo", "processo", "protocolo", "codigo") || `REL-${await shortHash(`${fileName}|${row.sourceSheet}|${row.sourceRow}`)}`;
      const responsible = responsibleValue(get("responsavel", "servidor"));
      const rawArea = normalize(get("area", "setor", "modulo"));
      return { id: `import-process-${await shortHash(processNumber)}`, assignment: responsible ? { module: "processes", responsible } : undefined, bindings: [processNumber, rawArea.includes("empresa") ? "Abertura de empresa" : "Urbanismo", get("requerente", "solicitante", "interessado", "contribuinte", "proprietario", "nome") || "Não informado", get("empresa", "razao social", "nome empresarial"), get("cnpj"), get("inscricao imobiliaria", "inscricao do imovel", "cadastro imobiliario"), get("categoria", "assunto", "servico", "acao", "tipo") || "Relatório importado", get("situacao", "status") || "Em análise", get("tipo de acao", "acao", "atividade"), dateValue(get("data de abertura", "abertura", "data da solicitacao", "data")), dateValue(get("previsao de encerramento", "prazo", "data limite", "vencimento")), get("observacao", "observacoes", "descricao", "conteudo"), importedBy, importedBy] };
    }));
    return { table: "manual_processes", sql: `INSERT INTO manual_processes (id,process_number,area,applicant,company_name,cnpj,property_registration,category,status,action_type,opened_at,planned_close_at,observation,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET process_number=excluded.process_number,area=excluded.area,applicant=excluded.applicant,company_name=excluded.company_name,cnpj=excluded.cnpj,property_registration=excluded.property_registration,category=excluded.category,status=excluded.status,action_type=excluded.action_type,opened_at=excluded.opened_at,planned_close_at=excluded.planned_close_at,observation=excluded.observation,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "projects") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const title = inferredText(get, row, fileName); const rawStage = normalize(get("etapa", "fase", "status", "situacao")); const stage = rawStage.includes("licit") ? "Em licitação" : rawStage.includes("depend") ? "Aguardando dependência" : rawStage.includes("desenvol") || rawStage.includes("andamento") ? "Em desenvolvimento" : "A iniciar"; const process = get("numero do processo", "processo", "protocolo"); const responsible = responsibleValue(get("responsavel", "servidor")); const priorityNumber = numberValue(get("prioridade")); return { id: `import-project-${await shortHash(`${title}|${process}`)}`, assignment: responsible ? { module: "projects", responsible } : undefined, bindings: [title, priorityNumber === 1 || priorityNumber === 2 ? priorityNumber : null, numberValue(get("area a construir", "area construcao", "area nova")), numberValue(get("area a reformar", "area reforma")), get("departamento", "secretaria", "setor"), dateValue(get("prazo", "data limite", "vencimento")), get("situacao atual", "status", "situacao") || stage, stage, process, get("inscricao imobiliaria", "inscricao do imovel", "cadastro imobiliario"), get("dependencia", "impedimento"), get("fonte de recurso", "recurso", "fonte"), numberValue(get("valor", "custo", "orcamento")), importedBy, importedBy] }; }));
    return { table: "manual_projects", sql: `INSERT INTO manual_projects (id,project,priority,area_to_build_m2,area_to_renovate_m2,department,deadline,current_status,stage,process_number,property_registration,dependency,funding_source,value,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET project=excluded.project,priority=excluded.priority,area_to_build_m2=excluded.area_to_build_m2,area_to_renovate_m2=excluded.area_to_renovate_m2,department=excluded.department,deadline=excluded.deadline,current_status=excluded.current_status,stage=excluded.stage,process_number=excluded.process_number,property_registration=excluded.property_registration,dependency=excluded.dependency,funding_source=excluded.funding_source,value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "procurements") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const object = inferredText(get, row, fileName); const process = get("numero do processo", "processo", "protocolo"); const rawModality = normalize(get("modalidade")); const modality = rawModality.includes("pregao") ? "Pregão eletrônico" : rawModality.includes("concorr") ? "Concorrência" : rawModality.includes("dispensa") ? "Dispensa" : rawModality.includes("inexig") ? "Inexigibilidade" : rawModality.includes("credenc") ? "Credenciamento" : rawModality.includes("concurso") ? "Concurso" : rawModality.includes("leilao") ? "Leilão" : "Outro"; const rawPhase = normalize(get("fase", "etapa")); const phase = rawPhase.includes("concl") ? "Concluída" : rawPhase.includes("homolog") ? "Homologação" : rawPhase.includes("julga") ? "Julgamento" : rawPhase.includes("disputa") ? "Em disputa" : rawPhase.includes("public") ? "Publicação" : rawPhase.includes("prepar") ? "Preparação" : rawPhase.includes("susp") ? "Suspensa" : "Planejamento"; const rawSituation = normalize(get("situacao", "status")); const situation = rawSituation.includes("concl") ? "Concluída" : rawSituation.includes("atras") ? "Atrasada" : rawSituation.includes("susp") ? "Suspensa" : rawSituation.includes("aten") ? "Atenção" : "No prazo"; const responsible = responsibleValue(get("responsavel", "servidor")); return { id: `import-procurement-${await shortHash(`${process}|${object}`)}`, assignment: responsible ? { module: "procurements", responsible } : undefined, bindings: [object, modality, process, phase, situation, dateValue(get("data de publicacao", "publicacao")), dateValue(get("data da sessao", "sessao")), numberValue(get("valor estimado", "valor", "orcamento")), get("fonte de recurso", "recurso", "fonte"), get("observacao", "notas", "descricao", "conteudo"), importedBy, importedBy] }; }));
    return { table: "procurements", sql: `INSERT INTO procurements (id,object,modality,process_number,phase,situation,planned_publication_date,session_date,estimated_value,funding_source,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET object=excluded.object,modality=excluded.modality,process_number=excluded.process_number,phase=excluded.phase,situation=excluded.situation,planned_publication_date=excluded.planned_publication_date,session_date=excluded.session_date,estimated_value=excluded.estimated_value,funding_source=excluded.funding_source,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "agenda") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const title = inferredText(get, row, fileName); const starts = dateTimeValue(get("data e horario", "inicio", "data", "horario"), `${today}T09:00`); const rawStatus = normalize(get("situacao", "status")); const status = rawStatus.includes("realiz") || rawStatus.includes("concl") ? "Realizado" : rawStatus.includes("cancel") ? "Cancelado" : "Agendado"; const participants = get("participantes", "convidados", "membros").split(/[;,\n]+/).map((name) => name.trim()).filter(Boolean); const responsible = responsibleValue(get("responsavel", "servidor")); return { id: `import-agenda-${await shortHash(`${title}|${starts}`)}`, assignment: responsible ? { module: "agenda", responsible } : undefined, bindings: [title, normalize(get("tipo")).includes("compromisso") ? "Compromisso" : "Reunião", starts, dateTimeValue(get("termino", "fim"), "") || null, get("local", "endereco"), JSON.stringify(participants), status, get("observacao", "notas", "descricao", "conteudo"), importedBy, importedBy] }; }));
    return { table: "agenda_items", sql: `INSERT INTO agenda_items (id,title,type,starts_at,ends_at,location,participants,status,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,type=excluded.type,starts_at=excluded.starts_at,ends_at=excluded.ends_at,location=excluded.location,participants=excluded.participants,status=excluded.status,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "geoprocessing") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const title = inferredText(get, row, fileName); const demandDate = dateValue(get("data da demanda", "data", "solicitacao"), today)!; const completed = yes(get("concluido", "situacao", "status")); const responsible = responsibleValue(get("responsavel", "servidor")); return { id: `import-geo-${await shortHash(`${title}|${demandDate}|${get("demandante", "solicitante", "requerente")}`)}`, assignment: responsible ? { module: "geoprocessing", responsible } : undefined, bindings: [title, get("demandante", "solicitante", "requerente") || "Relatório importado", demandDate, get("descricao", "detalhes", "observacao", "conteudo"), completed ? 1 : 0, completed ? now : null, importedBy, importedBy] }; }));
    return { table: "geoprocessing_demands", sql: `INSERT INTO geoprocessing_demands (id,title,requester,demand_date,description,completed,completed_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,requester=excluded.requester,demand_date=excluded.demand_date,description=excluded.description,completed=excluded.completed,completed_at=excluded.completed_at,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "festivals") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const description = inferredText(get, row, fileName); const expenseDate = dateValue(get("data da despesa", "data"), today)!; const eventName = get("festa", "evento") || fileName; const responsible = responsibleValue(get("responsavel", "servidor")) || RESPONSIBLE_OPTIONS[0]; const status = yes(get("quitado", "situacao", "status")) ? "Quitado" : "Pendente"; return { id: `import-festival-${await shortHash(`${eventName}|${expenseDate}|${description}`)}`, bindings: [eventName, expenseDate, description, numberValue(get("valor", "custo", "gasto")) ?? 0, get("quem pagou", "pagador") || "Não informado", get("quem deve", "devedor") || "Não informado", get("para quem", "credor") || "Não informado", responsible, status, get("observacao", "notas", "conteudo"), importedBy, importedBy] }; }));
    return { table: "party_expenses", sql: `INSERT INTO party_expenses (id,event_name,expense_date,description,amount,paid_by,debtor,creditor,responsible,status,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_name=excluded.event_name,expense_date=excluded.expense_date,description=excluded.description,amount=excluded.amount,paid_by=excluded.paid_by,debtor=excluded.debtor,creditor=excluded.creditor,responsible=excluded.responsible,status=excluded.status,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "staff-demands") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const title = inferredText(get, row, fileName); const staffName = responsibleValue(get("servidor", "responsavel", "destinatario")) || RESPONSIBLE_OPTIONS[0]; const dueDate = dateValue(get("prazo", "data limite", "vencimento", "data"), today)!; const completed = yes(get("concluido", "situacao", "status")); return { id: `import-staff-${await shortHash(`${staffName}|${title}|${dueDate}`)}`, bindings: [staffName, title, get("detalhes", "descricao", "observacao", "conteudo"), dueDate, completed ? 1 : 0, completed ? now : null, importedBy, importedBy] }; }));
    return { table: "staff_demands", sql: `INSERT INTO staff_demands (id,staff_name,title,details,due_date,completed,completed_at,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET staff_name=excluded.staff_name,title=excluded.title,details=excluded.details,due_date=excluded.due_date,completed=excluded.completed,completed_at=excluded.completed_at,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "master-plan") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const title = inferredText(get, row, fileName); const startDate = dateValue(get("data de inicio", "inicio", "data"), today)!; const dueDate = dateValue(get("prazo", "data limite", "termino", "fim"), startDate)!; const rawStatus = normalize(get("situacao", "status")); const status = rawStatus.includes("concl") ? "Concluído" : rawStatus.includes("valid") ? "Em validação" : rawStatus.includes("andamento") ? "Em andamento" : "Não iniciado"; const responsible = responsibleValue(get("responsavel", "servidor")) || RESPONSIBLE_OPTIONS[0]; const progress = Math.min(100, Math.max(0, Math.round(numberValue(get("progresso", "percentual", "avance")) ?? (status === "Concluído" ? 100 : 0)))); return { id: `import-master-${await shortHash(`${get("fase")}|${title}`)}`, bindings: [title, get("fase", "etapa") || "Preparação", get("tipo", "produto") || "Ação", get("descricao", "detalhes", "conteudo"), startDate, dueDate, status, progress, responsible, get("atores envolvidos", "participantes", "interessados"), get("referencia legal", "lei", "decreto", "processo"), get("artigo", "art"), get("paragrafo"), get("alinea"), get("item", "inciso"), get("observacao", "notas"), importedBy, importedBy] }; }));
    return { table: "master_plan_items", sql: `INSERT INTO master_plan_items (id,title,phase,item_type,description,start_date,due_date,status,progress,responsible,stakeholders,legal_reference,legal_article,legal_paragraph,legal_letter,legal_item,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,phase=excluded.phase,item_type=excluded.item_type,description=excluded.description,start_date=excluded.start_date,due_date=excluded.due_date,status=excluded.status,progress=excluded.progress,responsible=excluded.responsible,stakeholders=excluded.stakeholders,legal_reference=excluded.legal_reference,legal_article=excluded.legal_article,legal_paragraph=excluded.legal_paragraph,legal_letter=excluded.legal_letter,legal_item=excluded.legal_item,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "pai") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const title = inferredText(get, row, fileName); const startDate = dateValue(get("data de inicio", "inicio", "data"), today)!; const dueDate = dateValue(get("prazo", "data limite", "termino", "fim"), startDate)!; const rawStatus = normalize(get("situacao", "status")); const status = rawStatus.includes("concl") ? "Concluído" : rawStatus.includes("monitor") ? "Em monitoramento" : rawStatus.includes("exec") || rawStatus.includes("andamento") ? "Em execução" : "Planejado"; const responsible = responsibleValue(get("responsavel", "servidor")) || RESPONSIBLE_OPTIONS[0]; const progress = Math.min(100, Math.max(0, Math.round(numberValue(get("progresso", "percentual", "avance")) ?? (status === "Concluído" ? 100 : 0)))); return { id: `import-pai-${await shortHash(`${get("eixo")}|${title}`)}`, bindings: [title, get("eixo", "area", "tema") || "Desenvolvimento urbano", get("descricao", "detalhes", "conteudo"), startDate, dueDate, status, progress, numberValue(get("valor", "investimento", "custo estimado")), get("fonte de recursos", "fonte", "recurso"), responsible, get("local", "endereco", "bairro"), get("observacao", "notas"), importedBy, importedBy] }; }));
    return { table: "pai_items", sql: `INSERT INTO pai_items (id,title,axis,description,start_date,due_date,status,progress,estimated_value,funding_source,responsible,location,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,axis=excluded.axis,description=excluded.description,start_date=excluded.start_date,due_date=excluded.due_date,status=excluded.status,progress=excluded.progress,estimated_value=excluded.estimated_value,funding_source=excluded.funding_source,responsible=excluded.responsible,location=excluded.location,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  if (module === "councils") {
    const records = await Promise.all(rows.map(async (row) => { const get = picker(row.data); const name = get("conselho", "comissao", "comite", "colegiado", "nome", "titulo") || `${fileName} · linha ${row.sourceRow}`; const rawType = normalize(get("tipo") || name); const bodyType = rawType.includes("comissao") ? "Comissão" : rawType.includes("comite") ? "Comitê" : rawType.includes("grupo") ? "Grupo de Trabalho" : "Conselho"; const responsible = responsibleValue(get("responsavel", "servidor")) || RESPONSIBLE_OPTIONS[0]; const termStart = dateValue(get("inicio do mandato", "inicio", "data"), today)!; const termEndValue = dateValue(get("fim do mandato", "termino", "fim", "vencimento"), termEnd)!; const rawStatus = normalize(get("situacao", "status")); const status = rawStatus.includes("inativ") || rawStatus.includes("encerr") ? "Inativo" : rawStatus.includes("renov") ? "Em renovação" : "Ativo"; return { id: `import-council-${await shortHash(`${get("sigla")}|${name}`)}`, bindings: [name, get("sigla"), bodyType, get("ato de criacao", "ato legal", "lei", "decreto"), get("finalidade", "objetivo", "descricao", "conteudo"), responsible, get("presidente", "presidencia"), get("secretario", "secretaria executiva"), termStart, termEndValue, status, get("membros", "composicao", "participantes"), get("observacao", "notas"), importedBy, importedBy] }; }));
    return { table: "council_bodies", sql: `INSERT INTO council_bodies (id,name,acronym,body_type,legal_act,purpose,responsible,president,secretary,term_start,term_end,status,members,notes,created_by,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,acronym=excluded.acronym,body_type=excluded.body_type,legal_act=excluded.legal_act,purpose=excluded.purpose,responsible=excluded.responsible,president=excluded.president,secretary=excluded.secretary,term_start=excluded.term_start,term_end=excluded.term_end,status=excluded.status,members=excluded.members,notes=excluded.notes,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`, records };
  }

  return null;
}

export async function importNativeReportRows(options: { module: ItemModule; rows: GenericImportRow[]; fileName: string; importedBy: string }) {
  const plan = await planFor(options.module, options.rows, options.fileName, options.importedBy);
  if (!plan || !plan.records.length) return { insertedCount: 0, updatedCount: 0 };
  const binding = getD1Binding();
  const existing = await binding.prepare(`SELECT id FROM ${plan.table}`).all<{ id: string }>();
  const existingIds = new Set(existing.results.map((item) => item.id));
  const insertedCount = plan.records.filter((record) => !existingIds.has(record.id)).length;
  for (let index = 0; index < plan.records.length; index += 50) {
    const chunk = plan.records.slice(index, index + 50);
    await binding.batch(chunk.map((record) => binding.prepare(plan.sql).bind(record.id, ...record.bindings)));
    await binding.batch(chunk.map((record) => binding.prepare("DELETE FROM item_states WHERE module = ? AND item_id = ?").bind(options.module, record.id)));
    const assignments = chunk.filter((record) => record.assignment);
    if (assignments.length) {
      await binding.batch(assignments.map((record) => binding.prepare(`INSERT INTO module_assignments (module,item_id,responsible,updated_by) VALUES (?,?,?,?) ON CONFLICT(module,item_id) DO UPDATE SET responsible=excluded.responsible,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(record.assignment!.module, record.id, record.assignment!.responsible, options.importedBy)));
    }
  }
  return { insertedCount, updatedCount: plan.records.length - insertedCount };
}
