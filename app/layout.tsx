import type { Metadata } from "next";
import "./globals.css";

const themeInitializer = `
  (() => {
    try {
      const preference = localStorage.getItem("idepplan-dashboard-theme") || "dark";
      const resolved = preference === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : preference;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themePreference = preference;
    } catch {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.dataset.themePreference = "dark";
    }
  })();
`;

export const metadata: Metadata = {
  title: "Painel de Processos Urbanísticos | Apucarana",
  description:
    "Dashboard interativo de processos urbanísticos com indicadores, filtros e georreferenciamento compartilhado.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
