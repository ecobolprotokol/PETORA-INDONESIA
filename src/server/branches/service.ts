import { asc } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEvents, branches } from "@/db/schema";
import type { BranchInput } from "./validation";

export class BranchCodeConflictError extends Error {}

function hasBranchCodeConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return false;
  }

  const cause = error.cause;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === "branches_code_lower_unique"
  );
}

export async function listBranches() {
  return getDatabase()
    .select({
      id: branches.id,
      code: branches.code,
      name: branches.name,
      timezone: branches.timezone,
      isActive: branches.isActive,
    })
    .from(branches)
    .orderBy(asc(branches.name));
}

export async function createBranch(input: BranchInput, actorUserId: string) {
  try {
    return await getDatabase().transaction(async (tx) => {
      const [branch] = await tx
        .insert(branches)
        .values({
          code: input.code,
          name: input.name,
          timezone: input.timezone,
          createdBy: actorUserId,
        })
        .returning({
          id: branches.id,
          code: branches.code,
          name: branches.name,
          timezone: branches.timezone,
          isActive: branches.isActive,
        });

      if (!branch) {
        throw new Error("Cabang gagal dibuat.");
      }

      await tx.insert(auditEvents).values({
        actorUserId,
        action: "branch.created",
        targetType: "branch",
        targetId: branch.id,
      });

      return branch;
    });
  } catch (error) {
    if (hasBranchCodeConflict(error)) {
      throw new BranchCodeConflictError("Kode cabang sudah digunakan.");
    }

    throw error;
  }
}
