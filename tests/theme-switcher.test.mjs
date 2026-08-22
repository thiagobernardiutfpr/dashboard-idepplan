import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("offers persistent dark, light and system themes", async () => {
  const source = await readFile(
    new URL("../components/theme-switcher.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /idepplan-dashboard-theme/);
  assert.match(source, /label: "Escuro"/);
  assert.match(source, /label: "Claro"/);
  assert.match(source, /label: "Sistema"/);
  assert.match(source, /prefers-color-scheme: dark/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /aria-checked/);
});

test("initializes the theme before the dashboard is painted", async () => {
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  const dashboard = await readFile(
    new URL("../components/dashboard.tsx", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(layout, /themeInitializer/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(dashboard, /<ThemeSwitcher \/>/);
  assert.match(css, /:root\[data-theme="light"\]/);
  assert.match(css, /--page-background/);
});
