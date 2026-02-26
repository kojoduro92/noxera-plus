export type MemberStatus = "Active" | "Inactive" | "Visitor" | "Prospect";

export type MemberProfile = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  avatarUrl?: string | null;
  preferredContactMethod?: string | null;
  membershipDate?: string | null;
  baptismDate?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  notes?: string | null;
  customFields?: Record<string, unknown> | null;
  status: string;
  tags: string[];
  branchId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MemberPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  occupation?: string;
  avatarUrl?: string;
  preferredContactMethod?: string;
  membershipDate?: string;
  baptismDate?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
  status?: string;
  tags?: string[];
  branchId?: string;
};

export const MEMBER_STATUS_OPTIONS: MemberStatus[] = ["Active", "Inactive", "Visitor", "Prospect"];

export const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"] as const;
export const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"] as const;
export const CONTACT_METHOD_OPTIONS = ["Email", "Phone", "SMS", "WhatsApp"] as const;

export function formatMemberFullName(member: Pick<MemberProfile, "firstName" | "middleName" | "lastName">) {
  return [member.firstName, member.middleName, member.lastName].filter(Boolean).join(" ");
}

export function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
