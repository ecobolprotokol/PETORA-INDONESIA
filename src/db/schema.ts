import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const systemState = pgTable("system_state", {
  id: smallint("id").primaryKey(),
  businessName: text("business_name"),
  ownerCreatedAt: timestamp("owner_created_at", { withTimezone: true, mode: "date" }),
});

export const businessSettings = pgTable("business_settings", {
  id: smallint("id").primaryKey(),
  defaultTimezone: text("default_timezone").notNull(),
  locale: text("locale").notNull().$type<"id-ID" | "en-US">(),
  taxEnabled: boolean("tax_enabled").notNull(),
  taxRateBps: integer("tax_rate_bps").notNull(),
  taxIncluded: boolean("tax_included").notNull(),
  primaryColor: text("primary_color").notNull(),
  theme: text("theme").notNull().$type<"light" | "dark" | "system">(),
  updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const systemModuleFeatures = pgTable("system_module_features", {
  featureKey: text("feature_key").$type<"commissions" | "loyalty" | "inpatient">().primaryKey(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const documentNumberSequences = pgTable(
  "document_number_sequences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentType: text("document_type").$type<"invoice" | "purchase_order" | "receipt">().notNull(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
    prefix: text("prefix").notNull(),
    nextNumber: bigint("next_number", { mode: "number" }).notNull(),
    minimumWidth: smallint("minimum_width").notNull().default(5),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("document_number_sequences_global_unique")
      .on(table.documentType)
      .where(sql`${table.branchId} IS NULL`),
    uniqueIndex("document_number_sequences_branch_unique")
      .on(table.documentType, table.branchId)
      .where(sql`${table.branchId} IS NOT NULL`),
  ],
);

export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    isOwner: boolean("is_owner").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    totpSecretCiphertext: text("totp_secret_ciphertext"),
    totpPendingSecretCiphertext: text("totp_pending_secret_ciphertext"),
    totpPendingExpiresAt: timestamp("totp_pending_expires_at", {
      withTimezone: true,
      mode: "date",
    }),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true, mode: "date" }),
    totpLastUsedStep: bigint("totp_last_used_step", { mode: "number" }).notNull().default(-1),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_users_email_lower_unique").on(sql`lower(${table.email})`),
    uniqueIndex("staff_users_single_owner_unique").on(table.isOwner).where(sql`${table.isOwner}`),
  ],
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("branches_code_lower_unique").on(sql`lower(${table.code})`),
    index("branches_active_name_idx").on(table.name).where(sql`${table.isActive}`),
  ],
);

export const accessPermissions = pgTable("access_permissions", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
  branchScoped: boolean("branch_scoped").notNull(),
  supportsOwnScope: boolean("supports_own_scope").notNull().default(false),
  highRisk: boolean("high_risk").notNull().default(false),
});

export const accessRoles = pgTable(
  "access_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    requiresTwoFactor: boolean("requires_two_factor").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("access_roles_name_lower_unique").on(sql`lower(${table.name})`)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => accessRoles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => accessPermissions.key, { onDelete: "restrict" }),
    dataScope: text("data_scope").$type<"all" | "own">().notNull().default("all"),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionKey] }),
    index("role_permissions_permission_idx").on(table.permissionKey, table.roleId),
  ],
);

export const staffPermissionOverrides = pgTable(
  "staff_permission_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => accessPermissions.key, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
    effect: text("effect").$type<"allow" | "deny">().notNull(),
    dataScope: text("data_scope").$type<"all" | "own">().notNull().default("all"),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_permission_overrides_global_unique")
      .on(table.staffUserId, table.permissionKey)
      .where(sql`${table.branchId} IS NULL`),
    uniqueIndex("staff_permission_overrides_branch_unique")
      .on(table.staffUserId, table.permissionKey, table.branchId)
      .where(sql`${table.branchId} IS NOT NULL`),
    index("staff_permission_overrides_staff_permission_idx").on(
      table.staffUserId,
      table.permissionKey,
    ),
  ],
);

export const staffRoleAssignments = pgTable(
  "staff_role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    staffUserId: uuid("staff_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => accessRoles.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_role_assignment_global_unique")
      .on(table.staffUserId, table.roleId)
      .where(sql`${table.branchId} IS NULL`),
    uniqueIndex("staff_role_assignment_branch_unique")
      .on(table.staffUserId, table.roleId, table.branchId)
      .where(sql`${table.branchId} IS NOT NULL`),
    index("staff_role_assignment_staff_idx").on(table.staffUserId, table.branchId),
  ],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    tokenHash: char("token_hash", { length: 64 }).notNull().unique(),
    userAgent: text("user_agent").notNull().default("Peramban web"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("auth_sessions_user_active_idx")
      .on(table.userId, table.expiresAt)
      .where(sql`${table.revokedAt} IS NULL`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => staffUsers.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_created_at_idx").on(table.createdAt),
    index("audit_events_actor_action_idx").on(table.actorUserId, table.action),
  ],
);

export const authLoginAttempts = pgTable(
  "auth_login_attempts",
  {
    emailHash: char("email_hash", { length: 64 }).primaryKey(),
    attemptCount: integer("attempt_count").notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("auth_login_attempts_window_idx").on(table.windowStartedAt)],
);

export const authLoginChallenges = pgTable(
  "auth_login_challenges",
  {
    tokenHash: char("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    attemptCount: integer("attempt_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("auth_login_challenges_expiry_idx").on(table.expiresAt)],
);

export const authTotpRecoveryCodes = pgTable(
  "auth_totp_recovery_codes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    codeHash: char("code_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.codeHash] })],
);
