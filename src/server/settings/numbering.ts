import type { ExtractTablesWithRelations } from "drizzle-orm";
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgTransaction } from "drizzle-orm/node-postgres";
import type * as schema from "@/db/schema";
import { branches, documentNumberSequences } from "@/db/schema";
import type { DocumentType } from "./validation";

type SettingsTransaction = NodePgTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export class DocumentSequenceNotFoundError extends Error {}

export class DocumentSequenceExhaustedError extends Error {}

interface DocumentNumberInput {
  documentType: DocumentType;
  branchId: string | null;
}

export async function nextDocumentNumber(
  tx: SettingsTransaction,
  input: DocumentNumberInput,
): Promise<string> {
  const [branch] = input.branchId
    ? await tx
        .select({ id: branches.id, code: branches.code })
        .from(branches)
        .where(and(eq(branches.id, input.branchId), eq(branches.isActive, true)))
        .limit(1)
    : [];
  if (input.branchId && !branch) {
    throw new DocumentSequenceNotFoundError("Cabang tidak ditemukan atau tidak aktif.");
  }

  const branchScope = input.branchId
    ? eq(documentNumberSequences.branchId, input.branchId)
    : isNull(documentNumberSequences.branchId);
  const [branchSequence] = await tx
    .select({
      id: documentNumberSequences.id,
      prefix: documentNumberSequences.prefix,
      nextNumber: documentNumberSequences.nextNumber,
      minimumWidth: documentNumberSequences.minimumWidth,
    })
    .from(documentNumberSequences)
    .where(and(eq(documentNumberSequences.documentType, input.documentType), branchScope))
    .for("update")
    .limit(1);
  const [globalSequence] = branchSequence
    ? []
    : await tx
        .select({
          id: documentNumberSequences.id,
          prefix: documentNumberSequences.prefix,
          nextNumber: documentNumberSequences.nextNumber,
          minimumWidth: documentNumberSequences.minimumWidth,
        })
        .from(documentNumberSequences)
        .where(
          and(
            eq(documentNumberSequences.documentType, input.documentType),
            isNull(documentNumberSequences.branchId),
          ),
        )
        .for("update")
        .limit(1);
  const sequence = branchSequence ?? globalSequence;
  if (!sequence) {
    throw new DocumentSequenceNotFoundError("Sequence nomor dokumen belum dikonfigurasi.");
  }
  if (sequence.nextNumber >= 999_999_999_999) {
    throw new DocumentSequenceExhaustedError("Sequence nomor dokumen telah mencapai batas.");
  }

  await tx
    .update(documentNumberSequences)
    .set({ nextNumber: sequence.nextNumber + 1, updatedAt: new Date() })
    .where(eq(documentNumberSequences.id, sequence.id));

  const scopeCode = branch?.code ?? "GLOBAL";
  const serial = String(sequence.nextNumber).padStart(sequence.minimumWidth, "0");
  return `${sequence.prefix}/${scopeCode}/${serial}`;
}
