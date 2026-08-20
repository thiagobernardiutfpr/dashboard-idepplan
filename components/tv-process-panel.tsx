"use client";

import { BarChart3, ChevronLeft, ChevronRight, CircleDot, Clock3, LineChart, LogOut, Maximize2, Minimize2, Pause, PieChart, Play, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MappedProcess, ProcessRecord } from "@/lib/dashboard-types";
import { classifyOtherProcess, classifyPublicProcess, OTHER_PROCESS_GROUPS, PUBLIC_PROCESS_TYPES } from "@/lib/process-public-types";
import { TvProcessMap } from "@/components/tv-process-map";

const STATUS_COLORS = { active: "#38bdf8", overdue: "#f59e0b", closed: "#34d399", cancelled: "#64748b" };

function processState(process: ProcessRecord) {
  if (process.operationalState === "Cancelado") return "cancelled" as const;
  if (process.operationalState === "Encerrado") return "closed" as const;
  if (process.deadlineState === "Prazo vencido") return "overdue" as const;
  return "active" as const;
}

function pieBackground(values: Array<{ value: number; color: string }>) {
  const total = values.reduce((sum, item) => sum + item.value, 0);
  if (!total) return "conic-gradient(#183047 0 100%)";
  let cursor = 0;
  return `conic-gradient(${values.map((item) => {
    const start = cursor;
    cursor += (item.value / total) * 100;
    return `${item.color} ${start}% ${cursor}%`;
  }).join(", ")})`;
}

function TvClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(clock);
  }, []);
  return <div className="tv-clock"><Clock3 size={18} /><strong>{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong><span>{now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span></div>;
}

type PieSegment = { label: string; value: number; color: string };
type TvChartMode = "pie" | "donut" | "bar" | "line";
type TvChartItem = { id: string; label: string; total: number; color: string; segments: PieSegment[]; other?: boolean };
const HERO_GRAPHIC_MODES: TvChartMode[] = ["pie", "bar", "line", "donut"];
const ANALYTIC_COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#facc15", "#fb7185", "#60a5fa", "#fb923c", "#c084fc", "#2dd4bf", "#94a3b8"];

function countedSegments(processes: ProcessRecord[], value: (process: ProcessRecord) => string, colors = ANALYTIC_COLORS) {
  const counts = new Map<string, number>();
  for (const process of processes) {
    const label = value(process).trim() || "Não informado";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count], index) => ({ label, value: count, color: colors[index % colors.length] }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
}

function segmentedChartItems(id: string, label: string, segments: PieSegment[], color: string, chunkSize = 6): TvChartItem[] {
  const totalParts = Math.max(1, Math.ceil(segments.length / chunkSize));
  return Array.from({ length: totalParts }, (_, index) => {
    const part = segments.slice(index * chunkSize, (index + 1) * chunkSize);
    return {
      id: `${id}-${index + 1}`,
      label: totalParts > 1 ? `${label} · ${index + 1}/${totalParts}` : label,
      total: part.reduce((sum, item) => sum + item.value, 0),
      color,
      segments: part,
    };
  });
}

function TvChartGraphic({ mode, segments, label, animated = false }: { mode: TvChartMode; segments: PieSegment[]; label: string; animated?: boolean }) {
  if (mode === "bar") {
    const maximum = Math.max(1, ...segments.map((item) => item.value));
    return <div className={`tv-bar-chart ${animated ? "tv-chart-animated" : ""}`} role="img" aria-label={`Gráfico de barras de ${label}`}>{segments.map((item, index) => <div key={item.label} title={`${item.label}: ${item.value}`} style={{ "--hero-delay": `${index * 130}ms` } as CSSProperties}><i style={{ height: `${Math.max(item.value ? 12 : 2, (item.value / maximum) * 100)}%`, background: item.color }} /><span>{item.value}</span></div>)}</div>;
  }
  if (mode === "line") {
    const maximum = Math.max(1, ...segments.map((item) => item.value));
    const points = segments.map((item, index) => ({ ...item, x: segments.length === 1 ? 120 : 14 + (index / (segments.length - 1)) * 212, y: 86 - (item.value / maximum) * 68 }));
    return <svg className={`tv-line-chart ${animated ? "tv-chart-animated" : ""}`} viewBox="0 0 240 100" role="img" aria-label={`Gráfico de linhas de ${label}`}><path d="M14 86H226" /><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />{points.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="5" style={{ fill: point.color }} /><text x={point.x} y={Math.max(11, point.y - 9)}>{point.value}</text></g>)}</svg>;
  }
  return <div className="tv-pie-3d-stage"><div className={`tv-pie-chart ${mode === "donut" ? "tv-donut-chart" : ""} ${animated ? "tv-chart-animated" : ""}`} style={{ background: pieBackground(segments) }} role="img" aria-label={`${label}: ${segments.map((item) => `${item.label}, ${item.value}`).join("; ")}`}>{mode === "donut" ? <i /> : null}</div></div>;
}

