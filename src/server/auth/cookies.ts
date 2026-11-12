import { cookies } from "next/headers";
import { type AuthenticatedStaff, getStaffSession, listStaffSessions } from "./service";

export const SESSION_COOKIE_NAME = "petora_staff_session";
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function getCurrentStaff(): Promise<AuthenticatedStaff | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? getStaffSession(token) : null;
}

export async function getCurrentStaffSessions(staffUserId: string) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? listStaffSessions(staffUserId, token) : [];
}
