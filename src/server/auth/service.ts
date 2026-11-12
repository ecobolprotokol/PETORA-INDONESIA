import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { getDatabase } from "@/db";
import {
  accessRoles,
  auditEvents,
  authLoginAttempts,
  authLoginChallenges,
  authSessions,
  authTotpRecoveryCodes,
  branches,
  businessSettings,
  staffRoleAssignments,
  staffUsers,
  systemState,
} from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";
import {
  createOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode,
} from "./two-factor";
import type { LoginInput, SetupInput } from "./validation";

const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
const MAX_TOTP_CHALLENGE_ATTEMPTS = 5;
const TOTP_ENROLLMENT_LIFETIME_MS = 10 * 60 * 1000;

export class OwnerAlreadyCreatedError extends Error {}

export class OwnerEmailConflictError extends Error {}

export class OwnerBranchCodeConflictError extends Error {}

export interface AuthenticatedStaff {
  id: string;
  name: string;
  isOwner: boolean;
}

export interface ActiveStaffSession {
  id: string;
  userAgent: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

interface AuthResult {
  staff: AuthenticatedStaff;
  token: string;
  expiresAt: Date;
}

interface TotpChallengeResult {
  twoFactorRequired: true;
  challengeToken: string;
}

export class TotpAlreadyEnabledError extends Error {}

export class TotpNotEnabledError extends Error {}

export class TotpEnrollmentExpiredError extends Error {}

export class TotpVerificationError extends Error {}

export class TotpRateLimitedError extends Error {}

export class TotpRequiredByRoleError extends Error {}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeUserAgent(userAgent?: string): string {
  return userAgent?.replace(/\p{Cc}/gu, "").slice(0, 512) || "Peramban web";
}

export async function getSetupStatus(): Promise<{
  ownerCreated: boolean;
  businessName: string | null;
}> {
  const [state] = await getDatabase()
    .select({
      ownerCreatedAt: systemState.ownerCreatedAt,
      businessName: systemState.businessName,
    })
    .from(systemState)
    .where(eq(systemState.id, 1))
    .limit(1);

  if (!state) {
    throw new Error("Status setup sistem tidak ditemukan. Jalankan migrasi basis data.");
  }

  return {
    ownerCreated: state.ownerCreatedAt !== null,
    businessName: state.businessName,
  };
}

export async function bootstrapOwner(input: SetupInput, userAgent?: string): Promise<AuthResult> {
  const database = getDatabase();
  const passwordHash = await hashPassword(input.password);
  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  try {
    const staff = await database.transaction(async (tx) => {
      const [state] = await tx
        .select()
        .from(systemState)
        .where(eq(systemState.id, 1))
        .for("update")
        .limit(1);

      if (!state) {
        throw new Error("Status setup sistem tidak ditemukan. Jalankan migrasi basis data.");
      }

      if (state.ownerCreatedAt) {
        throw new OwnerAlreadyCreatedError("Akun Owner sudah dibuat.");
      }

      const [owner] = await tx
        .insert(staffUsers)
        .values({
          name: input.name,
          email: input.email,
          passwordHash,
          isOwner: true,
        })
        .returning({
          id: staffUsers.id,
          name: staffUsers.name,
          isOwner: staffUsers.isOwner,
        });

      if (!owner) {
        throw new Error("Akun Owner gagal dibuat.");
      }

      const [branch] = await tx
        .insert(branches)
        .values({
          code: input.branchCode,
          name: input.branchName,
          timezone: input.timezone,
          createdBy: owner.id,
        })
        .returning({ id: branches.id });

      if (!branch) {
        throw new Error("Cabang pertama gagal dibuat.");
      }

      await tx
        .update(systemState)
        .set({
          businessName: input.businessName,
          ownerCreatedAt: new Date(),
        })
        .where(eq(systemState.id, 1));

      await tx
        .update(businessSettings)
        .set({
          defaultTimezone: input.timezone,
          locale: input.locale,
          taxEnabled: input.taxEnabled,
          taxRateBps: input.taxRateBps,
          taxIncluded: input.taxIncluded,
          updatedBy: owner.id,
          updatedAt: new Date(),
        })
        .where(eq(businessSettings.id, 1));

      await tx.insert(authSessions).values({
        userId: owner.id,
        tokenHash,
        userAgent: normalizeUserAgent(userAgent),
        expiresAt,
      });

      await tx.insert(auditEvents).values({
        actorUserId: owner.id,
        action: "setup.owner_created",
        targetType: "staff_user",
        targetId: owner.id,
      });
      await tx.insert(auditEvents).values({
        actorUserId: owner.id,
        action: "branch.created",
        targetType: "branch",
        targetId: branch.id,
        metadata: { source: "initial_setup" },
      });

      return owner;
    });

    return { staff, token, expiresAt };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505" &&
      "constraint" in error &&
      error.constraint === "staff_users_email_lower_unique"
    ) {
      throw new OwnerEmailConflictError("Email sudah digunakan.");
    }

    if (hasDatabaseConstraint(error, "branches_code_lower_unique")) {
      throw new OwnerBranchCodeConflictError("Kode cabang sudah digunakan.");
    }

    throw error;
  }
}

