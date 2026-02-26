"use client";

import { useMemo } from "react";

type LinePoint = {
  label: string;
  value: number;
};

type StackedBarPoint = {
  label: string;
  firstLabel: string;
  first: number;
  secondLabel: string;
  second: number;
};

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

function toShortNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value}`;
}

export function LineTrendChart({ points, stroke = "#4f46e5" }: { points: LinePoint[]; stroke?: string }) {
  const { path, areaPath, maxValue, minValue } = useMemo(() => {
    if (points.length === 0) return { path: "", areaPath: "", maxValue: 0, minValue: 0 };
    const values = points.map((point) => point.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = Math.max(1, maxValue - minValue);
    const width = 100;
    const height = 40;
    const toX = (index: number) => (index / Math.max(1, points.length - 1)) * width;
    const toY = (value: number) => height - ((value - minValue) / range) * height;

    const commands = points.map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.value)}`);
    const path = commands.join(" ");
    const areaPath = `${path} L ${toX(points.length - 1)} ${height} L 0 ${height} Z`;
    return { path, areaPath, maxValue, minValue };
  }, [points]);

  if (points.length === 0) {
    return <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-medium text-slate-500">No data in this range.</p>;
  }

  return (
    <div className="space-y-2">
      <svg viewBox="0 0 100 40" className="h-40 w-full rounded-xl border border-slate-200 bg-slate-50">
        <defs>
          <linearGradient id="line-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#line-area-gradient)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <span>{points[0]?.label}</span>
        <span>{toShortNumber(minValue)} - {toShortNumber(maxValue)}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function StackedBarTrendChart({ points }: { points: StackedBarPoint[] }) {
  const maxTotal = useMemo(() => Math.max(1, ...points.map((point) => point.first + point.second)), [points]);

  if (points.length === 0) {
    return <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-medium text-slate-500">No data in this range.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />{points[0]?.firstLabel}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{points[0]?.secondLabel}</span>
      </div>
      <div className="space-y-2">
        {points.map((point) => {
          const firstPercent = ((point.first / maxTotal) * 100).toFixed(2);
          const secondPercent = ((point.second / maxTotal) * 100).toFixed(2);
          return (
            <div key={point.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>{point.label}</span>
                <span>{toShortNumber(point.first + point.second)}</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-indigo-500" style={{ width: `${firstPercent}%` }} />
                <div className="bg-emerald-500" style={{ width: `${secondPercent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const total = useMemo(() => segments.reduce((sum, segment) => sum + segment.value, 0), [segments]);
  const normalized = useMemo(() => {
    if (total <= 0) return [];
    let offset = 0;
    return segments
      .filter((segment) => segment.value > 0)
      .map((segment) => {
        const fraction = segment.value / total;
        const slice = {
          ...segment,
          fraction,
          dash: `${fraction * 100} ${100 - fraction * 100}`,
          offset,
        };
        offset += fraction * 100;
        return slice;
      });
  }, [segments, total]);

  if (total <= 0) {
    return <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-medium text-slate-500">No distribution data available.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 md:flex-row md:items-start">
      <div className="relative h-40 w-40">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="3.4" />
          {normalized.map((segment) => (
            <circle
              key={segment.label}
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke={segment.color}
              strokeWidth="3.4"
              strokeDasharray={segment.dash}
              strokeDashoffset={-segment.offset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-slate-900">{toShortNumber(total)}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {normalized.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}
            </span>
            <span className="font-black text-slate-900">{toShortNumber(segment.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
