import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizeStaff } from "@/server/access/service";
import { SESSION_COOKIE_NAME } from "@/server/auth/cookies";
import { getStaffSession } from "@/server/auth/service";
import { apiError, hasSameOrigin } from "@/server/http";
import { addPetWeight, listPetWeights, PetNotFoundError } from "@/server/pets/service";
import { petWeightSchema } from "@/server/pets/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ petId: string }> }) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "pets.read");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin melihat riwayat berat hewan.", 403);
  }
  const { petId } = await context.params;
  const parsedId = z.string().uuid().safeParse(petId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID hewan tidak valid.", 400);
  }
  try {
    return NextResponse.json({
      weights: await listPetWeights(parsedId.data, staff.id, grant.dataScope),
    });
  } catch (error) {
    if (error instanceof PetNotFoundError) {
      return apiError("PET_NOT_FOUND", "Hewan tidak ditemukan.", 404);
    }
    throw error;
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ petId: string }> }) {
  if (!hasSameOrigin(request)) {
    return apiError("ORIGIN_INVALID", "Permintaan tidak dapat diverifikasi.", 403);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const staff = token ? await getStaffSession(token) : null;
  if (!staff) {
    return apiError("UNAUTHENTICATED", "Silakan masuk terlebih dahulu.", 401);
  }
  const grant = await authorizeStaff(staff, "pets.manage");
  if (!grant) {
    return apiError("FORBIDDEN", "Anda tidak memiliki izin mencatat berat hewan.", 403);
  }

  const { petId } = await context.params;
  const parsedId = z.string().uuid().safeParse(petId);
  if (!parsedId.success) {
    return apiError("INPUT_INVALID", "ID hewan tidak valid.", 400);
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = petWeightSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INPUT_INVALID",
      "Berat hewan harus lebih dari nol dan paling banyak 1.000 kg.",
      400,
    );
  }

  try {
    const weight = await addPetWeight(
      parsedId.data,
      parsed.data.weightKg,
      parsed.data.note ?? null,
      staff.id,
      grant.dataScope,
    );
    return NextResponse.json({ weight }, { status: 201 });
  } catch (error) {
    if (error instanceof PetNotFoundError) {
      return apiError("PET_NOT_FOUND", "Hewan tidak ditemukan.", 404);
    }
    throw error;
  }
}
