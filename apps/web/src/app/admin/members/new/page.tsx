"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MemberProfileForm } from "@/components/members/member-profile-form";
import { MemberPayload } from "@/lib/members";
import { useBranch } from "@/contexts/BranchContext";
import { ApiError, apiFetch } from "@/lib/api-client";
import { PageBackButton } from "@/components/console/page-back-button";
import { PageBreadcrumbs } from "@/components/console/page-breadcrumbs";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return (error as { message?: string })?.message ?? fallback;
}

export default function NewMemberPage() {
  const router = useRouter();
  const { selectedBranchId } = useBranch();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (payload: MemberPayload) => {
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, branchId: selectedBranchId }),
      });
      router.push("/admin/members?created=1");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create member."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <PageBackButton fallbackHref="/admin/members" label="Back to Members" />
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Members", href: "/admin/members" },
              { label: "New Member" },
            ]}
          />
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}
      <MemberProfileForm mode="create" submitting={submitting} onSubmit={submit} onCancel={() => router.push("/admin/members")} />
    </div>
  );
}
