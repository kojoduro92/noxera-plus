"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";

type BranchRow = {
  id: string;
  name: string;
};

type TenantBranchToolbarProps = {
  tenantId: string;
  tenantName: string;
  defaultBranchId?: string | null;
  branchScopeMode?: "ALL" | "RESTRICTED";
  allowedBranchIds?: string[];
};

export function TenantBranchToolbar({
  tenantId,
  tenantName,
  defaultBranchId,
  branchScopeMode = "ALL",
  allowedBranchIds = [],
}: TenantBranchToolbarProps) {
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!tenantId) {
      setBranches([]);
      setSelectedBranchId(undefined);
      return;
    }

    const fetchBranches = async () => {
      setLoadingBranches(true);
      setError("");
      try {
        const payload = await apiFetch<BranchRow[]>("/api/admin/branches", {
          cache: "no-store",
        });
        const scopedBranches =
          branchScopeMode === "RESTRICTED" && allowedBranchIds.length > 0
            ? payload.filter((branch) => allowedBranchIds.includes(branch.id))
            : payload;
        setBranches(scopedBranches);

        if (selectedBranchId && !scopedBranches.some((branch) => branch.id === selectedBranchId)) {
          if (branchScopeMode === "RESTRICTED" && scopedBranches.length === 1) {
            setSelectedBranchId(scopedBranches[0].id);
          } else {
            setSelectedBranchId(defaultBranchId ?? undefined);
          }
        }
      } catch (err) {
        setBranches([]);
        if (err instanceof ApiError && err.status === 401) {
          setError("Session expired. Please sign in again.");
        } else {
          setError((err as { message?: string })?.message ?? "Unable to load branches.");
        }
      } finally {
        setLoadingBranches(false);
      }
    };

    void fetchBranches();
  }, [allowedBranchIds, branchScopeMode, defaultBranchId, selectedBranchId, setSelectedBranchId, tenantId]);

  const selectedBranchName = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId)?.name ?? "All branches",
    [branches, selectedBranchId],
  );

  const applyBranchSelection = (branchId: string | undefined) => {
    setSelectedBranchId(branchId);
    setNotice(branchId ? "Branch filter applied." : "Showing all branches.");
  };

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Operational Context</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            Tenant: <span className="font-black">{tenantName}</span> · Branch: <span className="font-black">{selectedBranchName}</span>
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>Tenant scope is server-locked for your account.</p>
          {branchScopeMode === "RESTRICTED" && (
            <p className="mt-1 font-semibold text-indigo-600">Branch scope: restricted</p>
          )}
          <Link href="/super-admin/onboarding" className="font-bold text-indigo-600 hover:text-indigo-500">
            Need another church workspace? Request Super Admin onboarding.
          </Link>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[320px_auto]">
        <select
          value={selectedBranchId ?? "all"}
          onChange={(event) => applyBranchSelection(event.target.value === "all" ? undefined : event.target.value)}
          disabled={!tenantId || loadingBranches}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="all">All branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => applyBranchSelection(undefined)}
          disabled={!selectedBranchId}
          className="justify-self-start rounded-xl border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear Branch
        </button>
      </div>

      {notice && <p className="mt-3 text-xs font-semibold text-emerald-600">{notice}</p>}
      {error && <p className="mt-3 text-xs font-semibold text-red-600">{error}</p>}
    </section>
  );
}
