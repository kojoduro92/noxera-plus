type SeriesPoint = {
  label: string;
  value: number;
};

type Segment = {
  label: string;
  value: number;
  color: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toChartPoints(points: SeriesPoint[], width: number, height: number, padding = 18) {
  if (points.length === 0) return [];
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const minValue = Math.min(...points.map((point) => point.value));
  const span = Math.max(1, maxValue - minValue);
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  return points.map((point, index) => {
    const x = padding + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
    const normalized = (point.value - minValue) / span;
    const y = padding + (1 - normalized) * plotHeight;
    return { ...point, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  });
}

export function Sparkline({ points, className = "" }: { points: SeriesPoint[]; className?: string }) {
  const width = 120;
  const height = 44;
  const chartPoints = toChartPoints(points, width, height, 6);
  if (chartPoints.length === 0) return null;

  const path = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Trend line">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function LineTrendChart({
  title,
  points,
}: {
  title: string;
  points: SeriesPoint[];
}) {
  const width = 560;
  const height = 220;
  const chartPoints = toChartPoints(points, width, height);
  const baselineY = height - 18;

  if (chartPoints.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-black text-slate-900">{title}</p>
        <p className="mt-6 text-xs font-semibold text-slate-500">No data yet.</p>
      </div>
    );
  }

  const linePath = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${baselineY} L ${chartPoints[0].x} ${baselineY} Z`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full">
        <defs>
          <linearGradient id="trend-fill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1={18} y1={baselineY} x2={width - 18} y2={baselineY} stroke="#e2e8f0" strokeWidth="1" />
        <path d={areaPath} fill="url(#trend-fill)" />
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {chartPoints.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r={4} fill="#4f46e5" />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-2">
        {points.slice(-6).map((point) => (
          <span key={point.label} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBarChart({
  title,
  segments,
  maxBars = 6,
}: {
  title: string;
  segments: Segment[];
  maxBars?: number;
}) {
  const rows = segments.slice(0, maxBars);
  const maxValue = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500">No data yet.</p>
        ) : (
          rows.map((row) => {
            const width = clamp((row.value / maxValue) * 100, 2, 100);
            return (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${width}%`, backgroundColor: row.color }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function DonutChart({
  title,
  segments,
  centerLabel,
}: {
  title: string;
  segments: Segment[];
  centerLabel: string;
}) {
  const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
  const circumference = 2 * Math.PI * 42;
  let currentOffset = 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <div className="mt-4 flex items-center gap-5">
        <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label={title}>
          <circle cx="60" cy="60" r="42" fill="none" stroke="#e2e8f0" strokeWidth="16" />
          {segments.map((segment) => {
            const fraction = segment.value / total;
            const dash = circumference * fraction;
            const gap = circumference - dash;
            const dashArray = `${dash} ${gap}`;
            const dashOffset = -currentOffset;
            currentOffset += dash;

            return (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke={segment.color}
                strokeWidth="16"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                transform="rotate(-90 60 60)"
              />
            );
          })}
          <text x="60" y="57" textAnchor="middle" className="fill-slate-900 text-[12px] font-black">
            {centerLabel}
          </text>
          <text x="60" y="72" textAnchor="middle" className="fill-slate-500 text-[9px] font-semibold">
            total
          </text>
        </svg>

        <div className="space-y-2">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              <span>{segment.label}</span>
              <span className="ml-auto font-black text-slate-900">{segment.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type { SeriesPoint, Segment };
