"use client";

import { useEffect, useRef, useState } from "react";
import type { ExportFormat } from "@/lib/export-utils";

type TableExportMenuProps = {
  onExport: (format: ExportFormat) => Promise<void> | void;
  label?: string;
};

const FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
  { value: "pdf", label: "PDF" },
];

export function TableExportMenu({ onExport, label = "Download" }: TableExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const triggerExport = async (format: ExportFormat) => {
    setBusy(format);
    try {
      await onExport(format);
      setOpen(false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
      >
        {busy ? `Exporting ${busy.toUpperCase()}...` : `${label} ▾`}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              onClick={() => void triggerExport(format.value)}
              disabled={Boolean(busy)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{format.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
