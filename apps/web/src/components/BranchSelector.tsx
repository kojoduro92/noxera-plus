"use client";

import React, { useEffect, useMemo, useState } from "react";

type BranchRow = {
  id: string;
  name: string;
  isActive?: boolean;
};

interface BranchSelectorProps {
  selectedBranchId: string | undefined;
  onSelectBranch: (branchId: string | undefined) => void;
}

export function BranchSelector({ selectedBranchId, onSelectBranch }: BranchSelectorProps) {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const loadBranches = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/admin/branches", {
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => [])) as BranchRow[] | { message?: string };

        if (!response.ok) {
          const message = (payload as { message?: string })?.message ?? "Unable to load branches.";
          setError(message);
          setBranches([]);
          return;
        }

        const list = Array.isArray(payload)
          ? payload.filter((branch) => branch.isActive !== false).sort((a, b) => a.name.localeCompare(b.name))
          : [];

        setBranches(list);
      } catch (fetchError) {
        if (!controller.signal.aborted) {
          setError((fetchError as { message?: string })?.message ?? "Unable to load branches.");
          setBranches([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadBranches();

    return () => controller.abort();
  }, []);

  const helperText = useMemo(() => {
    if (loading) return "Loading branches...";
    if (error) return error;
    if (branches.length === 0) return "No active branches available.";
    return "";
  }, [branches.length, error, loading]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label htmlFor="branch-select" className="text-sm font-bold text-slate-700">
          Branch:
        </label>
        <select
          id="branch-select"
          value={selectedBranchId || "all"}
          onChange={(event) => onSelectBranch(event.target.value === "all" ? undefined : event.target.value)}
          disabled={loading}
          className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="all">All Branches</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>
      {helperText && <p className={`text-xs font-medium ${error ? "text-rose-600" : "text-slate-500"}`}>{helperText}</p>}
    </div>
  );
}
