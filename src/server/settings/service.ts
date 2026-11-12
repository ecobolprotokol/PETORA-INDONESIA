import { and, asc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  auditEvents,
  branches,
  businessSettings,
  documentNumberSequences,
  systemModuleFeatures,
  systemState,
} from "@/db/schema";
import type { UpdateBusinessSettingsInput, UpdateDocumentSequenceInput } from "./validation";

export class SettingsRecordNotFoundError extends Error {}

export class SettingsBranchNotFoundError extends Error {}

export class DocumentSequenceConflictError extends Error {}

export async function getBusinessSettings() {
  const database = getDatabase();
  const [settings] = await database
    .select({
      businessName: systemState.businessName,
      defaultTimezone: businessSettings.defaultTimezone,
      locale: businessSettings.locale,
      taxEnabled: businessSettings.taxEnabled,
      taxRateBps: businessSettings.taxRateBps,
      taxIncluded: businessSettings.taxIncluded,
      primaryColor: businessSettings.primaryColor,
      theme: businessSettings.theme,
    })
    .from(businessSettings)
    .innerJoin(systemState, eq(systemState.id, businessSettings.id))
    .where(eq(businessSettings.id, 1))
    .limit(1);

  if (!settings) {
    throw new SettingsRecordNotFoundError("Pengaturan bisnis belum tersedia.");
  }

  const [features, documentSequences] = await Promise.all([
    database
      .select({
        key: systemModuleFeatures.featureKey,
        enabled: systemModuleFeatures.isEnabled,
      })
      .from(systemModuleFeatures)
      .orderBy(asc(systemModuleFeatures.featureKey)),
    database
      .select({
        id: documentNumberSequences.id,
        documentType: documentNumberSequences.documentType,
        branchId: documentNumberSequences.branchId,
        prefix: documentNumberSequences.prefix,
        nextNumber: documentNumberSequences.nextNumber,
        minimumWidth: documentNumberSequences.minimumWidth,
      })
      .from(documentNumberSequences)
      .orderBy(asc(documentNumberSequences.documentType), asc(documentNumberSequences.branchId)),
  ]);
  const enabled = (key: "commissions" | "loyalty" | "inpatient") => {
    const feature = features.find((item) => item.key === key);
    if (!feature) {
      throw new SettingsRecordNotFoundError(`Pengaturan fitur "${key}" belum tersedia.`);
    }
    return feature.enabled;
  };

  return {
    ...settings,
    features: {
      commissions: enabled("commissions"),
      loyalty: enabled("loyalty"),
      inpatient: enabled("inpatient"),
    },
    documentSequences,
  };
}

export async function updateBusinessSettings(
  input: UpdateBusinessSettingsInput,
  actorUserId: string,
): Promise<void> {
  await getDatabase().transaction(async (tx) => {
    const [system] = await tx
      .update(systemState)
      .set({ businessName: input.businessName })
      .where(eq(systemState.id, 1))
      .returning({ id: systemState.id });
    const [settings] = await tx
      .update(businessSettings)
      .set({
        defaultTimezone: input.defaultTimezone,
        locale: input.locale,
        taxEnabled: input.taxEnabled,
        taxRateBps: input.taxRateBps,
        taxIncluded: input.taxIncluded,
        primaryColor: input.primaryColor,
        theme: input.theme,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(businessSettings.id, 1))
      .returning({ id: businessSettings.id });

    if (!system || !settings) {
      throw new SettingsRecordNotFoundError("Pengaturan bisnis belum tersedia.");
    }

    const featureValues = [
      ["commissions", input.features.commissions],
      ["loyalty", input.features.loyalty],
      ["inpatient", input.features.inpatient],
    ] as const;
    for (const [featureKey, isEnabled] of featureValues) {
      const [feature] = await tx
        .update(systemModuleFeatures)
        .set({ isEnabled, updatedBy: actorUserId, updatedAt: new Date() })
        .where(eq(systemModuleFeatures.featureKey, featureKey))
        .returning({ key: systemModuleFeatures.featureKey });

      if (!feature) {
        throw new SettingsRecordNotFoundError(`Pengaturan fitur "${featureKey}" belum tersedia.`);
      }
    }

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "settings.business_updated",
      targetType: "business_settings",
      targetId: "1",
      metadata: {
        changed: ["businessName", "timezone", "locale", "tax", "branding", "features"].join(","),
      },
    });
  });
}

export async function updateDocumentNumberSequence(
  input: UpdateDocumentSequenceInput,
  actorUserId: string,
) {
  try {
    return await getDatabase().transaction(async (tx) => {
      if (input.branchId) {
        const [branch] = await tx
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.id, input.branchId), eq(branches.isActive, true)))
          .limit(1);
        if (!branch) {
          throw new SettingsBranchNotFoundError("Cabang tidak ditemukan atau tidak aktif.");
        }
      }

      const scope = input.branchId
        ? eq(documentNumberSequences.branchId, input.branchId)
        : isNull(documentNumberSequences.branchId);
      const [existing] = await tx
        .select({ id: documentNumberSequences.id })
        .from(documentNumberSequences)
        .where(and(eq(documentNumberSequences.documentType, input.documentType), scope))
        .for("update")
        .limit(1);
      const values = {
        documentType: input.documentType,
        branchId: input.branchId,
        prefix: input.prefix,
        nextNumber: input.nextNumber,
        minimumWidth: input.minimumWidth,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      };
      const [sequence] = existing
        ? await tx
            .update(documentNumberSequences)
            .set(values)
            .where(eq(documentNumberSequences.id, existing.id))
            .returning({
              id: documentNumberSequences.id,
              documentType: documentNumberSequences.documentType,
              branchId: documentNumberSequences.branchId,
              prefix: documentNumberSequences.prefix,
              nextNumber: documentNumberSequences.nextNumber,
              minimumWidth: documentNumberSequences.minimumWidth,
            })
        : await tx.insert(documentNumberSequences).values(values).returning({
            id: documentNumberSequences.id,
            documentType: documentNumberSequences.documentType,
            branchId: documentNumberSequences.branchId,
            prefix: documentNumberSequences.prefix,
            nextNumber: documentNumberSequences.nextNumber,
            minimumWidth: documentNumberSequences.minimumWidth,
          });

      if (!sequence) {
        throw new Error("Penomoran dokumen gagal disimpan.");
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        action: "settings.document_sequence_updated",
        targetType: "document_number_sequence",
        targetId: sequence.id,
        metadata: {
          documentType: input.documentType,
          branchScope: input.branchId ?? "global",
        },
      });

      return sequence;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      typeof error.cause === "object" &&
      error.cause !== null &&
      "constraint" in error.cause &&
      (error.cause.constraint === "document_number_sequences_global_unique" ||
        error.cause.constraint === "document_number_sequences_branch_unique")
    ) {
      throw new DocumentSequenceConflictError("Penomoran untuk cakupan tersebut baru saja diubah.");
    }

    throw error;
  }
}
