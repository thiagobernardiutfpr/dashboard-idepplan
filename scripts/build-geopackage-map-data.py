#!/usr/bin/env python3
"""Convert the municipal GeoPackages into compact Leaflet-ready JSON assets.

Only Python's standard library is used so the conversion remains reproducible in
the Sites build environment. Coordinates are emitted as [latitude, longitude].
"""

from __future__ import annotations

import json
import math
import csv
import sqlite3
import struct
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
UPLOAD = Path("/workspace/scratch/23b55fbbee38/upload")
OUTPUT = ROOT / "public" / "map-data"
GEO = UPLOAD / "GEO.gpkg"
GEO2 = UPLOAD / "GEO2.gpkg"
ZONING_CSV = UPLOAD / "zoneamento(1).csv"
APUCARANA_BOUNDS = (-52.0, -24.1, -51.0, -22.9)  # west, south, east, north

LAYERS = {
    "app": (GEO, "APP", 31982, ("id",)),
    "power-lines": (GEO, "ALTA TENSÃO", 4674, ("FIAÇÃO",)),
    "springs": (GEO, "NASCENTE_OLHO_DAGUA", 4674, ("TEMA", "IDF")),
    "urban-perimeter": (GEO, "PERIMETRO CIDADE E DISTRITOS", 31982, ("Nome",)),
    "rivers": (GEO, "Rios", 32722, ("nome", "observacao")),
    "road-system": (GEO, "SistemaViario", 31982, ("nome", "tipo")),
    "landfill-buffer": (GEO, "ÁREA DE AMORTECIMENTO ATERRO", 4326, ("id",)),
    "sewage-buffer": (GEO, "ZONA DE EMORTECIMENTO ETE", 4326, ("id",)),
    "zoning": (GEO, "ZONEAMENTO", 31982, ("fid",)),
    "municipal-lots": (GEO2, "LOTES PREFEITURA", 32722, ("inscricao", "situacao")),
    "obsolete-lots": (GEO2, "LOTES OBSOLETO", 32722, ("inscricao", "situacao")),
}

TOLERANCE = {
    "app": 0.00004,
    "power-lines": 0.000015,
    "springs": 0.0,
    "urban-perimeter": 0.000015,
    "rivers": 0.000018,
    "road-system": 0.000008,
    "landfill-buffer": 0.000015,
    "sewage-buffer": 0.000015,
    "zoning": 0.000009,
    "municipal-lots": 0.000003,
    "obsolete-lots": 0.000004,
}


class WkbReader:
    def __init__(self, data: bytes):
        self.data = data
        self.offset = 0

    def read(self, size: int) -> bytes:
        value = self.data[self.offset : self.offset + size]
        self.offset += size
        return value

    def uint(self, order: str) -> int:
        return struct.unpack(f"{order}I", self.read(4))[0]

    def doubles(self, order: str, count: int) -> list[float]:
        return list(struct.unpack(f"{order}{'d' * count}", self.read(8 * count)))

    def geometry(self) -> tuple[str, Any]:
        order = "<" if self.read(1)[0] == 1 else ">"
        raw_type = self.uint(order)
        has_z = bool(raw_type & 0x80000000)
        has_m = bool(raw_type & 0x40000000)
        has_srid = bool(raw_type & 0x20000000)
        base = raw_type & 0x0FFFFFFF
        dimensions = 2 + int(has_z) + int(has_m)
        if base >= 3000:
            base -= 3000
            dimensions = 4
        elif base >= 2000:
            base -= 2000
            dimensions = 3
        elif base >= 1000:
            base -= 1000
            dimensions = 3
        if has_srid:
            self.uint(order)

        def point() -> list[float]:
            return self.doubles(order, dimensions)[:2]

        if base == 1:
            return "Point", point()
        if base == 2:
            return "LineString", [point() for _ in range(self.uint(order))]
        if base == 3:
            rings = []
            for _ in range(self.uint(order)):
                rings.append([point() for _ in range(self.uint(order))])
            return "Polygon", rings
        if base in (4, 5, 6, 7):
            names = {4: "MultiPoint", 5: "MultiLineString", 6: "MultiPolygon", 7: "GeometryCollection"}
            return names[base], [self.geometry() for _ in range(self.uint(order))]
        raise ValueError(f"Unsupported WKB geometry type: {base}")


def gpkg_wkb(blob: bytes) -> bytes:
    if blob[:2] != b"GP":
        return blob
    flags = blob[3]
    envelope_code = (flags >> 1) & 0b111
    envelope_doubles = {0: 0, 1: 4, 2: 6, 3: 6, 4: 8}.get(envelope_code, 0)
    return blob[8 + envelope_doubles * 8 :]


