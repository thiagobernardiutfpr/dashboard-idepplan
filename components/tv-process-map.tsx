"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { MappedProcess } from "@/lib/dashboard-types";
import { classifyOtherProcess, classifyPublicProcess, PUBLIC_PROCESS_TYPES, publicProcessType } from "@/lib/process-public-types";
import { DEFAULT_ACTIVE_MUNICIPAL_LAYERS, type MunicipalLayerId } from "@/lib/municipal-map-layers";
import { renderStaticMunicipalLayer, renderVisibleObsoleteLots } from "@/lib/municipal-map-renderer";

const APUCARANA_CENTER: [number, number] = [-23.5505, -51.4614];
const TV_ZONING_OPACITY = 0.1;
const EMPRESA_FACIL_COLOR = "#10b981";
const TV_MAP_TOUR_INTERVAL_MS = 12_000;
const TV_PROCESS_INFLUENCE_RADIUS = { overdue: 260, regular: 195 } as const;
const TV_MAP_FALLBACK_TOUR: Array<[number, number, number]> = [
  [-23.5505, -51.4614, 13],
  [-23.5368, -51.4458, 14],
  [-23.5682, -51.4822, 14],
  [-23.5588, -51.4318, 14],
];

function popupContent(marker: MappedProcess) {
  const container = document.createElement("div");
  container.className = "map-popup tv-map-popup";
  const typeId = classifyPublicProcess(marker.process);
  const title = document.createElement("strong");
  title.textContent = marker.process.displayId ?? marker.process.id;
  container.appendChild(title);
  const applicant = document.createElement("span");
  applicant.textContent = marker.process.applicant;
  container.appendChild(applicant);
  const type = document.createElement("small");
  type.textContent = marker.process.sourceCategory === "Empresa Fácil"
    ? `Empresa Fácil · ${marker.process.actionType || "Processo empresarial"}`
    : typeId ? publicProcessType(typeId).label : `Outros · ${classifyOtherProcess(marker.process).label}`;
  container.appendChild(type);
  const status = document.createElement("small");
  status.textContent = `${marker.process.status} · ${marker.process.deadlineState}`;
  container.appendChild(status);
  return container;
}

