import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
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
  inventoryCostMethod: text("inventory_cost_method")
    .$type<"average" | "fifo">()
    .notNull()
    .default("fifo"),
  quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(false),
  quietHoursStart: text("quiet_hours_start").notNull().default("22:00"),
  quietHoursEnd: text("quiet_hours_end").notNull().default("08:00"),
  primaryColor: text("primary_color").notNull(),
  theme: text("theme").notNull().$type<"light" | "dark" | "system">(),
  logoUrl: text("logo_url"),
  invoiceTemplate: text("invoice_template"),
  receiptTemplate: text("receipt_template"),
  certificateTemplate: text("certificate_template"),
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
    documentType: text("document_type")
      .$type<
        | "invoice"
        | "purchase_request"
        | "purchase_order"
        | "inventory_transfer"
        | "goods_receipt"
        | "supplier_return"
        | "receipt"
        | "refund"
      >()
      .notNull(),
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
    supervisorPinHash: text("supervisor_pin_hash"),
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

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    isSample: boolean("is_sample").notNull().default(false),
    phoneNormalized: text("phone_normalized").notNull(),
    address: text("address"),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    notificationPreferences: jsonb("notification_preferences")
      .$type<{ appointments: boolean; marketing: boolean }>()
      .notNull()
      .default(sql`'{"appointments": true, "marketing": false}'::jsonb`),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("customers_created_by_created_at_idx").on(table.createdBy, sql`${table.createdAt} DESC`),
    index("customers_name_search_idx").on(sql`lower(${table.name})`),
  ],
);

export const pets = pgTable(
  "pets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    species: text("species")
      .$type<"dog" | "cat" | "bird" | "small_mammal" | "reptile" | "other">()
      .notNull(),
    breed: text("breed"),
    sex: text("sex").$type<"male" | "female" | "unknown">().notNull().default("unknown"),
    birthDate: date("birth_date", { mode: "string" }),
    estimatedAgeMonths: integer("estimated_age_months"),
    color: text("color"),
    microchipNumber: text("microchip_number"),
    photoUrl: text("photo_url"),
    isSterilized: boolean("is_sterilized").notNull().default(false),
    allergies: text("allergies").array().notNull().default(sql`ARRAY[]::text[]`),
    behaviorNotes: text("behavior_notes"),
    status: text("status")
      .$type<"active" | "deceased" | "transferred">()
      .notNull()
      .default("active"),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pets_name_search_idx").on(sql`lower(${table.name})`),
    uniqueIndex("pets_microchip_lower_unique")
      .on(sql`lower(${table.microchipNumber})`)
      .where(sql`${table.microchipNumber} IS NOT NULL`),
  ],
);

export const petOwners = pgTable(
  "pet_owners",
  {
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    relationship: text("relationship").notNull().default("owner"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.petId, table.customerId] }),
    index("pet_owners_customer_idx").on(table.customerId, table.petId),
    uniqueIndex("pet_owners_single_primary_idx").on(table.petId).where(sql`${table.isPrimary}`),
  ],
);

export const petWeightHistory = pgTable(
  "pet_weight_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    weightKg: numeric("weight_kg", { precision: 8, scale: 3 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    note: text("note"),
    recordedBy: uuid("recorded_by").references(() => staffUsers.id, { onDelete: "set null" }),
  },
  (table) => [
    index("pet_weight_history_pet_date_idx").on(table.petId, sql`${table.recordedAt} DESC`),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => productCategories.id, {
      onDelete: "restrict",
    }),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("product_categories_name_lower_unique").on(sql`lower(${table.name})`)],
);