def inverse_utm(easting: float, northing: float, zone: int = 22) -> tuple[float, float]:
    """Return lon/lat for WGS84/SIRGAS UTM in the southern hemisphere."""
    a = 6378137.0
    eccentricity = 0.08181919084262149
    k0 = 0.9996
    x = easting - 500000.0
    y = northing - 10000000.0
    m = y / k0
    mu = m / (a * (1 - eccentricity**2 / 4 - 3 * eccentricity**4 / 64 - 5 * eccentricity**6 / 256))
    e1 = (1 - math.sqrt(1 - eccentricity**2)) / (1 + math.sqrt(1 - eccentricity**2))
    j1 = 3 * e1 / 2 - 27 * e1**3 / 32
    j2 = 21 * e1**2 / 16 - 55 * e1**4 / 32
    j3 = 151 * e1**3 / 96
    j4 = 1097 * e1**4 / 512
    fp = mu + j1 * math.sin(2 * mu) + j2 * math.sin(4 * mu) + j3 * math.sin(6 * mu) + j4 * math.sin(8 * mu)
    e2 = eccentricity**2 / (1 - eccentricity**2)
    c1 = e2 * math.cos(fp) ** 2
    t1 = math.tan(fp) ** 2
    r1 = a * (1 - eccentricity**2) / (1 - eccentricity**2 * math.sin(fp) ** 2) ** 1.5
    n1 = a / math.sqrt(1 - eccentricity**2 * math.sin(fp) ** 2)
    d = x / (n1 * k0)
    q1 = n1 * math.tan(fp) / r1
    q2 = d**2 / 2
    q3 = (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * e2) * d**4 / 24
    q4 = (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * e2 - 3 * c1**2) * d**6 / 720
    latitude = fp - q1 * (q2 - q3 + q4)
    q5 = d
    q6 = (1 + 2 * t1 + c1) * d**3 / 6
    q7 = (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * e2 + 24 * t1**2) * d**5 / 120
    longitude = math.radians(zone * 6 - 183) + (q5 - q6 + q7) / math.cos(fp)
    return math.degrees(longitude), math.degrees(latitude)


def transform_point(point: list[float], srs: int) -> list[float]:
    x, y = point
    if srs in (31982, 32722):
        lon, lat = inverse_utm(x, y)
    else:
        lon, lat = x, y
    return [round(lat, 6), round(lon, 6)]


def perpendicular_distance(point: list[float], start: list[float], end: list[float]) -> float:
    x, y = point[1], point[0]
    x1, y1 = start[1], start[0]
    x2, y2 = end[1], end[0]
    if x1 == x2 and y1 == y2:
        return math.hypot(x - x1, y - y1)
    return abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / math.hypot(y2 - y1, x2 - x1)


def simplify_line(points: list[list[float]], tolerance: float, closed: bool = False) -> list[list[float]]:
    if len(points) <= (4 if closed else 2) or tolerance <= 0:
        return points
    work = points[:-1] if closed and points[0] == points[-1] else points
    if len(work) <= 3:
        result = work
    else:
        first, last = work[0], work[-1]
        max_distance, index = 0.0, 0
        for i in range(1, len(work) - 1):
            distance = perpendicular_distance(work[i], first, last)
            if distance > max_distance:
                index, max_distance = i, distance
        if max_distance > tolerance:
            left = simplify_line(work[: index + 1], tolerance)
            right = simplify_line(work[index:], tolerance)
            result = left[:-1] + right
        else:
            result = [first, last]
    if closed:
        if len(result) < 3:
            result = work[:3]
        return result + [result[0]]
    return result


def flatten_geometry(geometry: tuple[str, Any], srs: int, tolerance: float) -> list[tuple[str, Any]]:
    kind, coordinates = geometry
    if kind == "Point":
        return [("p", transform_point(coordinates, srs))]
    if kind == "LineString":
        points = [transform_point(point, srs) for point in coordinates]
        return [("l", simplify_line(points, tolerance))]
    if kind == "Polygon":
        rings = []
        for ring in coordinates:
            points = [transform_point(point, srs) for point in ring]
            simplified = simplify_line(points, tolerance, closed=True)
            if len(simplified) >= 4:
                rings.append(simplified)
        return [("a", rings)] if rings else []
    parts: list[tuple[str, Any]] = []
    for child in coordinates:
        parts.extend(flatten_geometry(child, srs, tolerance))
    return parts


