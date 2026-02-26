import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AdminSessionContext } from './auth.types';

export type BranchScopeResult = {
  branchId?: string;
  allowedBranchIds?: string[];
};

function normalizeBranchId(value?: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export function resolveReadBranchScope(session: AdminSessionContext, requestedBranchId?: string): BranchScopeResult {
  const branchId = normalizeBranchId(requestedBranchId);
  if (session.branchScopeMode !== 'RESTRICTED') {
    return { branchId };
  }

  const allowed = session.allowedBranchIds;
  if (allowed.length === 0) {
    throw new ForbiddenException('No branch access assigned for this account.');
  }

  if (branchId) {
    if (!allowed.includes(branchId)) {
      throw new ForbiddenException('Branch is outside your allowed scope.');
    }
    return { branchId };
  }

  if (allowed.length === 1) {
    return { branchId: allowed[0] };
  }

  return { allowedBranchIds: allowed };
}

export function resolveWriteBranchScope(session: AdminSessionContext, requestedBranchId?: string) {
  const branchId = normalizeBranchId(requestedBranchId);
  if (session.branchScopeMode !== 'RESTRICTED') {
    return { branchId };
  }

  if (!branchId) {
    throw new BadRequestException('Branch is required for this account because your access is branch-restricted.');
  }

  if (!session.allowedBranchIds.includes(branchId)) {
    throw new ForbiddenException('Branch is outside your allowed scope.');
  }

  return { branchId };
}
