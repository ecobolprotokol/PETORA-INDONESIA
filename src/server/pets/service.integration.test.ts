import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase } from "@/db";
import {
  accessRoles,
  auditEvents,
  customers,
  pets,
  petWeightHistory,
  rolePermissions,
  staffRoleAssignments,
  staffUsers,
} from "@/db/schema";
import { authorizeStaff } from "@/server/access/service";
import { hashPassword } from "@/server/auth/password";
import {
  addPetWeight,
  createPet,
  findPotentialPetDuplicates,
  listPets,
  mergePets,
  PetNotFoundError,
  PetOwnersInvalidError,
  updatePet,
} from "./service";
import { type PetInput, petSchema } from "./validation";

let staffId: string;
let otherStaffId: string;
let roleId: string;
let ownCustomerId: string;
let otherCustomerId: string;
let anotherOwnCustomerId: string;
let sharedPetId: string;
let duplicatePetId: string;

const staffPassword = "pet-test-password";

function makePetInput(ownerIds: string[], name = "Milo"): PetInput {
  return petSchema.parse({
    name,
    species: "cat",
    owners: ownerIds.map((customerId, index) => ({
      customerId,
      relationship: index === 0 ? "Pemilik" : "Keluarga",
      isPrimary: index === 0,
    })),
  });
}

beforeAll(async () => {
  const database = getDatabase();
  const suffix = randomUUID();
  const passwordHash = await hashPassword(staffPassword);
  const [staff] = await database
    .insert(staffUsers)
    .values({
      name: "Pet Scope Test",
      email: `pet-scope-${suffix}@example.test`,
      passwordHash,
    })
    .returning({ id: staffUsers.id });
  const [otherStaff] = await database
    .insert(staffUsers)
    .values({
      name: "Other Pet Scope Test",
      email: `other-pet-scope-${suffix}@example.test`,
      passwordHash,
    })
    .returning({ id: staffUsers.id });
  staffId = staff.id;
  otherStaffId = otherStaff.id;

  const [role] = await database
    .insert(accessRoles)
    .values({ name: `Pet Scope ${suffix}` })
    .returning({ id: accessRoles.id });
  roleId = role.id;
  await database.insert(rolePermissions).values([
    { roleId, permissionKey: "pets.read", dataScope: "own" },
    { roleId, permissionKey: "pets.manage", dataScope: "own" },
  ]);
  await database.insert(staffRoleAssignments).values({
    staffUserId: staffId,
    roleId,
    assignedBy: staffId,
  });

  const [ownCustomer, otherCustomer, anotherOwnCustomer] = await Promise.all([
    database
      .insert(customers)
      .values({
        name: "Pemilik Satu",
        phone: "081234567801",
        phoneNormalized: "6281234567801",
        createdBy: staffId,
        updatedBy: staffId,
      })
      .returning({ id: customers.id }),
    database
      .insert(customers)
      .values({
        name: "Pemilik Cabang Lain",
        phone: "081234567802",
        phoneNormalized: "6281234567802",
        createdBy: otherStaffId,
        updatedBy: otherStaffId,
      })
      .returning({ id: customers.id }),
    database
      .insert(customers)
      .values({
        name: "Pemilik Tiga",
        phone: "081234567803",
        phoneNormalized: "6281234567803",
        createdBy: staffId,
        updatedBy: staffId,
      })
      .returning({ id: customers.id }),
  ]);
  ownCustomerId = ownCustomer[0].id;
  otherCustomerId = otherCustomer[0].id;
  anotherOwnCustomerId = anotherOwnCustomer[0].id;

  const sharedPet = await createPet(
    makePetInput([ownCustomerId, otherCustomerId]),
    otherStaffId,
    "all",
  );
  sharedPetId = sharedPet.id;
  const duplicatePet = await createPet(
    makePetInput([ownCustomerId, anotherOwnCustomerId]),
    staffId,
    "own",
  );
  duplicatePetId = duplicatePet.id;
});

