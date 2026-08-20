"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, TileLayer } from "leaflet";
import type { ProjectLocationRecord, ProjectRecord } from "@/lib/dashboard-types";
import { MapViewControls } from "@/components/map-view-controls";
import { DEFAULT_ACTIVE_MUNICIPAL_LAYERS, type MunicipalLayerId } from "@/lib/municipal-map-layers";
import { renderStaticMunicipalLayer, renderVisibleObsoleteLots } from "@/lib/municipal-map-renderer";

type ProjectMarker = {
  project: ProjectRecord;
  location: ProjectLocationRecord;
};

type ProjectMapProps = {
  markers: ProjectMarker[];
  selectedProjectId: string;
  onPickCoordinate: (latitude: number, longitude: number) => void;
  onSelectProject: (projectId: string) => void;
};

const APUCARANA_CENTER: [number, number] = [-23.5505, -51.4614];

function markerColor(project: ProjectRecord) {
  if (project.stage === "Aguardando dependência") return "#f5b942";
  if (project.stage === "Em licitação") return "#a78bfa";
  if (project.stage === "Em desenvolvimento") return "#22d3ee";
  return "#3b82f6";
}

function popupContent(marker: ProjectMarker) {
  const container = document.createElement("div");
  container.className = "map-popup";
  const title = document.createElement("strong");
  title.textContent = marker.project.project;
  container.appendChild(title);
  const stage = document.createElement("span");
  stage.textContent = marker.project.stage;
  container.appendChild(stage);
  if (marker.location.locationLabel) {
    const label = document.createElement("small");
    label.textContent = marker.location.locationLabel;
    container.appendChild(label);
  }
  return container;
}

export function ProjectMap({
  markers,
  selectedProjectId,
  onPickCoordinate,
  onSelectProject,
}: ProjectMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const municipalLayerRef = useRef<LayerGroup | null>(null);
  const obsoleteLotsLayerRef = useRef<LayerGroup | null>(null);
  const labelsLayerRef = useRef<TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const pickRef = useRef(onPickCoordinate);
  const selectRef = useRef(onSelectProject);
  const [ready, setReady] = useState(false);
  const [baseMode, setBaseMode] = useState<"satellite" | "hybrid">("hybrid");
  const [activeLayers, setActiveLayers] = useState<Set<MunicipalLayerId>>(
    () => new Set(DEFAULT_ACTIVE_MUNICIPAL_LAYERS),
  );
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");
  const [mapViewRevision, setMapViewRevision] = useState(0);

  useEffect(() => {
    pickRef.current = onPickCoordinate;
  }, [onPickCoordinate]);

  useEffect(() => {
    selectRef.current = onSelectProject;
  }, [onSelectProject]);

  useEffect(() => {
    let cancelled = false;
    let localMap: LeafletMap | null = null;

    async function initialize() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      localMap = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
      }).setView(APUCARANA_CENTER, 13);
      mapRef.current = localMap;
      L.control.zoom({ position: "bottomright" }).addTo(localMap);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Imagem © Esri",
        crossOrigin: true,
      }).addTo(localMap);
      labelsLayerRef.current = L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        pane: "overlayPane",
        crossOrigin: true,
      }).addTo(localMap);
      markerLayerRef.current = L.layerGroup().addTo(localMap);
      municipalLayerRef.current = L.layerGroup().addTo(localMap);
      obsoleteLotsLayerRef.current = L.layerGroup().addTo(localMap);
      localMap.on("click", (event) => pickRef.current(event.latlng.lat, event.latlng.lng));
      localMap.on("moveend", () => setMapViewRevision((value) => value + 1));
      setReady(true);
    }

    void initialize();
    return () => {
      cancelled = true;
      setReady(false);
      markerLayerRef.current = null;
      municipalLayerRef.current = null;
      obsoleteLotsLayerRef.current = null;
      labelsLayerRef.current = null;
      leafletRef.current = null;
      mapRef.current = null;
      localMap?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const labels = labelsLayerRef.current;
    if (!ready || !map || !labels) return;
    if (baseMode === "hybrid") labels.addTo(map);
    else map.removeLayer(labels);
  }, [baseMode, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = municipalLayerRef.current;
    if (!ready || !L || !layer) return;
    const controller = new AbortController();
    layer.clearLayers();
    const staticIds = [...activeLayers].filter((id): id is Exclude<MunicipalLayerId, "obsolete-lots"> => id !== "obsolete-lots");
    void Promise.all(staticIds.map((id) => renderStaticMunicipalLayer(L, layer, id, controller.signal))).catch(() => {});
    return () => controller.abort();
  }, [activeLayers, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = obsoleteLotsLayerRef.current;
    if (!ready || !L || !map || !layer) return;
    const controller = new AbortController();
    layer.clearLayers();
    if (activeLayers.has("obsolete-lots")) void renderVisibleObsoleteLots(L, map, layer, controller.signal).catch(() => {});
    return () => controller.abort();
  }, [activeLayers, mapViewRevision, ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    const bounds: Array<[number, number]> = [];

    for (const marker of markers) {
      const position: [number, number] = [marker.location.latitude, marker.location.longitude];
      bounds.push(position);
      const selected = marker.project.id === selectedProjectId;
      const color = markerColor(marker.project);
      const circle = L.circleMarker(position, {
        radius: selected ? 10 : 7,
        color: selected ? "#ffffff" : color,
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: selected ? 1 : 0.86,
      });
      circle.bindTooltip(marker.project.project, { direction: "top", offset: [0, -8] });
      circle.bindPopup(popupContent(marker), { maxWidth: 300 });
      circle.on("click", () => selectRef.current(marker.project.id));
      circle.addTo(layer);
    }

    const selected = markers.find((marker) => marker.project.id === selectedProjectId);
    if (selected) {
      map.flyTo([selected.location.latitude, selected.location.longitude], Math.max(15, map.getZoom()), { duration: 0.5 });
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else {
      map.setView(APUCARANA_CENTER, 13);
    }
  }, [markers, ready, selectedProjectId]);

  function toggleLayer(id: MunicipalLayerId) {
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function exportPng() {
    if (!containerRef.current) return;
    setExporting(true);
    setExportMessage("");
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(containerRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#06101b" });
      if (!blob) throw new Error("A imagem do mapa não pôde ser gerada.");
      const dataUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `mapa-${selectedProjectId || "projetos"}-apucarana.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(dataUrl), 2_000);
      setExportMessage("PNG gerado e enviado para downloads.");
    } catch {
      setExportMessage("Não foi possível gerar o PNG. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="map-shell project-map-shell">
      <MapViewControls
        baseMode={baseMode}
        onBaseModeChange={setBaseMode}
        activeLayers={activeLayers}
        onToggleLayer={toggleLayer}
        onExport={() => void exportPng()}
        exporting={exporting}
      />
      <div ref={containerRef} className="map-canvas" role="application" aria-label="Mapa híbrido dos projetos em Apucarana" />
      {!ready ? <div className="map-loading">Preparando mapa…</div> : null}
      {exportMessage ? <div className="map-export-status" role="status">{exportMessage}</div> : null}
      <div className="map-hint">Clique na imagem para preencher as coordenadas do projeto</div>
      <div className="map-legend" aria-label="Legenda do mapa de projetos">
        <span><i className="legend-cyan" /> Em desenvolvimento</span>
        <span><i className="legend-amber" /> Dependência</span>
        <span><i className="legend-violet" /> Em licitação</span>
      </div>
    </div>
  );
}