def all_points(value: Any) -> Iterable[list[float]]:
    if isinstance(value, list) and len(value) == 2 and all(isinstance(item, (int, float)) for item in value):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from all_points(item)


def in_municipal_extent(coordinates: Any) -> bool:
    points = list(all_points(coordinates))
    if not points:
        return False
    south = min(point[0] for point in points)
    north = max(point[0] for point in points)
    west = min(point[1] for point in points)
    east = max(point[1] for point in points)
    bound_west, bound_south, bound_east, bound_north = APUCARANA_BOUNDS
    return not (east < bound_west or west > bound_east or north < bound_south or south > bound_north)


def label(row: sqlite3.Row, fields: tuple[str, ...]) -> str:
    values = []
    for field in fields:
        value = row[field] if field in row.keys() else None
        text = str(value).strip() if value is not None else ""
        if text and text.lower() not in {"none", "null"} and text not in values:
            values.append(text)
    return " · ".join(values)[:180]


def zoning_labels() -> dict[int, str]:
    """Match the geometry's zero-based fid to the exported QGIS zoning table."""
    if not ZONING_CSV.exists():
        return {}
    with ZONING_CSV.open(encoding="utf-8-sig", newline="") as handle:
        return {
            int(row["fid"]) - 1: row.get("sigla_zone", "").strip()
            for row in csv.DictReader(handle)
            if row.get("fid")
        }


def tile_for(coordinates: Any, zoom: int = 15) -> str:
    points = list(all_points(coordinates))
    lat = sum(point[0] for point in points) / len(points)
    lon = sum(point[1] for point in points) / len(points)
    scale = 2**zoom
    x = int((lon + 180.0) / 360.0 * scale)
    latitude = math.radians(max(-85.05112878, min(85.05112878, lat)))
    y = int((1.0 - math.asinh(math.tan(latitude)) / math.pi) / 2.0 * scale)
    return f"{x}-{y}"


def dump(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def convert_layer(layer_id: str) -> tuple[int, int, int]:
    path, table, srs, label_fields = LAYERS[layer_id]
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    geometry_column = connection.execute(
        "SELECT column_name FROM gpkg_geometry_columns WHERE table_name = ?", (table,)
    ).fetchone()[0]
    rows = connection.execute(f'SELECT * FROM "{table}"')
    features: list[list[Any]] = []
    tiled: dict[str, list[list[Any]]] = defaultdict(list)
    source_count = 0
    part_count = 0
    coordinate_count = 0
    zoning_by_fid = zoning_labels() if layer_id == "zoning" else {}
    for row in rows:
        source_count += 1
        blob = row[geometry_column]
        if not blob:
            continue
        try:
            geometry = WkbReader(gpkg_wkb(blob)).geometry()
            parts = flatten_geometry(geometry, srs, TOLERANCE[layer_id])
        except (ValueError, IndexError, struct.error):
            continue
        text = (zoning_by_fid.get(int(row["fid"])) or "Sem classificação") if layer_id == "zoning" else label(row, label_fields)
        for kind, coordinates in parts:
            if not in_municipal_extent(coordinates):
                continue
            feature: list[Any] = [kind, coordinates]
            if text:
                feature.append(text)
            coordinate_count += sum(1 for _ in all_points(coordinates))
            part_count += 1
            if layer_id == "obsolete-lots":
                tiled[tile_for(coordinates)].append(feature)
            else:
                features.append(feature)
    connection.close()

    if layer_id == "obsolete-lots":
        directory = OUTPUT / layer_id
        directory.mkdir(parents=True, exist_ok=True)
        for old in directory.glob("*.json"):
            old.unlink()
        for tile, tile_features in tiled.items():
            dump(directory / f"{tile}.json", {"v": 1, "f": tile_features})
        dump(directory / "index.json", {"v": 1, "z": 15, "minZoom": 15, "count": part_count, "tiles": sorted(tiled)})
    else:
        dump(OUTPUT / f"{layer_id}.json", {"v": 1, "f": features})
    return source_count, part_count, coordinate_count


def main() -> None:
    if not GEO.exists() or not GEO2.exists():
        raise SystemExit("GEO.gpkg and GEO2.gpkg are required in the upload directory")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    print("layer\tsource\tparts\tcoordinates")
    for layer_id in LAYERS:
        source, parts, coordinates = convert_layer(layer_id)
        print(f"{layer_id}\t{source}\t{parts}\t{coordinates}")


if __name__ == "__main__":
    main()
