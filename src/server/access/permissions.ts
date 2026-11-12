export const PERMISSION_KEYS = [
  "access.manage",
  "audit.read",
  "branches.read",
  "branches.manage",
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
  "settings.manage": { branchScoped: false, supportsOwnScope: false, highRisk: true },
};

export type PermissionDataScope = "all" | "own";