export const units = pgTable(
  "units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    abbreviation: text("abbreviation").notNull(),
    dimension: text("dimension").$type<"count" | "mass" | "volume" | "length">().notNull(),
    baseUnitId: uuid("base_unit_id").references((): AnyPgColumn => units.id, {
      onDelete: "restrict",
    }),
    toBaseFactor: numeric("to_base_factor", { precision: 14, scale: 6 }).notNull().default("1"),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("units_abbreviation_lower_unique").on(sql`lower(${table.abbreviation})`)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    productType: text("product_type")
      .$type<"general" | "medicine" | "feed" | "accessory">()
      .notNull(),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "restrict",
    }),
    brand: text("brand"),
    photoUrl: text("photo_url"),
    description: text("description"),
    baseUnitId: uuid("base_unit_id").references(() => units.id, { onDelete: "restrict" }),
    medicineClass: text("medicine_class"),
    prescriptionRequired: boolean("prescription_required").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("products_sku_lower_unique").on(sql`lower(${table.sku})`),
    index("products_name_search_idx").on(sql`lower(${table.name})`),
    index("products_category_idx").on(table.categoryId, sql`lower(${table.name})`),
  ],
);

export const productUnitConversions = pgTable(
  "product_unit_conversions",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "restrict" }),
    conversionFactor: numeric("conversion_factor", { precision: 14, scale: 6 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.productId, table.unitId] })],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_variants_sku_lower_unique").on(sql`lower(${table.sku})`),
    uniqueIndex("product_variants_product_name_lower_unique").on(
      table.productId,
      sql`lower(${table.name})`,
    ),
  ],
);

export const productBarcodes = pgTable(
  "product_barcodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    barcode: text("barcode").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("product_barcodes_lower_unique").on(sql`lower(${table.barcode})`),
    index("product_barcodes_product_idx").on(table.productId),
  ],
);

export const priceTiers = pgTable(
  "price_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("price_tiers_name_lower_unique").on(sql`lower(${table.name})`)],
);

export const productPrices = pgTable(
  "product_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    priceTierId: uuid("price_tier_id").references(() => priceTiers.id, { onDelete: "restrict" }),
    purchasePriceCents: bigint("purchase_price_cents", { mode: "number" }).$type<number | null>(),
    sellingPriceCents: bigint("selling_price_cents", { mode: "number" }).notNull(),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("product_prices_scope_unique")
      .on(table.productId, table.variantId, table.branchId, table.priceTierId)
      .nullsNotDistinct(),
    index("product_prices_branch_tier_idx").on(table.branchId, table.priceTierId),
  ],
);

export const serviceCategories = pgTable(
  "service_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("service_categories_name_lower_unique").on(sql`lower(${table.name})`)],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    categoryId: uuid("category_id").references(() => serviceCategories.id, {
      onDelete: "restrict",
    }),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("services_code_lower_unique").on(sql`lower(${table.code})`),
    index("services_name_search_idx").on(sql`lower(${table.name})`),
  ],
);

export const servicePrices = pgTable(
  "service_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    priceTierId: uuid("price_tier_id").references(() => priceTiers.id, { onDelete: "restrict" }),
    priceCents: bigint("price_cents", { mode: "number" }).notNull(),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("service_prices_scope_unique")
      .on(table.serviceId, table.branchId, table.priceTierId)
      .nullsNotDistinct(),
    index("service_prices_branch_tier_idx").on(table.branchId, table.priceTierId),
  ],
);

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("warehouses_branch_code_lower_unique").on(
      table.branchId,
      sql`lower(${table.code})`,
    ),
    index("warehouses_branch_active_idx").on(table.branchId, table.isActive),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("suppliers_name_lower_unique").on(sql`lower(${table.name})`),
    index("suppliers_active_name_idx").on(table.isActive, sql`lower(${table.name})`),
  ],
);