export function TvProcessMap({ markers }: { markers: MappedProcess[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const municipalLayersRef = useRef<Map<MunicipalLayerId, LayerGroup>>(new Map());
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);
  const visibleMarkers = markers;

  useEffect(() => {
    let cancelled = false;
    let localMap: LeafletMap | null = null;
    async function initialize() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      leafletRef.current = L;
      localMap = L.map(containerRef.current, { zoomControl: false, attributionControl: true, preferCanvas: true }).setView(APUCARANA_CENTER, 13);
      mapRef.current = localMap;
      L.control.zoom({ position: "bottomright" }).addTo(localMap);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagem © Esri" }).addTo(localMap);
      L.tileLayer("https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, pane: "overlayPane" }).addTo(localMap);
      localMap.createPane("processHeatPane");
      localMap.getPane("processHeatPane")!.style.zIndex = "450";
      localMap.createPane("processPointPane");
      localMap.getPane("processPointPane")!.style.zIndex = "500";
      layerRef.current = L.layerGroup().addTo(localMap);
      setReady(true);
    }
    void initialize();
    return () => {
      cancelled = true;
      setReady(false);
      layerRef.current = null;
      municipalLayersRef.current = new Map();
      leafletRef.current = null;
      mapRef.current = null;
      localMap?.remove();
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    const staticController = new AbortController();
    let obsoleteController: AbortController | null = null;
    const groups = new Map<MunicipalLayerId, LayerGroup>();

    for (const id of DEFAULT_ACTIVE_MUNICIPAL_LAYERS) {
      const group = L.layerGroup().addTo(map);
      groups.set(id, group);
      if (id !== "obsolete-lots") {
        void renderStaticMunicipalLayer(L, group, id, staticController.signal, {
          zoningFillOpacity: TV_ZONING_OPACITY,
          zoningStrokeOpacity: TV_ZONING_OPACITY,
        }).catch(() => undefined);
      }
    }
    municipalLayersRef.current = groups;

    const refreshObsoleteLots = () => {
      const group = groups.get("obsolete-lots");
      if (!group) return;
      obsoleteController?.abort();
      obsoleteController = new AbortController();
      group.clearLayers();
      void renderVisibleObsoleteLots(L, map, group, obsoleteController.signal).catch(() => undefined);
    };

    refreshObsoleteLots();
    map.on("moveend zoomend", refreshObsoleteLots);

    return () => {
      staticController.abort();
      obsoleteController?.abort();
      map.off("moveend zoomend", refreshObsoleteLots);
      for (const group of groups.values()) group.removeFrom(map);
      municipalLayersRef.current = new Map();
    };
  }, [ready]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();
    const bounds: Array<[number, number]> = [];
    for (const marker of visibleMarkers) {
      const typeId = classifyPublicProcess(marker.process);
      const type = marker.process.sourceCategory === "Empresa Fácil"
        ? { color: EMPRESA_FACIL_COLOR, shortLabel: "Empresa Fácil" }
        : typeId ? publicProcessType(typeId) : { color: "#94a3b8", shortLabel: classifyOtherProcess(marker.process).label };
      const position: [number, number] = [marker.coordinate.latitude, marker.coordinate.longitude];
      bounds.push(position);
      L.circle(position, {
        pane: "processHeatPane",
        radius: marker.process.deadlineState === "Prazo vencido"
          ? TV_PROCESS_INFLUENCE_RADIUS.overdue
          : TV_PROCESS_INFLUENCE_RADIUS.regular,
        stroke: false,
        fillColor: type.color,
        fillOpacity: marker.process.deadlineState === "Prazo vencido" ? 0.25 : 0.16,
        interactive: false,
      }).addTo(layer);
      const point = L.circleMarker(position, { pane: "processPointPane", radius: 5.5, color: "#ffffff", weight: 1.3, fillColor: type.color, fillOpacity: 0.96 });
      point.bindTooltip(`${type.shortLabel} · ${marker.process.displayId ?? marker.process.id}`, { direction: "top", offset: [0, -7] });
      point.bindPopup(popupContent(marker), { maxWidth: 300 });
      point.addTo(layer);
    }
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [34, 34], maxZoom: 14 });
    else if (bounds.length === 1) map.setView(bounds[0], 15);
    else map.setView(APUCARANA_CENTER, 13);
  }, [ready, visibleMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const uniqueProcessStops = [...new Map<string, [number, number, number]>(visibleMarkers.map((marker) => {
      const latitude = marker.coordinate.latitude;
      const longitude = marker.coordinate.longitude;
      return [
        `${latitude.toFixed(5)}:${longitude.toFixed(5)}`,
        [latitude, longitude, 15] as [number, number, number],
      ] as [string, [number, number, number]];
    })).values()];
    const sampleStep = Math.max(1, Math.ceil(uniqueProcessStops.length / 12));
    const sampledProcessStops = uniqueProcessStops.filter((_, index) => index % sampleStep === 0);
    const tourStops = sampledProcessStops.length > 1
      ? sampledProcessStops
      : sampledProcessStops.length === 1
        ? [sampledProcessStops[0], [APUCARANA_CENTER[0], APUCARANA_CENTER[1], 13] as [number, number, number]]
        : TV_MAP_FALLBACK_TOUR;
    let tourIndex = sampledProcessStops.length ? 0 : 1;
    let timer = 0;

    const advanceTour = () => {
      const [latitude, longitude, zoom] = tourStops[tourIndex % tourStops.length];
      map.flyTo([latitude, longitude], zoom, {
        animate: true,
        duration: 3.2,
        easeLinearity: 0.18,
      });
      tourIndex += 1;
      timer = window.setTimeout(advanceTour, TV_MAP_TOUR_INTERVAL_MS);
    };

    timer = window.setTimeout(advanceTour, 4_500);
    return () => {
      window.clearTimeout(timer);
      map.stop();
    };
  }, [ready, visibleMarkers]);

  const empresaFacilCount = visibleMarkers.filter((marker) => marker.process.sourceCategory === "Empresa Fácil").length;

  return <div className="tv-map-shell">
    <div ref={containerRef} className="tv-map-canvas" role="application" aria-label="Mapa de calor dos processos do IDEPPLAN em Apucarana" />
    {!ready ? <div className="map-loading">Preparando mapa de calor…</div> : null}
    <div className="tv-map-tour-badge" aria-label="Mapa animado com roteiro automático"><i /> Mapa animado · roteiro de 12s</div>
    <div className="tv-map-title"><span>Distribuição territorial</span><strong>Mapa de calor dos processos</strong><small>{visibleMarkers.length} processos georreferenciados · {empresaFacilCount} do Empresa Fácil · {DEFAULT_ACTIVE_MUNICIPAL_LAYERS.length} camadas ativas · Zoneamento 90% transparente · Nascentes desativadas</small></div>
    <div className="tv-map-legend" aria-label="Cores dos tipos de processo">{PUBLIC_PROCESS_TYPES.map((type) => <span key={type.id}><i style={{ backgroundColor: type.color }} />{type.shortLabel}</span>)}<span><i style={{ backgroundColor: EMPRESA_FACIL_COLOR }} />Empresa Fácil</span><span><i style={{ backgroundColor: "#94a3b8" }} />Outros</span></div>
  </div>;
}
