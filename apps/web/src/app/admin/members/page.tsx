"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  const withContact = members.filter((member) => Boolean(member.email || member.phone)).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total Members" value={members.length} />
        <MetricCard label="Active Members" value={activeMembers} />
        <MetricCard label="Contact Completeness" value={members.length ? `${Math.round((withContact / members.length) * 100)}%` : "0%"} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">Members Directory</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Production-grade member records with profile, family and contact metadata.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent("firstName,middleName,lastName,email,phone,status,tags,gender,dateOfBirth,membershipDate,branchId\nJane,,Doe,jane@example.com,+15551234567,Active,Choir|Volunteer,Female,1990-04-02,2025-01-10,")}`}
              download="members-template.csv"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
            >
              Template
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
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
          <button type="button" onClick={() => void loadMembers()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
            Refresh
          </button>
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
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Member</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Membership</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index}>
                  <td className="px-5 py-4"><div className="h-4 w-40 animate-pulse rounded bg-slate-200" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-52 animate-pulse rounded bg-slate-200" /></td>
                  <td className="px-5 py-4"><div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /></td>
                  <td className="px-5 py-4"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                </tr>
              ))
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm font-medium text-slate-500">
                  No members found for this tenant context.
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id}>
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
                  <td className="px-5 py-4 text-sm text-slate-600">
                    <div>{member.email || "No email"}</div>
                    <div className="text-xs text-slate-500">{member.phone || "No phone"}</div>
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">{member.status}</span>
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
      </section>

      <MemberProfileModal member={selectedMember} open={Boolean(selectedMember)} onClose={() => setSelectedMember(null)} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}
