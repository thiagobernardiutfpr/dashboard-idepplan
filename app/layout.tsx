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

const payloadGuard = `
  (() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const requestedUrl = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : "";
      if (response.status === 401 && location.pathname !== "/login" && !requestedUrl.includes("/api/auth/login")) {
        const returnTo = location.pathname + location.search;
        location.replace("/login?returnTo=" + encodeURIComponent(returnTo));
        return response;
      }
      if (response.status !== 413 || (response.headers.get("content-type") || "").includes("json")) return response;
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      headers.delete("content-length");
      return new Response(JSON.stringify({
        error: "O conteúdo excedeu o limite de uma única requisição. Use o envio automático em partes ou reduza o conteúdo."
      }), { status: 413, statusText: response.statusText, headers });
    };
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
        <script dangerouslySetInnerHTML={{ __html: payloadGuard }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
