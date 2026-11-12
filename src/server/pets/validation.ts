import { z } from "zod";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .or(z.literal(""))
    .nullable()
    .optional()
    .transform((value) => value || null);

export const petOwnerSchema = z.object({
  customerId: z.string().uuid(),
  relationship: z.string().trim().min(1).max(60).default("owner"),
  isPrimary: z.boolean(),
});

export const petSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    species: z.enum(["dog", "cat", "bird", "small_mammal", "reptile", "other"]),
    breed: nullableText(120),
    sex: z.enum(["male", "female", "unknown"]).default("unknown"),
    birthDate: z
      .string()
      .date()
      .nullable()
      .optional()
      .transform((value) => value || null),
    estimatedAgeMonths: z.number().int().min(0).max(2400).nullable().optional(),
    color: nullableText(120),
    microchipNumber: nullableText(80),
    photoUrl: z
      .string()
      .trim()
      .url()
      .max(2048)
      .or(z.literal(""))
      .nullable()
      .optional()
      .transform((value) => value || null),
    isSterilized: z.boolean().default(false),
    allergies: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
    behaviorNotes: nullableText(4000),
    status: z.enum(["active", "deceased", "transferred"]).default("active"),
    owners: z
      .array(petOwnerSchema)
      .min(1)
      .max(20)
      .refine((owners) => owners.filter(({ isPrimary }) => isPrimary).length === 1)
      .refine(
        (owners) => new Set(owners.map(({ customerId }) => customerId)).size === owners.length,
      ),
  })
  .strict();

export const petWeightSchema = z.object({
  weightKg: z.number().positive().max(1000),
  note: nullableText(500),
});

export const petMergeSchema = z
  .object({
    duplicatePetId: z.string().uuid(),
    keepPetId: z.string().uuid(),
  })
  .refine(({ duplicatePetId, keepPetId }) => duplicatePetId !== keepPetId);

export type PetInput = z.infer<typeof petSchema>;
