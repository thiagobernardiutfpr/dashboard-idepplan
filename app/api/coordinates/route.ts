import { desc, eq, sql } from "drizzle-orm";
import dataset from "@/data/dashboard-data.json";
import { ensureCoordinateSchema, getDb } from "@/db";
import { manualProcesses, processCoordinates } from "@/db/schema";
import { getRequestUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

const knownProcesses = new Set(dataset.processes.map((process) => process.id));

function apiError(error: unknown) {
  console.error("Coordinate API error", error);
  return Response.json(
    { error: "Não foi possível acessar a base compartilhada de coordenadas." },
    { status: 500 },
  );
}

async function validateProcessId(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  if (knownProcesses.has(value)) return value;
  const [record] = await getDb()
    .select({ id: manualProcesses.id })
    .from(manualProcesses)
    .where(eq(manualProcesses.id, value));
  return record ? value : null;
}

export async function GET() {
  try {
    await ensureCoordinateSchema();
    const db = getDb();
    const coordinates = await db
      .select()
      .from(processCoordinates)
      .orderBy(desc(processCoordinates.updatedAt));

    return Response.json({ coordinates });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as {
      processId?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      locationLabel?: unknown;
    };
    await ensureCoordinateSchema();
    const processId = await validateProcessId(payload.processId);
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    const locationLabel =
      typeof payload.locationLabel === "string"
        ? payload.locationLabel.trim().slice(0, 180)
        : "";

    if (!processId) {
      return Response.json({ error: "Processo inválido." }, { status: 400 });
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      return Response.json({ error: "Latitude inválida." }, { status: 400 });
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return Response.json({ error: "Longitude inválida." }, { status: 400 });
    }

    const db = getDb();
    const [coordinate] = await db
      .insert(processCoordinates)
      .values({
        processId,
        latitude,
        longitude,
        locationLabel,
        updatedBy: getRequestUser(request),
      })
      .onConflictDoUpdate({
        target: processCoordinates.processId,
        set: {
          latitude,
          longitude,
          locationLabel,
          updatedBy: getRequestUser(request),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .returning();

    return Response.json({ coordinate });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = (await request.json()) as { processId?: unknown };
    await ensureCoordinateSchema();
    const processId = await validateProcessId(payload.processId);
    if (!processId) {
      return Response.json({ error: "Processo inválido." }, { status: 400 });
    }

    const db = getDb();
    const [coordinate] = await db
      .delete(processCoordinates)
      .where(eq(processCoordinates.processId, processId))
      .returning();

    return Response.json({ coordinate: coordinate ?? null });
  } catch (error) {
    return apiError(error);
  }
}
