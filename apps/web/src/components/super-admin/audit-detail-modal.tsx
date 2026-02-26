"use client";

import { useEffect } from "react";
import { AuditLogRow } from "@/lib/super-admin-types";

type AuditDetailModalProps = {
  open: boolean;
  log: AuditLogRow | null;
  onClose: () => void;
};

export function AuditDetailModal({ open, log, onClose }: AuditDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !log) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <header className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900">Audit Log Entry</h3>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{log.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-200 transition text-slate-400 hover:text-slate-900">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{new Date(log.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</p>
              <span className="mt-1 inline-block rounded-full bg-indigo-100 px-3 py-1 text-xs font-black text-indigo-700">{log.action}</span>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Actor</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{log.user?.email || "System/Unknown"}</p>
              <p className="text-[10px] text-slate-500 font-semibold">{log.user?.name}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tenant</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{log.tenant?.name || "Global Platform"}</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase">{log.tenant?.domain}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resource Involved</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700">
              {log.resource}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Metadata Details</p>
            <div className="rounded-2xl bg-slate-900 p-4 overflow-hidden">
              <pre className="text-[11px] text-indigo-300 font-mono overflow-x-auto leading-relaxed">
                {JSON.stringify(log.details || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-slate-800 transition shadow-lg shadow-slate-200"
          >
            Close Inspector
          </button>
        </footer>
      </div>
    </div>
  );
}
