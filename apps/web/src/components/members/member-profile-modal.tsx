"use client";

import { useEffect } from "react";
import Link from "next/link";
import { MemberProfile, formatMemberFullName } from "@/lib/members";

type MemberProfileModalProps = {
  member: MemberProfile | null;
  open: boolean;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return "Not captured";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not captured";
  return date.toLocaleDateString();
}

function initials(member: MemberProfile) {
  return `${member.firstName.charAt(0)}${member.lastName.charAt(0)}`.toUpperCase();
}

function getProfileCompleteness(member: MemberProfile) {
  const checks = [
    Boolean(member.email),
    Boolean(member.phone),
    Boolean(member.gender),
    Boolean(member.dateOfBirth),
    Boolean(member.addressLine1 || member.city || member.country),
    Boolean(member.emergencyContactName || member.emergencyContactPhone),
  ];
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

export function MemberProfileModal({ member, open, onClose }: MemberProfileModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !member) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-profile-title"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.avatarUrl} alt={`${formatMemberFullName(member)} profile`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-black text-slate-500">{initials(member)}</span>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Member Profile</p>
              <h2 id="member-profile-title" className="text-2xl font-black text-slate-900">{formatMemberFullName(member)}</h2>
              <p className="mt-1 text-sm text-slate-500">{member.status} · {member.occupation || "Occupation not set"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/members/${member.id}`}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500"
            >
              Edit Member
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              aria-label="Close member profile"
            >
              Close
            </button>
          </div>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Badge label="Profile completeness" value={`${getProfileCompleteness(member)}%`} tone="indigo" />
          <Badge label="Member since" value={formatDate(member.membershipDate)} tone="emerald" />
          <Badge label="Last updated" value={formatDate(member.updatedAt || member.createdAt)} tone="violet" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard
            title="Contact"
            rows={[
              ["Email", member.email || "Not captured"],
              ["Phone", member.phone || "Not captured"],
              ["Preferred contact", member.preferredContactMethod || "Not captured"],
            ]}
          />
          <InfoCard
            title="Personal"
            rows={[
              ["Gender", member.gender || "Not captured"],
              ["Date of birth", formatDate(member.dateOfBirth)],
              ["Marital status", member.maritalStatus || "Not captured"],
            ]}
          />
          <InfoCard
            title="Church Records"
            rows={[
              ["Membership date", formatDate(member.membershipDate)],
              ["Baptism date", formatDate(member.baptismDate)],
              ["Tags", member.tags.length ? member.tags.join(", ") : "No tags"],
            ]}
          />
          <InfoCard
            title="Emergency"
            rows={[
              ["Contact name", member.emergencyContactName || "Not captured"],
              ["Contact phone", member.emergencyContactPhone || "Not captured"],
              ["Address", [member.addressLine1, member.addressLine2, member.city, member.state, member.country].filter(Boolean).join(", ") || "Not captured"],
            ]}
          />
        </div>

        {member.notes && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-600">Pastoral Notes</p>
            <p className="mt-2 text-sm text-slate-700">{member.notes}</p>
          </section>
        )}
      </div>
    </div>
  );
}

function Badge({ label, value, tone }: { label: string; value: string; tone: "indigo" | "emerald" | "violet" }) {
  const toneClass =
    tone === "indigo" ? "bg-indigo-50 text-indigo-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function InfoCard({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wider text-slate-600">{title}</p>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2 text-sm">
            <span className="font-semibold text-slate-500">{label}</span>
            <span className="text-right font-medium text-slate-800">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
