"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, TileLayer } from "leaflet";
import type { MappedProcess } from "@/lib/dashboard-types";
import { MapViewControls } from "@/components/map-view-controls";
import { DEFAULT_ACTIVE_MUNICIPAL_LAYERS, type MunicipalLayerId } from "@/lib/municipal-map-layers";
import { renderStaticMunicipalLayer, renderVisibleObsoleteLots } from "@/lib/municipal-map-renderer";

type ProcessMapProps = {
  markers: MappedProcess[];
  selectedProcessId: string;
  onPickCoordinate: (latitude: number, longitude: number) => void;
  onSelectProcess: (processId: string) => void;
  onCaptureApi?: (capture: (() => Promise<Blob | null>) | null) => void;
};

const APUCARANA_CENTER: [number, number] = [-23.5505, -51.4614];

function markerColor(marker: MappedProcess) {
  if (marker.process.deadlineState === "Prazo vencido") return "#f5b942";
  if (marker.process.operationalState === "Em andamento") return "#22d3ee";
  if (marker.process.operationalState === "Encerrado") return "#3b82f6";
  return "#8fa3b8";
}

function popupContent(marker: MappedProcess) {
  const container = document.createElement("div");
  container.className = "map-popup";

  const process = document.createElement("strong");
  process.textContent = `Processo ${marker.process.id}`;
  container.appendChild(process);

  const applicant = document.createElement("span");
  applicant.textContent = marker.process.applicant;
  container.appendChild(applicant);

  const category = document.createElement("small");
  category.textContent = marker.process.category;
  container.appendChild(category);

  if (marker.coordinate.locationLabel) {
    const location = document.createElement("small");
    location.textContent = marker.coordinate.locationLabel;
    container.appendChild(location);
  }

  return container;
}

export function ProcessMap({
  markers,
  selectedProcessId,
  onPickCoordinate,
  onSelectProcess,
  onCaptureApi,
}: ProcessMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const municipalLayerRef = useRef<LayerGroup | null>(null);
  const obsoleteLotsLayerRef = useRef<LayerGroup | null>(null);
  const labelsLayerRef = useRef<TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const pickRef = useRef(onPickCoordinate);
  const selectRef = useRef(onSelectProcess);
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
    selectRef.current = onSelectProcess;
  }, [onSelectProcess]);

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
      localMap.on("click", (event) => {
        pickRef.current(event.latlng.lat, event.latlng.lng);
      });
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
      const selected = marker.process.id === selectedProcessId;
      const position: [number, number] = [
        marker.coordinate.latitude,
        marker.coordinate.longitude,
      ];
      bounds.push(position);
      const circle = L.circleMarker(position, {
        radius: selected ? 10 : 7,
        color: selected ? "#ffffff" : markerColor(marker),
        weight: selected ? 3 : 2,
        fillColor: markerColor(marker),
        fillOpacity: selected ? 1 : 0.84,
      });
      circle.bindTooltip(marker.process.id, { direction: "top", offset: [0, -8] });
      circle.bindPopup(popupContent(marker), { maxWidth: 280 });
      circle.on("click", () => selectRef.current(marker.process.id));
      circle.addTo(layer);
    }

    const selectedMarker = markers.find(
      (marker) => marker.process.id === selectedProcessId,
    );
    if (selectedMarker) {
      map.flyTo(
        [selectedMarker.coordinate.latitude, selectedMarker.coordinate.longitude],
        Math.max(map.getZoom(), 15),
        { duration: 0.5 },
      );
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 15 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    } else {
      map.setView(APUCARANA_CENTER, 13);
    }
  }, [markers, ready, selectedProcessId]);

  function toggleLayer(id: MunicipalLayerId) {
    setActiveLayers((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const captureMap = useCallback(async () => {
    if (!containerRef.current) return null;
    const { toBlob } = await import("html-to-image");
    return toBlob(containerRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#06101b" });
  }, []);

  useEffect(() => {
    onCaptureApi?.(captureMap);
    return () => onCaptureApi?.(null);
  }, [captureMap, onCaptureApi]);

  async function exportPng() {
    setExporting(true);
    setExportMessage("");
    try {
      const blob = await captureMap();
      if (!blob) throw new Error("A imagem do mapa não pôde ser gerada.");
      const dataUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `mapa-${selectedProcessId || "processos"}-apucarana.png`;
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
    <div className="map-shell">
      <MapViewControls
        baseMode={baseMode}
        onBaseModeChange={setBaseMode}
        activeLayers={activeLayers}
        onToggleLayer={toggleLayer}
        onExport={() => void exportPng()}
        exporting={exporting}
      />
      <div
        ref={containerRef}
        className="map-canvas"
        role="application"
        aria-label="Mapa interativo dos processos em Apucarana"
      />
      {!ready ? <div className="map-loading">Preparando mapa…</div> : null}
      {exportMessage ? <div className="map-export-status" role="status">{exportMessage}</div> : null}
      <div className="map-hint">Clique no mapa para preencher latitude e longitude</div>
      <div className="map-legend" aria-label="Legenda do mapa">
        <span><i className="legend-cyan" /> Em andamento</span>
        <span><i className="legend-blue" /> Encerrado</span>
        <span><i className="legend-amber" /> Prazo vencido</span>
      </div>
    </div>
  );
}
