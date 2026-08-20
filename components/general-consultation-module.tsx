"use client";

import {
  Building2,
  Download,
  FileSearch,
  Hash,
  LoaderCircle,
  MapPin,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ItemFilesButton } from "@/components/item-lifecycle";
import { ZoningBadge } from "@/components/zoning-badge";
import {
  loadConsultationManifest,
  searchPropertyRecords,
  type ConsultationManifest,
  type PropertyRecord,
  type SearchMode,
} from "@/lib/property-consultation-client";
import {
  checkCnaeForZone,
  listCnaesForZone,
  normalizeCnae,
  type CnaePermissionStatus,
} from "@/lib/zoning-permissions";

const MODES: SearchMode[] = [
  "registration",
  "owner",
  "address",
  "identifier",
  "territory",
];
const ICONS = {
  registration: <Hash size={17} />,
  owner: <UserRound size={17} />,
  address: <MapPin size={17} />,
  identifier: <FileSearch size={17} />,
  territory: <Building2 size={17} />,
};
const STATUS_LABEL: Record<CnaePermissionStatus, string> = {
  permitted: "Permitido",
  tolerated: "Tolerado",
  prohibited: "Não permitido",
  "technical-review": "Análise técnica",
  "unknown-zone": "Zona não parametrizada",
};

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function GeneralConsultationModule() {
  const [manifest, setManifest] = useState<ConsultationManifest | null>(null);
  const [mode, setMode] = useState<SearchMode>("registration");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PropertyRecord[]>([]);
  const [selectedProperty, setSelectedProperty] =
    useState<PropertyRecord | null>(null);
  const [message, setMessage] = useState(
    "Digite ao menos quatro números da inscrição.",
  );
  const [searching, setSearching] = useState(false);
  const [loadingCnaes, setLoadingCnaes] = useState(false);
  const [cnaeQuery, setCnaeQuery] = useState("");
  const [cnaeFilter, setCnaeFilter] = useState("");
  const [cnaeRows, setCnaeRows] = useState<
    Awaited<ReturnType<typeof listCnaesForZone>>
  >([]);
  const [cnaeResult, setCnaeResult] =
    useState<Awaited<ReturnType<typeof checkCnaeForZone>>>(null);
  const [cnaeMessage, setCnaeMessage] = useState(
    "Selecione um imóvel para consultar a compatibilidade urbanística.",
  );
  const latest = useRef(0);

  useEffect(() => {
    loadConsultationManifest()
      .then(setManifest)
      .catch(() => setMessage("Não foi possível carregar a base cadastral."));
  }, []);

  async function searchProperties(event?: FormEvent) {
    event?.preventDefault();
    if (!manifest) return;
    const request = ++latest.current;
    setSearching(true);
    setSelectedProperty(null);
    setCnaeRows([]);
    setCnaeResult(null);
    setMessage("Consultando cadastro, zoneamento, numeração e coordenadas…");
    try {
      const rows = await searchPropertyRecords(mode, query);
      if (request !== latest.current) return;
      setResults(rows);
      setSelectedProperty(rows[0] ?? null);
      const located = rows.filter((row) => row.latitude != null).length;
      setMessage(
        rows.length
          ? `${rows.length} resultado${rows.length === 1 ? "" : "s"} · ${located} com coordenadas automáticas.`
          : "Nenhum imóvel encontrado.",
      );
      setCnaeMessage(
        rows[0]?.zone
          ? `Zoneamento ${rows[0].zone} identificado. Consulte os CNAEs abaixo.`
          : "O imóvel não possui zoneamento vinculado.",
      );
    } catch (error) {
      if (request === latest.current) {
        setResults([]);
        setMessage(
          error instanceof Error ? error.message : "Falha na consulta.",
        );
      }
    } finally {
      if (request === latest.current) setSearching(false);
    }
  }

  async function loadAllowedCnaes() {
    if (!selectedProperty?.zone)
      return setCnaeMessage("Selecione um imóvel com zoneamento vinculado.");
    setLoadingCnaes(true);
    setCnaeResult(null);
    try {
      const rows = await listCnaesForZone(selectedProperty.zone);
      setCnaeRows(rows);
      const permitted = rows.filter((row) => row.status === "permitted").length;
      const tolerated = rows.filter((row) => row.status === "tolerated").length;
      setCnaeMessage(
        rows.length
          ? `${permitted} CNAEs permitidos${tolerated ? ` · ${tolerated} tolerados` : ""} no zoneamento ${selectedProperty.zone}.`
          : `O zoneamento ${selectedProperty.zone} exige análise técnica individual.`,
      );
    } catch (error) {
      setCnaeMessage(
        error instanceof Error ? error.message : "Falha ao consultar CNAEs.",
      );
    } finally {
      setLoadingCnaes(false);
    }
  }

  async function verifyCnae(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedProperty?.zone)
      return setCnaeMessage("Selecione um imóvel com zoneamento vinculado.");
    if (normalizeCnae(cnaeQuery).length !== 7)
      return setCnaeMessage("Informe os sete dígitos do CNAE.");
    setLoadingCnaes(true);
    try {
      const result = await checkCnaeForZone(selectedProperty.zone, cnaeQuery);
      setCnaeResult(result);
      setCnaeMessage(
        result
          ? `${STATUS_LABEL[result.status]} no zoneamento ${selectedProperty.zone}.`
          : "CNAE não encontrado na planilha fornecida.",
      );
    } finally {
      setLoadingCnaes(false);
    }
  }

  function exportResults() {
    const header = [
      "Inscrição",
      "Zona",
      "Cadastro",
      "Proprietário",
      "CPF/CNPJ",
      "Tipo",
      "Bairro",
      "Logradouro",
      "Número",
      "CEP",
      "Quadra",
      "Lote",
      "Numeração QGIS",
      "Número no local",
      "Situação QGIS",
      "Latitude",
      "Longitude",
      "Observação QGIS",
    ];
    const rows = results.map((record) => [
      record.registration,
      record.zone,
      record.id,
      record.owner,
      record.document,
      record.propertyType,
      record.neighborhood,
      record.street,
      record.number,
      record.postalCode,
      record.block,
      record.lot,
      record.qgisNumber,
      record.onSiteNumber,
      record.numberingStatus,
      String(record.latitude ?? ""),
      String(record.longitude ?? ""),
      record.qgisObservation,
    ]);
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "consulta-geral-cadastral.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const selectedLabel = manifest?.modes[mode]?.label ?? "Consulta";
  const visibleCnaes = useMemo(() => {
    const filter = cnaeFilter.toLocaleLowerCase("pt-BR").trim();
    return cnaeRows
      .filter(
        (row) =>
          !filter ||
          `${row.cnae} ${row.description} ${row.classification}`
            .toLocaleLowerCase("pt-BR")
            .includes(filter),
      )
      .slice(0, 160);
  }, [cnaeFilter, cnaeRows]);

  return (
    <>
      <section className="dashboard-header module-header">
        <div>
          <p className="eyebrow">Central analítica · cadastro territorial</p>
          <h1>Consulta Geral</h1>
          <p>
            Cruzamento por inscrição imobiliária entre cadastro, zoneamento,
            localização e CNAEs.
          </p>
        </div>
        <div className="header-actions">
          <span className="database-chip ready">
            <ShieldCheck size={15} /> Base cadastral integrada
          </span>
          <button
            className="icon-button export-button"
            type="button"
            onClick={exportResults}
            disabled={!results.length}
          >
            <Download size={18} />
            <span>Exportar</span>
          </button>
        </div>
      </section>
      <section className="consultation-hero">
        <div className="consultation-mode-tabs" role="tablist">
          {MODES.map((item) => (
            <button
              key={item}
              className={mode === item ? "active" : ""}
              type="button"
              onClick={() => {
                setMode(item);
                setQuery("");
                setResults([]);
                setSelectedProperty(null);
                setCnaeRows([]);
                setMessage(
                  `Pesquise por ${manifest?.modes[item]?.label.toLowerCase() ?? item}.`,
                );
              }}
            >
              {ICONS[item]}
              <span>{manifest?.modes[item]?.label ?? item}</span>
            </button>
          ))}
        </div>
        <form
          className="consultation-search"
          onSubmit={(event) => void searchProperties(event)}
        >
          <label>
            <span>{selectedLabel}</span>
            <Search size={21} />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                mode === "registration"
                  ? "Ex.: 101.001.0012.001"
                  : mode === "owner"
                    ? "Ex.: Maria da Silva"
                    : mode === "address"
                      ? "Ex.: Munhoz da Rocha, 1800"
                      : mode === "identifier"
                        ? "Cadastro, CPF/CNPJ ou CEP"
                        : "Bairro, quadra, lote ou ZC1"
              }
            />
          </label>
          <button className="primary-button" type="submit" disabled={searching}>
            {searching ? (
              <LoaderCircle size={19} className="spin" />
            ) : (
              <Search size={19} />
            )}{" "}
            Consultar
          </button>
        </form>
        <p className="consultation-message">{message}</p>
      </section>
      <section className="kpi-grid consultation-kpis">
        <div className="kpi-card">
          <strong>{(manifest?.records ?? 0).toLocaleString("pt-BR")}</strong>
          <span>cadastros consultáveis</span>
        </div>
        <div className="kpi-card">
          <strong>{(manifest?.zoneRows ?? 0).toLocaleString("pt-BR")}</strong>
          <span>lotes com zoneamento</span>
        </div>
        <div className="kpi-card">
          <strong>{(manifest?.qgisRows ?? 0).toLocaleString("pt-BR")}</strong>
          <span>registros de numeração</span>
        </div>
        <div className="kpi-card">
          <strong>1.332</strong>
          <span>CNAEs classificados</span>
        </div>
      </section>
      <section className="panel consultation-results">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Resultado cadastral</p>
            <h2>Imóveis localizados</h2>
          </div>
          <span>
            {results.length} resultado{results.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="consultation-cards">
          {results.map((record) => (
            <article
              key={record.id}
              className={selectedProperty?.id === record.id ? "selected" : ""}
            >
              <header>
                <div>
                  <ZoningBadge zone={record.zone} />
                  <h3>{record.registration}</h3>
                  <small>
                    Cadastro nº {record.id} ·{" "}
                    {record.propertyType || "Tipo não informado"}
                  </small>
                </div>
                <ItemFilesButton
                  module="consultation"
                  itemId={record.id}
                  title={`Imóvel ${record.registration}`}
                />
              </header>
              <div className="property-grid">
                <div>
                  <span>Proprietário</span>
                  <strong>{record.owner || "—"}</strong>
                  <small>{record.document || "Documento não informado"}</small>
                </div>
                <div>
                  <span>Endereço</span>
                  <strong>
                    {[record.street, record.number]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </strong>
                  <small>
                    {[record.neighborhood, record.postalCode]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </div>
                <div>
                  <span>Quadra / lote</span>
                  <strong>
                    {record.block || "—"} / {record.lot || "—"}
                  </strong>
                  <small>Inscrição-base {record.baseRegistration}</small>
                </div>
                <div>
                  <span>Numeração QGIS</span>
                  <strong>
                    {record.qgisNumber || record.onSiteNumber || "—"}
                  </strong>
                  <small>
                    {record.numberingStatus || "Sem verificação registrada"}
                  </small>
                </div>
                <div>
                  <span>Coordenadas</span>
                  <strong>
                    {record.latitude != null
                      ? `${record.latitude.toFixed(6)}, ${record.longitude?.toFixed(6)}`
                      : "Não localizadas"}
                  </strong>
                  <small>
                    {record.latitude != null
                      ? "Cruzamento automático pela inscrição"
                      : "Sem correspondência na base QGIS"}
                  </small>
                </div>
              </div>
              {record.qgisObservation ? (
                <p className="property-note">{record.qgisObservation}</p>
              ) : null}
              <footer>
                <span>
                  Fontes: cadastro, zoneamento, numeração e coordenadas QGIS
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setSelectedProperty(record);
                    setCnaeRows([]);
                    setCnaeResult(null);
                    setCnaeMessage(
                      record.zone
                        ? `Zoneamento ${record.zone} selecionado.`
                        : "Sem zoneamento vinculado.",
                    );
                  }}
                >
                  Selecionar para CNAE
                </button>
              </footer>
            </article>
          ))}
          {!results.length ? (
            <div className="attachment-empty">
              <FileSearch size={28} />
              <span>Use uma das opções de busca para localizar imóveis.</span>
            </div>
          ) : null}
        </div>
      </section>
      <section className="panel cnae-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">Compatibilidade urbanística</p>
            <h2>CNAEs por zoneamento</h2>
            <p>
              {selectedProperty
                ? `Inscrição ${selectedProperty.registration} · zoneamento ${selectedProperty.zone || "não informado"}`
                : "Selecione um imóvel nos resultados acima."}
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => void loadAllowedCnaes()}
            disabled={!selectedProperty?.zone || loadingCnaes}
          >
            {loadingCnaes ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Search size={18} />
            )}{" "}
            Buscar CNAEs permitidos
          </button>
        </div>
        <div className="cnae-tools">
          <form onSubmit={(event) => void verifyCnae(event)}>
            <label>
              <span>Verificar CNAE específico</span>
              <input
                inputMode="numeric"
                value={cnaeQuery}
                onChange={(event) => setCnaeQuery(event.target.value)}
                placeholder="Ex.: 9609206"
              />
            </label>
            <button
              type="submit"
              className="secondary-button"
              disabled={!selectedProperty?.zone || loadingCnaes}
            >
              Verificar CNAE
            </button>
          </form>
          {cnaeRows.length ? (
            <label>
              <span>Filtrar lista</span>
              <input
                type="search"
                value={cnaeFilter}
                onChange={(event) => setCnaeFilter(event.target.value)}
                placeholder="Código, descrição ou classe"
              />
            </label>
          ) : null}
        </div>
        <p className="consultation-message">{cnaeMessage}</p>
        {cnaeResult ? (
          <div className={`cnae-result status-${cnaeResult.status}`}>
            <span>{STATUS_LABEL[cnaeResult.status]}</span>
            <strong>
              {cnaeResult.cnae} · {cnaeResult.description}
            </strong>
            <small>
              Classificação de uso {cnaeResult.classification} · zona{" "}
              {selectedProperty?.zone}
            </small>
          </div>
        ) : null}
        {cnaeRows.length ? (
          <div className="cnae-list">
            <header>
              <span>CNAE</span>
              <span>Atividade</span>
              <span>Classe</span>
              <span>Situação</span>
            </header>
            {visibleCnaes.map((row) => (
              <div key={row.cnae}>
                <strong>{row.cnae}</strong>
                <span>{row.description}</span>
                <span>{row.classification}</span>
                <span className={`status-${row.status}`}>
                  {STATUS_LABEL[row.status]}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="legal-note">
          Consulta orientativa baseada na LC Municipal 008/2020, alterada pela
          LC 005/2024. Porte, impacto, sistema viário, licenças e condicionantes
          permanecem sujeitos à análise técnica.{" "}
          <a
            href="https://sapl.apucarana.pr.leg.br/ta/3571/text?print"
            target="_blank"
            rel="noreferrer"
          >
            Consultar base legal
          </a>
          .
        </p>
      </section>
      <footer className="dashboard-footer">
        <span>Consulta indexada em quatro bases territoriais</span>
        <span>Resultados limitados a 80 por pesquisa</span>
      </footer>
    </>
  );
}
