import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import XLSX from "xlsx";

const [sourceFile] = process.argv.slice(2);
if (!sourceFile) throw new Error("Informe a planilha de coordenadas por inscrição imobiliária.");

const output = path.resolve("public/property-coordinates");
const clean = (value) => String(value ?? "").trim();
const registrationKey = (value) => clean(value).replace(/\D/g, "");
const coordinate = (value) => {
  const parsed = Number(value);
  return Math.abs(parsed) > 180 ? parsed / 1_000_000 : parsed;
};
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const distanceMeters = ([lat1, lon1], [lat2, lon2]) => {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const radius = 6_371_000;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const workbook = XLSX.readFile(sourceFile, { cellDates: false });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "", raw: true });
const grouped = new Map();
let invalidRegistrationRows = 0;
let invalidCoordinateRows = 0;

for (const row of rows) {
  const key = registrationKey(row.Inscricao_Imobiliaria ?? row.inscricao ?? row["Inscrição Imobiliária"]);
  if (key.length < 10) { invalidRegistrationRows += 1; continue; }
  const longitude = coordinate(row.Longitude_X ?? row.longitude ?? row.Longitude);
  const latitude = coordinate(row.Latitude_Y ?? row.latitude ?? row.Latitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -24.2 || latitude > -22.9 || longitude < -52.1 || longitude > -50.8) {
    invalidCoordinateRows += 1;
    continue;
  }
  const points = grouped.get(key) ?? [];
  points.push([latitude, longitude]);
  grouped.set(key, points);
}

const buckets = new Map();
let ambiguousRegistrations = 0;
for (const [key, points] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
  const center = [median(points.map(([latitude]) => latitude)), median(points.map(([, longitude]) => longitude))];
  if (points.some((point) => distanceMeters(center, point) > 200)) { ambiguousRegistrations += 1; continue; }
  const prefix = key.slice(0, 4);
  const bucket = buckets.get(prefix) ?? {};
  bucket[key] = [Number(center[0].toFixed(6)), Number(center[1].toFixed(6))];
  buckets.set(prefix, bucket);
}

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
await Promise.all([...buckets].map(async ([prefix, records]) => {
  await fs.writeFile(path.join(output, `${prefix}.json.gzbin`), gzipSync(Buffer.from(JSON.stringify(records)), { level: 9 }));
}));

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(sourceFile),
  sourceRows: rows.length,
  coordinateRows: [...grouped.values()].reduce((total, points) => total + points.length, 0),
  registrations: [...buckets.values()].reduce((total, records) => total + Object.keys(records).length, 0),
  invalidRegistrationRows,
  invalidCoordinateRows,
  ambiguousRegistrations,
  prefixSize: 4,
  coordinateSystem: "SIRGAS 2000 / graus decimais",
};
await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest));
console.log(JSON.stringify(manifest, null, 2));
