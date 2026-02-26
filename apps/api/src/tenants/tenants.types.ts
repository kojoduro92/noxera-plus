export type TenantSizeRange =
  | '1-50'
  | '51-150'
  | '151-300'
  | '301-700'
  | '701-1500'
  | '1500+';

export type CreateTenantPayload = {
  churchName: string;
  domain: string;
  plan?: string;
  adminEmail: string;
  branchName?: string;
  ownerName: string;
  ownerPhone?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  denomination?: string;
  sizeRange?: TenantSizeRange;
};
