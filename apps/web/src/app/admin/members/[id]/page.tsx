"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MemberProfileForm } from "@/components/members/member-profile-form";
import { MemberPayload, MemberProfile, formatMemberFullName } from "@/lib/members";
import { useBranch } from "@/contexts/BranchContext";
import { ApiError, apiFetch } from "@/lib/api-client";
import { PageBackButton } from "@/components/console/page-back-button";
import { PageBreadcrumbs } from "@/components/console/page-breadcrumbs";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

export default function MemberDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { selectedBranchId } = useBranch();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const memberId = params.id;

  const loadMember = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = selectedBranchId ? `?branchId=${encodeURIComponent(selectedBranchId)}` : "";
      const payload = await apiFetch<MemberProfile>(`/api/admin/members/${memberId}${query}`, {
        cache: "no-store",
      });
      setMember(payload);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load member record."));
    } finally {
      setLoading(false);
    }
  }, [memberId, selectedBranchId]);

  useEffect(() => {
    void loadMember();
  }, [loadMember]);

  const submit = async (payload: MemberPayload) => {
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, branchId: selectedBranchId ?? member?.branchId ?? undefined }),
      });
      setNotice("Member profile updated successfully.");
      await loadMember();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update member."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <PageBackButton fallbackHref="/admin/members" label="Back to Members" />
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Members", href: "/admin/members" },
              { label: "Edit Member" },
            ]}
          />
        </div>
      </div>
      {member && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Member Record</p>
          <h1 className="mt-1 text-lg font-black text-slate-900">{formatMemberFullName(member)}</h1>
        </div>
      )}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      {member ? (
        <MemberProfileForm mode="edit" initialValue={member} submitting={submitting} onSubmit={submit} onCancel={() => router.push("/admin/members")} />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          Member not found for this tenant context.
        </div>
      )}
    </div>
  );
}