afterAll(async () => {
  const database = getDatabase();
  const staffIds = [staffId, otherStaffId].filter(Boolean);
  if (staffIds.length) {
    await database.delete(auditEvents).where(andActorPetEvents(staffIds));
  }
  const petIds = [sharedPetId, duplicatePetId].filter(Boolean);
  if (petIds.length) {
    await database.delete(pets).where(inArray(pets.id, petIds));
  }
  const customerIds = [ownCustomerId, otherCustomerId, anotherOwnCustomerId].filter(Boolean);
  if (customerIds.length) {
    await database.delete(customers).where(inArray(customers.id, customerIds));
  }
  if (staffId) {
    await database.delete(staffUsers).where(eq(staffUsers.id, staffId));
  }
  if (otherStaffId) {
    await database.delete(staffUsers).where(eq(staffUsers.id, otherStaffId));
  }
  if (roleId) {
    await database.delete(accessRoles).where(eq(accessRoles.id, roleId));
  }
});

function andActorPetEvents(staffIds: string[]) {
  return inArray(auditEvents.actorUserId, staffIds);
}

describe("pet ownership scope, history, merge, and audit", () => {
  it("shows a shared pet through an in-scope owner and rejects out-of-scope owners", async () => {
    const staff = { id: staffId, name: "Pet Scope Test", isOwner: false };
    await expect(authorizeStaff(staff, "pets.read")).resolves.toMatchObject({ dataScope: "own" });
    await expect(listPets(staffId, "own")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: sharedPetId })]),
    );

    await expect(
      createPet(makePetInput([ownCustomerId, otherCustomerId]), staffId, "own"),
    ).rejects.toBeInstanceOf(PetOwnersInvalidError);
  });

  it("detects likely duplicates and prevents edits outside the owner's scope", async () => {
    const matches = await findPotentialPetDuplicates(
      "milo",
      "cat",
      [ownCustomerId],
      staffId,
      "own",
    );
    expect(matches.map(({ id }) => id)).toEqual(
      expect.arrayContaining([sharedPetId, duplicatePetId]),
    );

    await expect(
      updatePet(
        sharedPetId,
        makePetInput([ownCustomerId, otherCustomerId], "Changed"),
        staffId,
        "own",
      ),
    ).rejects.toBeInstanceOf(PetOwnersInvalidError);
    await expect(
      updatePet(
        "d89b2ca1-bd1f-4457-8b64-8a512473f6c1",
        makePetInput([ownCustomerId]),
        staffId,
        "own",
      ),
    ).rejects.toBeInstanceOf(PetNotFoundError);
  });

  it("merges owners and weight history while auditing without health values", async () => {
    await addPetWeight(duplicatePetId, 5.125, "Bobot awal", staffId, "own");
    await mergePets(duplicatePetId, sharedPetId, staffId, "own");
    const weights = await getDatabase()
      .select({ petId: petWeightHistory.petId, weightKg: petWeightHistory.weightKg })
      .from(petWeightHistory)
      .where(eq(petWeightHistory.petId, sharedPetId));
    expect(weights).toEqual([{ petId: sharedPetId, weightKg: "5.125" }]);
    await expect(listPets(staffId, "own")).resolves.toEqual([
      expect.objectContaining({
        id: sharedPetId,
        owners: expect.arrayContaining([
          expect.objectContaining({ customerId: ownCustomerId }),
          expect.objectContaining({ customerId: otherCustomerId }),
          expect.objectContaining({ customerId: anotherOwnCustomerId }),
        ]),
      }),
    ]);

    const audit = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(inArray(auditEvents.action, ["pet.weight_recorded", "pet.merged"]));
    expect(audit.map(({ action }) => action)).toEqual(
      expect.arrayContaining(["pet.weight_recorded", "pet.merged"]),
    );
    expect(JSON.stringify(audit)).not.toContain("5.125");
    expect(JSON.stringify(audit)).not.toContain("Bobot awal");
  });
});
