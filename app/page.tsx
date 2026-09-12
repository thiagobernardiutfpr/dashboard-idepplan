import Link from "next/link";
import Dashboard from "@/components/dashboard";
import data from "@/data/dashboard-data.json";
import projectsData from "@/data/projects-data.json";
import type { DashboardDataset, ProjectsDataset } from "@/lib/dashboard-types";
import { ItemLifecycleProvider } from "@/components/item-lifecycle";

export default function Home() {
  return (
    <ItemLifecycleProvider>
      <Dashboard
        dataset={data as unknown as DashboardDataset}
        projectsDataset={projectsData as unknown as ProjectsDataset}
      />
      <Link
        href="/integracoes/atende"
        title="Gerenciar sincronização automática do Atende.Net"
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          zIndex: 1000,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: 12,
          border: "1px solid rgba(148, 163, 184, .28)",
          background: "rgba(15, 23, 42, .94)",
          color: "#e2e8f0",
          textDecoration: "none",
          fontSize: 13,
          fontWeight: 700,
          boxShadow: "0 12px 32px rgba(2, 6, 23, .28)",
          backdropFilter: "blur(12px)",
        }}
      >
        Integração Atende.Net
      </Link>
    </ItemLifecycleProvider>
  );
}