export const inventoryBatches = pgTable(
  "inventory_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "restrict" }),
    batchNumber: text("batch_number").notNull(),
    expiresOn: date("expires_on", { mode: "string" }),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("inventory_batches_lot_unique")
      .on(table.warehouseId, table.productId, table.variantId, table.batchNumber)
      .nullsNotDistinct(),
    index("inventory_batches_fefo_idx").on(
      table.warehouseId,
      table.productId,
      table.variantId,
      table.expiresOn,
      table.createdAt,
    ),
  ],
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: "restrict" }),
    movementType: text("movement_type")
      .$type<
        | "receipt"
        | "adjustment_in"
        | "adjustment_out"
        | "transfer_in"
        | "transfer_out"
        | "supplier_return"
        | "bundle_component_in"
        | "bundle_component_out"
        | "sale_out"
        | "sale_return_in"
      >()
      .notNull(),
    quantityDelta: numeric("quantity_delta", { precision: 14, scale: 3 }).notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }).notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    reason: text("reason"),
    actorUserId: uuid("actor_user_id").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("inventory_movements_warehouse_product_idx").on(
      table.warehouseId,
      table.productId,
      table.createdAt,
    ),
    index("inventory_movements_batch_created_idx").on(table.batchId, table.createdAt),
    uniqueIndex("inventory_movements_source_unique").on(
      table.sourceType,
      table.sourceId,
      table.batchId,
      table.movementType,
    ),
  ],
);

export const inventoryReorderLevels = pgTable(
  "inventory_reorder_levels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    minimumQuantity: numeric("minimum_quantity", { precision: 14, scale: 3 }).notNull(),
    reorderQuantity: numeric("reorder_quantity", { precision: 14, scale: 3 }).notNull(),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    unique("inventory_reorder_levels_scope_unique")
      .on(table.warehouseId, table.productId, table.variantId)
      .nullsNotDistinct(),
    index("inventory_reorder_levels_warehouse_idx").on(table.warehouseId, table.productId),
  ],
);

export const productBundleComponents = pgTable(
  "product_bundle_components",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bundleProductId: uuid("bundle_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    componentProductId: uuid("component_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    componentVariantId: uuid("component_variant_id").references(() => productVariants.id, {
      onDelete: "restrict",
    }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  },
  (table) => [
    unique("product_bundle_components_unique")
      .on(table.bundleProductId, table.componentProductId, table.componentVariantId)
      .nullsNotDistinct(),
  ],
);

export const purchaseRequests = pgTable(
  "purchase_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    requestNumber: text("request_number").notNull().unique(),
    status: text("status")
      .$type<"draft" | "submitted" | "approved" | "rejected" | "converted">()
      .notNull()
      .default("draft"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    reviewedBy: uuid("reviewed_by").references(() => staffUsers.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("purchase_requests_branch_status_idx").on(table.branchId, table.status, table.createdAt),
  ],
);

export const purchaseRequestLines = pgTable(
  "purchase_request_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => purchaseRequests.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    estimatedUnitCostCents: bigint("estimated_unit_cost_cents", { mode: "number" }),
  },
  (table) => [index("purchase_request_lines_request_idx").on(table.requestId)],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    requestId: uuid("request_id").references(() => purchaseRequests.id, { onDelete: "restrict" }),
    orderNumber: text("order_number").notNull().unique(),
    status: text("status")
      .$type<"draft" | "ordered" | "partially_received" | "received" | "cancelled">()
      .notNull()
      .default("draft"),
    orderedBy: uuid("ordered_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("purchase_orders_branch_status_idx").on(table.branchId, table.status, table.createdAt),
    index("purchase_orders_supplier_idx").on(table.supplierId, table.createdAt),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    receivedQuantity: numeric("received_quantity", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }).notNull(),
  },
  (table) => [index("purchase_order_lines_order_idx").on(table.orderId)],
);

export const purchaseReceipts = pgTable(
  "purchase_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "restrict" }),
    receiptNumber: text("receipt_number").notNull().unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    receivedBy: uuid("received_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    notes: text("notes"),
  },
  (table) => [index("purchase_receipts_order_idx").on(table.orderId, table.receivedAt)],
);

export const purchaseReceiptLines = pgTable(
  "purchase_receipt_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => purchaseReceipts.id, { onDelete: "restrict" }),
    orderLineId: uuid("order_line_id")
      .notNull()
      .references(() => purchaseOrderLines.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }).notNull(),
  },
  (table) => [index("purchase_receipt_lines_receipt_idx").on(table.receiptId)],
);

