"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiFetch, withJsonBody } from "@/lib/api-client";
import { sendSignInLinkToEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

const SETTINGS_TABS = [
  { key: "branches", label: "Branches" },
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles" },
  { key: "integrations", label: "Integrations" },
  { key: "billing", label: "Billing & Exports" },
] as const;

type TabKey = (typeof SETTINGS_TABS)[number]["key"];

type BranchRow = {
  id: string;
  name: string;
  location?: string | null;
  isActive: boolean;
};

type BranchStats = {
  branchId: string;
  members: number;
  services: number;
  attendances: number;
  users: number;
};

type RoleRow = {
  id: string;
  name: string;
  isSystem: boolean;
  permissions: string[];
  _count: {
    users: number;
  };
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  status: "Invited" | "Active" | "Suspended";
  branchScopeMode: "ALL" | "RESTRICTED";
  role?: {
    id: string;
    name: string;
  } | null;
  branch?: {
    id: string;
    name: string;
  } | null;
  branchAccess?: Array<{
    branch: {
      id: string;
      name: string;
      isActive: boolean;
    };
  }>;
};

type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

type SessionPayload = {
  permissions?: string[];
};

type IntegrationRow = {
  id: string;
  name: string;
  status: string;
};

type GivingSummary = {
  tithes: number;
  offerings: number;
  special: number;
};

type BillingPreferences = {
  invoiceDueDays: number;
  reminderLeadDays: number;
  statementFrequency: "weekly" | "monthly" | "quarterly";
  defaultExportFormat: "csv" | "excel" | "pdf";
  autoReceiptEmail: boolean;
};

const BILLING_PREFS_STORAGE_KEY = "noxera_admin_billing_preferences";
const DEFAULT_BILLING_PREFERENCES: BillingPreferences = {
  invoiceDueDays: 5,
  reminderLeadDays: 3,
  statementFrequency: "monthly",
  defaultExportFormat: "csv",
  autoReceiptEmail: true,
};

function getError(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message;
  return (err as { message?: string })?.message ?? fallback;
}

function resolveTab(value: string | null): TabKey {
  const matched = SETTINGS_TABS.find((tab) => tab.key === value);
  return matched?.key ?? "branches";
}

export default function AdminSettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  const [activeTab, setActiveTab] = useState<TabKey>("branches");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<string[]>([]);
  const [branchStats, setBranchStats] = useState<Record<string, BranchStats>>({});
  const [expandedBranchStatsId, setExpandedBranchStatsId] = useState<string | null>(null);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchName, setEditingBranchName] = useState("");
  const [editingBranchLocation, setEditingBranchLocation] = useState("");

  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLocation, setNewBranchLocation] = useState("");

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteScope, setInviteScope] = useState<"ALL" | "RESTRICTED">("ALL");
  const [inviteBranchIds, setInviteBranchIds] = useState<string[]>([]);

  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [editingRolePermissions, setEditingRolePermissions] = useState<string[]>([]);
  const [branchSelectionDrafts, setBranchSelectionDrafts] = useState<Record<string, string[]>>({});
  const [userDefaultBranchDrafts, setUserDefaultBranchDrafts] = useState<Record<string, string>>({});
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [billingInsightsLoading, setBillingInsightsLoading] = useState(false);
  const [givingSummary, setGivingSummary] = useState<GivingSummary>({ tithes: 0, offerings: 0, special: 0 });
  const [billingPreferences, setBillingPreferences] = useState<BillingPreferences>(DEFAULT_BILLING_PREFERENCES);

  const activeBranchOptions = useMemo(() => branches.filter((branch) => branch.isActive), [branches]);
  const canManageBranches = useMemo(
    () => permissions.includes("*") || permissions.includes("branches.manage"),
    [permissions],
  );
  const canManageUsers = useMemo(
    () => permissions.includes("*") || permissions.includes("users.manage"),
    [permissions],
  );
  const canManageRoles = useMemo(
    () => permissions.includes("*") || permissions.includes("roles.manage"),
    [permissions],
  );
  const connectedIntegrations = useMemo(
    () => integrations.filter((integration) => integration.status.toLowerCase().includes("connected")).length,
    [integrations],
  );
  const givingTotal = useMemo(
    () => givingSummary.tithes + givingSummary.offerings + givingSummary.special,
    [givingSummary],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await apiFetch<SessionPayload>("/api/admin/session", { cache: "no-store" });
      const resolvedPermissions = session.permissions ?? [];
      setPermissions(resolvedPermissions);

      const branchPayload = await apiFetch<BranchRow[]>("/api/admin/branches?includeArchived=1", { cache: "no-store" });
      setBranches(branchPayload);

      if (
        resolvedPermissions.includes("*") ||
        resolvedPermissions.includes("roles.manage") ||
        resolvedPermissions.includes("users.manage")
      ) {
        const [rolePayload, catalogPayload] = await Promise.all([
          apiFetch<PaginatedResponse<RoleRow>>("/api/admin/roles?limit=100", { cache: "no-store" }),
          apiFetch<string[]>("/api/admin/roles/permissions-catalog", { cache: "no-store" }),
        ]);
        setRoles(rolePayload.items);
        setPermissionsCatalog(catalogPayload);
        if (!inviteRoleId && rolePayload.items.length > 0) {
          setInviteRoleId(rolePayload.items[0].id);
        }
      } else {
        setRoles([]);
        setPermissionsCatalog([]);
      }

      if (resolvedPermissions.includes("*") || resolvedPermissions.includes("users.manage")) {
        const userPayload = await apiFetch<PaginatedResponse<UserRow>>("/api/admin/users?limit=100", { cache: "no-store" });
        setUsers(userPayload.items);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setError(getError(err, "Unable to load governance settings."));
    } finally {
      setLoading(false);
    }
  }, [inviteRoleId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const branchDrafts = users.reduce<Record<string, string[]>>((acc, user) => {
      acc[user.id] = user.branchAccess?.map((access) => access.branch.id).filter(Boolean) ?? [];
      return acc;
    }, {});
    const defaultBranchDrafts = users.reduce<Record<string, string>>((acc, user) => {
      acc[user.id] = user.branch?.id ?? "";
      return acc;
    }, {});
    setBranchSelectionDrafts(branchDrafts);
    setUserDefaultBranchDrafts(defaultBranchDrafts);
  }, [users]);

  useEffect(() => {
    const requested = resolveTab(new URLSearchParams(searchParamsString).get("tab"));
    setActiveTab((previous) => (previous === requested ? previous : requested));
  }, [searchParamsString]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(BILLING_PREFS_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<BillingPreferences>;
      setBillingPreferences((previous) => ({
        ...previous,
        ...parsed,
      }));
    } catch {
      // Ignore malformed local billing preferences and continue with defaults.
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    const payload = await apiFetch<PaginatedResponse<UserRow>>("/api/admin/users?limit=100", { cache: "no-store" });
    setUsers(payload.items);
  }, []);

  const refreshRoles = useCallback(async () => {
    const payload = await apiFetch<PaginatedResponse<RoleRow>>("/api/admin/roles?limit=100", { cache: "no-store" });
    setRoles(payload.items);
  }, []);

  const refreshBranches = useCallback(async () => {
    const payload = await apiFetch<BranchRow[]>("/api/admin/branches?includeArchived=1", { cache: "no-store" });
    setBranches(payload);
  }, []);

  const loadIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const payload = await apiFetch<IntegrationRow[]>("/api/admin/integrations/active", { cache: "no-store" });
      setIntegrations(payload);
    } catch (err) {
      setIntegrations([]);
      setError(getError(err, "Unable to load integrations."));
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  const loadBillingInsights = useCallback(async () => {
    setBillingInsightsLoading(true);
    try {
      const payload = await apiFetch<GivingSummary>("/api/admin/giving/summary", { cache: "no-store" });
      setGivingSummary(payload);
    } catch (err) {
      setGivingSummary({ tithes: 0, offerings: 0, special: 0 });
      setError(getError(err, "Unable to load billing insights."));
    } finally {
      setBillingInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "integrations") {
      void loadIntegrations();
    }
  }, [activeTab, loadIntegrations]);

  useEffect(() => {
    if (activeTab === "billing") {
      void loadBillingInsights();
    }
  }, [activeTab, loadBillingInsights]);

  const sendInviteEmailLink = useCallback(async (email: string) => {
    if (!auth) {
      throw new Error("Firebase Auth is not initialized.");
    }
    const baseOrigin = typeof window === "undefined" ? "" : window.location.origin;
    await sendSignInLinkToEmail(auth, email, {
      url: `${baseOrigin}/login?next=/admin`,
      handleCodeInApp: true,
    });
  }, []);

  const createBranch = async () => {
    if (!canManageBranches) {
      setError("You do not have permission to manage branches.");
      return;
    }
    if (!newBranchName.trim()) {
      setError("Branch name is required.");
      return;
    }
    setBusyKey("create-branch");
    setError("");
    setNotice("");
    try {
      await apiFetch("/api/admin/branches", {
        method: "POST",
        ...withJsonBody({
          name: newBranchName.trim(),
          location: newBranchLocation.trim() || undefined,
        }),
      });
      setNewBranchName("");
      setNewBranchLocation("");
      setNotice("Branch created.");
      await refreshBranches();
    } catch (err) {
      setError(getError(err, "Unable to create branch."));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleArchiveBranch = async (branch: BranchRow) => {
    if (!canManageBranches) {
      setError("You do not have permission to manage branches.");
      return;
    }
    setBusyKey(`branch-${branch.id}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/branches/${branch.id}/${branch.isActive ? "archive" : "unarchive"}`, {
        method: "POST",
      });
      setNotice(branch.isActive ? "Branch archived." : "Branch unarchived.");
      await refreshBranches();
      await refreshUsers();
    } catch (err) {
      setError(getError(err, "Unable to update branch status."));
    } finally {
      setBusyKey(null);
    }
  };

  const openBranchEditor = (branch: BranchRow) => {
    setEditingBranchId(branch.id);
    setEditingBranchName(branch.name);
    setEditingBranchLocation(branch.location ?? "");
  };

  const saveBranchEdit = async () => {
    if (!editingBranchId) return;
    if (!editingBranchName.trim()) {
      setError("Branch name is required.");
      return;
    }
    setBusyKey(`branch-edit-${editingBranchId}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/branches/${editingBranchId}`, {
        method: "PATCH",
        ...withJsonBody({
          name: editingBranchName.trim(),
          location: editingBranchLocation.trim() || undefined,
        }),
      });
      setNotice("Branch updated.");
      setEditingBranchId(null);
      await refreshBranches();
    } catch (err) {
      setError(getError(err, "Unable to update branch."));
    } finally {
      setBusyKey(null);
    }
  };

  const toggleBranchStats = async (branchId: string) => {
    if (expandedBranchStatsId === branchId) {
      setExpandedBranchStatsId(null);
      return;
    }
    setExpandedBranchStatsId(branchId);
    if (branchStats[branchId]) {
      return;
    }
    setBusyKey(`branch-stats-${branchId}`);
    try {
      const payload = await apiFetch<BranchStats>(`/api/admin/branches/${branchId}/stats`, { cache: "no-store" });
      setBranchStats((prev) => ({ ...prev, [branchId]: payload }));
    } catch (err) {
      setError(getError(err, "Unable to load branch stats."));
    } finally {
      setBusyKey(null);
    }
  };

  const inviteUser = async () => {
    if (!canManageUsers) {
      setError("You do not have permission to invite users.");
      return;
    }
    if (!inviteName.trim() || !inviteEmail.trim() || !inviteRoleId) {
      setError("Name, email, and role are required for invite.");
      return;
    }

    if (inviteScope === "RESTRICTED" && inviteBranchIds.length === 0) {
      setError("Restricted users must have at least one branch.");
      return;
    }

    setBusyKey("invite-user");
    setError("");
    setNotice("");
    try {
      const normalizedEmail = inviteEmail.trim().toLowerCase();
      await apiFetch("/api/admin/users/invite", {
        method: "POST",
        ...withJsonBody({
          name: inviteName.trim(),
          email: normalizedEmail,
          roleId: inviteRoleId,
          branchScopeMode: inviteScope,
          branchIds: inviteScope === "RESTRICTED" ? inviteBranchIds : [],
          defaultBranchId: inviteScope === "RESTRICTED" ? inviteBranchIds[0] : undefined,
        }),
      });
      let inviteNotice = "User invited successfully.";
      try {
        await sendInviteEmailLink(normalizedEmail);
        inviteNotice = "User invited and access link sent.";
      } catch (inviteErr) {
        const inviteCode = (inviteErr as { code?: string })?.code ?? "";
        if (inviteCode === "auth/operation-not-allowed") {
          inviteNotice = "User invited. Enable Email Link sign-in in Firebase to send invite links.";
        } else {
          inviteNotice = "User invited. Access link delivery failed; use resend after Firebase is configured.";
        }
      }
      setInviteName("");
      setInviteEmail("");
      setInviteScope("ALL");
      setInviteBranchIds([]);
      setNotice(inviteNotice);
      await refreshUsers();
    } catch (err) {
      setError(getError(err, "Unable to invite user."));
    } finally {
      setBusyKey(null);
    }
  };

  const suspendOrReactivateUser = async (user: UserRow) => {
    if (!canManageUsers) {
      setError("You do not have permission to manage users.");
      return;
    }
    setBusyKey(`user-status-${user.id}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/users/${user.id}/${user.status === "Suspended" ? "reactivate" : "suspend"}`, {
        method: "POST",
      });
      setNotice(user.status === "Suspended" ? "User reactivated." : "User suspended.");
      await refreshUsers();
    } catch (err) {
      setError(getError(err, "Unable to update user status."));
    } finally {
      setBusyKey(null);
    }
  };

  const resendInvite = async (user: UserRow) => {
    if (!canManageUsers) {
      setError("You do not have permission to resend invites.");
      return;
    }
    setBusyKey(`user-invite-${user.id}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/users/${user.id}/resend-invite`, { method: "POST" });
      let inviteNotice = "Invite status refreshed.";
      try {
        await sendInviteEmailLink(user.email);
        inviteNotice = "Invite resent with new access link.";
      } catch (inviteErr) {
        const inviteCode = (inviteErr as { code?: string })?.code ?? "";
        inviteNotice =
          inviteCode === "auth/operation-not-allowed"
            ? "Invite status refreshed. Enable Email Link sign-in in Firebase to send links."
            : "Invite status refreshed, but email-link delivery failed.";
      }
      setNotice(inviteNotice);
      await refreshUsers();
    } catch (err) {
      setError(getError(err, "Unable to resend invite."));
    } finally {
      setBusyKey(null);
    }
  };

  const updateUserRole = async (userId: string, roleId: string) => {
    if (!canManageUsers) {
      setError("You do not have permission to manage users.");
      return;
    }
    setBusyKey(`user-role-${userId}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        ...withJsonBody({ roleId }),
      });
      setNotice("User role updated.");
      await refreshUsers();
    } catch (err) {
      setError(getError(err, "Unable to update user role."));
    } finally {
      setBusyKey(null);
    }
  };

  const updateUserBranchScope = async (user: UserRow, branchScopeMode: "ALL" | "RESTRICTED") => {
    if (!canManageUsers) {
      setError("You do not have permission to manage users.");
      return;
    }
    const restrictedBranchIds = branchScopeMode === "RESTRICTED" ? branchSelectionDrafts[user.id] ?? [] : [];
    const normalizedRestrictedBranchIds =
      branchScopeMode === "RESTRICTED" && restrictedBranchIds.length === 0 && activeBranchOptions.length > 0
        ? [activeBranchOptions[0].id]
        : restrictedBranchIds;
    setBusyKey(`user-scope-${user.id}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/users/${user.id}/branches`, {
        method: "PATCH",
        ...withJsonBody({
          branchScopeMode,
          branchIds: normalizedRestrictedBranchIds,
        }),
      });
      setNotice("Branch scope updated.");
      await refreshUsers();
    } catch (err) {
      setError(getError(err, "Unable to update branch scope."));
    } finally {
      setBusyKey(null);
    }
  };

  const saveRestrictedBranches = async (user: UserRow) => {
    if (!canManageUsers) {
      setError("You do not have permission to manage users.");
      return;
    }
    const selectedBranchIds = branchSelectionDrafts[user.id] ?? [];
    if (selectedBranchIds.length === 0) {
      setError("Select at least one branch for restricted scope.");
      return;
    }
    setBusyKey(`user-branches-${user.id}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/users/${user.id}/branches`, {
        method: "PATCH",
        ...withJsonBody({
          branchScopeMode: "RESTRICTED",
          branchIds: selectedBranchIds,
        }),
      });
      setNotice("Restricted branch access updated.");
      await refreshUsers();
    } catch (err) {
      setError(getError(err, "Unable to update restricted branch access."));
    } finally {
      setBusyKey(null);
    }
  };

  const saveUserDefaultBranch = async (user: UserRow) => {
    if (!canManageUsers) {
      setError("You do not have permission to manage users.");
      return;
    }
    const defaultBranchId = userDefaultBranchDrafts[user.id] || null;
    const restrictedBranchIds = branchSelectionDrafts[user.id] ?? [];
    if (user.branchScopeMode === "RESTRICTED" && restrictedBranchIds.length === 0) {
      setError("Select at least one branch before setting a default branch.");
      return;
    }

    setBusyKey(`user-default-${user.id}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        ...withJsonBody({
          defaultBranchId,
          branchScopeMode: user.branchScopeMode,
          branchIds: user.branchScopeMode === "RESTRICTED" ? restrictedBranchIds : undefined,
        }),
      });
      setNotice("Default branch updated.");
      await refreshUsers();
    } catch (err) {
      setError(getError(err, "Unable to update default branch."));
    } finally {
      setBusyKey(null);
    }
  };

  const createRole = async () => {
    if (!canManageRoles) {
      setError("You do not have permission to manage roles.");
      return;
    }
    if (!newRoleName.trim()) {
      setError("Role name is required.");
      return;
    }
    if (newRolePermissions.length === 0) {
      setError("Select at least one permission.");
      return;
    }

    setBusyKey("create-role");
    setError("");
    setNotice("");
    try {
      await apiFetch("/api/admin/roles", {
        method: "POST",
        ...withJsonBody({
          name: newRoleName.trim(),
          permissions: newRolePermissions,
        }),
      });
      setNewRoleName("");
      setNewRolePermissions([]);
      setNotice("Role created.");
      await refreshRoles();
    } catch (err) {
      setError(getError(err, "Unable to create role."));
    } finally {
      setBusyKey(null);
    }
  };

  const deleteRole = async (role: RoleRow) => {
    if (!canManageRoles) {
      setError("You do not have permission to manage roles.");
      return;
    }
    const query = new URLSearchParams();
    if (role._count.users > 0) {
      const fallback = roles.find((candidate) => candidate.id !== role.id);
      if (!fallback) {
        setError("Reassignment role required before delete.");
        return;
      }
      query.set("reassignRoleId", fallback.id);
    }

    setBusyKey(`delete-role-${role.id}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/roles/${role.id}${query.toString() ? `?${query.toString()}` : ""}`, {
        method: "DELETE",
      });
      setNotice("Role deleted.");
      await Promise.all([refreshRoles(), refreshUsers()]);
    } catch (err) {
      setError(getError(err, "Unable to delete role."));
    } finally {
      setBusyKey(null);
    }
  };

  const startRoleEdit = (role: RoleRow) => {
    setEditingRoleId(role.id);
    setEditingRoleName(role.name);
    setEditingRolePermissions(role.permissions);
  };

  const saveRoleEdit = async () => {
    if (!editingRoleId) return;
    if (!editingRoleName.trim()) {
      setError("Role name is required.");
      return;
    }
    if (editingRolePermissions.length === 0) {
      setError("Select at least one permission for the role.");
      return;
    }
    setBusyKey(`edit-role-${editingRoleId}`);
    setError("");
    setNotice("");
    try {
      await apiFetch(`/api/admin/roles/${editingRoleId}`, {
        method: "PATCH",
        ...withJsonBody({
          name: editingRoleName.trim(),
          permissions: editingRolePermissions,
        }),
      });
      setNotice("Role updated.");
      setEditingRoleId(null);
      setEditingRoleName("");
      setEditingRolePermissions([]);
      await Promise.all([refreshRoles(), refreshUsers()]);
    } catch (err) {
      setError(getError(err, "Unable to update role."));
    } finally {
      setBusyKey(null);
    }
  };

  const openTab = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab);
      const nextParams = new URLSearchParams(searchParamsString);
      if (tab === "branches") {
        nextParams.delete("tab");
      } else {
        nextParams.set("tab", tab);
      }
      const query = nextParams.toString();
      router.replace(query ? `/admin/settings?${query}` : "/admin/settings", { scroll: false });
    },
    [router, searchParamsString],
  );

  const saveBillingPreferences = () => {
    setError("");
    setNotice("");
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(BILLING_PREFS_STORAGE_KEY, JSON.stringify(billingPreferences));
      }
      setNotice("Billing preferences saved.");
    } catch {
      setError("Unable to save billing preferences in this browser.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900">Governance Settings</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Manage branches, staff access, and role permissions with server-side tenant enforcement.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => openTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-black uppercase tracking-wider transition ${
                activeTab === tab.key
                  ? "bg-indigo-600 !text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {(loading || error || notice) && (
        <section className="space-y-3">
          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
              Loading governance data...
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              {notice}
            </div>
          )}
        </section>
      )}

      {activeTab === "branches" && (
        <section className="space-y-4">
          {!canManageBranches && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              You can view branch records, but branch management actions require <code>branches.manage</code>.
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Add Branch</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input
                value={newBranchName}
                onChange={(event) => setNewBranchName(event.target.value)}
                placeholder="Branch name"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={newBranchLocation}
                onChange={(event) => setNewBranchLocation(event.target.value)}
                placeholder="Location (optional)"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => void createBranch()}
                disabled={!canManageBranches || busyKey === "create-branch"}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {busyKey === "create-branch" ? "Saving..." : "Create"}
              </button>
            </div>
          </div>

          {editingBranchId && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Edit Branch</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <input
                  value={editingBranchName}
                  onChange={(event) => setEditingBranchName(event.target.value)}
                  placeholder="Branch name"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <input
                  value={editingBranchLocation}
                  onChange={(event) => setEditingBranchLocation(event.target.value)}
                  placeholder="Location"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => void saveBranchEdit()}
                  disabled={!canManageBranches || busyKey === `branch-edit-${editingBranchId}`}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500 disabled:opacity-50"
                >
                  {busyKey === `branch-edit-${editingBranchId}` ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBranchId(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((branch) => (
                  <Fragment key={branch.id}>
                    <tr>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{branch.name}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-600">{branch.location || "Not set"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${branch.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {branch.isActive ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleBranchStats(branch.id)}
                            disabled={busyKey === `branch-stats-${branch.id}`}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                          >
                            {busyKey === `branch-stats-${branch.id}` ? "Loading..." : expandedBranchStatsId === branch.id ? "Hide Stats" : "Stats"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openBranchEditor(branch)}
                            disabled={!canManageBranches}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleArchiveBranch(branch)}
                            disabled={!canManageBranches || busyKey === `branch-${branch.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                          >
                            {busyKey === `branch-${branch.id}` ? "Working..." : branch.isActive ? "Archive" : "Unarchive"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedBranchStatsId === branch.id && (
                      <tr>
                        <td colSpan={4} className="bg-slate-50 px-4 py-3">
                          <div className="grid gap-2 sm:grid-cols-4">
                            <StatsChip label="Members" value={branchStats[branch.id]?.members ?? 0} />
                            <StatsChip label="Services" value={branchStats[branch.id]?.services ?? 0} />
                            <StatsChip label="Attendance" value={branchStats[branch.id]?.attendances ?? 0} />
                            <StatsChip label="Users" value={branchStats[branch.id]?.users ?? 0} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "users" && (
        <section className="space-y-4">
          {!canManageUsers && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              You can view users, but invite and access actions require <code>users.manage</code>.
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Invite Staff</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
                placeholder="Full name"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Email"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <select
                value={inviteRoleId}
                onChange={(event) => setInviteRoleId(event.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <select
                value={inviteScope}
                onChange={(event) => setInviteScope(event.target.value as "ALL" | "RESTRICTED")}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="ALL">All branches</option>
                <option value="RESTRICTED">Restricted branches</option>
              </select>
            </div>
            {inviteScope === "RESTRICTED" && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {activeBranchOptions.map((branch) => {
                  const selected = inviteBranchIds.includes(branch.id);
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() =>
                        setInviteBranchIds((prev) =>
                          selected ? prev.filter((branchId) => branchId !== branch.id) : [...prev, branch.id],
                        )
                      }
                      className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                        selected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {branch.name}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => void inviteUser()}
              disabled={!canManageUsers || busyKey === "invite-user"}
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {busyKey === "invite-user" ? "Inviting..." : "Send Invite"}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Branch Scope</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-black text-slate-900">{user.name}</p>
                      <p className="text-xs font-medium text-slate-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role?.id ?? ""}
                        onChange={(event) => void updateUserRole(user.id, event.target.value)}
                        disabled={!canManageUsers}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.branchScopeMode}
                        onChange={(event) => void updateUserBranchScope(user, event.target.value as "ALL" | "RESTRICTED")}
                        disabled={!canManageUsers}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="ALL">All branches</option>
                        <option value="RESTRICTED">Restricted</option>
                      </select>
                      {user.branchScopeMode === "RESTRICTED" && (
                        <div className="mt-2 space-y-2">
                          <select
                            multiple
                            value={branchSelectionDrafts[user.id] ?? []}
                            onChange={(event) => {
                              const selectedValues = Array.from(event.target.selectedOptions).map((option) => option.value);
                              setBranchSelectionDrafts((prev) => ({
                                ...prev,
                                [user.id]: selectedValues,
                              }));
                            }}
                            className="min-w-[180px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            disabled={!canManageUsers}
                          >
                            {activeBranchOptions.map((branch) => (
                              <option key={branch.id} value={branch.id}>
                                {branch.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void saveRestrictedBranches(user)}
                            disabled={!canManageUsers || busyKey === `user-branches-${user.id}`}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                          >
                            Save Branches
                          </button>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <select
                          value={userDefaultBranchDrafts[user.id] ?? ""}
                          onChange={(event) =>
                            setUserDefaultBranchDrafts((prev) => ({
                              ...prev,
                              [user.id]: event.target.value,
                            }))
                          }
                          disabled={!canManageUsers}
                          className="min-w-[180px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        >
                          <option value="">No default branch</option>
                          {(user.branchScopeMode === "ALL"
                            ? activeBranchOptions
                            : activeBranchOptions.filter((branch) =>
                                (branchSelectionDrafts[user.id] ?? []).includes(branch.id),
                              )
                          ).map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void saveUserDefaultBranch(user)}
                          disabled={!canManageUsers || busyKey === `user-default-${user.id}`}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                        >
                          {busyKey === `user-default-${user.id}` ? "Saving..." : "Save Default"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${
                        user.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : user.status === "Invited"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-rose-100 text-rose-700"
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {user.status === "Invited" && (
                          <button
                            type="button"
                            onClick={() => void resendInvite(user)}
                            disabled={!canManageUsers || busyKey === `user-invite-${user.id}`}
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
                          >
                            Resend
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void suspendOrReactivateUser(user)}
                          disabled={!canManageUsers || busyKey === `user-status-${user.id}`}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                            user.status === "Suspended"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          }`}
                        >
                          {user.status === "Suspended" ? "Reactivate" : "Suspend"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "roles" && (
        <section className="space-y-4">
          {!canManageRoles && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              You can view roles, but role changes require <code>roles.manage</code>.
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Create Custom Role</h3>
            <div className="mt-3 space-y-3">
              <input
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder="Role name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {permissionsCatalog.map((permission) => {
                  const selected = newRolePermissions.includes(permission);
                  return (
                    <button
                      key={permission}
                      type="button"
                      onClick={() =>
                        setNewRolePermissions((prev) =>
                          selected ? prev.filter((entry) => entry !== permission) : [...prev, permission],
                        )
                      }
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                        selected
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {permission}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => void createRole()}
                disabled={!canManageRoles || busyKey === "create-role"}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {busyKey === "create-role" ? "Saving..." : "Create Role"}
              </button>
            </div>
          </div>

          {editingRoleId && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-black text-slate-900">Edit Custom Role</h3>
              <div className="mt-3 space-y-3">
                <input
                  value={editingRoleName}
                  onChange={(event) => setEditingRoleName(event.target.value)}
                  placeholder="Role name"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {permissionsCatalog.map((permission) => {
                    const selected = editingRolePermissions.includes(permission);
                    return (
                      <button
                        key={permission}
                        type="button"
                        onClick={() =>
                          setEditingRolePermissions((prev) =>
                            selected ? prev.filter((entry) => entry !== permission) : [...prev, permission],
                          )
                        }
                        className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {permission}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void saveRoleEdit()}
                    disabled={!canManageRoles || busyKey === `edit-role-${editingRoleId}`}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {busyKey === `edit-role-${editingRoleId}` ? "Saving..." : "Save Role"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRoleId(null);
                      setEditingRoleName("");
                      setEditingRolePermissions([]);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Permissions</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Users</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td className="px-4 py-3 text-sm font-black text-slate-900">{role.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${role.isSystem ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-700"}`}>
                        {role.isSystem ? "System" : "Custom"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">{role.permissions.length}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-800">{role._count.users}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={!canManageRoles || role.isSystem}
                          onClick={() => startRoleEdit(role)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={!canManageRoles || role.isSystem || busyKey === `delete-role-${role.id}`}
                          onClick={() => void deleteRole(role)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "integrations" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">Integration Policy</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Validate provider health, sync readiness, and downstream export actions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadIntegrations()}
                disabled={integrationsLoading}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {integrationsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <StatsChip label="Providers" value={integrationsLoading ? 0 : integrations.length} />
              <StatsChip label="Connected" value={integrationsLoading ? 0 : connectedIntegrations} />
              <StatsChip
                label="Needs Attention"
                value={integrationsLoading ? 0 : Math.max(integrations.length - connectedIntegrations, 0)}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => router.push("/admin/integrations")}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500"
              >
                Open Integrations
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/communication")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              >
                Communication Providers
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/website")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              >
                Website Integrations
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {integrationsLoading ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-sm font-semibold text-slate-500">
                      Loading integration status...
                    </td>
                  </tr>
                ) : integrations.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-sm font-semibold text-slate-500">
                      No providers are configured for this workspace yet.
                    </td>
                  </tr>
                ) : (
                  integrations.map((integration) => (
                    <tr key={integration.id}>
                      <td className="px-4 py-3 text-sm font-black text-slate-900">{integration.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${integrationStatusTone(integration.status)}`}>
                          {integration.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "billing" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">Billing Policy & Exports</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Configure finance reporting defaults and monitor giving totals before statement runs.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tithes (MTD)</p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {billingInsightsLoading ? "--" : formatCurrency(givingSummary.tithes)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Offerings (MTD)</p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {billingInsightsLoading ? "--" : formatCurrency(givingSummary.offerings)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Special (MTD)</p>
                <p className="mt-1 text-xl font-black text-slate-900">
                  {billingInsightsLoading ? "--" : formatCurrency(givingSummary.special)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total (MTD)</p>
                <p className="mt-1 text-xl font-black text-slate-900">{billingInsightsLoading ? "--" : formatCurrency(givingTotal)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-900">Default Billing Preferences</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Invoice due days</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={billingPreferences.invoiceDueDays}
                  onChange={(event) =>
                    setBillingPreferences((previous) => ({
                      ...previous,
                      invoiceDueDays: Number.parseInt(event.target.value || "1", 10),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Reminder lead days</span>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={billingPreferences.reminderLeadDays}
                  onChange={(event) =>
                    setBillingPreferences((previous) => ({
                      ...previous,
                      reminderLeadDays: Number.parseInt(event.target.value || "1", 10),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Statement frequency</span>
                <select
                  value={billingPreferences.statementFrequency}
                  onChange={(event) =>
                    setBillingPreferences((previous) => ({
                      ...previous,
                      statementFrequency: event.target.value as BillingPreferences["statementFrequency"],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Default export format</span>
                <select
                  value={billingPreferences.defaultExportFormat}
                  onChange={(event) =>
                    setBillingPreferences((previous) => ({
                      ...previous,
                      defaultExportFormat: event.target.value as BillingPreferences["defaultExportFormat"],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={billingPreferences.autoReceiptEmail}
                onChange={(event) =>
                  setBillingPreferences((previous) => ({
                    ...previous,
                    autoReceiptEmail: event.target.checked,
                  }))
                }
              />
              Send auto receipt email when giving transactions are recorded.
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveBillingPreferences}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black uppercase tracking-wider !text-white transition hover:bg-indigo-500"
              >
                Save Preferences
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/giving")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              >
                Open Giving Ledger
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/reports")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-100"
              >
                Open Reports
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function integrationStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("connected") || normalized.includes("healthy")) return "bg-emerald-100 text-emerald-700";
  if (normalized.includes("degraded") || normalized.includes("warning") || normalized.includes("pending")) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-200 text-slate-700";
}

function StatsChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-base font-black text-slate-900">{value}</p>
    </div>
  );
}