function hasDatabaseConstraint(error: unknown, constraint: string): boolean {
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
    cause.constraint === constraint
  );
}

async function consumeLoginAttempt(email: string): Promise<number> {
  const emailHash = hashEmail(email);
  const database = getDatabase();
  const windowExpired = sql`${authLoginAttempts.windowStartedAt} <= now() - interval '15 minutes'`;
  await database
    .delete(authLoginAttempts)
    .where(lte(authLoginAttempts.windowStartedAt, sql`now() - interval '24 hours'`));

  const [result] = await database
    .insert(authLoginAttempts)
    .values({
      emailHash,
      attemptCount: 1,
      windowStartedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: authLoginAttempts.emailHash,
      set: {
        attemptCount: sql`CASE WHEN ${windowExpired} THEN 1 ELSE ${authLoginAttempts.attemptCount} + 1 END`,
        windowStartedAt: sql`CASE WHEN ${windowExpired} THEN now() ELSE ${authLoginAttempts.windowStartedAt} END`,
      },
    })
    .returning({ attemptCount: authLoginAttempts.attemptCount });

  if (!result) {
    throw new Error("Pembatasan percobaan login gagal dicatat.");
  }

  return result.attemptCount;
}

export async function loginStaff(
  input: LoginInput,
  userAgent?: string,
): Promise<AuthResult | TotpChallengeResult | null> {
  const database = getDatabase();
  const attemptCount = await consumeLoginAttempt(input.email);

  if (attemptCount > MAX_LOGIN_ATTEMPTS) {
    return null;
  }

  const [staff] = await database
    .select({
      id: staffUsers.id,
      name: staffUsers.name,
      passwordHash: staffUsers.passwordHash,
      isOwner: staffUsers.isOwner,
      isActive: staffUsers.isActive,
      totpSecretCiphertext: staffUsers.totpSecretCiphertext,
      totpEnabledAt: staffUsers.totpEnabledAt,
    })
    .from(staffUsers)
    .where(eq(staffUsers.email, input.email))
    .limit(1);

  if (!staff) {
    await hashPassword(input.password);
    return null;
  }

  const passwordMatches = await verifyPassword(input.password, staff.passwordHash);

  if (!passwordMatches || !staff.isActive) {
    return null;
  }

  const [requiredRole] = staff.isOwner
    ? []
    : await database
        .select({ id: accessRoles.id })
        .from(staffRoleAssignments)
        .innerJoin(accessRoles, eq(staffRoleAssignments.roleId, accessRoles.id))
        .where(
          and(
            eq(staffRoleAssignments.staffUserId, staff.id),
            eq(accessRoles.isActive, true),
            eq(accessRoles.requiresTwoFactor, true),
          ),
        )
        .limit(1);

  if (requiredRole && (!staff.totpEnabledAt || !staff.totpSecretCiphertext)) {
    await database.insert(auditEvents).values({
      actorUserId: staff.id,
      action: "auth.login_blocked_2fa_required",
      targetType: "staff_user",
      targetId: staff.id,
    });
    return null;
  }

  if (staff.totpEnabledAt) {
    if (!staff.totpSecretCiphertext) {
      throw new Error("Status 2FA akun tidak konsisten: secret TOTP tidak ditemukan.");
    }

    const challengeToken = createSessionToken();
    const challengeExpiresAt = new Date(Date.now() + LOGIN_CHALLENGE_LIFETIME_MS);

    await database.transaction(async (tx) => {
      await tx
        .delete(authLoginAttempts)
        .where(eq(authLoginAttempts.emailHash, hashEmail(input.email)));
      await tx.delete(authLoginChallenges).where(lte(authLoginChallenges.expiresAt, new Date()));
      await tx.insert(authLoginChallenges).values({
        tokenHash: hashToken(challengeToken),
        userId: staff.id,
        expiresAt: challengeExpiresAt,
      });
      await tx.insert(auditEvents).values({
        actorUserId: staff.id,
        action: "auth.totp_challenge_issued",
        targetType: "staff_user",
        targetId: staff.id,
      });
    });

    return { twoFactorRequired: true, challengeToken };
  }

  const token = createSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);

  await database.transaction(async (tx) => {
    await tx
      .delete(authLoginAttempts)
      .where(eq(authLoginAttempts.emailHash, hashEmail(input.email)));
    await tx.insert(authSessions).values({
      userId: staff.id,
      tokenHash,
      userAgent: normalizeUserAgent(userAgent),
      expiresAt,
    });
    await tx.insert(auditEvents).values({
      actorUserId: staff.id,
      action: "auth.login",
      targetType: "staff_user",
      targetId: staff.id,
    });
  });

  return {
    staff: { id: staff.id, name: staff.name, isOwner: staff.isOwner },
    token,
    expiresAt,
  };
}

