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
  donorName?: string | null;
  status: string;
  member?: { firstName: string; lastName: string } | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function donorLabel(row: GivingRow) {
  if (row.member) return `${row.member.firstName} ${row.member.lastName}`;
  return row.donorName || "Anonymous";
}

export default function StatementsPage() {
  const { selectedBranchId } = useBranch();
  const [records, setRecords] = useState<GivingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [donorQuery, setDonorQuery] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [activeDonor, setActiveDonor] = useState<string>("all");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    try {
      const payload = await apiFetch<GivingRow[]>(`/api/admin/giving${query}`, { cache: "no-store" });
      setRecords(payload);
    } catch (err) {
      setRecords([]);
      setError(getErrorMessage(err, "Unable to load giving records for statements."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const monthRecords = useMemo(
    () => records.filter((row) => row.transactionDate.startsWith(month)),
    [month, records],
  );

  const donorRows = useMemo(() => {
    const aggregate = new Map<string, { donor: string; total: number; transactionCount: number; lastTransaction: string | null }>();
    monthRecords.forEach((row) => {
      const donor = donorLabel(row);
      const current = aggregate.get(donor) ?? { donor, total: 0, transactionCount: 0, lastTransaction: null };
      current.total += row.amount;
      current.transactionCount += 1;
      if (!current.lastTransaction || new Date(row.transactionDate).getTime() > new Date(current.lastTransaction).getTime()) {
        current.lastTransaction = row.transactionDate;
      }
      aggregate.set(donor, current);
    });

    return Array.from(aggregate.values())
      .filter((row) => (donorQuery.trim() ? row.donor.toLowerCase().includes(donorQuery.trim().toLowerCase()) : true))
      .sort((left, right) => right.total - left.total);
  }, [donorQuery, monthRecords]);

  useEffect(() => {
    if (activeDonor === "all") return;
    if (!donorRows.some((row) => row.donor === activeDonor)) {
      setActiveDonor("all");
    }
  }, [activeDonor, donorRows]);

  const statementLines = useMemo(
    () =>
      monthRecords
        .filter((row) => activeDonor === "all" || donorLabel(row) === activeDonor)
        .sort((left, right) => new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime()),
    [activeDonor, monthRecords],
  );

  const statementTotal = statementLines.reduce((sum, row) => sum + row.amount, 0);

  const handleSummaryExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `donor-statements-summary-${month}`,
      donorRows,
      [
        { label: "Donor", value: (row) => row.donor },
        { label: "Transactions", value: (row) => row.transactionCount },
        { label: "Total", value: (row) => row.total.toFixed(2) },
        { label: "Last Transaction", value: (row) => (row.lastTransaction ? new Date(row.lastTransaction).toISOString() : "") },
      ],
      `Donor Statements Summary ${month}`,
    );
  };

  const handleStatementExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `donor-statement-${activeDonor === "all" ? "all" : activeDonor.replace(/\s+/g, "-").toLowerCase()}-${month}`,
      statementLines,
      [
        { label: "Date", value: (row) => new Date(row.transactionDate).toISOString() },
        { label: "Donor", value: (row) => donorLabel(row) },
        { label: "Fund", value: (row) => row.fund },
        { label: "Method", value: (row) => row.method },
        { label: "Status", value: (row) => row.status },
        { label: "Amount", value: (row) => row.amount.toFixed(2) },
      ],
      `Donor Statement ${activeDonor === "all" ? "All Donors" : activeDonor}`,
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Statements</p>
        <h2 className="mt-2 text-2xl font-black">Generate donor statements and monthly contribution summaries.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Filter by month and donor, then export clean CSV/Excel/PDF statements.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">Statement Month</label>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={donorQuery} onChange={(event) => setDonorQuery(event.target.value)} placeholder="Search donor" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void loadRecords()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">Refresh</button>
            <TableExportMenu onExport={handleSummaryExport} label="Export Summary" />
          </div>

          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Donor</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Transactions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}><td colSpan={3} className="px-4 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                  ))
                ) : donorRows.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-sm font-medium text-slate-500">No donor activity for this month.</td></tr>
                ) : (
                  donorRows.map((row) => (
                    <tr key={row.donor} className={activeDonor === row.donor ? "bg-indigo-50/50" : undefined}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        <button type="button" onClick={() => setActiveDonor((current) => (current === row.donor ? "all" : row.donor))} className="text-left hover:text-indigo-600">
                          {row.donor}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{row.transactionCount}</td>
                      <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatCurrency(row.total)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">Statement Detail</h3>
            <TableExportMenu onExport={handleStatementExport} label="Export Statement" />
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {activeDonor === "all" ? "All donors" : activeDonor} · {month}
          </p>
          <p className="mt-2 text-sm font-black text-slate-900">Total: {formatCurrency(statementTotal)}</p>

          <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />)
            ) : statementLines.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm font-medium text-slate-500">No statement lines found.</p>
            ) : (
              statementLines.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-900">{donorLabel(row)}</span>
                    <span className="font-black text-slate-900">{formatCurrency(row.amount)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{row.fund} · {row.method}</span>
                    <span>{new Date(row.transactionDate).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
