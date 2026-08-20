import { ensureDashboardSchema, getD1Binding, getR2Binding } from "@/db";
import type { ItemModule } from "@/lib/dashboard-types";

export const dynamic = "force-dynamic";

const MODULES: ItemModule[] = [
  "processes",
  "projects",
  "procurements",
  "agenda",
  "geoprocessing",
  "empresa-facil",
  "consultation",
  "festivals",
  "staff-demands",
  "master-plan",
  "councils",
  "pai",
];
const TABLES: Partial<Record<ItemModule, string[]>> = {
  processes: ["process_coordinates", "process_enrichments", "manual_processes"],
  projects: ["project_locations", "manual_projects"],
  procurements: ["procurements"],
  agenda: ["agenda_items"],
  geoprocessing: ["geoprocessing_demands"],
  "empresa-facil": ["empresa_facil_records"],
  festivals: ["party_expenses"],
  "staff-demands": ["staff_demands"],
  "master-plan": ["master_plan_items"],
  councils: [
    "council_requests",
    "council_members",
    "council_meetings",
    "council_bodies",
  ],
  pai: ["pai_items"],
};

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      module?: unknown;
      seedIds?: unknown;
      confirmation?: unknown;
    };
    const itemModule =
      typeof body.module === "string"
        ? (body.module as ItemModule)
        : ("" as ItemModule);
    const seedIds = Array.isArray(body.seedIds)
      ? [
          ...new Set(
            body.seedIds.filter(
              (id): id is string =>
                typeof id === "string" && id.length > 0 && id.length <= 240,
            ),
          ),
        ].slice(0, 1000)
      : [];
    if (!MODULES.includes(itemModule) || body.confirmation !== "EXCLUIR")
      return Response.json(
        { error: "Confirmação ou módulo inválido." },
        { status: 400 },
      );
    await ensureDashboardSchema();
    const db = getD1Binding();
    const attachments = await db
      .prepare("SELECT r2_key FROM item_attachments WHERE module = ?")
      .bind(itemModule)
      .all<{ r2_key: string }>();
    if (attachments.results.length)
      await Promise.all(
        attachments.results.map((item) => getR2Binding().delete(item.r2_key)),
      );

    const statements = [
      ...(TABLES[itemModule] ?? []).map((table) =>
        db.prepare(`DELETE FROM ${table}`),
      ),
      ...(itemModule === "councils"
        ? [
            db.prepare(
              "DELETE FROM workspace_agenda_items WHERE context_type = 'council'",
            ),
          ]
        : []),
      ...(itemModule === "master-plan"
        ? [
            db.prepare(
              "DELETE FROM workspace_agenda_items WHERE context_type = 'master-plan'",
            ),
          ]
        : []),
      db
        .prepare("DELETE FROM item_attachments WHERE module = ?")
        .bind(itemModule),
      db
        .prepare("DELETE FROM module_assignments WHERE module = ?")
        .bind(itemModule),
      db.prepare("DELETE FROM item_states WHERE module = ?").bind(itemModule),
      db
        .prepare("DELETE FROM report_import_rows WHERE module = ?")
        .bind(itemModule),
      itemModule === "empresa-facil"
        ? db
            .prepare(
              "DELETE FROM report_imports WHERE module = ? AND id <> 'empresa-facil-seed-relatorio-1'",
            )
            .bind(itemModule)
        : db
            .prepare("DELETE FROM report_imports WHERE module = ?")
            .bind(itemModule),
    ];
    await db.batch(statements);

    if (seedIds.length) {
      for (let index = 0; index < seedIds.length; index += 50) {
        const chunk = seedIds.slice(index, index + 50);
        await db.batch(
          chunk.map((id) =>
            db
              .prepare(
                "INSERT INTO item_states (module,item_id,completed,removed,updated_by) VALUES (?,?,0,1,'Limpeza do módulo') ON CONFLICT(module,item_id) DO UPDATE SET completed=0,removed=1,updated_by='Limpeza do módulo',updated_at=CURRENT_TIMESTAMP",
              )
              .bind(itemModule, id),
          ),
        );
      }
    }
    return Response.json({
      ok: true,
      module: itemModule,
      hiddenSeedItems: seedIds.length,
    });
  } catch (error) {
    console.error("Module clear error", error);
    return Response.json(
      {
        error:
          "Não foi possível limpar o módulo. Nenhuma exclusão adicional será tentada.",
      },
      { status: 500 },
    );
  }
}
