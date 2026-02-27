"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";
import { MEMBER_STATUS_OPTIONS, MemberProfile, formatMemberFullName } from "@/lib/members";
import { MemberProfileModal } from "@/components/members/member-profile-modal";

type ImportFailure = {
  row: number;
  reason: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  return rows;
}

export default function MembersPage() {
  const searchParams = useSearchParams();
  const { selectedBranchId } = useBranch();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"membershipDate" | "name" | "status">("membershipDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    if (selectedBranchId) params.set("branchId", selectedBranchId);

    try {
      const payload = await apiFetch<MemberProfile[]>(`/api/admin/members${params.toString() ? `?${params.toString()}` : ""}`, {
        cache: "no-store",
      });
      setMembers(payload);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load members."));
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [search, selectedBranchId, statusFilter]);

  useEffect(() => {
    if (searchParams.get("created") === "1") {
      setNotice("Member created successfully.");
    }
  }, [searchParams]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const deleteMember = async (member: MemberProfile) => {
    if (!window.confirm(`Delete ${formatMemberFullName(member)}?`)) return;

    setDeletingId(member.id);
    setError("");
    setNotice("");
    try {
      const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
      await apiFetch<{ success: boolean }>(`/api/admin/members/${member.id}${query}`, {
        method: "DELETE",
      });
      setNotice("Member deleted. Audit trail was recorded.");
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to delete member."));
    } finally {
      setDeletingId(null);
    }
  };

  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setError("");
    setNotice("");
    setImportFailures([]);

    try {
      const content = await file.text();
      const rows = parseCsvRows(content);
      if (rows.length <= 1) throw new Error("CSV is empty. Include a header row and at least one data row.");

      const headers = rows[0].map((value) => value.trim().toLowerCase());
      const firstNameIndex = headers.indexOf("firstname");
      const middleNameIndex = headers.indexOf("middlename");
      const lastNameIndex = headers.indexOf("lastname");
      const emailIndex = headers.indexOf("email");
      const phoneIndex = headers.indexOf("phone");
      const statusIndex = headers.indexOf("status");
      const tagsIndex = headers.indexOf("tags");
      const genderIndex = headers.indexOf("gender");
      const dobIndex = headers.indexOf("dateofbirth");
      const membershipDateIndex = headers.indexOf("membershipdate");
      const branchIdIndex = headers.indexOf("branchid");

      if (firstNameIndex === -1 || lastNameIndex === -1) {
        throw new Error("CSV must include firstName and lastName columns.");
      }

      let successCount = 0;
      const failures: ImportFailure[] = [];

      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const firstName = row[firstNameIndex]?.trim() ?? "";
        const lastName = row[lastNameIndex]?.trim() ?? "";
        if (!firstName || !lastName) {
          failures.push({ row: rowIndex + 1, reason: "Missing firstName or lastName." });
          continue;
        }

        const tagsRaw = (tagsIndex >= 0 ? row[tagsIndex] : "") ?? "";
        const payload = {
          firstName,
          middleName: (middleNameIndex >= 0 ? row[middleNameIndex] : "")?.trim() || undefined,
          lastName,
          email: (emailIndex >= 0 ? row[emailIndex] : "")?.trim() || undefined,
          phone: (phoneIndex >= 0 ? row[phoneIndex] : "")?.trim() || undefined,
          status: (statusIndex >= 0 ? row[statusIndex] : "")?.trim() || "Active",
          tags: tagsRaw.split(tagsRaw.includes("|") ? "|" : ",").map((tag) => tag.trim()).filter(Boolean),
          gender: (genderIndex >= 0 ? row[genderIndex] : "")?.trim() || undefined,
          dateOfBirth: (dobIndex >= 0 ? row[dobIndex] : "")?.trim() ? new Date(row[dobIndex]).toISOString() : undefined,
          membershipDate: (membershipDateIndex >= 0 ? row[membershipDateIndex] : "")?.trim()
            ? new Date(row[membershipDateIndex]).toISOString()
            : undefined,
          branchId: (branchIdIndex >= 0 ? row[branchIdIndex] : "")?.trim() || selectedBranchId,
        };

        try {
          await apiFetch<MemberProfile>("/api/admin/members", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          successCount += 1;
        } catch (err) {
          failures.push({ row: rowIndex + 1, reason: getErrorMessage(err, "Unable to import row.") });
        }
      }

      setImportFailures(failures.slice(0, 8));
      setNotice(`CSV import complete: ${successCount} created, ${failures.length} failed.`);
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err, "CSV import failed."));
    } finally {
      setImporting(false);
    }
  };

  const activeMembers = members.filter((member) => member.status === "Active").length;
  const visitorMembers = members.filter((member) => member.status === "Visitor").length;
  const prospectMembers = members.filter((member) => member.status === "Prospect").length;
  const inactiveMembers = members.filter((member) => member.status === "Inactive").length;
  const withContact = members.filter((member) => Boolean(member.email || member.phone)).length;
  const contactCompleteness = members.length ? Math.round((withContact / members.length) * 100) : 0;
  const taggedMembers = members.filter((member) => member.tags.length > 0).length;
  const thisMonth = new Date();
  const newThisMonth = members.filter((member) => {
    if (!member.membershipDate) return false;
    const date = new Date(member.membershipDate);
    return !Number.isNaN(date.getTime()) && date.getMonth() === thisMonth.getMonth() && date.getFullYear() === thisMonth.getFullYear();
  }).length;

  const sortedMembers = useMemo(() => {
    const rows = [...members];
    const direction = sortDirection === "asc" ? 1 : -1;

    rows.sort((left, right) => {
      if (sortBy === "name") {
        return formatMemberFullName(left).localeCompare(formatMemberFullName(right)) * direction;
      }
      if (sortBy === "status") {
        return left.status.localeCompare(right.status) * direction;
      }

      const leftTime = left.membershipDate ? new Date(left.membershipDate).getTime() : 0;
      const rightTime = right.membershipDate ? new Date(right.membershipDate).getTime() : 0;
      return (leftTime - rightTime) * direction;
    });

    return rows;
  }, [members, sortBy, sortDirection]);

  const templateCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    "firstName,middleName,lastName,email,phone,status,tags,gender,dateOfBirth,membershipDate,branchId\nJane,,Doe,jane@example.com,+15551234567,Active,Choir|Volunteer,Female,1990-04-02,2025-01-10,",
  )}`;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Member Operations</p>
            <h2 className="text-2xl font-black text-slate-900">Members Directory</h2>
            <p className="text-sm text-slate-500">Operational profiles, lifecycle status, tags, and contact readiness in one control view.</p>
            <p className="text-xs font-semibold text-indigo-600">{selectedBranchId ? `Branch scoped: ${selectedBranchId}` : "All branches in active tenant scope"}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a href={templateCsvHref} download="members-template.csv" className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-100">
              Download Template
            </a>
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-100">
              {importing ? "Importing..." : "Import CSV"}
              <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" disabled={importing} />
            </label>
            <Link href="/admin/members/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wide !text-white transition hover:bg-indigo-500">
              Add Member
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Members" value={members.length} tone="indigo" sublabel={`${newThisMonth} joined this month`} />
            <MetricCard label="Active Members" value={activeMembers} tone="teal" sublabel={`${inactiveMembers} inactive`} />
            <MetricCard label="Contact Complete" value={`${contactCompleteness}%`} tone="violet" sublabel={`${withContact} with email/phone`} />
            <MetricCard label="Tagged Profiles" value={taggedMembers} tone="amber" sublabel={`${prospectMembers + visitorMembers} follow-up queue`} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1.4fr_.9fr_.8fr_.8fr_auto]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, phone, emergency contact"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">All statuses</option>
                {MEMBER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as "membershipDate" | "name" | "status")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="membershipDate">Sort: Date Joined</option>
                <option value="name">Sort: Name</option>
                <option value="status">Sort: Status</option>
              </select>
              <select
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void loadMembers()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                    setSortBy("membershipDate");
                    setSortDirection("desc");
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Clear
                </button>
              </div>
            </div>
          </section>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
          {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}
          {importFailures.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-700">
              {importFailures.map((failure) => (
                <li key={`${failure.row}-${failure.reason}`}>Row {failure.row}: {failure.reason}</li>
              ))}
            </ul>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Directory List</p>
              <p className="text-xs font-semibold text-slate-500">
                {loading ? "Loading..." : `${sortedMembers.length} records`} · {sortBy} ({sortDirection})
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Member</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tags</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Membership</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-5 py-4"><div className="h-4 w-40 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-52 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                      </tr>
                    ))
                  ) : sortedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm font-medium text-slate-500">
                        No members found for this tenant context.
                      </td>
                    </tr>
                  ) : (
                    sortedMembers.map((member) => (
                      <tr key={member.id} className="transition hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              {member.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={member.avatarUrl} alt={`${formatMemberFullName(member)} avatar`} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-xs font-black text-slate-500">
                                  {member.firstName.charAt(0)}
                                  {member.lastName.charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{formatMemberFullName(member)}</p>
                              <p className="text-xs text-slate-500">{member.gender || "Gender not set"} · {member.occupation || "Occupation not set"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(member.status)}`}>{member.status}</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <div>{member.email || "No email"}</div>
                          <div className="text-xs text-slate-500">{member.phone || "No phone"}</div>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {member.tags.length ? (
                            <div className="flex flex-wrap gap-1">
                              {member.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                  {tag}
                                </span>
                              ))}
                              {member.tags.length > 2 ? <span className="text-xs font-semibold text-slate-500">+{member.tags.length - 2}</span> : null}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">No tags</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {member.membershipDate ? new Date(member.membershipDate).toLocaleDateString() : "Not captured"}
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-semibold">
                          <button
                            type="button"
                            onClick={() => setSelectedMember(member)}
                            className="mr-2 rounded-md border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                          >
                            View
                          </button>
                          <Link
                            href={`/admin/members/${member.id}`}
                            className="mr-2 rounded-md border border-indigo-200 px-2 py-1 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => void deleteMember(member)}
                            disabled={deletingId === member.id}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === member.id ? "Deleting..." : "Delete"}
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

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Quick Actions</p>
            <div className="mt-3 grid gap-2">
              <Link href="/admin/members/new" className="rounded-lg bg-indigo-600 px-3 py-2 text-center text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500">
                Add New Member
              </Link>
              <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100">
                {importing ? "Importing..." : "Import CSV"}
                <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" disabled={importing} />
              </label>
              <a href={templateCsvHref} download="members-template.csv" className="rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100">
                Get CSV Template
              </a>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Status Mix</p>
            <div className="mt-3 space-y-2 text-sm">
              <StatusRow label="Active" value={activeMembers} total={members.length} tone="bg-emerald-500" />
              <StatusRow label="Visitor" value={visitorMembers} total={members.length} tone="bg-sky-500" />
              <StatusRow label="Prospect" value={prospectMembers} total={members.length} tone="bg-amber-500" />
              <StatusRow label="Inactive" value={inactiveMembers} total={members.length} tone="bg-slate-500" />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Data Quality</p>
            <div className="mt-3 space-y-3 text-sm">
              <ProgressRow label="Contact completeness" value={contactCompleteness} />
              <ProgressRow label="Tagged profiles" value={members.length ? Math.round((taggedMembers / members.length) * 100) : 0} />
            </div>
          </section>
        </aside>
      </div>

      <MemberProfileModal member={selectedMember} open={Boolean(selectedMember)} onClose={() => setSelectedMember(null)} />
    </div>
  );
}

function statusBadgeClass(status: string) {
  if (status === "Active") return "bg-emerald-100 text-emerald-700";
  if (status === "Visitor") return "bg-sky-100 text-sky-700";
  if (status === "Prospect") return "bg-amber-100 text-amber-700";
  if (status === "Inactive") return "bg-slate-200 text-slate-700";
  return "bg-indigo-100 text-indigo-700";
}

function MetricCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: number | string;
  sublabel: string;
  tone: "indigo" | "teal" | "violet" | "amber";
}) {
  const toneClass =
    tone === "indigo"
      ? "from-indigo-600 to-blue-500"
      : tone === "teal"
        ? "from-teal-500 to-emerald-500"
        : tone === "violet"
          ? "from-violet-500 to-indigo-500"
          : "from-amber-500 to-orange-500";

  return (
    <div className={`rounded-xl bg-gradient-to-r ${toneClass} p-[1px] shadow-sm`}>
      <div className="rounded-[11px] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{sublabel}</p>
      </div>
    </div>
  );
}

function StatusRow({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const percentage = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-700">{label}</p>
        <p className="text-xs font-black text-slate-500">{value}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${tone}`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-700">{label}</p>
        <p className="text-xs font-black text-slate-500">{value}%</p>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-indigo-500" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
