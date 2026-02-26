import { Request } from 'express';

export type AdminSessionContext = {
  uid: string;
  email: string | null;
  isSuperAdmin: boolean;
  userId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: string[];
  defaultBranchId: string | null;
  userStatus: string | null;
  branchScopeMode: 'ALL' | 'RESTRICTED';
  allowedBranchIds: string[];
  signInProvider: string | null;
};

export type ImpersonationSessionInfo = {
  superAdminEmail: string;
  tenantId: string;
  startedAt: string;
  expiresAt: string;
};

export type RequestWithAuth = Request & {
  authContext?: AdminSessionContext;
  superAdmin?: {
    uid: string;
    email: string | null;
  };
  impersonation?: ImpersonationSessionInfo;
};
