import { desc, eq } from "drizzle-orm";
import { ensureDashboardSchema, getDb } from "@/db";
import { empresaFacilRecords, reportImports } from "@/db/schema";
import { ensureEmpresaFacilSeed } from "@/lib/empresa-facil-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDashboardSchema();
    await ensureEmpresaFacilSeed();
    const db = getDb();
    const [records, imports] = await Promise.all([
      db
        .select()
        .from(empresaFacilRecords)
        .orderBy(desc(empresaFacilRecords.requestedAt), desc(empresaFacilRecords.code)),
      db
        .select()
        .from(reportImports)
        .where(eq(reportImports.module, "empresa-facil"))
        .orderBy(desc(reportImports.createdAt))
        .limit(12),
    ]);
    return Response.json({ records, imports });
  } catch (error) {
    console.error("Empresa Fácil API error", error);
    return Response.json(
      { error: "Não foi possível carregar os dados do Empresa Fácil." },
      { status: 500 },
    );
  }
}

const field = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const code = field(body.code, 120);
    const status = field(body.status, 120);
    const actionType = field(body.actionType, 160);
    const requestedAt = field(body.requestedAt, 32);
    const applicantName = field(body.applicantName, 300);
    if (!code || !status || !actionType || !requestedAt || !applicantName) {
      return Response.json({ error: "Informe código, situação, ação, data e solicitante." }, { status: 400 });
    }
    await ensureDashboardSchema();
    const [record] = await getDb().insert(empresaFacilRecords).values({
      id: crypto.randomUUID(), code, status, actionType, requestedAt,
      protocol: field(body.protocol, 160), riskLevel: field(body.riskLevel, 120),
      propertyCode: field(body.propertyCode, 120), propertyRegistration: field(body.propertyRegistration, 160),
      primaryActivityCode: field(body.primaryActivityCode, 120), primaryActivityDescription: field(body.primaryActivityDescription, 500),
      cnpj: field(body.cnpj, 32), classification: field(body.classification, 180),
      applicantCode: field(body.applicantCode, 120), applicantName,
      economicRegistration: field(body.economicRegistration, 160), companyName: field(body.companyName, 300),
      indicators: field(body.indicators, 1000), sourceFile: "Cadastro manual",
    }).returning();
    return Response.json({ record }, { status: 201 });
  } catch (error) {
    console.error("Empresa Fácil POST error", error);
    return Response.json({ error: "Não foi possível cadastrar o processo do Empresa Fácil." }, { status: 500 });
  }
}