export async function verifyTotpLoginChallenge(
  challengeToken: string,
  code: string,
  userAgent?: string,
): Promise<AuthResult | null> {
  const database = getDatabase();
  const tokenHash = hashToken(challengeToken);

  return database.transaction(async (tx) => {
    const [challenge] = await tx
      .select({
        tokenHash: authLoginChallenges.tokenHash,
        userId: authLoginChallenges.userId,
        attemptCount: authLoginChallenges.attemptCount,
        expiresAt: authLoginChallenges.expiresAt,
        consumedAt: authLoginChallenges.consumedAt,
      })
      .from(authLoginChallenges)
      .where(eq(authLoginChallenges.tokenHash, tokenHash))
      .for("update")
      .limit(1);

    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.attemptCount >= MAX_TOTP_CHALLENGE_ATTEMPTS
    ) {
      return null;
    }

    const [staff] = await tx
      .select({
        id: staffUsers.id,
        name: staffUsers.name,
        isOwner: staffUsers.isOwner,
        isActive: staffUsers.isActive,
        totpSecretCiphertext: staffUsers.totpSecretCiphertext,
        totpEnabledAt: staffUsers.totpEnabledAt,
        totpLastUsedStep: staffUsers.totpLastUsedStep,
      })
      .from(staffUsers)
      .where(eq(staffUsers.id, challenge.userId))
      .for("update")
      .limit(1);

    if (!staff?.isActive || !staff.totpEnabledAt || !staff.totpSecretCiphertext) {
      await tx
        .update(authLoginChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(authLoginChallenges.tokenHash, tokenHash));
      return null;
    }

    const secret = decryptTotpSecret(staff.totpSecretCiphertext);
    const acceptedStep = verifyTotpCode(secret, code, Date.now(), staff.totpLastUsedStep);
    const recoveryCodeHash = acceptedStep === null ? hashRecoveryCode(code) : "";
    let usedRecoveryCode = false;

    if (acceptedStep === null && recoveryCodeHash) {
      const deletedCodes = await tx
        .delete(authTotpRecoveryCodes)
        .where(
          and(
            eq(authTotpRecoveryCodes.userId, staff.id),
            eq(authTotpRecoveryCodes.codeHash, recoveryCodeHash),
          ),
        )
        .returning({ codeHash: authTotpRecoveryCodes.codeHash });
      usedRecoveryCode = deletedCodes.length === 1;
    }

    if (acceptedStep === null && !usedRecoveryCode) {
      const attemptCount = challenge.attemptCount + 1;
      await tx
        .update(authLoginChallenges)
        .set({
          attemptCount,
          ...(attemptCount >= MAX_TOTP_CHALLENGE_ATTEMPTS ? { consumedAt: new Date() } : {}),
        })
        .where(eq(authLoginChallenges.tokenHash, tokenHash));
      return null;
    }

    if (acceptedStep !== null) {
      await tx
        .update(staffUsers)
        .set({ totpLastUsedStep: acceptedStep })
        .where(eq(staffUsers.id, staff.id));
    }

    const now = new Date();
    const token = createSessionToken();
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);

    await tx
      .update(authLoginChallenges)
      .set({ consumedAt: now })
      .where(eq(authLoginChallenges.tokenHash, tokenHash));
    await tx.insert(authSessions).values({
      userId: staff.id,
      tokenHash: hashToken(token),
      userAgent: normalizeUserAgent(userAgent),
      expiresAt,
    });
    await tx.insert(auditEvents).values({
      actorUserId: staff.id,
      action: "auth.login",
      targetType: "staff_user",
      targetId: staff.id,
      metadata: { secondFactor: usedRecoveryCode ? "recovery_code" : "totp" },
    });

    return {
      staff: { id: staff.id, name: staff.name, isOwner: staff.isOwner },
      token,
      expiresAt,
    };
  });
}

