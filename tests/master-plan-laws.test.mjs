import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Plano Diretor organiza assuntos pelas nove leis municipais", async () => {
  const source = await readFile(
    new URL("../components/master-plan-module.tsx", import.meta.url),
    "utf8",
  );
  for (const law of [
    "Lei do Plano Diretor",
    "Lei de Uso e Ocupação do Solo",
    "Lei do Parcelamento do Solo",
    "Lei do Sistema Viário",
    "Lei do Código de Obras",
    "Código de Posturas",
    "Lei do Meio Ambiente",
    "Lei de Telecomunicações",
    "Lei do Perímetro Urbano",
  ]) assert.match(source, new RegExp(law));
  assert.match(source, /<span>Lei<\/span>/);
  assert.doesNotMatch(source, /"Habitação",\s*"Meio ambiente",\s*"Mobilidade"/);
});
