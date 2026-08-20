import Dashboard from "@/components/dashboard";
import data from "@/data/dashboard-data.json";
import projectsData from "@/data/projects-data.json";
import type { DashboardDataset, ProjectsDataset } from "@/lib/dashboard-types";
import { ItemLifecycleProvider } from "@/components/item-lifecycle";

export default function Home() {
  return (
    <ItemLifecycleProvider><Dashboard
      dataset={data as unknown as DashboardDataset}
      projectsDataset={projectsData as unknown as ProjectsDataset}
    /></ItemLifecycleProvider>
  );
}
