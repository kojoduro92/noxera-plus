"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
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
  member?: {
    firstName: string;
    lastName: string;
  } | null;
};

type GivingSummary = {
  tithes: number;
  offerings: number;
  special: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

export default function GivingPage() {
  const { selectedBranchId } = useBranch();
  const [records, setRecords] = useState<GivingRow[]>([]);
  const [summary, setSummary] = useState<GivingSummary>({ tithes: 0, offerings: 0, special: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [fundFilter, setFundFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [amount, setAmount] = useState("");
  const [fund, setFund] = useState("Tithe");
  const [method, setMethod] = useState("Cash");
  const [donorName, setDonorName] = useState("");
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 16));

  const loadGiving = useCallback(async () => {
    setLoading(true);
    setError("");

    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      const [rows, stats] = await Promise.all([
        apiFetch<GivingRow[]>(`/api/admin/giving${query}`, { cache: "no-store" }),
        apiFetch<GivingSummary>(`/api/admin/giving/summary${query}`, { cache: "no-store" }),
      ]);
      setRecords(rows);
      setSummary(stats);
    } catch (err) {
      setRecords([]);
      setSummary({ tithes: 0, offerings: 0, special: 0 });
      setError(getErrorMessage(err, "Unable to load giving records."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadGiving();
  }, [loadGiving]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      if (fundFilter !== "all" && record.fund !== fundFilter) return false;
      if (methodFilter !== "all" && record.method !== methodFilter) return false;
      const timestamp = new Date(record.transactionDate).getTime();
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
  }, [records, fundFilter, methodFilter, startDate, endDate]);

  const totals = useMemo(
    () => ({
      total: filteredRecords.reduce((sum, record) => sum + record.amount, 0),
      count: filteredRecords.length,
    }),
    [filteredRecords],
  );

  const handleCreateTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await apiFetch<GivingRow>("/api/admin/giving", {
        method: "POST",
        ...withJsonBody({
          amount: parsedAmount,
          fund,
          method,
          donorName: donorName.trim() || undefined,
          transactionDate: new Date(transactionDate).toISOString(),
          branchId: selectedBranchId,
        }),
      });
      setAmount("");
      setDonorName("");
      setTransactionDate(new Date().toISOString().slice(0, 16));
      setNotice("Transaction saved.");
      await loadGiving();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to save transaction."));
    } finally {
      setSubmitting(false);
    }
  };

  const exportFiltered = async (format: ExportFormat) => {
    const fileDate = new Date().toISOString().slice(0, 10);
    await downloadRows(format, `giving-${fileDate}`, filteredRecords, [
      { label: "Date", value: (row) => new Date(row.transactionDate).toISOString() },
      { label: "Donor", value: (row) => (row.member ? `${row.member.firstName} ${row.member.lastName}` : row.donorName || "Anonymous") },
      { label: "Fund", value: (row) => row.fund },
      { label: "Method", value: (row) => row.method },
      { label: "Status", value: (row) => row.status },
      { label: "Amount", value: (row) => row.amount.toFixed(2) },
    ], "Giving Transactions");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Giving Operations</p>
        <h2 className="mt-2 text-2xl font-black">Record transactions, monitor monthly funds, and export clean reports.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">All entries are tenant and branch scoped with server-side authorization checks.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tithes (MTD)</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatCurrency(summary.tithes)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Offerings (MTD)</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatCurrency(summary.offerings)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Special Funds (MTD)</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatCurrency(summary.special)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filtered Total</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{formatCurrency(totals.total)}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{totals.count} transactions</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <form onSubmit={handleCreateTransaction} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Record Transaction</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">Capture manual giving entries and assign them to funds.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Amount"
              inputMode="decimal"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <input
              value={donorName}
              onChange={(event) => setDonorName(event.target.value)}
              placeholder="Donor name (optional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <select value={fund} onChange={(event) => setFund(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="Tithe">Tithe</option>
              <option value="Offering">Offering</option>
              <option value="Building Fund">Building Fund</option>
              <option value="Special Giving">Special Giving</option>
            </select>
            <select value={method} onChange={(event) => setMethod(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Transfer">Transfer</option>
              <option value="Check">Check</option>
              <option value="Online">Online</option>
            </select>
            <input
              type="datetime-local"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Transaction"}
          </button>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Filters & Export</h3>
          <div className="mt-4 grid gap-3">
            <select value={fundFilter} onChange={(event) => setFundFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All funds</option>
              <option value="Tithe">Tithe</option>
              <option value="Offering">Offering</option>
              <option value="Building Fund">Building Fund</option>
              <option value="Special Giving">Special Giving</option>
            </select>
            <select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All methods</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Transfer">Transfer</option>
              <option value="Check">Check</option>
              <option value="Online">Online</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFundFilter("all");
                  setMethodFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              >
                Reset
              </button>
              <TableExportMenu onExport={exportFiltered} label="Export" />
            </div>
          </div>
        </section>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-600">Transactions</h3>
          <button type="button" onClick={() => void loadGiving()} className="text-xs font-bold text-indigo-600 transition hover:text-indigo-500">
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Donor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Fund</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td className="px-4 py-4"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-36 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-16 animate-pulse rounded-full bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="ml-auto h-4 w-20 animate-pulse rounded bg-slate-200" /></td>
                  </tr>
                ))
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                    No giving records found. Record your first transaction to start reporting.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const donor = record.member ? `${record.member.firstName} ${record.member.lastName}` : record.donorName || "Anonymous";
                  return (
                    <tr key={record.id}>
                      <td className="px-4 py-4 text-sm text-slate-700">{new Date(record.transactionDate).toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{donor}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{record.fund}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{record.method}</td>
                      <td className="px-4 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${record.status === "Completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-900">{formatCurrency(record.amount)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
