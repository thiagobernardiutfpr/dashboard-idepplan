import { and, desc, eq, sql } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { manualProjects, moduleAssignments, projectLocations } from "@/db/schema";
import type { ProjectStage } from "@/lib/dashboard-types";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const STAGES: ProjectStage[] = ["A iniciar", "Em desenvolvimento", "Aguardando dependência", "Em licitação"];

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : undefined;
}

function optionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function validate(payload: Record<string, unknown>) {
  const project = cleanText(payload.project, 400);
  const rawPriority = payload.priority == null || payload.priority === "" ? null : Number(payload.priority);
  const priority = rawPriority === 1 || rawPriority === 2 ? rawPriority : rawPriority == null ? null : undefined;
  const areaToBuildM2 = optionalNumber(payload.areaToBuildM2);
  const areaToRenovateM2 = optionalNumber(payload.areaToRenovateM2);
  const department = cleanText(payload.department, 180);
  const deadline = cleanDate(payload.deadline);
  const currentStatus = cleanText(payload.currentStatus, 1000);
  const stage = cleanText(payload.stage, 80);
  const processNumber = cleanText(payload.processNumber, 100);
  const propertyRegistration = cleanText(payload.propertyRegistration, 40);
  const dependency = cleanText(payload.dependency, 500);
  const fundingSource = cleanText(payload.fundingSource, 180);
  const value = optionalNumber(payload.value);

  if (!project) return { error: "Informe o nome do projeto." } as const;
  if (priority === undefined) return { error: "Prioridade inválida." } as const;
  if (areaToBuildM2 === undefined || areaToRenovateM2 === undefined || value === undefined) return { error: "Informe valores numéricos válidos." } as const;
  if (deadline === undefined) return { error: "Prazo inválido." } as const;
  if (!currentStatus) return { error: "Informe a situação atual." } as const;
  if (!STAGES.includes(stage as ProjectStage)) return { error: "Etapa inválida." } as const;

  return { value: { project, priority, areaToBuildM2, areaToRenovateM2, department, deadline, currentStatus, stage, processNumber, propertyRegistration, dependency, fundingSource, value } } as const;
}

function apiError(error: unknown) {
  console.error("Manual project API error", error);
  return Response.json({ error: "Não foi possível acessar os projetos cadastrados." }, { status: 500 });
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    const records = await getDb().select().from(manualProjects).orderBy(desc(manualProjects.updatedAt));
    return Response.json({ projects: records });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = validate((await request.json()) as Record<string, unknown>);
    if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    await ensureDashboardSchema();
    const editor = getRequestUser(request);
    const [record] = await getDb().insert(manualProjects).values({ id: crypto.randomUUID(), ...parsed.value, createdBy: editor, updatedBy: editor }).returning();
    return Response.json({ project: record }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const id = cleanText(payload.id, 160);
    if (!id) return Response.json({ error: "Projeto inválido." }, { status: 400 });
    const parsed = validate(payload);
    if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
    await ensureDashboardSchema();
    const [record] = await getDb().update(manualProjects).set({ ...parsed.value, updatedBy: getRequestUser(request), updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(manualProjects.id, id)).returning();
    if (!record) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
    return Response.json({ project: record });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { id?: unknown };
    const id = cleanText(payload.id, 160);
    if (!id) return Response.json({ error: "Projeto inválido." }, { status: 400 });
    await ensureDashboardSchema();
    const db = getDb();
    const [record] = await db.delete(manualProjects).where(eq(manualProjects.id, id)).returning();
    if (!record) return Response.json({ error: "Projeto não encontrado." }, { status: 404 });
    await db.delete(moduleAssignments).where(and(eq(moduleAssignments.module, "projects"), eq(moduleAssignments.itemId, id)));
    await db.delete(projectLocations).where(eq(projectLocations.projectId, id));
    return Response.json({ project: record });
  } catch (error) { return apiError(error); }
}
