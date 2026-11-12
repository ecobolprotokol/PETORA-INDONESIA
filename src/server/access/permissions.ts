export const PERMISSION_KEYS = [
  "access.manage",
  "audit.read",
  "branches.read",
  "branches.manage",
  "customers.read",
  "customers.manage",
  "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSIONS: Record<
  PermissionKey,
  { branchScoped: boolean; supportsOwnScope: boolean; highRisk: boolean }
> = {
  "access.manage": { branchScoped: false, supportsOwnScope: false, highRisk: true },
  "audit.read": { branchScoped: false, supportsOwnScope: false, highRisk: true },
  "branches.read": { branchScoped: true, supportsOwnScope: true, highRisk: false },
  "branches.manage": { branchScoped: false, supportsOwnScope: false, highRisk: true },
  "customers.read": { branchScoped: false, supportsOwnScope: true, highRisk: true },
  "customers.manage": { branchScoped: false, supportsOwnScope: true, highRisk: true },
  "settings.manage": { branchScoped: false, supportsOwnScope: false, highRisk: true },
};

export type PermissionDataScope = "all" | "own";