export async function getTotpStatus(userId: string): Promise<{ enabled: boolean }> {
  const [staff] = await getDatabase()
    .select({ enabledAt: staffUsers.totpEnabledAt })
    .from(staffUsers)
    .where(eq(staffUsers.id, userId))
    .limit(1);

  if (!staff) {
    throw new Error("Akun staf tidak ditemukan.");
  }

  return { enabled: staff.enabledAt !== null };
}

export async function startTotpEnrollment(
  userId: string,
): Promise<{ secret: string; otpauthUri: string }> {
  const secret = generateTotpSecret();
  const encryptedSecret = encryptTotpSecret(secret);
  const [staff] = await getDatabase()
    .update(staffUsers)
    .set({
      totpPendingSecretCiphertext: encryptedSecret,
      totpPendingExpiresAt: new Date(Date.now() + TOTP_ENROLLMENT_LIFETIME_MS),
    })
    .where(and(eq(staffUsers.id, userId), isNull(staffUsers.totpEnabledAt)))
    .returning({ email: staffUsers.email });

  if (!staff) {
    const status = await getTotpStatus(userId);
    if (status.enabled) {
      throw new TotpAlreadyEnabledError("Autentikasi dua langkah sudah aktif.");
    }
    throw new Error("Akun staf tidak ditemukan.");
  }

  return {
    secret,
    otpauthUri: createOtpAuthUri(staff.email, "PETORA INDONESIA", secret),
  };
}

