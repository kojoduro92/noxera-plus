"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { useBranch } from "@/contexts/BranchContext";

type GroupRow = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  _count?: {
    members: number;
  };
};

type GroupDetail = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    member: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string | null;
    };
  }>;
};

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

export default function GroupsPage() {
  const { selectedBranchId } = useBranch();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Ministry");
  const [newDescription, setNewDescription] = useState("");

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberRole, setMemberRole] = useState("Member");
  const [addingMember, setAddingMember] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";

    try {
      const [groupPayload, memberPayload] = await Promise.all([
        apiFetch<GroupRow[]>(`/api/admin/groups${query}`, { cache: "no-store" }),
        apiFetch<MemberOption[]>(`/api/admin/members?status=Active${selectedBranchId ? `&branchId=${encodeURIComponent(selectedBranchId)}` : ""}`, {
          cache: "no-store",
        }),
      ]);

      setGroups(groupPayload);
      setMembers(memberPayload);
    } catch (err) {
      setGroups([]);
      setMembers([]);
      setError(getErrorMessage(err, "Unable to load groups."));
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  const loadGroupDetail = useCallback(
    async (groupId: string) => {
      setLoadingDetail(true);
      setError("");
      const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
      try {
        const detail = await apiFetch<GroupDetail>(`/api/admin/groups/${groupId}${query}`, { cache: "no-store" });
        setGroupDetail(detail);
      } catch (err) {
        setGroupDetail(null);
        setError(getErrorMessage(err, "Unable to load group details."));
      } finally {
        setLoadingDetail(false);
      }
    },
    [selectedBranchId],
  );

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (!activeGroupId) {
      setGroupDetail(null);
      return;
    }
    void loadGroupDetail(activeGroupId);
  }, [activeGroupId, loadGroupDetail]);

  const filteredGroups = useMemo(
    () =>
      groups.filter((group) => {
        if (typeFilter !== "all" && group.type !== typeFilter) return false;
        if (!search.trim()) return true;
        const query = search.trim().toLowerCase();
        return group.name.toLowerCase().includes(query) || (group.description || "").toLowerCase().includes(query);
      }),
    [groups, search, typeFilter],
  );

  const availableMembers = useMemo(() => {
    if (!groupDetail) return [];
    const existingMemberIds = new Set(groupDetail.members.map((item) => item.member.id));
    const query = memberSearch.trim().toLowerCase();
    return members
      .filter((member) => !existingMemberIds.has(member.id))
      .filter((member) => {
        if (!query) return true;
        return `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) || (member.email || "").toLowerCase().includes(query);
      })
      .slice(0, 8);
  }, [groupDetail, memberSearch, members]);

  const groupMetrics = useMemo(
    () => ({
      total: groups.length,
      totalAssignments: groups.reduce((sum, row) => sum + (row._count?.members ?? 0), 0),
      ministries: groups.filter((row) => row.type === "Ministry").length,
    }),
    [groups],
  );

  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newName.trim()) {
      setError("Group name is required.");
      return;
    }

    setCreating(true);
    setError("");
    setNotice("");

    try {
      await apiFetch<GroupRow>("/api/admin/groups", {
        method: "POST",
        ...withJsonBody({
          name: newName.trim(),
          type: newType,
          description: newDescription.trim() || undefined,
          branchId: selectedBranchId,
        }),
      });
      setNotice("Group created.");
      setNewName("");
      setNewDescription("");
      await loadGroups();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create group."));
    } finally {
      setCreating(false);
    }
  };

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeGroupId || !selectedMemberId) {
      setError("Select a member first.");
      return;
    }

    setAddingMember(true);
    setError("");
    setNotice("");

    try {
      await apiFetch(`/api/admin/groups/${activeGroupId}/members`, {
        method: "POST",
        ...withJsonBody({
          memberId: selectedMemberId,
          role: memberRole,
          branchId: selectedBranchId,
        }),
      });
      setNotice("Member assigned to group.");
      setSelectedMemberId("");
      setMemberRole("Member");
      await Promise.all([loadGroups(), loadGroupDetail(activeGroupId)]);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to assign member."));
    } finally {
      setAddingMember(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-violet-700 p-6 text-white shadow-lg shadow-indigo-900/20">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-200">Groups Governance</p>
        <h2 className="mt-2 text-2xl font-black">Manage ministries, departments, and member assignments by branch.</h2>
        <p className="mt-2 max-w-3xl text-sm text-indigo-100">Every assignment is auditable and scoped to your active tenant context.</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Groups</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{groupMetrics.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Member Assignments</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{groupMetrics.totalAssignments}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ministry Groups</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{groupMetrics.ministries}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-900">Groups Directory</h3>
            <button type="button" onClick={() => void loadGroups()} className="text-xs font-bold text-indigo-600 transition hover:text-indigo-500">
              Refresh
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search groups"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="all">All types</option>
              <option value="Ministry">Ministry</option>
              <option value="Department">Department</option>
              <option value="CellGroup">Cell Group</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Clear
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Group</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Members</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index}>
                      <td className="px-4 py-4"><div className="h-4 w-36 animate-pulse rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="h-4 w-16 animate-pulse rounded bg-slate-200" /></td>
                      <td className="px-4 py-4"><div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200" /></td>
                    </tr>
                  ))
                ) : filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm font-medium text-slate-500">
                      No groups found. Create your first group to start assignments.
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map((group) => (
                    <tr key={group.id}>
                      <td className="px-4 py-4 text-sm font-semibold text-slate-900">{group.name}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{group.type}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{group._count?.members ?? 0}</td>
                      <td className="px-4 py-4 text-right text-sm">
                        <button type="button" onClick={() => setActiveGroupId(group.id)} className="font-semibold text-indigo-600 transition hover:text-indigo-500">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <form onSubmit={createGroup} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Create Group</h3>
            <div className="mt-4 grid gap-3">
              <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Group name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <select value={newType} onChange={(event) => setNewType(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="Ministry">Ministry</option>
                <option value="Department">Department</option>
                <option value="CellGroup">Cell Group</option>
              </select>
              <textarea
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button type="submit" disabled={creating} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
              {creating ? "Creating..." : "Create Group"}
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Group Detail</h3>
            {!activeGroupId ? (
              <p className="mt-3 text-sm text-slate-500">Select a group from the directory to manage members.</p>
            ) : loadingDetail ? (
              <div className="mt-3 space-y-2">
                <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              </div>
            ) : !groupDetail ? (
              <p className="mt-3 text-sm text-red-600">Unable to load selected group details.</p>
            ) : (
              <>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-900">{groupDetail.name}</p>
                  <p className="text-xs font-medium text-slate-600">{groupDetail.type}</p>
                  <p className="mt-2 text-xs text-slate-500">{groupDetail.description || "No description provided."}</p>
                </div>

                <form onSubmit={addMember} className="mt-4 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">Assign Member</p>
                  <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search members" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select member</option>
                    {availableMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName} {member.email ? `(${member.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="Member">Member</option>
                    <option value="Leader">Leader</option>
                    <option value="Assistant">Assistant</option>
                  </select>
                  <button type="submit" disabled={addingMember} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {addingMember ? "Saving..." : "Add Member"}
                  </button>
                </form>

                <div className="mt-4">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">Current Members</p>
                  {groupDetail.members.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No members assigned yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {groupDetail.members.slice(0, 8).map((entry) => (
                        <li key={entry.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <span className="font-semibold text-slate-900">{entry.member.firstName} {entry.member.lastName}</span>
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{entry.role}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
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
