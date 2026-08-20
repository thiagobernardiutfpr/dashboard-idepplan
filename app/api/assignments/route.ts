import { and, asc, eq, inArray, sql } from "drizzle-orm";
import dashboardDataset from "@/data/dashboard-data.json";
import projectsDataset from "@/data/projects-data.json";
import { ensureDashboardSchema, getDb } from "@/db";
import {
  agendaItems,
  empresaFacilRecords,
  geoprocessingDemands,
  manualProcesses,
  manualProjects,
  moduleAssignments,
  procurements,
} from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";
import { isResponsibleName } from "@/lib/responsibles";

export const dynamic = "force-dynamic";

const MODULES = ["processes", "projects", "procurements", "agenda", "geoprocessing", "empresa-facil"] as const;
type AssignmentModule = (typeof MODULES)[number];

const staticIds = {
  processes: new Set(dashboardDataset.processes.map((process) => process.id)),
  projects: new Set(projectsDataset.projects.map((project) => project.id)),
};

function parseModule(value: unknown): AssignmentModule | null {
  return typeof value === "string" && MODULES.includes(value as AssignmentModule)
    ? (value as AssignmentModule)
    : null;
}

function apiError(error: unknown) {
  console.error("Assignment API error", error);
  return Response.json(
    { error: "Não foi possível acessar as atribuições de responsáveis." },
    { status: 500 },
  );
}

async function validateItemIds(module: AssignmentModule, itemIds: string[]) {
  if (module === "processes" || module === "projects") {
    const missingIds = itemIds.filter((itemId) => !staticIds[module].has(itemId));
    if (!missingIds.length) return true;
    const table = module === "processes" ? manualProcesses : manualProjects;
    const rows = await getDb().select({ id: table.id }).from(table).where(inArray(table.id, missingIds));
    return rows.length === missingIds.length;
  }

  if (module === "empresa-facil") {
    const rows = await getDb()
      .select({ id: empresaFacilRecords.id })
      .from(empresaFacilRecords)
      .where(inArray(empresaFacilRecords.id, itemIds));
    return rows.length === itemIds.length;
  }

  const table = module === "procurements"
    ? procurements
    : module === "agenda"
      ? agendaItems
      : geoprocessingDemands;
  const rows = await getDb().select({ id: table.id }).from(table).where(inArray(table.id, itemIds));
  return rows.length === itemIds.length;
}

export async function GET() {
  try {
    await ensureDashboardSchema();
    const assignments = await getDb()
      .select()
      .from(moduleAssignments)
      .orderBy(asc(moduleAssignments.module), asc(moduleAssignments.itemId));
    return Response.json({ assignments });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      module?: unknown;
      itemIds?: unknown;
      responsible?: unknown;
    };
    const moduleName = parseModule(payload.module);
    const itemIds = Array.isArray(payload.itemIds)
      ? [...new Set(payload.itemIds.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean))]
      : [];
    const responsible = typeof payload.responsible === "string" ? payload.responsible.trim() : "";

    if (!moduleName) {
      return Response.json({ error: "Módulo inválido." }, { status: 400 });
    }
    if (!itemIds.length || itemIds.length > 250 || itemIds.some((itemId) => itemId.length > 160)) {
      return Response.json({ error: "Selecione entre 1 e 250 registros válidos." }, { status: 400 });
    }
    if (responsible && !isResponsibleName(responsible)) {
      return Response.json({ error: "Responsável inválido." }, { status: 400 });
    }

    await ensureDashboardSchema();
    if (!(await validateItemIds(moduleName, itemIds))) {
      return Response.json({ error: "Um ou mais registros selecionados são inválidos." }, { status: 400 });
    }

    const db = getDb();
    if (!responsible) {
      await db
        .delete(moduleAssignments)
        .where(
          and(
            eq(moduleAssignments.module, moduleName),
            inArray(moduleAssignments.itemId, itemIds),
          ),
        );
      return Response.json({ assignments: [], cleared: itemIds });
    }

    const updatedBy = getRequestUser(request);
    await db
      .insert(moduleAssignments)
      .values(
        itemIds.map((itemId) => ({
          module: moduleName,
          itemId,
          responsible,
          updatedBy,
        })),
      )
      .onConflictDoUpdate({
        target: [moduleAssignments.module, moduleAssignments.itemId],
        set: {
          responsible,
          updatedBy,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    const assignments = await db
      .select()
      .from(moduleAssignments)
      .where(
        and(
          eq(moduleAssignments.module, moduleName),
          inArray(moduleAssignments.itemId, itemIds),
        ),
      );

    return Response.json({ assignments, cleared: [] });
  } catch (error) {
    return apiError(error);
  }
}
