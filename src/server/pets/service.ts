import { and, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import { auditEvents, customers, petOwners, pets, petWeightHistory } from "@/db/schema";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { PetInput } from "./validation";

export class PetNotFoundError extends Error {}

export class PetOwnersInvalidError extends Error {}

export class PetMergeConflictError extends Error {}

export interface PetRecord {
  id: string;
  name: string;
  species: "dog" | "cat" | "bird" | "small_mammal" | "reptile" | "other";
  breed: string | null;
  sex: "male" | "female" | "unknown";
  birthDate: string | null;
  estimatedAgeMonths: number | null;
  color: string | null;
  microchipNumber: string | null;
  photoUrl: string | null;
  isSterilized: boolean;
  allergies: string[];
  behaviorNotes: string | null;
  status: "active" | "deceased" | "transferred";
  createdBy: string | null;
  owners: Array<{ customerId: string; name: string; relationship: string; isPrimary: boolean }>;
}

const petSelection = {
  id: pets.id,
  name: pets.name,
  species: pets.species,
  breed: pets.breed,
  sex: pets.sex,
  birthDate: pets.birthDate,
  estimatedAgeMonths: pets.estimatedAgeMonths,
  color: pets.color,
  microchipNumber: pets.microchipNumber,
  photoUrl: pets.photoUrl,
  isSterilized: pets.isSterilized,
  allergies: pets.allergies,
  behaviorNotes: pets.behaviorNotes,
  status: pets.status,
  createdBy: pets.createdBy,
};

function ownPetCondition(staffUserId: string) {
  return exists(
    getDatabase()
      .select({ one: sql`1` })
      .from(petOwners)
      .innerJoin(customers, eq(petOwners.customerId, customers.id))
      .where(and(eq(petOwners.petId, pets.id), eq(customers.createdBy, staffUserId))),
  );
}

async function loadOwners(petIds: string[]) {
  if (petIds.length === 0) {
    return new Map<
      string,
      Array<{ customerId: string; name: string; relationship: string; isPrimary: boolean }>
    >();
  }

  const rows = await getDatabase()
    .select({
      petId: petOwners.petId,
      customerId: petOwners.customerId,
      name: customers.name,
      relationship: petOwners.relationship,
      isPrimary: petOwners.isPrimary,
    })
    .from(petOwners)
    .innerJoin(customers, eq(petOwners.customerId, customers.id))
    .where(inArray(petOwners.petId, petIds))
    .orderBy(desc(petOwners.isPrimary), customers.name);

  const grouped = new Map<
    string,
    Array<{ customerId: string; name: string; relationship: string; isPrimary: boolean }>
  >();
  for (const { petId, ...owner } of rows) {
    const owners = grouped.get(petId) ?? [];
    owners.push(owner);
    grouped.set(petId, owners);
  }
  return grouped;
}

async function withOwners<T extends { id: string }>(records: T[]) {
  const ownersByPet = await loadOwners(records.map(({ id }) => id));
  return records.map((record) => ({ ...record, owners: ownersByPet.get(record.id) ?? [] }));
}

async function assertOwnersInScope(
  tx: Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0],
  ownerIds: string[],
  actorUserId: string,
  dataScope: PermissionDataScope,
) {
  const visibleOwners = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        inArray(customers.id, ownerIds),
        dataScope === "own" ? eq(customers.createdBy, actorUserId) : undefined,
      ),
    );
  if (visibleOwners.length !== ownerIds.length) {
    throw new PetOwnersInvalidError("Satu atau lebih pemilik tidak ditemukan dalam cakupan Anda.");
  }
}