export const supplierReturns = pgTable(
  "supplier_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    returnNumber: text("return_number").notNull().unique(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("supplier_returns_supplier_idx").on(table.supplierId, table.createdAt)],
);

export const supplierReturnLines = pgTable(
  "supplier_return_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    returnId: uuid("return_id")
      .notNull()
      .references(() => supplierReturns.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitCostCents: bigint("unit_cost_cents", { mode: "number" }).notNull(),
  },
  (table) => [index("supplier_return_lines_return_idx").on(table.returnId)],
);

export const supplierPayableEntries = pgTable(
  "supplier_payable_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    entryType: text("entry_type")
      .$type<"receipt" | "return" | "payment" | "adjustment">()
      .notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    createdBy: uuid("created_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("supplier_payable_source_unique").on(table.sourceType, table.sourceId),
    index("supplier_payable_supplier_date_idx").on(table.supplierId, table.createdAt),
  ],
);

export const stocktakes = pgTable(
  "stocktakes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    status: text("status")
      .$type<"draft" | "pending_approval" | "approved" | "rejected">()
      .notNull()
      .default("draft"),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    reviewedBy: uuid("reviewed_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [index("stocktakes_warehouse_status_idx").on(table.warehouseId, table.status)],
);

export const stocktakeLines = pgTable(
  "stocktake_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stocktakeId: uuid("stocktake_id")
      .notNull()
      .references(() => stocktakes.id, { onDelete: "cascade" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: "restrict" }),
    expectedQuantity: numeric("expected_quantity", { precision: 14, scale: 3 }).notNull(),
    countedQuantity: numeric("counted_quantity", { precision: 14, scale: 3 }).notNull(),
  },
  (table) => [
    unique("stocktake_lines_batch_unique").on(table.stocktakeId, table.batchId),
    index("stocktake_lines_stocktake_idx").on(table.stocktakeId),
  ],
);

export const posShifts = pgTable(
  "pos_shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    status: text("status").$type<"open" | "closed">().notNull().default("open"),
    openingCashCents: bigint("opening_cash_cents", { mode: "number" }).notNull(),
    closingCashCents: bigint("closing_cash_cents", { mode: "number" }),
    expectedCashCents: bigint("expected_cash_cents", { mode: "number" }),
    openedAt: timestamp("opened_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true, mode: "date" }),
    closeNotes: text("close_notes"),
  },
  (table) => [
    index("pos_shifts_branch_status_idx").on(table.branchId, table.status, table.openedAt),
  ],
);

export const posSales = pgTable(
  "pos_sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    requestFingerprint: text("request_fingerprint").notNull(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => posShifts.id, { onDelete: "restrict" }),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    petId: uuid("pet_id").references(() => pets.id, { onDelete: "set null" }),
    priceTierId: uuid("price_tier_id").references(() => priceTiers.id, { onDelete: "restrict" }),
    status: text("status")
      .$type<"held" | "paid" | "partially_paid" | "voided" | "refunded">()
      .notNull(),
    subtotalCents: bigint("subtotal_cents", { mode: "number" }).notNull(),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull(),
    taxCents: bigint("tax_cents", { mode: "number" }).notNull(),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    paidCents: bigint("paid_cents", { mode: "number" }).notNull().default(0),
    refundedCents: bigint("refunded_cents", { mode: "number" }).notNull().default(0),
    voidIdempotencyKey: text("void_idempotency_key"),
    resumeIdempotencyKey: text("resume_idempotency_key"),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references(() => staffUsers.id, { onDelete: "restrict" }),
    voidedAt: timestamp("voided_at", { withTimezone: true, mode: "date" }),
    taxRateBps: integer("tax_rate_bps").notNull(),
    taxIncluded: boolean("tax_included").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pos_sales_branch_date_idx").on(table.branchId, table.createdAt),
    index("pos_sales_shift_status_idx").on(table.shiftId, table.status, table.createdAt),
  ],
);

