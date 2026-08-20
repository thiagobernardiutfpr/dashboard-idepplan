type MonthDatum = {
  key: string;
  label: string;
  value: number;
};

type DonutDatum = {
  label: string;
  value: number;
  color: string;
};

type DistributionDatum = {
  label: string;
  value: number;
  color?: string;
};

export function DistributionBars({
  data,
  emptyLabel = "Sem dados para os filtros atuais.",
}: {
  data: DistributionDatum[];
  emptyLabel?: string;
}) {
  const maximum = Math.max(1, ...data.map((item) => item.value));

  if (!data.length) return <p className="distribution-empty">{emptyLabel}</p>;

  return (
    <div className="distribution-bars">
      {data.map((item) => (
        <div className="distribution-row" key={item.label}>
          <div className="distribution-label">
            <span title={item.label}>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="distribution-track" aria-hidden="true">
            <i
              style={{
                width: `${Math.max(3, (item.value / maximum) * 100)}%`,
                backgroundColor: item.color ?? "#22d3ee",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MonthlyAreaChart({ data }: { data: MonthDatum[] }) {
  const width = 760;
  const height = 290;
  const padding = { top: 22, right: 22, bottom: 44, left: 46 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(10, ...data.map((item) => item.value));
  const roundedMax = Math.ceil(maximum / 10) * 10;
  const denominator = Math.max(data.length - 1, 1);
  const points = data.map((item, index) => ({
    ...item,
    x: padding.left + (index / denominator) * plotWidth,
    y: padding.top + plotHeight - (item.value / roundedMax) * plotHeight,
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const areaPath = points.length
    ? `${linePath} L${points.at(-1)?.x},${padding.top + plotHeight} L${points[0].x},${padding.top + plotHeight} Z`
    : "";
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
    Math.round(roundedMax * ratio),
  );

  return (
    <div className="chart-wrap">
      <svg
        className="area-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Entradas de processos por mês"
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <filter id="cyan-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {gridValues.map((value) => {
          const y = padding.top + plotHeight - (value / roundedMax) * plotHeight;
          return (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                className="chart-gridline"
              />
              <text x={padding.left - 12} y={y + 5} textAnchor="end" className="chart-axis-label">
                {value}
              </text>
            </g>
          );
        })}

        {areaPath ? <path d={areaPath} fill="url(#area-fill)" /> : null}
        {linePath ? <path d={linePath} className="chart-line" /> : null}

        {points.map((point) => (
          <g key={point.key} className="chart-point-group">
            <circle cx={point.x} cy={point.y} r="13" className="chart-hit-area">
              <title>{`${point.label}: ${point.value} processo${point.value === 1 ? "" : "s"}`}</title>
            </circle>
            <circle cx={point.x} cy={point.y} r="5" className="chart-point" filter="url(#cyan-glow)" />
            <text
              x={point.x}
              y={height - 12}
              textAnchor="middle"
              className="chart-axis-label chart-month"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function StatusDonut({ data }: { data: DonutDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const stops = data.map((item) => {
    const start = cursor;
    cursor += total ? (item.value / total) * 100 : 0;
    return `${item.color} ${start}% ${cursor}%`;
  });
  const background = total
    ? `conic-gradient(${stops.join(", ")})`
    : "conic-gradient(#20384b 0 100%)";

  return (
    <div className="donut-layout">
      <div
        className="donut"
        style={{ background }}
        role="img"
        aria-label={`Distribuição: ${data.map((item) => `${item.label}, ${item.value}`).join("; ")}`}
      >
        <div className="donut-center">
          <strong>{total}</strong>
          <span>processos</span>
        </div>
      </div>
      <ul className="donut-legend">
        {data.map((item) => (
          <li key={item.label}>
            <span className="legend-label">
              <i style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
            <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const width = 118;
  const height = 42;
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const points = values
    .map((value, index) => {
      const x = values.length > 1 ? (index / (values.length - 1)) * (width - 8) + 4 : width / 2;
      const y = height - 5 - ((value - min) / Math.max(max - min, 1)) * (height - 10);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={points} fill="none" stroke="#22d3ee" strokeWidth="2" />
      {values.length ? (
        <circle
          cx={values.length > 1 ? width - 4 : width / 2}
          cy={height - 5 - ((values.at(-1)! - min) / Math.max(max - min, 1)) * (height - 10)}
          r="3.5"
          fill="#22d3ee"
        />
      ) : null}
    </svg>
  );
}
