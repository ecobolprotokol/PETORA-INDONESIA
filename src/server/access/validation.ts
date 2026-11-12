import { z } from "zod";
import { PERMISSION_KEYS, PERMISSIONS } from "./permissions";

const financialCapSchema = z
  .union([z.number().int().min(0).max(10_000), z.null()])
  .optional()
  .nullable();

const financialCentsSchema = z
  .union([z.number().int().min(0).max(999_999_999_999), z.null()])
  .optional()
  .nullable();

const rolePermissionSchema = z
  .object({
    key: z.enum(PERMISSION_KEYS),
    dataScope: z.enum(["all", "own"]).default("all"),
    maxDiscountBps: financialCapSchema,
    maxRefundCents: financialCentsSchema,
    maxVoidCents: financialCentsSchema,
    maxTransferCents: financialCentsSchema,
    requiresSupervisorPin: z.boolean().optional(),
  })
  .refine(({ key, dataScope }) => dataScope === "all" || PERMISSIONS[key].supportsOwnScope, {
    path: ["dataScope"],
    message: "Izin ini tidak mendukung cakupan milik sendiri.",
  });

const roleFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
  requiresTwoFactor: z.boolean().default(false),
  permissions: z.array(rolePermissionSchema).max(PERMISSION_KEYS.length).default([]),
};

function refineRole<
  T extends z.ZodObject<{
    name: typeof roleFields.name;
    permissions: typeof roleFields.permissions;
  }>,
>(schema: T) {
  return schema
    .refine((value) => value.name.toLowerCase() !== "owner", {
      path: ["name"],
      message: "Owner adalah akun khusus dan bukan peran yang dapat dibuat.",
    })
    .refine(
      ({ permissions }) => new Set(permissions.map(({ key }) => key)).size === permissions.length,
      {
        path: ["permissions"],
        message: "Izin yang sama tidak boleh ditambahkan lebih dari sekali.",
      },
    );
}

export const createRoleSchema = refineRole(z.object(roleFields));

export const updateRoleSchema = refineRole(
  z.object({ ...roleFields, isActive: z.boolean().default(true) }),
);

export const assignRoleSchema = z.object({
  staffUserId: z.string().uuid(),
  roleId: z.string().uuid(),
  branchId: z.string().uuid().nullable().default(null),
});

export const permissionOverrideSchema = z
  .object({
    staffUserId: z.string().uuid(),
    permissionKey: z.enum(PERMISSION_KEYS),
    branchId: z.string().uuid().nullable().default(null),
    effect: z.enum(["allow", "deny"]),
    dataScope: z.enum(["all", "own"]).default("all"),
    reason: z.string().trim().min(5).max(500),
    maxDiscountBps: financialCapSchema,
    maxRefundCents: financialCentsSchema,
    maxVoidCents: financialCentsSchema,
    maxTransferCents: financialCentsSchema,
    requiresSupervisorPin: z.boolean().optional(),
  })
  .refine(
    ({ permissionKey, branchId }) =>
      PERMISSIONS[permissionKey].branchScoped ? branchId !== null : branchId === null,
    {
      path: ["branchId"],
      message: "Pilih cabang untuk izin yang dibatasi per cabang.",
    },
  )
  .refine(
    ({ permissionKey, effect, dataScope }) =>
      effect === "deny"
        ? dataScope === "all"
        : dataScope === "all" || PERMISSIONS[permissionKey].supportsOwnScope,
    {
      path: ["dataScope"],
      message: "Cakupan data ini tidak didukung untuk pengecualian izin.",
    },
  );

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type PermissionOverrideInput = z.infer<typeof permissionOverrideSchema>;
