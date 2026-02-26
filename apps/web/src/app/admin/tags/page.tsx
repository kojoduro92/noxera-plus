"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import type { MemberProfile } from "@/lib/members";
import { formatMemberFullName } from "@/lib/members";
import { useBranch } from "@/contexts/BranchContext";
import { TableExportMenu } from "@/components/super-admin/table-export-menu";
import { downloadRows, type ExportFormat } from "@/lib/export-utils";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

export default function TagsPage() {
  const { selectedBranchId } = useBranch();
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [newTag, setNewTag] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    try {
      const payload = await apiFetch<MemberProfile[]>(`/api/admin/members${query}`, { cache: "no-store" });
      setMembers(payload);
      if (!selectedMemberId && payload.length > 0) {
        setSelectedMemberId(payload[0].id);
      }
    } catch (err) {
      setMembers([]);
      setError(getErrorMessage(err, "Unable to load member tags."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId, selectedMemberId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const tagAnalytics = useMemo(() => {
    const aggregate = new Map<string, { label: string; count: number; members: number }>();

    members.forEach((member) => {
      const seen = new Set<string>();
      member.tags.forEach((tag) => {
        const normalized = normalizeTag(tag);
        if (!normalized) return;
        const current = aggregate.get(normalized) ?? { label: tag.trim(), count: 0, members: 0 };
        current.count += 1;
        if (!seen.has(normalized)) {
          current.members += 1;
          seen.add(normalized);
        }
        aggregate.set(normalized, current);
      });
    });

    return Array.from(aggregate.entries())
      .map(([key, value]) => ({ key, ...value }))
      .filter((row) => (tagSearch.trim() ? row.label.toLowerCase().includes(tagSearch.trim().toLowerCase()) : true))
      .sort((left, right) => right.members - left.members || left.label.localeCompare(right.label));
  }, [members, tagSearch]);

  const selectedMember = useMemo(() => members.find((member) => member.id === selectedMemberId) ?? null, [members, selectedMemberId]);

  const upsertMemberTags = async (member: MemberProfile, tags: string[]) => {
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
    await apiFetch(`/api/admin/members/${member.id}${query}`, {
      method: "PUT",
      ...withJsonBody({ tags }),
    });
  };

  const addTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMember) {
      setError("Select a member.");
      return;
    }
    const tag = newTag.trim();
    if (!tag) {
      setError("Enter a tag to add.");
      return;
    }

    setBusy("add-tag");
    setError("");
    setNotice("");
    try {
      const exists = selectedMember.tags.some((value) => normalizeTag(value) === normalizeTag(tag));
      const tags = exists ? selectedMember.tags : [...selectedMember.tags, tag];
      await upsertMemberTags(selectedMember, tags);
      setNotice(`Tag '${tag}' applied to ${formatMemberFullName(selectedMember)}.`);
      setNewTag("");
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to add tag."));
    } finally {
      setBusy(null);
    }
  };

  const removeTag = async (member: MemberProfile, tag: string) => {
    setBusy(`remove-${member.id}-${tag}`);
    setError("");
    setNotice("");
    try {
      const tags = member.tags.filter((value) => normalizeTag(value) !== normalizeTag(tag));
      await upsertMemberTags(member, tags);
      setNotice(`Removed '${tag}' from ${formatMemberFullName(member)}.`);
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to remove tag."));
    } finally {
      setBusy(null);
    }
  };

  const renameTagAcrossMembers = async () => {
    const from = renameFrom.trim();
    const to = renameTo.trim();
    if (!from || !to) {
      setError("Both current tag and replacement tag are required.");
      return;
    }

    const impacted = members.filter((member) => member.tags.some((tag) => normalizeTag(tag) === normalizeTag(from)));
    if (impacted.length === 0) {
      setError(`No members found with tag '${from}'.`);
      return;
    }

    setBusy("rename-tag");
    setError("");
    setNotice("");

    try {
      for (const member of impacted) {
        const nextTags = member.tags
          .map((tag) => (normalizeTag(tag) === normalizeTag(from) ? to : tag))
          .filter((tag, index, array) => array.findIndex((value) => normalizeTag(value) === normalizeTag(tag)) === index);
        await upsertMemberTags(member, nextTags);
      }
      setNotice(`Renamed '${from}' to '${to}' for ${impacted.length} member(s).`);
      setRenameFrom("");
      setRenameTo("");
      await loadMembers();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to rename tag."));
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    await downloadRows(
      format,
      `member-tags-${new Date().toISOString().slice(0, 10)}`,
      tagAnalytics,
      [
        { label: "Tag", value: (row) => row.label },
        { label: "Members", value: (row) => row.members },
        { label: "Assignments", value: (row) => row.count },
      ],
      "Member Tags",
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Segmentation Tags</p>
        <h2 className="mt-2 text-2xl font-black">Manage member audience tags for reporting and communication.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Create consistent tag taxonomy, apply across members, and clean duplicates.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-900">Tag Inventory</h3>
            <TableExportMenu onExport={handleExport} label="Download" />
          </div>
          <div className="mt-3 flex gap-2">
            <input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="Search tags" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="button" onClick={() => void loadMembers()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700">Refresh</button>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Tag</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Members</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Assignments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index}><td colSpan={3} className="px-4 py-3"><div className="h-8 animate-pulse rounded bg-slate-100" /></td></tr>
                  ))
                ) : tagAnalytics.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm font-medium text-slate-500">No tags found.</td>
                  </tr>
                ) : (
                  tagAnalytics.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.label}</td>
                      <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{row.members}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700">{row.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <form onSubmit={addTag} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Assign Tag to Member</h3>
            <div className="mt-3 grid gap-3">
              <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{formatMemberFullName(member)}</option>
                ))}
              </select>
              <input value={newTag} onChange={(event) => setNewTag(event.target.value)} placeholder="Enter tag" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="submit" disabled={busy === "add-tag"} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-500 disabled:opacity-50">
                {busy === "add-tag" ? "Applying..." : "Apply Tag"}
              </button>
            </div>

            {selectedMember && (
              <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Current tags for {formatMemberFullName(selectedMember)}</p>
                <div className="flex flex-wrap gap-2">
                  {selectedMember.tags.length === 0 ? (
                    <span className="text-sm text-slate-500">No tags assigned.</span>
                  ) : (
                    selectedMember.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        disabled={busy === `remove-${selectedMember.id}-${tag}`}
                        onClick={() => void removeTag(selectedMember, tag)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {tag} ×
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </form>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Bulk Rename Tag</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Normalize duplicate naming across all members in this branch scope.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input value={renameFrom} onChange={(event) => setRenameFrom(event.target.value)} placeholder="Current tag" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input value={renameTo} onChange={(event) => setRenameTo(event.target.value)} placeholder="Replacement tag" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => void renameTagAcrossMembers()} disabled={busy === "rename-tag"} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              {busy === "rename-tag" ? "Updating..." : "Rename Tag"}
            </button>
          </section>
        </section>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || notice}
        </div>
      )}
    </div>
  );
}