function TvChartCard({ label, total, color, segments, mode, other = false }: { label: string; total: number; color: string; segments: PieSegment[]; mode: TvChartMode; other?: boolean }) {
  return <article className={`tv-pie-card ${other ? "tv-pie-card-other" : ""}`} style={{ "--type-color": color } as CSSProperties}>
    <header><span>{label}</span><strong>{total}</strong></header>
    <div className="tv-pie-card-body">
      <TvChartGraphic mode={mode} segments={segments} label={label} />
      <div className="tv-pie-values">{segments.filter((item) => item.value > 0 || !other).map((item) => <div key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><strong>{item.value}</strong></div>)}</div>
    </div>
  </article>;
}

export function TvProcessPanel({ processes, mappedProcesses, mapTotalProcesses, onExit, onRefresh }: { processes: ProcessRecord[]; mappedProcesses: MappedProcess[]; mapTotalProcesses?: number; onExit: () => void; onRefresh: () => void }) {
  const [fullscreen, setFullscreen] = useState(false);
  const [analysisReferenceTime] = useState(() => Date.now());
  const [chartMode, setChartMode] = useState<TvChartMode>("pie");
  const [heroMode, setHeroMode] = useState(true);
  const [heroPaused, setHeroPaused] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroCycle, setHeroCycle] = useState(0);

  useEffect(() => {
    const handleFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () => document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  const grouped = useMemo(() => PUBLIC_PROCESS_TYPES.map((type) => {
    const records = processes.filter((process) => classifyPublicProcess(process) === type.id);
    const counts = { active: 0, overdue: 0, closed: 0, cancelled: 0 };
    for (const process of records) counts[processState(process)] += 1;
    return { ...type, records, counts };
  }), [processes]);
  const otherRecords = useMemo(() => processes.filter((process) => !classifyPublicProcess(process)), [processes]);
  const otherSegments = useMemo(() => OTHER_PROCESS_GROUPS.map((group) => ({ ...group, value: otherRecords.filter((process) => classifyOtherProcess(process).id === group.id).length })), [otherRecords]);
  const chartItems = useMemo<TvChartItem[]>(() => {
    const generalStatus: PieSegment[] = [
      { label: "Em andamento", value: processes.filter((process) => processState(process) === "active").length, color: STATUS_COLORS.active },
      { label: "Atrasado", value: processes.filter((process) => processState(process) === "overdue").length, color: STATUS_COLORS.overdue },
      { label: "Encerrado", value: processes.filter((process) => processState(process) === "closed").length, color: STATUS_COLORS.closed },
      { label: "Cancelado", value: processes.filter((process) => processState(process) === "cancelled").length, color: STATUS_COLORS.cancelled },
    ];
    const receiptStatus: PieSegment[] = [
      { label: "Recebidos pelo servidor", value: processes.filter((process) => process.receivedAt).length, color: "#34d399" },
      { label: "Aguardando recebimento", value: processes.filter((process) => !process.receivedAt).length, color: "#64748b" },
    ];
    const deadlineSegments = countedSegments(processes, (process) => process.deadlineState, ["#f59e0b", "#34d399", "#a78bfa", "#64748b", "#60a5fa"]);
    const originSegments = countedSegments(processes, (process) => process.sourceCategory === "Empresa Fácil" ? "Empresa Fácil" : process.area);
    const responsibleSegments = countedSegments(processes, (process) => process.responsible || "Aguardando distribuição");
    const categorySegments = countedSegments(processes, (process) => process.category);
    const actionSegments = countedSegments(processes, (process) => process.actionType || "Sem ação informada");
    const riskSegments = countedSegments(processes, (process) => process.riskLevel || "Sem classificação de risco");
    const receivedMonths = countedSegments(processes.filter((process) => process.receivedAt), (process) => {
      const [year, month] = String(process.receivedAt).slice(0, 7).split("-");
      return `${month}/${year}`;
    }).sort((a, b) => a.label.localeCompare(b.label));
    const receiptAge: PieSegment[] = [
      { label: "Até 7 dias", value: 0, color: "#34d399" },
      { label: "8 a 15 dias", value: 0, color: "#22d3ee" },
      { label: "16 a 30 dias", value: 0, color: "#a78bfa" },
      { label: "Mais de 30 dias", value: 0, color: "#f59e0b" },
      { label: "Sem recebimento", value: 0, color: "#64748b" },
    ];
    for (const process of processes) {
      if (!process.receivedAt) {
        receiptAge[4].value += 1;
        continue;
      }
      const start = new Date(`${process.receivedAt.slice(0, 10)}T00:00:00Z`).getTime();
      const end = process.closedAt ? new Date(`${process.closedAt.slice(0, 10)}T00:00:00Z`).getTime() : analysisReferenceTime;
      const days = Math.max(0, Math.floor((end - start) / 86_400_000));
      receiptAge[days <= 7 ? 0 : days <= 15 ? 1 : days <= 30 ? 2 : 3].value += 1;
    }

    return [
      { id: "portfolio-status", label: "Todos os processos · situação geral", total: processes.length, color: "#22d3ee", segments: generalStatus },
      { id: "receipt-status", label: "Recebimento pelo servidor", total: processes.length, color: "#34d399", segments: receiptStatus },
      { id: "receipt-age", label: "Tempo desde o recebimento", total: processes.length, color: "#f59e0b", segments: receiptAge },
      ...segmentedChartItems("deadline", "Condição dos prazos", deadlineSegments, "#f59e0b"),
      ...segmentedChartItems("origin", "Origem dos processos", originSegments, "#2dd4bf"),
      ...grouped.map((type) => ({
        id: type.id,
        label: type.label,
        total: type.records.length,
        color: type.color,
        segments: [
          { label: "Em andamento", value: type.counts.active, color: STATUS_COLORS.active },
          { label: "Atrasado", value: type.counts.overdue, color: STATUS_COLORS.overdue },
          { label: "Encerrado", value: type.counts.closed, color: STATUS_COLORS.closed },
          { label: "Cancelado", value: type.counts.cancelled, color: STATUS_COLORS.cancelled },
        ],
      })),
      { id: "other", label: "Outros processos · classificação pela descrição", total: otherRecords.length, color: "#94a3b8", segments: otherSegments, other: true },
      ...segmentedChartItems("responsible", "Processos por responsável", responsibleSegments, "#60a5fa"),
      ...segmentedChartItems("category", "Processos por categoria", categorySegments, "#a78bfa"),
      ...segmentedChartItems("action", "Processos por ação", actionSegments, "#fb923c"),
      ...segmentedChartItems("risk", "Classificação de risco", riskSegments, "#fb7185"),
      ...segmentedChartItems("received-month", "Recebimentos por mês", receivedMonths, "#22d3ee", 8),
    ];
  }, [analysisReferenceTime, grouped, otherRecords.length, otherSegments, processes]);
  const active = processes.filter((process) => processState(process) === "active").length;
  const overdue = processes.filter((process) => processState(process) === "overdue").length;
  const mapped = mappedProcesses.length;
  const mappableTotal = mapTotalProcesses ?? processes.length;
  const heroItem = chartItems[heroIndex % Math.max(1, chartItems.length)];
  const heroGraphicMode = HERO_GRAPHIC_MODES[heroIndex % HERO_GRAPHIC_MODES.length];

  useEffect(() => {
    if (!heroMode || heroPaused || chartItems.length < 2) return;
    const interval = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % chartItems.length);
      setHeroCycle((current) => current + 1);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [chartItems.length, heroMode, heroPaused]);

  useEffect(() => {
    if (heroIndex < chartItems.length) return;
    const timer = window.setTimeout(() => setHeroIndex(0), 0);
    return () => window.clearTimeout(timer);
  }, [chartItems.length, heroIndex]);

  function selectChartMode(mode: TvChartMode) {
    setHeroMode(false);
    setChartMode(mode);
  }

  function stepHero(direction: number) {
    setHeroIndex((current) => (current + direction + chartItems.length) % chartItems.length);
    setHeroCycle((current) => current + 1);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }

  async function leavePanel() {
    if (document.fullscreenElement) await document.exitFullscreen();
    onExit();
  }

  return <section className="tv-panel" aria-label="Painel público de acompanhamento dos processos do IDEPPLAN">
    <header className="tv-header">
      <div className="tv-brand"><img src="/prefeitura-apucarana.png" alt="Prefeitura de Apucarana" /><span /><img src="/idepplan-2026.png" alt="IDEPPLAN" /></div>
      <div className="tv-title"><p>IDEPPLAN · Acompanhamento público</p><h1>Processos em movimento</h1><span>Transparência, planejamento e desenvolvimento de Apucarana</span></div>
      <div className="tv-header-actions">
        <TvClock />
        <button type="button" onClick={onRefresh} title="Atualizar dados agora" aria-label="Atualizar dados agora"><RefreshCw size={19} /></button>
        <button type="button" onClick={() => void toggleFullscreen()} title={fullscreen ? "Sair da tela cheia" : "Exibir em tela cheia"} aria-label={fullscreen ? "Sair da tela cheia" : "Exibir em tela cheia"}>{fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
        <button type="button" onClick={() => void leavePanel()} title="Voltar ao dashboard" aria-label="Voltar ao dashboard"><LogOut size={19} /></button>
      </div>
    </header>

    <div className="tv-kpis">
      <div><span>Processos acompanhados</span><strong>{processes.length}</strong><small>em {chartItems.length} gráficos analíticos</small></div>
      <div><span>Em andamento</span><strong>{active}</strong><small>tramitação regular</small></div>
      <div className={overdue ? "attention" : ""}><span>Atrasados</span><strong>{overdue}</strong><small>recebidos há mais de 30 dias</small></div>
      <div><span>No mapa</span><strong>{mappableTotal ? Math.round((mapped / mappableTotal) * 100) : 0}%</strong><small>{mapped} de {mappableTotal} localizados</small></div>
      <div><span>Atualização</span><strong>60s</strong><small>base compartilhada</small></div>
    </div>

    <div className="tv-content-grid">
      <div className="tv-pie-section">
        <div className="tv-section-heading">
          <div><span>Carteira completa</span><strong>Todos os processos, em diferentes recortes</strong></div>
          <div className="tv-chart-controls" aria-label="Formato e animação dos gráficos">
            <button
              type="button"
              className={heroMode ? "active hero-active" : ""}
              onClick={() => {
                setHeroMode((current) => !current);
                setHeroPaused(false);
                setHeroCycle((current) => current + 1);
              }}
              title="Destaque animado, com troca automática a cada 30 segundos"
            ><Sparkles size={15}/><span>Hero 30s</span></button>
            <button type="button" className={!heroMode && chartMode === "pie" ? "active" : ""} onClick={() => selectChartMode("pie")} title="Pizza"><PieChart size={15}/><span>Pizza</span></button>
            <button type="button" className={!heroMode && chartMode === "donut" ? "active" : ""} onClick={() => selectChartMode("donut")} title="Rosca"><CircleDot size={15}/><span>Rosca</span></button>
            <button type="button" className={!heroMode && chartMode === "bar" ? "active" : ""} onClick={() => selectChartMode("bar")} title="Barras"><BarChart3 size={15}/><span>Barras</span></button>
            <button type="button" className={!heroMode && chartMode === "line" ? "active" : ""} onClick={() => selectChartMode("line")} title="Linhas"><LineChart size={15}/><span>Linhas</span></button>
          </div>
          <div className="tv-status-key"><span><i style={{ background: STATUS_COLORS.active }} />Em andamento</span><span><i style={{ background: STATUS_COLORS.overdue }} />Atrasado</span><span><i style={{ background: STATUS_COLORS.closed }} />Encerrado</span><span><i style={{ background: STATUS_COLORS.cancelled }} />Cancelado</span></div>
        </div>
        {heroMode && heroItem ? <div className="tv-hero-stage" aria-live="polite">
          <article key={`${heroItem.id}-${heroCycle}`} className="tv-hero-card" style={{ "--type-color": heroItem.color } as CSSProperties}>
            <header>
              <div><span>Destaque automático · {heroGraphicMode === "pie" ? "Pizza 3D" : heroGraphicMode === "donut" ? "Rosca 3D" : heroGraphicMode === "bar" ? "Barras" : "Linhas"}</span><h2>{heroItem.label}</h2></div>
              <strong>{heroItem.total}<small>processos</small></strong>
            </header>
            <div className="tv-hero-card-body">
              <TvChartGraphic mode={heroGraphicMode} segments={heroItem.segments} label={heroItem.label} animated />
              <div className="tv-hero-values">{heroItem.segments.filter((item) => item.value > 0 || !heroItem.other).map((item) => <div key={item.label}><span><i style={{ background: item.color }} />{item.label}</span><strong>{item.value}<small>{heroItem.total ? `${Math.round((item.value / heroItem.total) * 100)}%` : "0%"}</small></strong></div>)}</div>
            </div>
            <div className="tv-hero-progress" aria-hidden="true"><i className={heroPaused ? "paused" : ""}/></div>
          </article>
          <div className="tv-hero-navigation">
            <button type="button" onClick={() => stepHero(-1)} aria-label="Gráfico anterior"><ChevronLeft size={20}/></button>
            <div aria-label={`Gráfico ${heroIndex + 1} de ${chartItems.length}`}>{chartItems.map((item, index) => <button key={item.id} type="button" className={index === heroIndex ? "active" : ""} onClick={() => { setHeroIndex(index); setHeroCycle((current) => current + 1); }} aria-label={`Exibir ${item.label}`}/>)}</div>
            <button type="button" onClick={() => setHeroPaused((current) => !current)} aria-label={heroPaused ? "Continuar animação" : "Pausar animação"}>{heroPaused ? <Play size={18}/> : <Pause size={18}/>}</button>
            <button type="button" onClick={() => stepHero(1)} aria-label="Próximo gráfico"><ChevronRight size={20}/></button>
          </div>
        </div> : <div className="tv-pie-grid">{chartItems.map((item) => <TvChartCard key={item.id} label={item.label} total={item.total} color={item.color} segments={item.segments} mode={chartMode} other={item.other} />)}</div>}
      </div>
      <TvProcessMap markers={mappedProcesses} />
    </div>
    <footer className="tv-footer"><span><i /> Dados atualizados automaticamente pela base compartilhada do IDEPPLAN</span><span>{processes.length} processos detalhados em {chartItems.length} visualizações · prazo contado do recebimento pelo servidor</span></footer>
  </section>;
}
