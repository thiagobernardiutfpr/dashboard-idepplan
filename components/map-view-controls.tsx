"use client";

import {
  Check,
  Download,
  Layers3,
  LoaderCircle,
  Map,
  Satellite,
} from "lucide-react";
import type { MunicipalLayerId } from "@/lib/municipal-map-layers";
import { MUNICIPAL_MAP_LAYERS } from "@/lib/municipal-map-layers";
import { ZONING_PALETTE, ZONING_SWATCH_GRADIENT } from "@/lib/zoning-colors";

type MapViewControlsProps = {
  baseMode: "satellite" | "hybrid";
  onBaseModeChange: (mode: "satellite" | "hybrid") => void;
  activeLayers: Set<MunicipalLayerId>;
  onToggleLayer: (id: MunicipalLayerId) => void;
  onExport: () => void;
  exporting: boolean;
};

export function MapViewControls({
  baseMode,
  onBaseModeChange,
  activeLayers,
  onToggleLayer,
  onExport,
  exporting,
}: MapViewControlsProps) {
  return (
    <div className="map-view-controls" data-export-ignore="true">
      <div className="map-base-switch" aria-label="Mapa base">
        <button
          type="button"
          className={baseMode === "satellite" ? "active" : ""}
          onClick={() => onBaseModeChange("satellite")}
        >
          <Satellite size={15} /> Satélite
        </button>
        <button
          type="button"
          className={baseMode === "hybrid" ? "active" : ""}
          onClick={() => onBaseModeChange("hybrid")}
        >
          <Map size={15} /> Híbrido
        </button>
      </div>
      <details className="map-layer-menu">
        <summary>
          <Layers3 size={16} /> Camadas municipais
        </summary>
        <div>
          {MUNICIPAL_MAP_LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              disabled={!layer.geometryAvailable}
              className={activeLayers.has(layer.id) ? "active" : ""}
              onClick={() => onToggleLayer(layer.id)}
              title={`${layer.featureCount.toLocaleString("pt-BR")} feições do GeoPackage${layer.minZoom ? ` · visível a partir do zoom ${layer.minZoom}` : ""}`}
            >
              <i
                style={{
                  background:
                    layer.id === "zoning"
                      ? ZONING_SWATCH_GRADIENT
                      : layer.color,
                }}
              />
              <span>
                {layer.label}
                <small>
                  {layer.featureCount.toLocaleString("pt-BR")} feições
                  {layer.minZoom
                    ? ` · zoom ${layer.minZoom}+`
                    : " · GeoPackage"}
                </small>
              </span>
              {activeLayers.has(layer.id) ? <Check size={14} /> : null}
            </button>
          ))}
          {activeLayers.has("zoning") ? (
            <section
              className="zoning-color-legend"
              aria-label="Cores oficiais do zoneamento"
            >
              <header>
                <strong>Legenda do zoneamento</strong>
                <small>Paleta oficial</small>
              </header>
              <div>
                {ZONING_PALETTE.map(({ zone, color }) => (
                  <span key={zone}>
                    <i style={{ backgroundColor: color }} />
                    {zone}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          <p>
            Geometrias dos GeoPackages GEO e GEO2. A camada de lotes obsoletos é
            carregada por área visível para manter o mapa rápido.
          </p>
        </div>
      </details>
      <button
        type="button"
        className="map-download-button"
        onClick={onExport}
        disabled={exporting}
      >
        {exporting ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Download size={16} />
        )}{" "}
        PNG
      </button>
    </div>
  );
}
