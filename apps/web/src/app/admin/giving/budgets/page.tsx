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
};

type BudgetStore = Record<string, Record<string, number>>;

const STORAGE_KEY = "noxera_admin_budget_targets";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function readBudgetStore(): BudgetStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BudgetStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeBudgetStore(store: BudgetStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export default function BudgetsPage() {
  const { selectedBranchId } = useBranch();
  const [records, setRecords] = useState<GivingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [targets, setTargets] = useState<Record<string, string>>({});

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    try {
      const payload = await apiFetch<GivingRow[]>(`/api/admin/giving${query}`, { cache: "no-store" });
      setRecords(payload);
    } catch (err) {
      setRecords([]);
      setError(getErrorMessage(err, "Unable to load giving records for budget planning."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const funds = useMemo(() => {
    const values = Array.from(new Set(records.map((row) => row.fund))).sort((a, b) => a.localeCompare(b));
    return values.length > 0 ? values : ["Tithe", "Offering", "Building Fund"];
  }, [records]);

  useEffect(() => {
    const store = readBudgetStore();
    const monthBudgets = store[month] ?? {};
    const nextTargets: Record<string, string> = {};
    funds.forEach((fund) => {
      nextTargets[fund] = monthBudgets[fund] !== undefined ? String(monthBudgets[fund]) : "";
    });
    setTargets(nextTargets);
  }, [funds, month]);

  const actualByFund = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((row) => {
      if (!row.transactionDate.startsWith(month)) return;
      map.set(row.fund, (map.get(row.fund) ?? 0) + row.amount);
    });
    return map;
  }, [month, records]);

  const rows = useMemo(
    () =>
      funds.map((fund) => {
        const budgetValue = Number.parseFloat(targets[fund] || "0");
        const budget = Number.isFinite(budgetValue) && budgetValue >= 0 ? budgetValue : 0;
        const actual = actualByFund.get(fund) ?? 0;
        const variance = actual - budget;
        const progress = budget > 0 ? Math.min(999, (actual / budget) * 100) : 0;
        return { fund, budget, actual, variance, progress };
      }),
    [actualByFund, funds, targets],
  );

  const totals = useMemo(() => {
    const budget = rows.reduce((sum, row) => sum + row.budget, 0);
    const actual = rows.reduce((sum, row) => sum + row.actual, 0);
    return { budget, actual, variance: actual - budget };
  }, [rows]);

  const saveBudgets = () => {
    const parsed: Record<string, number> = {};
    for (const [fund, raw] of Object.entries(targets)) {
      const value = Number.parseFloat(raw || "0");
      parsed[fund] = Number.isFinite(value) && value >= 0 ? value : 0;
    }
    const store = readBudgetStore();
    store[month] = parsed;
    writeBudgetStore(store);
    setNotice(`Saved budget targets for ${month}.`);
  };

  const handleExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `budgets-${month}`,
      rows,
      [
        { label: "Fund", value: (row) => row.fund },
        { label: "Budget", value: (row) => row.budget.toFixed(2) },
        { label: "Actual", value: (row) => row.actual.toFixed(2) },
        { label: "Variance", value: (row) => row.variance.toFixed(2) },
        { label: "Progress %", value: (row) => row.progress.toFixed(2) },
      ],
      `Budget vs Actual ${month}`,
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Budgets</p>
        <h2 className="mt-2 text-2xl font-black">Plan monthly fund targets and compare against actual giving.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Budget targets are saved per month for quick finance planning reviews.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Budget Total" value={loading ? "--" : formatCurrency(totals.budget)} />
        <MetricCard label="Actual Total" value={loading ? "--" : formatCurrency(totals.actual)} />
        <MetricCard label="Variance" value={loading ? "--" : formatCurrency(totals.variance)} />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500">Budget Month</label>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button type="button" onClick={saveBudgets} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-500">Save Targets</button>
          <button type="button" onClick={() => void loadRecords()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">Refresh Actuals</button>
          <TableExportMenu onExport={handleExport} label="Download" />
        </div>
      </section>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || notice}</div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Fund</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Budget Target</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actual</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Variance</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}><td colSpan={5} className="px-4 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                ))
              ) : (
                rows.map((row) => (
                  <tr key={row.fund}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.fund}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      <input
                        value={targets[row.fund] ?? ""}
                        onChange={(event) => setTargets((current) => ({ ...current, [row.fund]: event.target.value }))}
                        inputMode="decimal"
                        className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatCurrency(row.actual)}</td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${row.variance >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(row.variance)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{row.progress.toFixed(1)}%</td>
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