export const posSaleLines = pgTable(
  "pos_sale_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => posSales.id, { onDelete: "restrict" }),
    itemType: text("item_type").$type<"product" | "service">().notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }),
    itemName: text("item_name").notNull(),
    itemSku: text("item_sku").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull(),
    taxCents: bigint("tax_cents", { mode: "number" }).notNull(),
    lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull(),
    returnedQuantity: numeric("returned_quantity", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
    notes: text("notes"),
  },
  (table) => [index("pos_sale_lines_sale_idx").on(table.saleId)],
);

export const posSaleStockAllocations = pgTable(
  "pos_sale_stock_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleLineId: uuid("sale_line_id")
      .notNull()
      .references(() => posSaleLines.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  },
  (table) => [uniqueIndex("pos_sale_stock_allocation_unique").on(table.saleLineId, table.batchId)],
);

export const posPayments = pgTable(
  "pos_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => posSales.id, { onDelete: "restrict" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => posShifts.id, { onDelete: "restrict" }),
    idempotencyKey: text("idempotency_key").notNull(),
    method: text("method")
      .$type<
        "cash" | "bank_transfer" | "card" | "qris" | "ewallet" | "virtual_account" | "deposit"
      >()
      .notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    reference: text("reference"),
    receivedBy: uuid("received_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("pos_payments_sale_idx").on(table.saleId, table.createdAt)],
);

export const posRefunds = pgTable(
  "pos_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    refundNumber: text("refund_number").notNull().unique(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => posSales.id, { onDelete: "restrict" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => posShifts.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("pos_refunds_sale_idx").on(table.saleId, table.createdAt)],
);

export const posRefundLines = pgTable("pos_refund_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  refundId: uuid("refund_id")
    .notNull()
    .references(() => posRefunds.id, { onDelete: "restrict" }),
  saleLineId: uuid("sale_line_id")
    .notNull()
    .references(() => posSaleLines.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
});

export const posRefundStockAllocations = pgTable("pos_refund_stock_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  refundLineId: uuid("refund_line_id")
    .notNull()
    .references(() => posRefundLines.id, { onDelete: "restrict" }),
  saleLineId: uuid("sale_line_id")
    .notNull()
    .references(() => posSaleLines.id, { onDelete: "restrict" }),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => inventoryBatches.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
});

export const posRefundPayments = pgTable("pos_refund_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  refundId: uuid("refund_id")
    .notNull()
    .references(() => posRefunds.id, { onDelete: "restrict" }),
  method: text("method")
    .$type<"cash" | "bank_transfer" | "card" | "qris" | "ewallet" | "virtual_account" | "deposit">()
    .notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  reference: text("reference"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const posCashMovements = pgTable(
  "pos_cash_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => posShifts.id, { onDelete: "restrict" }),
    movementType: text("movement_type").$type<"cash_in" | "cash_out">().notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("pos_cash_movements_shift_idx").on(table.shiftId, table.createdAt)],
);

export const inventoryAdjustments = pgTable(
  "inventory_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("inventory_adjustments_warehouse_created_idx").on(table.warehouseId, table.createdAt),
  ],
);

export const inventoryTransfers = pgTable(
  "inventory_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transferNumber: text("transfer_number").notNull().unique(),
    sourceWarehouseId: uuid("source_warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    destinationWarehouseId: uuid("destination_warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "restrict" }),
    status: text("status")
      .$type<"requested" | "in_transit" | "received" | "cancelled">()
      .notNull()
      .default("requested"),
    reason: text("reason").notNull(),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    shippedBy: uuid("shipped_by").references(() => staffUsers.id, { onDelete: "set null" }),
    receivedBy: uuid("received_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    shippedAt: timestamp("shipped_at", { withTimezone: true, mode: "date" }),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("inventory_transfers_source_status_idx").on(table.sourceWarehouseId, table.status),
    index("inventory_transfers_destination_status_idx").on(
      table.destinationWarehouseId,
      table.status,
    ),
  ],
);