export async function confirmTotpEnrollment(userId: string, code: string): Promise<string[]> {
  const rateLimitKey = `totp-enrollment:${userId}`;
  if ((await consumeLoginAttempt(rateLimitKey)) > MAX_LOGIN_ATTEMPTS) {
    throw new TotpRateLimitedError("Percobaan konfirmasi 2FA dibatasi. Coba lagi 15 menit lagi.");
  }

  const recoveryCodes = generateRecoveryCodes();
  const recoveryCodeRows = recoveryCodes.map((recoveryCode) => ({
    userId,
    codeHash: hashRecoveryCode(recoveryCode),
  }));
  const database = getDatabase();
  const rateLimitHash = hashEmail(rateLimitKey);

  await database.transaction(async (tx) => {
    const [staff] = await tx
      .select({
        pendingSecret: staffUsers.totpPendingSecretCiphertext,
        pendingExpiresAt: staffUsers.totpPendingExpiresAt,
        enabledAt: staffUsers.totpEnabledAt,
      })
      .from(staffUsers)
      .where(eq(staffUsers.id, userId))
      .for("update")
      .limit(1);

    if (!staff) {
      throw new Error("Akun staf tidak ditemukan.");
    }
    if (staff.enabledAt) {
      throw new TotpAlreadyEnabledError("Autentikasi dua langkah sudah aktif.");
    }
    if (!staff.pendingSecret || !staff.pendingExpiresAt || staff.pendingExpiresAt <= new Date()) {
      throw new TotpEnrollmentExpiredError("Pendaftaran 2FA kedaluwarsa. Mulai kembali.");
    }

    const secret = decryptTotpSecret(staff.pendingSecret);
    const acceptedStep = verifyTotpCode(secret, code);

    if (acceptedStep === null) {
      throw new TotpVerificationError("Kode autentikator tidak valid.");
    }

    await tx
      .update(staffUsers)
      .set({
        totpSecretCiphertext: staff.pendingSecret,
        totpPendingSecretCiphertext: null,
        totpPendingExpiresAt: null,
        totpEnabledAt: new Date(),
        totpLastUsedStep: acceptedStep,
      })
      .where(eq(staffUsers.id, userId));
    await tx.insert(authTotpRecoveryCodes).values(recoveryCodeRows);
    await tx.insert(auditEvents).values({
      actorUserId: userId,
      action: "auth.totp_enabled",
      targetType: "staff_user",
      targetId: userId,
    });
    await tx.delete(authLoginAttempts).where(eq(authLoginAttempts.emailHash, rateLimitHash));
  });

  return recoveryCodes;
}

export async function disableTotp(userId: string, password: string, code: string): Promise<void> {
  const rateLimitKey = `totp-disable:${userId}`;
  if ((await consumeLoginAttempt(rateLimitKey)) > MAX_LOGIN_ATTEMPTS) {
    throw new TotpRateLimitedError(
      "Percobaan menonaktifkan 2FA dibatasi. Coba lagi 15 menit lagi.",
    );
  }

  const database = getDatabase();
  const rateLimitHash = hashEmail(rateLimitKey);

  try {
    await database.transaction(async (tx) => {
      const [staff] = await tx
        .select({
          passwordHash: staffUsers.passwordHash,
          totpSecretCiphertext: staffUsers.totpSecretCiphertext,
          totpEnabledAt: staffUsers.totpEnabledAt,
          totpLastUsedStep: staffUsers.totpLastUsedStep,
        })
        .from(staffUsers)
        .where(eq(staffUsers.id, userId))
        .for("update")
        .limit(1);

      if (!staff?.totpEnabledAt || !staff.totpSecretCiphertext) {
        throw new TotpNotEnabledError("Autentikasi dua langkah belum aktif.");
      }
      if (!(await verifyPassword(password, staff.passwordHash))) {
        throw new TotpVerificationError("Kata sandi atau kode autentikator tidak valid.");
      }

      const [requiredRole] = await tx
        .select({ id: accessRoles.id })
        .from(staffRoleAssignments)
        .innerJoin(accessRoles, eq(staffRoleAssignments.roleId, accessRoles.id))
        .where(
          and(
            eq(staffRoleAssignments.staffUserId, userId),
            eq(accessRoles.isActive, true),
            eq(accessRoles.requiresTwoFactor, true),
          ),
        )
        .limit(1);

      if (requiredRole) {
        throw new TotpRequiredByRoleError(
          "2FA tidak dapat dinonaktifkan selama Anda memiliki peran yang mewajibkannya.",
        );
      }

      const secret = decryptTotpSecret(staff.totpSecretCiphertext);
      const acceptedStep = verifyTotpCode(secret, code, Date.now(), staff.totpLastUsedStep);
      const recoveryCodeHash = acceptedStep === null ? hashRecoveryCode(code) : "";
      let usedRecoveryCode = false;

      if (acceptedStep === null && recoveryCodeHash) {
        const deletedCodes = await tx
          .delete(authTotpRecoveryCodes)
          .where(
            and(
              eq(authTotpRecoveryCodes.userId, userId),
              eq(authTotpRecoveryCodes.codeHash, recoveryCodeHash),
            ),
          )
          .returning({ codeHash: authTotpRecoveryCodes.codeHash });
        usedRecoveryCode = deletedCodes.length === 1;
      }

      if (acceptedStep === null && !usedRecoveryCode) {
        throw new TotpVerificationError("Kata sandi atau kode autentikator tidak valid.");
      }

      const now = new Date();
      await tx
        .update(staffUsers)
        .set({
          totpSecretCiphertext: null,
          totpPendingSecretCiphertext: null,
          totpPendingExpiresAt: null,
          totpEnabledAt: null,
          totpLastUsedStep: -1,
        })
        .where(eq(staffUsers.id, userId));
      await tx.delete(authTotpRecoveryCodes).where(eq(authTotpRecoveryCodes.userId, userId));
      await tx
        .update(authSessions)
        .set({ revokedAt: now })
        .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        action: "auth.totp_disabled",
        targetType: "staff_user",
        targetId: userId,
        metadata: { verification: usedRecoveryCode ? "recovery_code" : "totp" },
      });
      await tx.delete(authLoginAttempts).where(eq(authLoginAttempts.emailHash, rateLimitHash));
    });
  } catch (error) {
    if (error instanceof TotpVerificationError) {
      throw new TotpVerificationError("Kata sandi atau kode autentikator tidak valid.");
    }
    if (error instanceof TotpNotEnabledError || error instanceof TotpRequiredByRoleError) {
      await database
        .delete(authLoginAttempts)
        .where(eq(authLoginAttempts.emailHash, rateLimitHash));
    }
    throw error;
  }
}

