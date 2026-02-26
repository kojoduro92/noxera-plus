export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
};

export type AuditLogRow = {
  id: string;
  action: string;
  resource: string;
  details?: unknown;
  ipAddress?: string | null;
  createdAt: string;
  tenant?: {
    id: string;
    name: string;
    domain?: string | null;
    status?: string | null;
  } | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

export type PlanSummary = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
};

export type BillingTenantRow = {
  id: string;
  name: string;
  domain?: string | null;
  status: string;
  createdAt: string;
  planId?: string | null;
  plan?: {
    id: string;
    name: string;
    price: number;
  } | null;
};

export type SupportTicketRow = {
  id: string;
  tenantId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    name: string;
    domain?: string | null;
    status?: string | null;
  } | null;
};