export const inventoryTransferLines = pgTable(
  "inventory_transfer_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => inventoryTransfers.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
  },
  (table) => [index("inventory_transfer_lines_transfer_idx").on(table.transferId)],
);

export const inventoryTransferBatchLines = pgTable(
  "inventory_transfer_batch_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transferLineId: uuid("transfer_line_id")
      .notNull()
      .references(() => inventoryTransferLines.id, { onDelete: "restrict" }),
    sourceBatchId: uuid("source_batch_id")
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: "restrict" }),
    destinationBatchId: uuid("destination_batch_id")
      .notNull()
      .references(() => inventoryBatches.id, { onDelete: "restrict" }),
    shippedQuantity: numeric("shipped_quantity", { precision: 14, scale: 3 }).notNull(),
    receivedQuantity: numeric("received_quantity", { precision: 14, scale: 3 })
      .notNull()
      .default("0"),
  },
  (table) => [
    unique("inventory_transfer_batch_unique").on(table.transferLineId, table.sourceBatchId),
    index("inventory_transfer_batch_transfer_line_idx").on(table.transferLineId),
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
    maxDiscountBps: integer("max_discount_bps").$type<number | null>(),
    maxRefundCents: bigint("max_refund_cents", { mode: "number" }).$type<number | null>(),
    maxVoidCents: bigint("max_void_cents", { mode: "number" }).$type<number | null>(),
    maxTransferCents: bigint("max_transfer_cents", { mode: "number" }).$type<number | null>(),
    requiresSupervisorPin: boolean("requires_supervisor_pin").notNull().default(false),
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
    maxDiscountBps: integer("max_discount_bps").$type<number | null>(),
    maxRefundCents: bigint("max_refund_cents", { mode: "number" }).$type<number | null>(),
    maxVoidCents: bigint("max_void_cents", { mode: "number" }).$type<number | null>(),
    maxTransferCents: bigint("max_transfer_cents", { mode: "number" }).$type<number | null>(),
    requiresSupervisorPin: boolean("requires_supervisor_pin").notNull().default(false),
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

export const notificationTemplates = pgTable("notification_templates", {
  key: text("key").primaryKey(),
  description: text("description").notNull(),
  titleTemplate: text("title_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  honorsQuietHours: boolean("honors_quiet_hours").notNull().default(false),
  updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const staffNotifications = pgTable(
  "staff_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    templateKey: text("template_key")
      .notNull()
      .references(() => notificationTemplates.key, { onDelete: "restrict" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: text("status").$type<"queued" | "delivered" | "failed">().notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lastErrorCode: text("last_error_code"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, mode: "date" }),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("staff_notifications_inbox_idx").on(table.recipientUserId, table.status, table.createdAt),
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

export const posPromotions = pgTable(
  "pos_promotions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    discountType: text("discount_type")
      .$type<"percentage" | "fixed_amount" | "buy_x_get_y">()
      .notNull(),
    discountValue: numeric("discount_value", { precision: 14, scale: 3 }).notNull(),
    minPurchaseCents: bigint("min_purchase_cents", { mode: "number" }),
    maxDiscountCents: bigint("max_discount_cents", { mode: "number" }),
    appliesTo: text("applies_to")
      .$type<"all" | "products" | "services" | "categories" | "specific">()
      .notNull(),
    targetIds: uuid("target_ids").array().notNull().default(sql`ARRAY[]::uuid[]`),
    priceTierId: uuid("price_tier_id").references(() => priceTiers.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    priority: smallint("priority").notNull().default(0),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pos_promotions_branch_active_idx")
      .on(table.branchId, table.isActive, table.startsAt, table.endsAt)
      .where(sql`${table.isActive}`),
    index("pos_promotions_date_range_idx").on(table.startsAt, table.endsAt),
  ],
);

export const posVouchers = pgTable(
  "pos_vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    discountType: text("discount_type").$type<"percentage" | "fixed_amount">().notNull(),
    discountValue: numeric("discount_value", { precision: 14, scale: 3 }).notNull(),
    minPurchaseCents: bigint("min_purchase_cents", { mode: "number" }),
    maxDiscountCents: bigint("max_discount_cents", { mode: "number" }),
    appliesTo: text("applies_to")
      .$type<"all" | "products" | "services" | "categories" | "specific">()
      .notNull(),
    targetIds: uuid("target_ids").array().notNull().default(sql`ARRAY[]::uuid[]`),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    usageLimit: integer("usage_limit"),
    usageCount: integer("usage_count").notNull().default(0),
    perCustomerLimit: integer("per_customer_limit"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pos_vouchers_code_branch_lower_unique").on(
      table.branchId,
      sql`lower(${table.code})`,
    ),
    index("pos_vouchers_branch_active_idx")
      .on(table.branchId, table.isActive, table.startsAt, table.endsAt)
      .where(sql`${table.isActive}`),
  ],
);

export const posVoucherUsages = pgTable(
  "pos_voucher_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => posVouchers.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => posSales.id, { onDelete: "restrict" }),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("pos_voucher_usages_voucher_idx").on(table.voucherId, table.usedAt),
    index("pos_voucher_usages_customer_idx").on(table.customerId, table.usedAt),
  ],
);

export const loyaltyAccounts = pgTable(
  "loyalty_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    pointsBalance: integer("points_balance").notNull().default(0),
    tier: text("tier")
      .$type<"member" | "silver" | "gold" | "platinum">()
      .notNull()
      .default("member"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("loyalty_accounts_customer_branch_unique").on(table.customerId, table.branchId),
    index("loyalty_accounts_branch_idx").on(table.branchId, table.tier),
  ],
);

export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: "restrict" }),
    type: text("type").$type<"earn" | "redeem" | "expire" | "adjust" | "refund">().notNull(),
    points: integer("points").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    sourceType: text("source_type")
      .$type<"pos_sale" | "manual" | "promotion" | "voucher" | "system">()
      .notNull(),
    sourceId: uuid("source_id"),
    reason: text("reason"),
    actorUserId: uuid("actor_user_id").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("loyalty_transactions_account_idx").on(table.accountId, sql`${table.createdAt} DESC`),
    index("loyalty_transactions_source_idx").on(table.sourceType, table.sourceId),
  ],
);

