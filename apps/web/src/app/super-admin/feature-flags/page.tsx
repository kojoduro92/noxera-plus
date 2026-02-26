"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, withJsonBody } from "@/lib/api-client";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";
import { ConfirmActionModal } from "@/components/super-admin/confirm-action-modal";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";

type ReleaseFlag = {
  id: string;
  key: string;
  description?: string | null;
  enabled: boolean;
  rolloutStage: string;
  owner?: string | null;
  tenantCohort: string[];
};

type ReleaseFlagsResponse = {
  items: ReleaseFlag[];
};

const stages = ["internal", "beta", "canary", "general"] as const;
type SortOption = "key" | "stage" | "status";

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<ReleaseFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("key");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [confirmFlag, setConfirmFlag] = useState<ReleaseFlag | null>(null);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const payload = await apiFetch<ReleaseFlagsResponse>(
        `/api/super-admin/settings/release-flags${search ? `?search=${encodeURIComponent(search)}` : ""}`,
        { cache: "no-store" },
      );
      setFlags(payload.items);
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to load feature flags.");
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  const updateFlag = async (flag: ReleaseFlag, payload: { enabled?: boolean; rolloutStage?: string }) => {
    setSavingKey(flag.key);
    setError("");
    setMessage("");

    try {
      await apiFetch(`/api/super-admin/settings/release-flags/${encodeURIComponent(flag.key)}`, {
        method: "PATCH",
        ...withJsonBody(payload),
      });
      setMessage(`Updated ${flag.key}.`);
      await loadFlags();
    } catch (err) {
      setError((err as { message?: string })?.message ?? "Unable to update feature flag.");
    } finally {
      setSavingKey("");
    }
  };

  const summary = useMemo(
    () => ({
      total: flags.length,
      enabled: flags.filter((flag) => flag.enabled).length,
      rollout: flags.filter((flag) => flag.rolloutStage !== "general").length,
    }),
    [flags],
  );

  const sortedFlags = useMemo(() => {
    const next = [...flags];
    const direction = sortDirection === "asc" ? 1 : -1;
    next.sort((a, b) => {
      if (sortBy === "key") return a.key.localeCompare(b.key) * direction;
      if (sortBy === "stage") return a.rolloutStage.localeCompare(b.rolloutStage) * direction;
      return (Number(a.enabled) - Number(b.enabled)) * direction;
    });
    return next;
  }, [flags, sortBy, sortDirection]);

  const exportRows = async (format: ExportFormat) => {
    await downloadRows(format, "super-admin-feature-flags", sortedFlags, [
      { label: "Key", value: (row) => row.key },
      { label: "Stage", value: (row) => row.rolloutStage },
      { label: "Enabled", value: (row) => (row.enabled ? "Yes" : "No") },
      { label: "Owner", value: (row) => row.owner ?? "" },
      { label: "Description", value: (row) => row.description ?? "" },
    ], "Super Admin Feature Flags");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Feature Rollouts</p>
        <h2 className="mt-2 text-3xl font-black text-slate-900">Feature Flags</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Safely ship beta and staged releases across church tenants.</p>
      </section>

      {(error || message) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Total Flags</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Enabled</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{summary.enabled}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Staged Rollouts</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{summary.rollout}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-900">Release Flags</h3>
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search flags"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="key">Sort: Key</option>
              <option value="stage">Sort: Stage</option>
              <option value="status">Sort: Status</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
              <TableExportMenu onExport={exportRows} label="Export" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Flag</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {sortedFlags.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No feature flags found.</td>
                  </tr>
                ) : (
                  sortedFlags.map((flag) => (
                    <tr key={flag.id}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-black text-slate-900">{flag.key}</p>
                        {flag.description ? <p className="text-xs font-semibold text-slate-500">{flag.description}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={flag.rolloutStage}
                          onChange={(event) => void updateFlag(flag, { rolloutStage: event.target.value })}
                          disabled={savingKey === flag.key}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {stages.map((stage) => (
                            <option key={stage} value={stage}>{stage}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flag.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {flag.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        <button
                          type="button"
                          onClick={() => setConfirmFlag(flag)}
                          disabled={savingKey === flag.key}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                        >
                          {flag.enabled ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmActionModal
        open={Boolean(confirmFlag)}
        busy={Boolean(confirmFlag && savingKey === confirmFlag.key)}
        title={confirmFlag?.enabled ? "Disable feature flag?" : "Enable feature flag?"}
        description={confirmFlag?.enabled ? "Disabling this flag can remove access for tenant cohorts immediately." : "Enabling this flag can expose feature behavior to assigned rollout cohorts."}
        confirmLabel={confirmFlag?.enabled ? "Disable flag" : "Enable flag"}
        tone={confirmFlag?.enabled ? "danger" : "primary"}
        onCancel={() => {
          if (!savingKey) {
            setConfirmFlag(null);
          }
        }}
        onConfirm={() => {
          if (confirmFlag) {
            void updateFlag(confirmFlag, { enabled: !confirmFlag.enabled });
            setConfirmFlag(null);
          }
        }}
      />
    </div>
  );
}