export async function listPets(
  staffUserId: string,
  dataScope: PermissionDataScope,
  query?: string,
): Promise<PetRecord[]> {
  const normalizedQuery = query?.trim();
  const records = await getDatabase()
    .select(petSelection)
    .from(pets)
    .where(
      and(
        dataScope === "own" ? ownPetCondition(staffUserId) : undefined,
        normalizedQuery
          ? or(
              ilike(pets.name, `%${normalizedQuery.replace(/[\\%_]/gu, "\\$&")}%`),
              ilike(pets.microchipNumber, `%${normalizedQuery.replace(/[\\%_]/gu, "\\$&")}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(pets.createdAt), desc(pets.id))
    .limit(50);
  const result = await withOwners(records);

  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId: staffUserId,
      action: normalizedQuery ? "pet.searched" : "pet.listed",
      targetType: "pet_collection",
      metadata: {
        dataScope,
        returned: String(result.length),
        ...(normalizedQuery ? { queryLength: String(normalizedQuery.length) } : {}),
      },
    });
  return result;
}

export async function exportPets(staffUserId: string, dataScope: PermissionDataScope) {
  const petsToExport = await getDatabase()
    .select(petSelection)
    .from(pets)
    .where(dataScope === "own" ? ownPetCondition(staffUserId) : undefined)
    .orderBy(desc(pets.createdAt), desc(pets.id))
    .limit(10_000);
  const records = await withOwners(petsToExport);
  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId: staffUserId,
      action: "pet.exported",
      targetType: "pet_collection",
      metadata: { dataScope, returned: String(records.length) },
    });
  return records;
}

export async function importPets(
  inputs: PetInput[],
  actorUserId: string,
  dataScope: PermissionDataScope,
) {
  return getDatabase().transaction(async (tx) => {
    for (const input of inputs) {
      const ownerIds = input.owners.map(({ customerId }) => customerId);
      await assertOwnersInScope(tx, ownerIds, actorUserId, dataScope);
      const [pet] = await tx
        .insert(pets)
        .values({
          name: input.name,
          species: input.species,
          breed: input.breed,
          sex: input.sex,
          birthDate: input.birthDate,
          estimatedAgeMonths: input.estimatedAgeMonths,
          color: input.color,
          microchipNumber: input.microchipNumber,
          photoUrl: input.photoUrl,
          isSterilized: input.isSterilized,
          allergies: input.allergies,
          behaviorNotes: input.behaviorNotes,
          status: input.status,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning({ id: pets.id });
      if (!pet) {
        throw new Error("Data hewan gagal diimpor.");
      }
      await tx.insert(petOwners).values(
        input.owners.map((owner) => ({
          petId: pet.id,
          customerId: owner.customerId,
          relationship: owner.relationship,
          isPrimary: owner.isPrimary,
        })),
      );
    }
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "pet.imported",
      targetType: "pet_collection",
      metadata: {
        imported: String(inputs.length),
        fields: "profile,owners,allergies,behaviorNotes",
      },
    });
    return inputs.length;
  });
}

export async function createPet(
  input: PetInput,
  actorUserId: string,
  dataScope: PermissionDataScope,
): Promise<PetRecord> {
  const pet = await getDatabase().transaction(async (tx) => {
    const ownerIds = input.owners.map(({ customerId }) => customerId);
    await assertOwnersInScope(tx, ownerIds, actorUserId, dataScope);

    const [pet] = await tx
      .insert(pets)
      .values({
        name: input.name,
        species: input.species,
        breed: input.breed,
        sex: input.sex,
        birthDate: input.birthDate,
        estimatedAgeMonths: input.estimatedAgeMonths,
        color: input.color,
        microchipNumber: input.microchipNumber,
        photoUrl: input.photoUrl,
        isSterilized: input.isSterilized,
        allergies: input.allergies,
        behaviorNotes: input.behaviorNotes,
        status: input.status,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning(petSelection);
    if (!pet) {
      throw new Error("Data hewan gagal disimpan.");
    }

    await tx.insert(petOwners).values(
      input.owners.map((owner) => ({
        petId: pet.id,
        customerId: owner.customerId,
        relationship: owner.relationship,
        isPrimary: owner.isPrimary,
      })),
    );
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "pet.created",
      targetType: "pet",
      targetId: pet.id,
      metadata: {
        fields: "name,species,owners",
        ownerCount: String(ownerIds.length),
      },
    });

    return pet;
  });
  const [record] = await withOwners([pet]);
  return record;
}

export async function updatePet(
  petId: string,
  input: PetInput,
  actorUserId: string,
  dataScope: PermissionDataScope,
): Promise<PetRecord> {
  const pet = await getDatabase().transaction(async (tx) => {
    const [current] = await tx
      .select(petSelection)
      .from(pets)
      .where(
        and(eq(pets.id, petId), dataScope === "own" ? ownPetCondition(actorUserId) : undefined),
      )
      .for("update")
      .limit(1);
    if (!current) {
      throw new PetNotFoundError("Hewan tidak ditemukan.");
    }

    const ownerIds = input.owners.map(({ customerId }) => customerId);
    await assertOwnersInScope(tx, ownerIds, actorUserId, dataScope);
    const [updated] = await tx
      .update(pets)
      .set({
        name: input.name,
        species: input.species,
        breed: input.breed,
        sex: input.sex,
        birthDate: input.birthDate,
        estimatedAgeMonths: input.estimatedAgeMonths,
        color: input.color,
        microchipNumber: input.microchipNumber,
        photoUrl: input.photoUrl,
        isSterilized: input.isSterilized,
        allergies: input.allergies,
        behaviorNotes: input.behaviorNotes,
        status: input.status,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(pets.id, petId))
      .returning(petSelection);
    if (!updated) {
      throw new PetNotFoundError("Hewan tidak ditemukan.");
    }

    await tx.delete(petOwners).where(eq(petOwners.petId, petId));
    await tx.insert(petOwners).values(
      input.owners.map((owner) => ({
        petId,
        customerId: owner.customerId,
        relationship: owner.relationship,
        isPrimary: owner.isPrimary,
      })),
    );

    await tx.insert(auditEvents).values({
      actorUserId,
      action: "pet.updated",
      targetType: "pet",
      targetId: petId,
      metadata: { fields: "name,species,profile,owners", ownerCount: String(ownerIds.length) },
    });

    return updated;
  });
  const [record] = await withOwners([pet]);
  return record;
}

export async function addPetWeight(
  petId: string,
  weightKg: number,
  note: string | null,
  actorUserId: string,
  dataScope: PermissionDataScope,
) {
  return getDatabase().transaction(async (tx) => {
    const [pet] = await tx
      .select({ id: pets.id })
      .from(pets)
      .where(
        and(eq(pets.id, petId), dataScope === "own" ? ownPetCondition(actorUserId) : undefined),
      )
      .limit(1);
    if (!pet) {
      throw new PetNotFoundError("Hewan tidak ditemukan.");
    }
    const [weight] = await tx
      .insert(petWeightHistory)
      .values({ petId, weightKg: String(weightKg), note, recordedBy: actorUserId })
      .returning({
        id: petWeightHistory.id,
        weightKg: petWeightHistory.weightKg,
        recordedAt: petWeightHistory.recordedAt,
        note: petWeightHistory.note,
      });
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "pet.weight_recorded",
      targetType: "pet",
      targetId: petId,
      metadata: {},
    });
    return weight;
  });
}

export async function listPetWeights(
  petId: string,
  actorUserId: string,
  dataScope: PermissionDataScope,
) {
  const [pet] = await getDatabase()
    .select({ id: pets.id })
    .from(pets)
    .where(and(eq(pets.id, petId), dataScope === "own" ? ownPetCondition(actorUserId) : undefined))
    .limit(1);
  if (!pet) {
    throw new PetNotFoundError("Hewan tidak ditemukan.");
  }

  const weights = await getDatabase()
    .select({
      id: petWeightHistory.id,
      weightKg: petWeightHistory.weightKg,
      recordedAt: petWeightHistory.recordedAt,
      note: petWeightHistory.note,
    })
    .from(petWeightHistory)
    .where(eq(petWeightHistory.petId, petId))
    .orderBy(desc(petWeightHistory.recordedAt), desc(petWeightHistory.id))
    .limit(50);
  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId,
      action: "pet.weight_history_viewed",
      targetType: "pet",
      targetId: petId,
      metadata: { returned: String(weights.length) },
    });
  return weights;
}

export async function findPotentialPetDuplicates(
  name: string,
  species: PetInput["species"],
  ownerIds: string[],
  staffUserId: string,
  dataScope: PermissionDataScope,
) {
  const records = await getDatabase()
    .select(petSelection)
    .from(pets)
    .where(
      and(
        eq(pets.species, species),
        eq(sql`lower(${pets.name})`, name.trim().toLowerCase()),
        ownerIds.length
          ? exists(
              getDatabase()
                .select({ one: sql`1` })
                .from(petOwners)
                .where(and(eq(petOwners.petId, pets.id), inArray(petOwners.customerId, ownerIds))),
            )
          : undefined,
        dataScope === "own" ? ownPetCondition(staffUserId) : undefined,
      ),
    )
    .limit(10);
  const result = await withOwners(records);
  await getDatabase()
    .insert(auditEvents)
    .values({
      actorUserId: staffUserId,
      action: "pet.duplicates_checked",
      targetType: "pet_collection",
      metadata: { dataScope, matches: String(result.length) },
    });
  return result;
}

export async function mergePets(
  duplicatePetId: string,
  keepPetId: string,
  actorUserId: string,
  dataScope: PermissionDataScope,
): Promise<void> {
  await getDatabase().transaction(async (tx) => {
    const scope = dataScope === "own" ? ownPetCondition(actorUserId) : undefined;
    const visiblePets = await tx
      .select({ id: pets.id })
      .from(pets)
      .where(and(inArray(pets.id, [duplicatePetId, keepPetId]), scope))
      .for("update");
    if (visiblePets.length !== 2) {
      throw new PetNotFoundError("Hewan tidak ditemukan.");
    }

    const [target] = await tx
      .select(petSelection)
      .from(pets)
      .where(eq(pets.id, keepPetId))
      .limit(1);
    const [source] = await tx
      .select(petSelection)
      .from(pets)
      .where(eq(pets.id, duplicatePetId))
      .limit(1);
    if (!target || !source) {
      throw new PetNotFoundError("Hewan tidak ditemukan.");
    }
    if (
      target.microchipNumber &&
      source.microchipNumber &&
      target.microchipNumber.toLowerCase() !== source.microchipNumber.toLowerCase()
    ) {
      throw new PetMergeConflictError(
        "Nomor microchip berbeda. Perbaiki datanya sebelum menggabungkan hewan.",
      );
    }

    await tx
      .update(pets)
      .set({
        breed: target.breed ?? source.breed,
        birthDate: target.birthDate ?? source.birthDate,
        estimatedAgeMonths: target.estimatedAgeMonths ?? source.estimatedAgeMonths,
        color: target.color ?? source.color,
        microchipNumber: target.microchipNumber ?? source.microchipNumber,
        photoUrl: target.photoUrl ?? source.photoUrl,
        isSterilized: target.isSterilized || source.isSterilized,
        allergies: [...new Set([...target.allergies, ...source.allergies])],
        behaviorNotes:
          [target.behaviorNotes, source.behaviorNotes]
            .filter((note, index, notes) => note && notes.indexOf(note) === index)
            .join("\n\n") || null,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(pets.id, keepPetId));

    const targetOwners = await tx
      .select({ customerId: petOwners.customerId, isPrimary: petOwners.isPrimary })
      .from(petOwners)
      .where(eq(petOwners.petId, keepPetId));
    const sourceOwners = await tx
      .select({
        customerId: petOwners.customerId,
        relationship: petOwners.relationship,
        isPrimary: petOwners.isPrimary,
      })
      .from(petOwners)
      .where(eq(petOwners.petId, duplicatePetId));
    const targetOwnerIds = new Set(targetOwners.map(({ customerId }) => customerId));
    const primaryCustomerId =
      targetOwners.find(({ isPrimary }) => isPrimary)?.customerId ??
      sourceOwners.find(({ isPrimary }) => isPrimary)?.customerId ??
      targetOwners[0]?.customerId ??
      sourceOwners[0]?.customerId;
    await tx.update(petOwners).set({ isPrimary: false }).where(eq(petOwners.petId, keepPetId));
    const ownersToInsert = sourceOwners
      .filter(({ customerId }) => !targetOwnerIds.has(customerId))
      .map((owner) => ({
        petId: keepPetId,
        customerId: owner.customerId,
        relationship: owner.relationship,
        isPrimary: false,
      }));
    if (ownersToInsert.length) {
      await tx.insert(petOwners).values(ownersToInsert);
    }
    if (primaryCustomerId) {
      await tx
        .update(petOwners)
        .set({ isPrimary: true })
        .where(and(eq(petOwners.petId, keepPetId), eq(petOwners.customerId, primaryCustomerId)));
    }

    const movedWeights = await tx
      .update(petWeightHistory)
      .set({ petId: keepPetId })
      .where(eq(petWeightHistory.petId, duplicatePetId))
      .returning({ id: petWeightHistory.id });
    await tx.delete(pets).where(eq(pets.id, duplicatePetId));
    await tx.insert(auditEvents).values({
      actorUserId,
      action: "pet.merged",
      targetType: "pet",
      targetId: keepPetId,
      metadata: {
        duplicatePetId,
        ownersAdded: String(ownersToInsert.length),
        weightsMoved: String(movedWeights.length),
      },
    });
  });
}