export async function getStaffSession(token: string): Promise<AuthenticatedStaff | null> {
  const database = getDatabase();
  const tokenHash = hashToken(token);
  const [staff] = await database
    .select({
      sessionId: authSessions.id,
      id: staffUsers.id,
      name: staffUsers.name,
      isOwner: staffUsers.isOwner,
    })
    .from(authSessions)
    .innerJoin(staffUsers, eq(authSessions.userId, staffUsers.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
        eq(staffUsers.isActive, true),
      ),
    )
    .limit(1);

  if (!staff) {
    return null;
  }

  await database
    .update(authSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(authSessions.id, staff.sessionId));

  return { id: staff.id, name: staff.name, isOwner: staff.isOwner };
}

export async function listStaffSessions(
  userId: string,
  currentToken: string,
): Promise<ActiveStaffSession[]> {
  const sessions = await getDatabase()
    .select({
      id: authSessions.id,
      tokenHash: authSessions.tokenHash,
      userAgent: authSessions.userAgent,
      createdAt: authSessions.createdAt,
      lastSeenAt: authSessions.lastSeenAt,
      expiresAt: authSessions.expiresAt,
    })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.userId, userId),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(sql`${authSessions.lastSeenAt} DESC`);
  const currentTokenHash = hashToken(currentToken);

  return sessions.map(({ tokenHash, ...session }) => ({
    ...session,
    isCurrent: tokenHash === currentTokenHash,
  }));
}

export async function revokeStaffSessionById(
  userId: string,
  sessionId: string,
  currentToken: string,
): Promise<{ revoked: boolean; isCurrent: boolean }> {
  const currentTokenHash = hashToken(currentToken);

  return getDatabase().transaction(async (tx) => {
    const [session] = await tx
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, new Date()),
        ),
      )
      .returning({ tokenHash: authSessions.tokenHash });

    if (!session) {
      return { revoked: false, isCurrent: false };
    }

    await tx.insert(auditEvents).values({
      actorUserId: userId,
      action: "auth.session_revoked",
      targetType: "auth_session",
      targetId: sessionId,
    });

    return {
      revoked: true,
      isCurrent: session.tokenHash === currentTokenHash,
    };
  });
}

export async function revokeStaffSession(token: string): Promise<void> {
  const database = getDatabase();
  const tokenHash = hashToken(token);

  await database.transaction(async (tx) => {
    const [session] = await tx
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)))
      .returning({ userId: authSessions.userId });

    if (!session) {
      return;
    }

    await tx.insert(auditEvents).values({
      actorUserId: session.userId,
      action: "auth.logout",
      targetType: "staff_user",
      targetId: session.userId,
    });
  });
}
