import Link from "next/link";
import { AtendeSyncPanel } from "@/components/atende-sync-panel";

export default function AtendeIntegrationPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "32px clamp(18px, 4vw, 54px)", background: "#020617", color: "#e2e8f0" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, opacity: .65, textTransform: "uppercase", letterSpacing: ".09em", fontSize: 13 }}>Dashboard IDEPPLAN · Integrações</p>
            <h1 style={{ margin: "7px 0 8px", fontSize: "clamp(28px, 4vw, 44px)" }}>Integração Atende.Net</h1>
            <p style={{ margin: 0, maxWidth: 760, opacity: .78 }}>
              Gerencie a chave do sincronizador Windows e acompanhe as emissões automáticas do Relatório Estatístico por Centro de Custos.
            </p>
          </div>
          <Link href="/" style={{ color: "#cbd5e1", textDecoration: "none", border: "1px solid rgba(148,163,184,.25)", borderRadius: 12, padding: "10px 14px" }}>
            Voltar ao Dashboard
          </Link>
        </header>
        <AtendeSyncPanel />
      </div>
    </main>
  );
}
