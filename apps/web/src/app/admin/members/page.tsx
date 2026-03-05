"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";
import { MEMBER_STATUS_OPTIONS, MemberProfile, formatMemberFullName } from "@/lib/members";
import { MemberProfileModal } from "@/components/members/member-profile-modal";
import { downloadRows, type CsvColumn } from "@/lib/export-utils";
import { KpiCard } from "@/components/console/kpi-card";

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
  const [activeTab, setActiveTab] = useState<"overview" | "attendance" | "birthdays">("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [ministryFilter, setMinistryFilter] = useState("all");
  const [ageGroupFilter, setAgeGroupFilter] = useState("all");
  const [joinedFilter, setJoinedFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"membershipDate" | "name" | "status">("membershipDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [exportFormat, setExportFormat] = useState<"csv" | "excel" | "pdf">("csv");
  const pageSize = 10;

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
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
  }, [selectedBranchId]);

  useEffect(() => {
    if (searchParams?.get("created") === "1") {
      setNotice("Member created successfully.");
    }
  }, [searchParams]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, branchFilter, ministryFilter, ageGroupFilter, joinedFilter, sortBy, sortDirection, activeTab]);

  useEffect(() => {
    setSelectedIds([]);
  }, [search, statusFilter, branchFilter, ministryFilter, ageGroupFilter, joinedFilter, activeTab, page]);

  const updateMember = useCallback(
    async (memberId: string, payload: Partial<MemberProfile>) => {
      await apiFetch(`/api/admin/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          branchId: selectedBranchId ?? payload.branchId ?? undefined,
        }),
      });
    },
    [selectedBranchId],
  );

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

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
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

  const branchOptions = useMemo(
    () => Array.from(new Set(members.map((member) => member.branchId).filter(Boolean) as string[])).sort((left, right) => left.localeCompare(right)),
    [members],
  );
  const ministryOptions = useMemo(
    () => Array.from(new Set(members.flatMap((member) => member.tags).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const now = new Date();
    const rows = members.filter((member) => {
      const name = formatMemberFullName(member).toLowerCase();
      const needle = search.trim().toLowerCase();
      if (needle) {
        const haystack = [
          name,
          member.email ?? "",
          member.phone ?? "",
          member.occupation ?? "",
          member.emergencyContactName ?? "",
          member.city ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }

      if (statusFilter && member.status !== statusFilter) return false;

      if (branchFilter !== "all") {
        if (branchFilter === "unassigned" && member.branchId) return false;
        if (branchFilter !== "unassigned" && member.branchId !== branchFilter) return false;
      }

      if (ministryFilter !== "all" && !member.tags.some((tag) => tag.toLowerCase() === ministryFilter.toLowerCase())) {
        return false;
      }

      const age = getMemberAge(member.dateOfBirth);
      if (ageGroupFilter !== "all") {
        if (age === null) return false;
        if (ageGroupFilter === "under-18" && age >= 18) return false;
        if (ageGroupFilter === "18-30" && (age < 18 || age > 30)) return false;
        if (ageGroupFilter === "31-45" && (age < 31 || age > 45)) return false;
        if (ageGroupFilter === "46-plus" && age < 46) return false;
      }

      if (joinedFilter !== "all") {
        if (!member.membershipDate) return false;
        const joined = new Date(member.membershipDate);
        if (Number.isNaN(joined.getTime())) return false;
        const dayMs = 1000 * 60 * 60 * 24;
        const diff = (now.getTime() - joined.getTime()) / dayMs;
        if (joinedFilter === "30-days" && diff > 30) return false;
        if (joinedFilter === "90-days" && diff > 90) return false;
        if (joinedFilter === "this-year" && joined.getFullYear() !== now.getFullYear()) return false;
      }

      if (activeTab === "attendance") {
        const hasEngagement = member.status === "Active" || member.tags.some((tag) => /follow up|worker|volunteer|leader/i.test(tag));
        if (!hasEngagement) return false;
      }

      if (activeTab === "birthdays") {
        if (!member.dateOfBirth) return false;
        const dob = new Date(member.dateOfBirth);
        if (Number.isNaN(dob.getTime())) return false;
        if (dob.getMonth() !== now.getMonth()) return false;
      }

      return true;
    });

    return rows;
  }, [members, search, statusFilter, branchFilter, ministryFilter, ageGroupFilter, joinedFilter, activeTab]);

  const sortedMembers = useMemo(() => {
    const rows = [...filteredMembers];
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
  }, [filteredMembers, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedMembers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedMembers = sortedMembers.slice(pageStart, pageStart + pageSize);
  const allCurrentPageSelected = paginatedMembers.length > 0 && paginatedMembers.every((member) => selectedIds.includes(member.id));
  const selectedMembers = sortedMembers.filter((member) => selectedIds.includes(member.id));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const exportColumns: CsvColumn<MemberProfile>[] = useMemo(
    () => [
      { label: "Name", value: (member) => formatMemberFullName(member) },
      { label: "Status", value: (member) => member.status },
      { label: "Branch", value: (member) => member.branchId ?? "Unassigned" },
      { label: "Email", value: (member) => member.email ?? "" },
      { label: "Phone", value: (member) => member.phone ?? "" },
      { label: "DOB", value: (member) => toDateLabel(member.dateOfBirth) },
      { label: "Tags", value: (member) => member.tags.join("|") },
      { label: "Date Joined", value: (member) => toDateLabel(member.membershipDate) },
      { label: "Follow-up", value: (member) => getFollowUpInfo(member).label },
    ],
    [],
  );

  async function exportMembers(scope: "filtered" | "selected") {
    const rows = scope === "selected" ? selectedMembers : sortedMembers;
    if (rows.length === 0) {
      setNotice(scope === "selected" ? "Select at least one member to export." : "No rows available for export.");
      return;
    }

    await downloadRows(
      exportFormat,
      `members-${scope}-${new Date().toISOString().slice(0, 10)}`,
      rows,
      exportColumns,
      `Members ${scope === "selected" ? "(selected)" : "(filtered)"}`,
    );
    setNotice(`Exported ${rows.length} member record${rows.length > 1 ? "s" : ""} as ${exportFormat.toUpperCase()}.`);
  }

  async function applyBulkAction() {
    if (!bulkAction) {
      setNotice("Choose a bulk action first.");
      return;
    }
    if (selectedMembers.length === 0) {
      setNotice("Select at least one member.");
      return;
    }

    setBulkBusy(true);
    setError("");
    setNotice("");
    try {
      if (bulkAction === "delete") {
        if (!window.confirm(`Delete ${selectedMembers.length} selected member(s)?`)) {
          setBulkBusy(false);
          return;
        }
        await Promise.all(selectedMembers.map((member) => deleteMemberDirect(member)));
        setNotice(`Deleted ${selectedMembers.length} member record${selectedMembers.length > 1 ? "s" : ""}.`);
      } else if (bulkAction === "activate" || bulkAction === "inactive" || bulkAction === "prospect" || bulkAction === "visitor") {
        const nextStatus = bulkAction === "activate" ? "Active" : bulkAction === "inactive" ? "Inactive" : bulkAction === "prospect" ? "Prospect" : "Visitor";
        await Promise.all(selectedMembers.map((member) => updateMember(member.id, { status: nextStatus })));
        setNotice(`Updated ${selectedMembers.length} member record${selectedMembers.length > 1 ? "s" : ""} to ${nextStatus}.`);
      } else if (bulkAction === "mark-follow-up") {
        await Promise.all(
          selectedMembers.map((member) => {
            const nextTags = member.tags.includes("Follow Up") ? member.tags : [...member.tags, "Follow Up"];
            return updateMember(member.id, { tags: nextTags });
          }),
        );
        setNotice(`Marked ${selectedMembers.length} member record${selectedMembers.length > 1 ? "s" : ""} for follow up.`);
      } else if (bulkAction === "clear-follow-up") {
        await Promise.all(
          selectedMembers.map((member) =>
            updateMember(member.id, {
              tags: member.tags.filter((tag) => tag.toLowerCase() !== "follow up"),
            }),
          ),
        );
        setNotice(`Cleared follow-up tags for ${selectedMembers.length} member record${selectedMembers.length > 1 ? "s" : ""}.`);
      }

      await loadMembers();
      setSelectedIds([]);
      setBulkAction("");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to apply bulk action."));
    } finally {
      setBulkBusy(false);
    }
  }

  async function deleteMemberDirect(member: MemberProfile) {
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    await apiFetch<{ success: boolean }>(`/api/admin/members/${member.id}${query}`, {
      method: "DELETE",
    });
  }

  const templateCsvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    "firstName,middleName,lastName,email,phone,status,tags,gender,dateOfBirth,membershipDate,branchId\nJane,,Doe,jane@example.com,+15551234567,Active,Choir|Volunteer,Female,1990-04-02,2025-01-10,",
  )}`;

  return (
    <div className="space-y-5">
      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm nx-soft-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[34px] font-black leading-none text-slate-900">Members</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { key: "overview", label: "Overview" },
                { key: "attendance", label: "Attendance" },
                { key: "birthdays", label: "Birthdays" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as "overview" | "attendance" | "birthdays")}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    activeTab === tab.key
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-700"
                      : "border-transparent bg-white/70 text-slate-500 hover:border-indigo-100 hover:text-indigo-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs font-semibold text-indigo-600">
              {selectedBranchId ? `Branch scope: ${selectedBranchId}` : "All branches in tenant scope"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/members/new"
              className="inline-flex items-center rounded-xl border border-indigo-400 bg-indigo-500 px-4 py-2 text-xs font-black uppercase tracking-wide !text-white shadow-sm transition hover:bg-indigo-600"
            >
              + Add Member
            </Link>
            <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50">
              {importing ? "Importing..." : "Import CSV"}
              <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" disabled={importing} />
            </label>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2">
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as "csv" | "excel" | "pdf")}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="pdf">PDF</option>
              </select>
              <button
                type="button"
                onClick={() => void exportMembers("filtered")}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-slate-700 hover:bg-slate-100"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[1.2fr_.8fr_.8fr_.8fr_.8fr_.8fr_auto_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search member, email, phone, city..."
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Branch</option>
            {branchOptions.map((branchId) => (
              <option key={branchId} value={branchId}>
                {branchId}
              </option>
            ))}
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            value={ministryFilter}
            onChange={(event) => setMinistryFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Ministry</option>
            {ministryOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">Status</option>
            {MEMBER_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select
            value={ageGroupFilter}
            onChange={(event) => setAgeGroupFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Age Group</option>
            <option value="under-18">Under 18</option>
            <option value="18-30">18 - 30</option>
            <option value="31-45">31 - 45</option>
            <option value="46-plus">46+</option>
          </select>
          <select
            value={joinedFilter}
            onChange={(event) => setJoinedFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">Date Joined</option>
            <option value="30-days">Last 30 days</option>
            <option value="90-days">Last 90 days</option>
            <option value="this-year">This year</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setBranchFilter("all");
              setMinistryFilter("all");
              setAgeGroupFilter("all");
              setJoinedFilter("all");
              setSortBy("membershipDate");
              setSortDirection("desc");
              setBulkAction("");
            }}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700 hover:bg-slate-50"
          >
            Clear All
          </button>
          <button
            type="button"
            onClick={() => void applyBulkAction()}
            disabled={bulkBusy || selectedMembers.length === 0}
            className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkBusy ? "Applying..." : "Apply Action"}
          </button>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Members"
              value={members.length}
              sublabel={`${newThisMonth} joined this month`}
              tone="blue"
              icon="users"
              loading={loading}
            />
            <KpiCard
              label="Active"
              value={activeMembers}
              sublabel={`${inactiveMembers} inactive`}
              tone="teal"
              icon="heartbeat"
              loading={loading}
            />
            <KpiCard
              label="Contact Ready"
              value={`${contactCompleteness}%`}
              sublabel={`${withContact} with contact`}
              tone="violet"
              icon="chart"
              loading={loading}
            />
            <KpiCard
              label="Follow-up Queue"
              value={prospectMembers + visitorMembers}
              sublabel={`${taggedMembers} tagged profiles`}
              tone="orange"
              icon="calendar"
              loading={loading}
            />
          </div>

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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Members Table</p>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {selectedMembers.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "membershipDate" | "name" | "status")}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="membershipDate">Sort by Joined Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="status">Sort by Status</option>
                </select>
                <select
                  value={sortDirection}
                  onChange={(event) => setSortDirection(event.target.value as "asc" | "desc")}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadMembers()}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs">
              <div className="flex items-center gap-4 text-slate-500">
                <span className="font-semibold">New this month</span>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">{newThisMonth}</span>
                <span>Showing {loading ? "..." : `${paginatedMembers.length}`} of {sortedMembers.length} results</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={bulkAction}
                  onChange={(event) => setBulkAction(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="">Bulk actions</option>
                  <option value="activate">Set Active</option>
                  <option value="inactive">Set Inactive</option>
                  <option value="visitor">Set Visitor</option>
                  <option value="prospect">Set Prospect</option>
                  <option value="mark-follow-up">Tag Follow Up</option>
                  <option value="clear-follow-up">Clear Follow Up Tag</option>
                  <option value="delete">Delete Selected</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedIds((current) => Array.from(new Set([...current, ...paginatedMembers.map((member) => member.id)])));
                          } else {
                            setSelectedIds((current) => current.filter((id) => !paginatedMembers.some((member) => member.id === id)));
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label="Select all rows on this page"
                      />
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Branch</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Group</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">DOB</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Follow up due</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-4 py-4"><div className="h-4 w-4 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-40 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-40 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-36 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="h-6 w-24 animate-pulse rounded-full bg-slate-200" /></td>
                        <td className="px-5 py-4"><div className="ml-auto h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                      </tr>
                    ))
                  ) : paginatedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-sm font-medium text-slate-500">
                        No members found for this tenant context.
                      </td>
                    </tr>
                  ) : (
                    paginatedMembers.map((member) => {
                      const followUp = getFollowUpInfo(member);
                      return (
                      <tr key={member.id} className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(member.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedIds((current) => (current.includes(member.id) ? current : [...current, member.id]));
                              } else {
                                setSelectedIds((current) => current.filter((id) => id !== member.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            aria-label={`Select ${formatMemberFullName(member)}`}
                          />
                        </td>
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
                              <p className="text-xs text-slate-500">{member.gender || "Member profile"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <div>{member.phone || "No phone"}</div>
                          <div className="text-xs text-slate-500">{member.email || "No email"}</div>
                        </td>
                        <td className="px-5 py-4 text-sm">
                          <div className="space-y-1">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(member.status)}`}>{member.status}</span>
                            <div className="text-[11px] text-slate-500">{member.status === "Active" ? "Inflow Up" : "Follow Up"}</div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {member.branchId || "Unassigned"}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {member.tags.length ? (
                            <div className="flex flex-wrap gap-1">
                              {member.tags.slice(0, 1).map((tag) => (
                                <span key={tag} className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                  {tag}
                                </span>
                              ))}
                              {member.tags.length > 1 ? <span className="text-xs font-semibold text-slate-500">+{member.tags.length - 1}</span> : null}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">No tags</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {toDateLabel(member.dateOfBirth)}
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          <div className="space-y-1">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${followUp.tone}`}>
                              {followUp.label}
                            </span>
                            <p className="text-[11px] text-slate-500">{followUp.dateLabel}</p>
                          </div>
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
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <p className="text-xs font-medium text-slate-500">
                Showing {sortedMembers.length === 0 ? 0 : pageStart + 1} to {Math.min(pageStart + pageSize, sortedMembers.length)} of {sortedMembers.length} results
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Prev
                </button>
                <span className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Quick Actions</p>
            <div className="mt-3 grid gap-2">
              <Link href="/admin/members/new" className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center text-xs font-black uppercase tracking-wider !text-indigo-700 transition hover:bg-indigo-100">
                Add New Member
              </Link>
              <label className="cursor-pointer rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-violet-700 transition hover:bg-violet-100">
                {importing ? "Importing..." : "Import CSV"}
                <input type="file" accept=".csv,text/csv" onChange={importCsv} className="hidden" disabled={importing} />
              </label>
              <a href={templateCsvHref} download="members-template.csv" className="rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100">
                Get CSV Template
              </a>
              <button
                type="button"
                onClick={() => void exportMembers("selected")}
                className="rounded-lg border border-slate-300 px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              >
                Export Selected
              </button>
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

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Operations</p>
            <div className="mt-3 space-y-3 text-sm">
              <ActionStat label="Send Notice" value={selectedMembers.length || activeMembers} href="/admin/communication" />
              <ActionStat label="Open Follow-ups" value={prospectMembers + visitorMembers} href="/admin/followups" />
              <ActionStat label="Tagged Members" value={taggedMembers} href="/admin/tags" />
              <ActionStat label="Visitors" value={visitorMembers} href="/admin/visitors" />
            </div>
          </section>
        </aside>
      </div>

      <MemberProfileModal member={selectedMember} open={Boolean(selectedMember)} onClose={() => setSelectedMember(null)} />
    </div>
  );
}

function statusBadgeClass(status: string) {
  if (status === "Active") return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  if (status === "Visitor") return "border border-sky-200 bg-sky-100 text-sky-700";
  if (status === "Prospect") return "border border-amber-200 bg-amber-100 text-amber-700";
  if (status === "Inactive") return "border border-slate-300 bg-slate-200 text-slate-700";
  return "border border-indigo-200 bg-indigo-100 text-indigo-700";
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

function ActionStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 transition hover:bg-slate-50">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="text-sm font-black text-slate-900">{value.toLocaleString()}</span>
    </Link>
  );
}

function getMemberAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

function toDateLabel(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString();
}

function getFollowUpInfo(member: MemberProfile): { label: string; tone: string; dateLabel: string } {
  const joined = member.membershipDate ? new Date(member.membershipDate) : null;
  const hasJoinedDate = Boolean(joined && !Number.isNaN(joined.getTime()));
  const followUpTag = member.tags.some((tag) => tag.toLowerCase() === "follow up");

  if (member.status === "Prospect" || member.status === "Visitor" || followUpTag) {
    const dueDate =
      hasJoinedDate && joined
        ? new Date(joined.getTime() + 1000 * 60 * 60 * 24 * 7).toLocaleDateString()
        : "Due soon";
    return {
      label: "Follow Up",
      tone: "border border-violet-200 bg-violet-100 text-violet-700",
      dateLabel: dueDate,
    };
  }

  return {
    label: "Inflow Up",
    tone: "border border-emerald-200 bg-emerald-100 text-emerald-700",
    dateLabel: hasJoinedDate && joined ? joined.toLocaleDateString() : "No date",
  };
}
