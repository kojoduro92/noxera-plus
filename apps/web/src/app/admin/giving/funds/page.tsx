"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

type GivingRow = {
  id: string;
  transactionDate: string;
  amount: number;
  fund: string;
  method: string;
  status: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default function FundsPage() {
  const { selectedBranchId } = useBranch();
  const [records, setRecords] = useState<GivingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    try {
      const payload = await apiFetch<GivingRow[]>(`/api/admin/giving${query}`, { cache: "no-store" });
      setRecords(payload);
    } catch (err) {
      setRecords([]);
      setError(getErrorMessage(err, "Unable to load fund analytics."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const fundRows = useMemo(() => {
    const filtered = records.filter((row) => {
      const query = search.trim().toLowerCase();
      if (query && !row.fund.toLowerCase().includes(query)) return false;
      const timestamp = new Date(row.transactionDate).getTime();
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`).getTime();
        if (timestamp < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59`).getTime();
        if (timestamp > end) return false;
      }
      return true;
    });

    const aggregate = new Map<string, { fund: string; total: number; transactionCount: number; lastTransaction: string | null }>();
    filtered.forEach((row) => {
      const item = aggregate.get(row.fund) ?? { fund: row.fund, total: 0, transactionCount: 0, lastTransaction: null };
      item.total += row.amount;
      item.transactionCount += 1;
      if (!item.lastTransaction || new Date(row.transactionDate).getTime() > new Date(item.lastTransaction).getTime()) {
        item.lastTransaction = row.transactionDate;
      }
      aggregate.set(row.fund, item);
    });

    return Array.from(aggregate.values())
      .map((row) => ({
        ...row,
        average: row.transactionCount > 0 ? row.total / row.transactionCount : 0,
      }))
      .sort((left, right) => right.total - left.total);
  }, [endDate, records, search, startDate]);

  const totalFunds = fundRows.length;
  const totalAmount = fundRows.reduce((sum, row) => sum + row.total, 0);

  const handleExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `funds-${new Date().toISOString().slice(0, 10)}`,
      fundRows,
      [
        { label: "Fund", value: (row) => row.fund },
        { label: "Transactions", value: (row) => row.transactionCount },
        { label: "Total", value: (row) => row.total.toFixed(2) },
        { label: "Average", value: (row) => row.average.toFixed(2) },
        { label: "Last Transaction", value: (row) => (row.lastTransaction ? new Date(row.lastTransaction).toISOString() : "") },
      ],
      "Funds",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Funds</p>
        <h2 className="mt-2 text-2xl font-black">Analyze giving performance by fund.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Monitor contribution mix, average transaction values, and recency.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Funds" value={loading ? "--" : String(totalFunds)} />
        <MetricCard label="Total Amount" value={loading ? "--" : formatCurrency(totalAmount)} />
        <MetricCard label="Transactions" value={loading ? "--" : String(records.length)} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search fund" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={() => void loadRecords()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">Refresh</button>
          <TableExportMenu onExport={handleExport} label="Download" />
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Fund</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Transactions</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Average</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}><td colSpan={5} className="px-4 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                ))
              ) : fundRows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm font-medium text-slate-500">No fund records in this period.</td></tr>
              ) : (
                fundRows.map((row) => (
                  <tr key={row.fund}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.fund}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{row.transactionCount}</td>
                    <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatCurrency(row.total)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{formatCurrency(row.average)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{row.lastTransaction ? new Date(row.lastTransaction).toLocaleDateString() : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}