export const loyaltyTiers = pgTable(
  "loyalty_tiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    name: text("name").$type<"member" | "silver" | "gold" | "platinum">().notNull(),
    minPoints: integer("min_points").notNull(),
    earnRateBps: integer("earn_rate_bps").notNull(),
    redeemRateBps: integer("redeem_rate_bps").notNull(),
    minRedeemPoints: integer("min_redeem_points").notNull().default(0),
    benefits: jsonb("benefits").notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("loyalty_tiers_branch_name_unique").on(table.branchId, table.name)],
);

export const customerDeposits = pgTable(
  "customer_deposits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    balanceCents: bigint("balance_cents", { mode: "number" }).notNull().default(0),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by").references(() => staffUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("customer_deposits_customer_branch_unique").on(table.customerId, table.branchId),
    index("customer_deposits_branch_idx").on(table.branchId, sql`${table.balanceCents} DESC`),
  ],
);

export const customerDepositTransactions = pgTable(
  "customer_deposit_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    depositId: uuid("deposit_id")
      .notNull()
      .references(() => customerDeposits.id, { onDelete: "restrict" }),
    type: text("type")
      .$type<"topup" | "payment" | "refund" | "adjust" | "transfer_in" | "transfer_out">()
      .notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    balanceAfterCents: bigint("balance_after_cents", { mode: "number" }).notNull(),
    sourceType: text("source_type")
      .$type<"pos_sale" | "pos_refund" | "manual" | "transfer" | "system">()
      .notNull(),
    sourceId: uuid("source_id"),
    reference: text("reference"),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("customer_deposit_transactions_deposit_idx").on(
      table.depositId,
      sql`${table.createdAt} DESC`,
    ),
    index("customer_deposit_transactions_source_idx").on(table.sourceType, table.sourceId),
  ],
);
