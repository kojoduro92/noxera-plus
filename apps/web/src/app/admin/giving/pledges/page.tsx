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

export default function PledgesPage() {
  const { selectedBranchId } = useBranch();
  const [records, setRecords] = useState<GivingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [donorName, setDonorName] = useState("");
  const [fund, setFund] = useState("Tithe");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    try {
      const payload = await apiFetch<GivingRow[]>(`/api/admin/giving${query}`, { cache: "no-store" });
      setRecords(payload);
    } catch (err) {
      setRecords([]);
      setError(getErrorMessage(err, "Unable to load pledges."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const pledges = useMemo(() => {
    const pledgeRows = records.filter((row) => row.method.toLowerCase().includes("pledge") || row.status.toLowerCase() === "pending");
    const fulfillmentRows = records.filter((row) => row.method.toLowerCase().includes("fulfillment"));

    return pledgeRows.map((pledge) => {
      const matchedFulfillment = fulfillmentRows.find((fulfillment) => {
        const sameDonor = donorLabel(fulfillment).toLowerCase() === donorLabel(pledge).toLowerCase();
        const sameFund = fulfillment.fund.toLowerCase() === pledge.fund.toLowerCase();
        const closeAmount = Math.abs(fulfillment.amount - pledge.amount) < 0.01;
        return sameDonor && sameFund && closeAmount && new Date(fulfillment.transactionDate).getTime() >= new Date(pledge.transactionDate).getTime();
      });

      return {
        ...pledge,
        fulfillmentId: matchedFulfillment?.id ?? null,
        fulfilledAt: matchedFulfillment?.transactionDate ?? null,
      };
    });
  }, [records]);

  const pendingPledges = pledges.filter((pledge) => !pledge.fulfillmentId);
  const pledgedTotal = pendingPledges.reduce((sum, pledge) => sum + pledge.amount, 0);

  const createPledge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Pledge amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await apiFetch("/api/admin/giving", {
        method: "POST",
        ...withJsonBody({
          amount: parsed,
          fund,
          method: "Pledge",
          status: "Pending",
          donorName: donorName.trim() || undefined,
          transactionDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : new Date().toISOString(),
          branchId: selectedBranchId,
        }),
      });
      setAmount("");
      setDonorName("");
      setDueDate("");
      setNotice("Pledge recorded.");
      await loadRecords();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to record pledge."));
    } finally {
      setSubmitting(false);
    }
  };

  const recordFulfillment = async (pledge: (typeof pledges)[number]) => {
    setBusyId(pledge.id);
    setError("");
    setNotice("");
    try {
      await apiFetch("/api/admin/giving", {
        method: "POST",
        ...withJsonBody({
          amount: pledge.amount,
          fund: pledge.fund,
          method: "Pledge Fulfillment",
          status: "Completed",
          donorName: pledge.donorName ?? undefined,
          transactionDate: new Date().toISOString(),
          branchId: selectedBranchId,
        }),
      });
      setNotice(`Fulfillment recorded for ${donorLabel(pledge)}.`);
      await loadRecords();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to record fulfillment."));
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `pledges-${new Date().toISOString().slice(0, 10)}`,
      pledges,
      [
        { label: "Donor", value: (row) => donorLabel(row) },
        { label: "Fund", value: (row) => row.fund },
        { label: "Amount", value: (row) => row.amount.toFixed(2) },
        { label: "Pledge Date", value: (row) => new Date(row.transactionDate).toLocaleDateString() },
        { label: "Fulfilled", value: (row) => (row.fulfilledAt ? "Yes" : "No") },
        { label: "Fulfilled At", value: (row) => (row.fulfilledAt ? new Date(row.fulfilledAt).toLocaleDateString() : "") },
      ],
      "Pledges",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Pledges</p>
        <h2 className="mt-2 text-2xl font-black">Track pledge commitments and fulfillment records.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Pending pledges remain visible until a fulfillment entry is recorded.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Pledges" value={loading ? "--" : String(pledges.length)} />
        <MetricCard label="Pending" value={loading ? "--" : String(pendingPledges.length)} />
        <MetricCard label="Pending Amount" value={loading ? "--" : formatCurrency(pledgedTotal)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <form onSubmit={createPledge} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Create Pledge</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input value={donorName} onChange={(event) => setDonorName(event.target.value)} placeholder="Donor name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" inputMode="decimal" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={fund} onChange={(event) => setFund(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="Tithe">Tithe</option>
              <option value="Offering">Offering</option>
              <option value="Building Fund">Building Fund</option>
              <option value="Missions">Missions</option>
              <option value="Special Giving">Special Giving</option>
            </select>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={submitting} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-500 disabled:opacity-50">
            {submitting ? "Saving..." : "Record Pledge"}
          </button>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Actions</h3>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button type="button" onClick={() => void loadRecords()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">Refresh</button>
            <TableExportMenu onExport={handleExport} label="Download" />
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-500">When a pledge is honored, use “Record Fulfillment” from the table row.</p>
        </section>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || notice}</div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Donor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Fund</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}><td colSpan={6} className="px-4 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                ))
              ) : pledges.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm font-medium text-slate-500">No pledges recorded yet.</td></tr>
              ) : (
                pledges.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{donorLabel(row)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.fund}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{new Date(row.transactionDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${row.fulfilledAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {row.fulfilledAt ? "Fulfilled" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={Boolean(row.fulfilledAt) || busyId === row.id}
                        onClick={() => void recordFulfillment(row)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                      >
                        {busyId === row.id ? "Saving..." : "Record Fulfillment"}
                      </button>
                    </td>
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
