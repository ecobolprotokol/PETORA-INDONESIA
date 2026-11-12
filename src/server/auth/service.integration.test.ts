import { createHmac } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DELETE as removePermissionOverrideRoute } from "@/app/api/access/permission-overrides/[overrideId]/route";
import {
  GET as listPermissionOverridesRoute,
  POST as setPermissionOverrideRoute,
} from "@/app/api/access/permission-overrides/route";
import { POST as assignAccessRoleRoute } from "@/app/api/access/role-assignments/route";
import { PATCH as patchAccessRoleRoute } from "@/app/api/access/roles/[roleId]/route";
import {
  POST as createAccessRoleRoute,
  GET as listAccessRolesRoute,
} from "@/app/api/access/roles/route";
import { GET as listAuditRoute } from "@/app/api/audit/route";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import {
  GET as listDevicesRoute,
  DELETE as revokeDeviceRoute,
} from "@/app/api/auth/sessions/route";
import { POST as totpChallengeRoute } from "@/app/api/auth/totp/challenge/route";
import { POST as confirmTotpRoute } from "@/app/api/auth/totp/confirm/route";
import { POST as disableTotpRoute } from "@/app/api/auth/totp/disable/route";
import { POST as enrollTotpRoute } from "@/app/api/auth/totp/route";
import { POST as createBranchRoute, GET as listBranchesRoute } from "@/app/api/branches/route";
import { DELETE as deleteCustomerSamplesRoute } from "@/app/api/customers/samples/route";
import { PATCH as updateDocumentSettingsRoute } from "@/app/api/settings/document-numbering/route";
import { GET as getSettingsRoute, PATCH as updateSettingsRoute } from "@/app/api/settings/route";
import { GET as getSetupReadinessRoute } from "@/app/api/setup/readiness/route";
import { POST as setupRoute } from "@/app/api/setup/route";
import { PATCH as updateStaffRoute } from "@/app/api/staff/[staffUserId]/route";
import { POST as createStaffRoute, GET as listStaffRoute } from "@/app/api/staff/route";
import { closeDatabase, getDatabase } from "@/db";
import {
  accessRoles,
  auditEvents,
  authLoginAttempts,
  authLoginChallenges,
  authSessions,
  authTotpRecoveryCodes,
  branches,
  businessSettings,
  customers,
  documentNumberSequences,
  rolePermissions,
  staffNotifications,
  staffPermissionOverrides,
  staffRoleAssignments,
  staffUsers,
  systemModuleFeatures,
  systemState,
} from "@/db/schema";
import {
  assignAccessRole,
  authorizeStaff,
  createAccessRole,
  listAccessRoles,
  listBranchesForStaff,
  listPermissionOverrides,
  TwoFactorEnrollmentRequiredError,
} from "@/server/access/service";
import { createBranch } from "@/server/branches/service";
import { listStaffNotifications, startNotificationWorker } from "@/server/notifications/queue";
import { nextDocumentNumber } from "@/server/settings/numbering";
import { getBusinessSettings } from "@/server/settings/service";
import { listStaffUsers } from "@/server/staff/service";
import { SESSION_COOKIE_NAME } from "./cookies";
import { hashPassword } from "./password";
import {
  bootstrapOwner,
  disableTotp,
  getSetupStatus,
  getStaffSession,
  listStaffSessions,
  loginStaff,
  OwnerAlreadyCreatedError,
  revokeStaffSession,
  TotpRequiredByRoleError,
} from "./service";

const setupInput = {
  businessName: "Klinik Hewan PETORA",
  branchName: "Klinik Jakarta",
  branchCode: "JKT-01",
  timezone: "Asia/Jakarta",
  locale: "id-ID" as const,
  taxEnabled: false,
  taxRateBps: 0,
  taxIncluded: false,
  name: "Pemilik PETORA",
  email: "owner@example.test",
  password: "kata-sandi-pemilik-aman",
};

const originalTotpEncryptionKey = process.env.TOTP_ENCRYPTION_KEY;

beforeAll(() => {
  process.env.TOTP_ENCRYPTION_KEY = "c".repeat(64);
});

afterAll(async () => {
  await closeDatabase();
  if (originalTotpEncryptionKey === undefined) {
    delete process.env.TOTP_ENCRYPTION_KEY;
  } else {
    process.env.TOTP_ENCRYPTION_KEY = originalTotpEncryptionKey;
  }
});

async function clearTestData() {
  const database = getDatabase();
  // The dedicated test database disables the guard only while removing fixture accounts.
  await database.execute(sql`ALTER TABLE staff_users DISABLE TRIGGER staff_users_protect_owner`);

  try {
    await database.delete(customers);
    await database.delete(staffRoleAssignments);
    await database.delete(staffPermissionOverrides);
    await database.delete(rolePermissions);
    await database.delete(accessRoles);
    await database.delete(documentNumberSequences);
    await database.delete(branches);
    await database.delete(auditEvents);
    await database.delete(authLoginChallenges);
    await database.delete(authTotpRecoveryCodes);
    await database.delete(authSessions);
    await database.delete(authLoginAttempts);
    await database.delete(staffUsers);
    await database
      .update(systemState)
      .set({ businessName: null, ownerCreatedAt: null })
      .where(eq(systemState.id, 1));
    await database
      .update(businessSettings)
      .set({
        defaultTimezone: "Asia/Jakarta",
        locale: "id-ID",
        taxEnabled: false,
        taxRateBps: 0,
        taxIncluded: false,
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        primaryColor: "#1E765D",
        theme: "system",
        updatedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(businessSettings.id, 1));
    await database
      .update(systemModuleFeatures)
      .set({ isEnabled: false, updatedBy: null, updatedAt: new Date() });
    await database.insert(documentNumberSequences).values([
      { documentType: "invoice", prefix: "INV", nextNumber: 1, minimumWidth: 5 },
      { documentType: "purchase_order", prefix: "PO", nextNumber: 1, minimumWidth: 5 },
      { documentType: "receipt", prefix: "RCP", nextNumber: 1, minimumWidth: 5 },
    ]);
  } finally {
    await database.execute(sql`ALTER TABLE staff_users ENABLE TRIGGER staff_users_protect_owner`);
  }
}

function currentTotpCode(secret: string, stepOffset = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const secretBytes: number[] = [];

  for (const character of secret) {
    value = (value << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      secretBytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + stepOffset));
  const digest = createHmac("sha1", Buffer.from(secretBytes)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary =
    ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255);

  return String(binary % 1_000_000).padStart(6, "0");
}

function jsonRequest(
  path: string,
  body: unknown,
  cookie?: string,
  method: "POST" | "PATCH" | "DELETE" = "POST",
): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("staff authentication with PostgreSQL", () => {
  afterEach(clearTestData);
  it("enforces delegated access, settings, and audit permissions on their APIs", async () => {
    await clearTestData();

    const owner = await bootstrapOwner(setupInput);
    const password = "kata-sandi-staf-yang-aman";
    const [adminStaff, regularStaff] = await getDatabase()
      .insert(staffUsers)
      .values([
        {
          name: "Admin PETORA",
          email: "admin@example.test",
          passwordHash: await hashPassword(password),
        },
        {
          name: "Staf PETORA",
          email: "staff@example.test",
          passwordHash: await hashPassword(password),
        },
      ])
      .returning({ id: staffUsers.id });
    if (!adminStaff || !regularStaff) {
      throw new Error("Akun staf tes gagal dibuat.");
    }

    const adminRole = await createAccessRole(
      {
        name: "Super Admin Delegasi",
        description: "",
        requiresTwoFactor: false,
        permissions: [
          { key: "access.manage", dataScope: "all" },
          { key: "audit.read", dataScope: "all" },
          { key: "settings.manage", dataScope: "all" },
        ],
      },
      owner.staff.id,
    );
    await assignAccessRole(
      { staffUserId: adminStaff.id, roleId: adminRole.id, branchId: null },
      owner.staff.id,
    );
    const [roleNotification] = await getDatabase()
      .select({
        title: staffNotifications.title,
        body: staffNotifications.body,
        status: staffNotifications.status,
      })
      .from(staffNotifications)
      .where(eq(staffNotifications.recipientUserId, adminStaff.id))
      .limit(1);
    expect(roleNotification).toEqual({
      title: "Peran diperbarui",
      body: "Peran Super Admin Delegasi telah ditugaskan ke akun Anda.",
      status: "queued",
    });
    await startNotificationWorker();
    let inbox = await listStaffNotifications(adminStaff.id);
    for (let attempt = 0; attempt < 60 && inbox[0]?.status === "queued"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      inbox = await listStaffNotifications(adminStaff.id);
    }
    expect(inbox[0]?.status).toBe("delivered");
    const adminLogin = await loginStaff({ email: "admin@example.test", password });
    const regularLogin = await loginStaff({ email: "staff@example.test", password });
    if (
      !adminLogin ||
      "twoFactorRequired" in adminLogin ||
      !regularLogin ||
      "twoFactorRequired" in regularLogin
    ) {
      throw new Error("Login staf tes seharusnya berhasil.");
    }

    const adminCookie = `${SESSION_COOKIE_NAME}=${adminLogin.token}`;
    const regularCookie = `${SESSION_COOKIE_NAME}=${regularLogin.token}`;
    const apiRequest = (path: string, cookie: string) =>
      new NextRequest(`http://localhost${path}`, {
        headers: { Cookie: cookie },
      });

    expect((await listStaffRoute(apiRequest("/api/staff", adminCookie))).status).toBe(200);
    expect((await listAccessRolesRoute(apiRequest("/api/access/roles", adminCookie))).status).toBe(
      200,
    );
    expect((await getSettingsRoute(apiRequest("/api/settings", adminCookie))).status).toBe(200);
    expect((await listAuditRoute(apiRequest("/api/audit", adminCookie))).status).toBe(200);

    expect((await listStaffRoute(apiRequest("/api/staff", regularCookie))).status).toBe(403);
    expect(
      (await listAccessRolesRoute(apiRequest("/api/access/roles", regularCookie))).status,
    ).toBe(403);
    expect((await getSettingsRoute(apiRequest("/api/settings", regularCookie))).status).toBe(403);
    expect((await listAuditRoute(apiRequest("/api/audit", regularCookie))).status).toBe(403);
  });

  it("bootstraps one Owner, logs in, throttles failures, revokes sessions, and audits actions", async () => {
    await clearTestData();

    const readinessResponse = await getSetupReadinessRoute();
    expect(readinessResponse.status).toBe(200);
    await expect(readinessResponse.json()).resolves.toMatchObject({
      ready: true,
      database: true,
    });

    const setup = await bootstrapOwner(setupInput);
    expect(await getSetupStatus()).toEqual({
      ownerCreated: true,
      businessName: setupInput.businessName,
    });
    await expect(
      getDatabase()
        .select({
          code: branches.code,
          name: branches.name,
          timezone: branches.timezone,
        })
        .from(branches),
    ).resolves.toEqual([
      {
        code: setupInput.branchCode,
        name: setupInput.branchName,
        timezone: setupInput.timezone,
      },
    ]);
    await expect(getStaffSession(setup.token)).resolves.toMatchObject({
      id: setup.staff.id,
      isOwner: true,
    });
    await expect(bootstrapOwner(setupInput)).rejects.toBeInstanceOf(OwnerAlreadyCreatedError);

    await expect(
      getDatabase().delete(staffUsers).where(eq(staffUsers.id, setup.staff.id)),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "staff_users_owner_protected" },
    });
    await expect(
      getDatabase()
        .update(staffUsers)
        .set({ isOwner: false })
        .where(eq(staffUsers.id, setup.staff.id)),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "staff_users_owner_protected" },
    });
    await expect(
      getDatabase()
        .update(staffUsers)
        .set({ isActive: false })
        .where(eq(staffUsers.id, setup.staff.id)),
    ).rejects.toMatchObject({
      cause: { code: "23514", constraint: "staff_users_owner_protected" },
    });

    const [regularStaff] = await getDatabase()
      .insert(staffUsers)
      .values({
        name: "Staf PETORA",
        email: "staff@example.test",
        passwordHash: "unused-test-hash",
      })
      .returning({ id: staffUsers.id });
    expect(regularStaff).toBeDefined();
    if (!regularStaff) {
      throw new Error("Akun staf tes gagal dibuat.");
    }

    await expect(
      getDatabase()
        .delete(staffUsers)
        .where(eq(staffUsers.id, regularStaff.id))
        .returning({ id: staffUsers.id }),
    ).resolves.toHaveLength(1);

    const invalidLogin = {
      email: setupInput.email,
      password: "kata-sandi-yang-salah",
    };
    await expect(loginStaff(invalidLogin)).resolves.toBeNull();

    const login = await loginStaff(setupInput);
    if (!login || "twoFactorRequired" in login) {
      throw new Error("Login dengan kredensial yang benar seharusnya berhasil.");
    }

    expect(login.staff.id).toBe(setup.staff.id);
    await revokeStaffSession(login.token);
    await revokeStaffSession(login.token);
    await expect(getStaffSession(login.token)).resolves.toBeNull();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(loginStaff(invalidLogin)).resolves.toBeNull();
    }
    await expect(loginStaff(setupInput)).resolves.toBeNull();

    const actions = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents);
    expect(actions.map(({ action }) => action)).toEqual(
      expect.arrayContaining(["setup.owner_created", "auth.login", "auth.logout"]),
    );
    expect(actions.filter(({ action }) => action === "auth.logout")).toHaveLength(1);
    expect(actions.find(({ action }) => action === "branch.created")?.metadata).toEqual({
      source: "initial_setup",
    });
    expect(
      actions
        .filter(({ action }) => action !== "branch.created")
        .every(({ metadata }) => Object.keys(metadata).length === 0),
    ).toBe(true);
  });

  it("loads optional customer samples during setup and lets only the Owner clear them", async () => {
    await clearTestData();

    const setup = await bootstrapOwner({ ...setupInput, includeSampleData: true });
    const database = getDatabase();
    const initialCustomers = await database
      .select({
        name: customers.name,
        isSample: customers.isSample,
        createdBy: customers.createdBy,
      })
      .from(customers)
      .orderBy(customers.name);
    expect(initialCustomers).toEqual([
      { name: "Pelanggan Contoh 1", isSample: true, createdBy: setup.staff.id },
      { name: "Pelanggan Contoh 2", isSample: true, createdBy: setup.staff.id },
    ]);

    await database.insert(customers).values({
      name: "Pelanggan Reguler",
      phone: "081234567899",
      createdBy: setup.staff.id,
      updatedBy: setup.staff.id,
    });

    const [regularStaff] = await database
      .insert(staffUsers)
      .values({
        name: "Staf Non-Owner",
        email: "non-owner-sample-test@example.test",
        passwordHash: await hashPassword("kata-sandi-staf-yang-aman"),
      })
      .returning({ id: staffUsers.id });
    if (!regularStaff) {
      throw new Error("Akun staf tes gagal dibuat.");
    }
    const regularLogin = await loginStaff({
      email: "non-owner-sample-test@example.test",
      password: "kata-sandi-staf-yang-aman",
    });
    if (!regularLogin || "twoFactorRequired" in regularLogin) {
      throw new Error("Login staf tes seharusnya berhasil.");
    }

    const forbiddenResponse = await deleteCustomerSamplesRoute(
      jsonRequest(
        "/api/customers/samples",
        {},
        `${SESSION_COOKIE_NAME}=${regularLogin.token}`,
        "DELETE",
      ),
    );
    expect(forbiddenResponse.status).toBe(403);

    const ownerCookie = `${SESSION_COOKIE_NAME}=${setup.token}`;
    const clearResponse = await deleteCustomerSamplesRoute(
      jsonRequest("/api/customers/samples", {}, ownerCookie, "DELETE"),
    );
    expect(clearResponse.status).toBe(200);
    await expect(clearResponse.json()).resolves.toEqual({ deleted: 2 });
    await expect(
      database.select({ name: customers.name, isSample: customers.isSample }).from(customers),
    ).resolves.toEqual([{ name: "Pelanggan Reguler", isSample: false }]);

    const sampleAudit = await database
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(
        inArray(auditEvents.action, ["setup.sample_data_loaded", "setup.sample_data_cleared"]),
      );
    expect(sampleAudit.map(({ action }) => action).sort()).toEqual([
      "setup.sample_data_cleared",
      "setup.sample_data_loaded",
    ]);
    expect(sampleAudit.every(({ metadata }) => metadata.customers === "2")).toBe(true);
  });

  it("returns the tightest financial limits and combined supervisor PIN policy", async () => {
    await clearTestData();

    const owner = await bootstrapOwner(setupInput);
    const [staff] = await getDatabase()
      .insert(staffUsers)
      .values({
        name: "Staf Kasir",
        email: "cashier-policy@example.test",
        passwordHash: await hashPassword("kata-sandi-staf-yang-aman"),
      })
      .returning({ id: staffUsers.id, name: staffUsers.name });
    if (!staff) {
      throw new Error("Akun staf tes gagal dibuat.");
    }

    const firstRole = await createAccessRole(
      {
        name: "Kasir dengan batas awal",
        description: "",
        requiresTwoFactor: false,
        permissions: [
          {
            key: "customers.manage",
            dataScope: "all",
            maxDiscountBps: 1_000,
            maxRefundCents: 25_000,
            maxVoidCents: 30_000,
            maxTransferCents: 40_000,
            requiresSupervisorPin: true,
          },
        ],
      },
      owner.staff.id,
    );
    const secondRole = await createAccessRole(
      {
        name: "Kasir dengan batas ketat",
        description: "",
        requiresTwoFactor: false,
        permissions: [
          {
            key: "customers.manage",
            dataScope: "own",
            maxDiscountBps: 800,
            maxRefundCents: null,
            maxVoidCents: 10_000,
            maxTransferCents: null,
            requiresSupervisorPin: false,
          },
        ],
      },
      owner.staff.id,
    );
    await assignAccessRole(
      { staffUserId: staff.id, roleId: firstRole.id, branchId: null },
      owner.staff.id,
    );
    await assignAccessRole(
      { staffUserId: staff.id, roleId: secondRole.id, branchId: null },
      owner.staff.id,
    );
    await getDatabase().insert(staffPermissionOverrides).values({
      staffUserId: staff.id,
      permissionKey: "customers.manage",
      effect: "allow",
      dataScope: "own",
      maxDiscountBps: 500,
      maxRefundCents: 20_000,
      maxVoidCents: null,
      maxTransferCents: null,
      requiresSupervisorPin: false,
      reason: "Batas individu lebih ketat",
      createdBy: owner.staff.id,
      updatedBy: owner.staff.id,
    });

    await expect(
      authorizeStaff({ id: staff.id, name: staff.name, isOwner: false }, "customers.manage"),
    ).resolves.toEqual({
      dataScope: "all",
      branchScope: "all",
      maxDiscountBps: 500,
      maxRefundCents: 20_000,
      maxVoidCents: 10_000,
      maxTransferCents: 40_000,
      requiresSupervisorPin: true,
    });
  });

  it("serves the Owner audit log with stable cursor pagination and access control", async () => {
    await clearTestData();
    const owner = await bootstrapOwner(setupInput);
    const ownerCookie = `${SESSION_COOKIE_NAME}=${owner.token}`;

    const firstPageResponse = await listAuditRoute(
      new NextRequest("http://localhost/api/audit?limit=1", {
        headers: { Cookie: ownerCookie },
      }),
    );
    expect(firstPageResponse.status).toBe(200);
    const firstPage: unknown = await firstPageResponse.json();
    if (
      typeof firstPage !== "object" ||
      firstPage === null ||
      !("events" in firstPage) ||
      !Array.isArray(firstPage.events) ||
      !("nextCursor" in firstPage) ||
      typeof firstPage.nextCursor !== "string"
    ) {
      throw new Error("Respons halaman pertama audit tidak valid.");
    }
    expect(firstPage.events).toHaveLength(1);

    const secondPageResponse = await listAuditRoute(
      new NextRequest(
        `http://localhost/api/audit?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
        { headers: { Cookie: ownerCookie } },
      ),
    );
    expect(secondPageResponse.status).toBe(200);
    const secondPage: unknown = await secondPageResponse.json();
    if (
      typeof secondPage !== "object" ||
      secondPage === null ||
      !("events" in secondPage) ||
      !Array.isArray(secondPage.events)
    ) {
      throw new Error("Respons halaman kedua audit tidak valid.");
    }
    expect(secondPage.events).toHaveLength(1);
    expect(secondPage.events[0]).not.toEqual(firstPage.events[0]);

    const invalidCursorResponse = await listAuditRoute(
      new NextRequest("http://localhost/api/audit?cursor=tidak-valid", {
        headers: { Cookie: ownerCookie },
      }),
    );
    expect(invalidCursorResponse.status).toBe(400);
    const invalidLimitResponse = await listAuditRoute(
      new NextRequest("http://localhost/api/audit?limit=101", {
        headers: { Cookie: ownerCookie },
      }),
    );
    expect(invalidLimitResponse.status).toBe(400);

    const staffPassword = "kata-sandi-staf-yang-aman";
    await createStaffRoute(
      jsonRequest(
        "/api/staff",
        { name: "Staf Audit", email: "audit-staff@example.test", password: staffPassword },
        ownerCookie,
      ),
    );
    const staffLogin = await loginStaff({
      email: "audit-staff@example.test",
      password: staffPassword,
    });
    if (!staffLogin || "twoFactorRequired" in staffLogin) {
      throw new Error("Login staf untuk uji akses audit gagal.");
    }
    const forbiddenResponse = await listAuditRoute(
      new NextRequest("http://localhost/api/audit", {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${staffLogin.token}` },
      }),
    );
    expect(forbiddenResponse.status).toBe(403);
  });

  it("serves setup/login/logout over the API and rejects a cross-origin setup request", async () => {
    await clearTestData();

    const rejectedSetup = await setupRoute(
      new NextRequest("http://localhost/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
        },
        body: JSON.stringify(setupInput),
      }),
    );
    expect(rejectedSetup.status).toBe(403);

    const setupResponse = await setupRoute(jsonRequest("/api/setup", setupInput));
    expect(setupResponse.status).toBe(200);
    expect(setupResponse.cookies.get(SESSION_COOKIE_NAME)?.httpOnly).toBe(true);

    const loginResponse = await loginRoute(jsonRequest("/api/auth/login", setupInput));
    expect(loginResponse.status).toBe(200);
    const sessionToken = loginResponse.cookies.get(SESSION_COOKIE_NAME)?.value;
    expect(sessionToken).toBeTruthy();

    if (!sessionToken) {
      throw new Error("Respons login tidak menerbitkan cookie sesi.");
    }

    const setupSessionToken = setupResponse.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!setupSessionToken) {
      throw new Error("Setup tidak menerbitkan cookie sesi.");
    }

    const ownerSession = await getStaffSession(sessionToken);
    if (!ownerSession) {
      throw new Error("Sesi Owner dari login tidak ditemukan.");
    }

    const sessionCookie = `${SESSION_COOKIE_NAME}=${sessionToken}`;
    const deviceListResponse = await listDevicesRoute(
      new NextRequest("http://localhost/api/auth/sessions", {
        headers: { Cookie: sessionCookie },
      }),
    );
    expect(deviceListResponse.status).toBe(200);
    const listedDevices = await deviceListResponse.json();
    expect(listedDevices.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: "Peramban web", isCurrent: true }),
        expect.objectContaining({ userAgent: "Peramban web", isCurrent: false }),
      ]),
    );
    expect(JSON.stringify(listedDevices)).not.toContain("tokenHash");

    const activeSessions = await listStaffSessions(ownerSession.id, sessionToken);
    const previousSession = activeSessions.find(({ isCurrent }) => !isCurrent);
    if (!previousSession) {
      throw new Error("Sesi setup seharusnya terdaftar sebagai perangkat lain.");
    }

    const revokeDeviceResponse = await revokeDeviceRoute(
      new NextRequest("http://localhost/api/auth/sessions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ sessionId: previousSession.id }),
      }),
    );
    expect(revokeDeviceResponse.status).toBe(200);
    await expect(getStaffSession(setupSessionToken)).resolves.toBeNull();

    const staffPassword = "kata-sandi-staf-yang-aman";
    const ownerCookie = sessionCookie;
    const staffInput = {
      name: "Staf PETORA",
      email: "staff@example.test",
      password: staffPassword,
    };
    const createStaffResponse = await createStaffRoute(
      jsonRequest("/api/staff", staffInput, ownerCookie),
    );
    expect(createStaffResponse.status).toBe(201);
    const staff = (await listStaffUsers()).find(({ email }) => email === staffInput.email);
    if (!staff) {
      throw new Error("Akun staf yang dibuat melalui API tidak ditemukan.");
    }

    const duplicateStaffResponse = await createStaffRoute(
      jsonRequest("/api/staff", staffInput, ownerCookie),
    );
    expect(duplicateStaffResponse.status).toBe(409);

    const staffLogin = await loginStaff({
      email: "staff@example.test",
      password: staffPassword,
    });
    if (!staffLogin || "twoFactorRequired" in staffLogin) {
      throw new Error("Login staf tes seharusnya berhasil.");
    }

    const forbiddenBranch = await createBranchRoute(
      jsonRequest(
        "/api/branches",
        { code: "BDG-01", name: "Klinik Bandung", timezone: "Asia/Jakarta" },
        `${SESSION_COOKIE_NAME}=${staffLogin.token}`,
      ),
    );
    expect(forbiddenBranch.status).toBe(403);
    await revokeStaffSession(staffLogin.token);

    const branchInput = {
      code: "API-01",
      name: "Klinik API",
      timezone: "Asia/Jakarta",
    };
    const unauthenticatedBranch = await createBranchRoute(
      jsonRequest("/api/branches", branchInput),
    );
    expect(unauthenticatedBranch.status).toBe(401);

    const crossOriginBranch = await createBranchRoute(
      new NextRequest("http://localhost/api/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
          Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
        body: JSON.stringify(branchInput),
      }),
    );
    expect(crossOriginBranch.status).toBe(403);

    const branchCookie = `${SESSION_COOKIE_NAME}=${sessionToken}`;
    const branchResponse = await createBranchRoute(
      jsonRequest("/api/branches", branchInput, branchCookie),
    );
    expect(branchResponse.status).toBe(201);
    await expect(branchResponse.json()).resolves.toMatchObject({
      branch: { code: "API-01", name: "Klinik API", timezone: "Asia/Jakarta" },
    });

    const duplicateBranchResponse = await createBranchRoute(
      jsonRequest("/api/branches", { ...branchInput, code: "api-01" }, branchCookie),
    );
    expect(duplicateBranchResponse.status).toBe(409);

    const branchListResponse = await listBranchesRoute(
      new NextRequest("http://localhost/api/branches", {
        headers: { Cookie: branchCookie },
      }),
    );
    expect(branchListResponse.status).toBe(200);
    await expect(branchListResponse.json()).resolves.toMatchObject({
      branches: expect.arrayContaining([
        expect.objectContaining({ code: "JKT-01", name: "Klinik Jakarta" }),
        expect.objectContaining({ code: "API-01", name: "Klinik API" }),
      ]),
    });

    const branchAudit = await getDatabase()
      .select({ action: auditEvents.action, targetType: auditEvents.targetType })
      .from(auditEvents)
      .where(eq(auditEvents.action, "branch.created"));
    expect(branchAudit).toHaveLength(2);
    expect(
      branchAudit.every(
        ({ action, targetType }) => action === "branch.created" && targetType === "branch",
      ),
    ).toBe(true);

    const logoutResponse = await logoutRoute(
      new NextRequest("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
          Origin: "http://localhost",
          Cookie: branchCookie,
        },
      }),
    );
    expect(logoutResponse.status).toBe(200);
    await expect(getStaffSession(sessionToken)).resolves.toBeNull();
  });

  it("updates custom roles, audits changes, and preserves two-factor requirements", async () => {
    await clearTestData();

    const owner = await bootstrapOwner(setupInput);
    const [regularStaff] = await getDatabase()
      .insert(staffUsers)
      .values({
        name: "Staf PETORA",
        email: "staff@example.test",
        passwordHash: await hashPassword("kata-sandi-staf-yang-aman"),
      })
      .returning({ id: staffUsers.id });
    if (!regularStaff) {
      throw new Error("Akun staf tes gagal dibuat.");
    }

    const ownerCookie = `${SESSION_COOKIE_NAME}=${owner.token}`;
    const createResponse = await createAccessRoleRoute(
      jsonRequest("/api/access/roles", { name: "Kasir" }, ownerCookie),
    );
    expect(createResponse.status).toBe(201);
    const role = (await listAccessRoles()).find(({ name }) => name === "Kasir");
    if (!role) {
      throw new Error("Peran tes tidak ditemukan.");
    }
    await assignAccessRole(
      { staffUserId: regularStaff.id, roleId: role.id, branchId: null },
      owner.staff.id,
    );

    const unauthorizedResponse = await patchAccessRoleRoute(
      jsonRequest(`/api/access/roles/${role.id}`, { name: "Kasir Baru" }, undefined, "PATCH"),
      { params: Promise.resolve({ roleId: role.id }) },
    );
    expect(unauthorizedResponse.status).toBe(401);

    const conflictingRoleResponse = await createAccessRoleRoute(
      jsonRequest("/api/access/roles", { name: "Nama Sudah Ada" }, ownerCookie),
    );
    expect(conflictingRoleResponse.status).toBe(201);
    const duplicateNameResponse = await patchAccessRoleRoute(
      jsonRequest(`/api/access/roles/${role.id}`, { name: "Nama Sudah Ada" }, ownerCookie, "PATCH"),
      { params: Promise.resolve({ roleId: role.id }) },
    );
    expect(duplicateNameResponse.status).toBe(409);

    const twoFactorConflictResponse = await patchAccessRoleRoute(
      jsonRequest(
        `/api/access/roles/${role.id}`,
        { name: "Kasir Dua Langkah", requiresTwoFactor: true },
        ownerCookie,
        "PATCH",
      ),
      { params: Promise.resolve({ roleId: role.id }) },
    );
    expect(twoFactorConflictResponse.status).toBe(409);

    const updateResponse = await patchAccessRoleRoute(
      jsonRequest(
        `/api/access/roles/${role.id}`,
        {
          name: "Kasir Senior",
          description: "Mengelola transaksi kasir",
          isActive: false,
          requiresTwoFactor: false,
          permissions: [{ key: "branches.read", dataScope: "own" }],
        },
        ownerCookie,
        "PATCH",
      ),
      { params: Promise.resolve({ roleId: role.id }) },
    );
    expect(updateResponse.status).toBe(200);
    await expect(listAccessRoles()).resolves.toContainEqual(
      expect.objectContaining({
        id: role.id,
        name: "Kasir Senior",
        description: "Mengelola transaksi kasir",
        isActive: false,
        permissions: [expect.objectContaining({ key: "branches.read", dataScope: "own" })],
      }),
    );

    const roleAudits = await getDatabase()
      .select({ action: auditEvents.action })
      .from(auditEvents)
      .where(eq(auditEvents.targetId, role.id));
    expect(roleAudits.map(({ action }) => action)).toContain("access.role_updated");
  });

  it("enforces role permissions within branch assignments and grants global access only explicitly", async () => {
    await clearTestData();

    const owner = await bootstrapOwner(setupInput);
    const [firstBranch] = await getDatabase()
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.code, setupInput.branchCode));
    if (!firstBranch) {
      throw new Error("Cabang setup awal tidak ditemukan.");
    }
    const secondBranch = await createBranch(
      { code: "BDG-01", name: "Klinik Bandung", timezone: "Asia/Jakarta" },
      owner.staff.id,
    );
    const staffPassword = "kata-sandi-staf-yang-aman";
    const [regularStaff] = await getDatabase()
      .insert(staffUsers)
      .values({
        name: "Staf PETORA",
        email: "staff@example.test",
        passwordHash: await hashPassword(staffPassword),
      })
      .returning({ id: staffUsers.id });

    if (!regularStaff) {
      throw new Error("Akun staf tes gagal dibuat.");
    }

    const ownerCookie = `${SESSION_COOKIE_NAME}=${owner.token}`;
    const roleResponse = await createAccessRoleRoute(
      jsonRequest(
        "/api/access/roles",
        {
          name: "Kasir Jakarta",
          permissions: [{ key: "branches.read", dataScope: "own" }],
        },
        ownerCookie,
      ),
    );
    expect(roleResponse.status).toBe(201);

    const role = (await listAccessRoles()).find(({ name }) => name === "Kasir Jakarta");
    if (!role) {
      throw new Error("Peran yang dibuat melalui API tidak ditemukan.");
    }

    const assignmentRequest = {
      staffUserId: regularStaff.id,
      roleId: role.id,
      branchId: null,
    };
    const assignmentResponse = await assignAccessRoleRoute(
      jsonRequest("/api/access/role-assignments", assignmentRequest, ownerCookie),
    );
    expect(assignmentResponse.status).toBe(201);

    const duplicateAssignmentResponse = await assignAccessRoleRoute(
      jsonRequest("/api/access/role-assignments", assignmentRequest, ownerCookie),
    );
    expect(duplicateAssignmentResponse.status).toBe(409);

    const ownerAssignmentResponse = await assignAccessRoleRoute(
      jsonRequest(
        "/api/access/role-assignments",
        { staffUserId: owner.staff.id, roleId: role.id, branchId: null },
        ownerCookie,
      ),
    );
    expect(ownerAssignmentResponse.status).toBe(409);

    const staffLogin = await loginStaff({
      email: "staff@example.test",
      password: staffPassword,
    });
    if (!staffLogin || "twoFactorRequired" in staffLogin) {
      throw new Error("Login staf tes seharusnya berhasil.");
    }

    const authenticatedStaff = await getStaffSession(staffLogin.token);
    if (!authenticatedStaff) {
      throw new Error("Sesi staf tes tidak ditemukan.");
    }

    await expect(
      authorizeStaff(authenticatedStaff, "branches.read", firstBranch.id),
    ).resolves.toMatchObject({ dataScope: "own", branchScope: "all" });
    await expect(
      authorizeStaff(authenticatedStaff, "branches.read", secondBranch.id),
    ).resolves.toMatchObject({ dataScope: "own", branchScope: "all" });
    await expect(authorizeStaff(authenticatedStaff, "branches.read")).resolves.toBeNull();
    await expect(listBranchesForStaff(authenticatedStaff)).resolves.toEqual([]);

    const globalRole = await createAccessRole(
      {
        name: "Pengelola Cabang",
        description: "",
        requiresTwoFactor: false,
        permissions: [{ key: "branches.manage", dataScope: "all" }],
      },
      owner.staff.id,
    );
    await assignAccessRole(
      { staffUserId: regularStaff.id, roleId: globalRole.id, branchId: null },
      owner.staff.id,
    );
    await expect(authorizeStaff(authenticatedStaff, "branches.manage")).resolves.toMatchObject({
      dataScope: "all",
      branchScope: "all",
    });

    const staffCookie = `${SESSION_COOKIE_NAME}=${staffLogin.token}`;
    const staffBranchResponse = await createBranchRoute(
      jsonRequest(
        "/api/branches",
        { code: "SBY-01", name: "Klinik Surabaya", timezone: "Asia/Jakarta" },
        staffCookie,
      ),
    );
    expect(staffBranchResponse.status).toBe(201);
    const branchManagerRole = await createAccessRole(
      {
        name: "Manajer Bandung",
        description: "",
        requiresTwoFactor: false,
        permissions: [{ key: "branches.read", dataScope: "all" }],
      },
      owner.staff.id,
    );
    await assignAccessRole(
      { staffUserId: regularStaff.id, roleId: branchManagerRole.id, branchId: secondBranch.id },
      owner.staff.id,
    );
    const denyBranchResponse = await setPermissionOverrideRoute(
      jsonRequest(
        "/api/access/permission-overrides",
        {
          staffUserId: regularStaff.id,
          permissionKey: "branches.read",
          branchId: secondBranch.id,
          effect: "deny",
          reason: "Pembatasan akses sementara",
        },
        ownerCookie,
      ),
    );
    expect(denyBranchResponse.status).toBe(201);
    const allowBranchResponse = await setPermissionOverrideRoute(
      jsonRequest(
        "/api/access/permission-overrides",
        {
          staffUserId: regularStaff.id,
          permissionKey: "branches.read",
          branchId: firstBranch.id,
          effect: "allow",
          reason: "Tugas audit cabang",
        },
        ownerCookie,
      ),
    );
    expect(allowBranchResponse.status).toBe(201);
    const updatedAllowResponse = await setPermissionOverrideRoute(
      jsonRequest(
        "/api/access/permission-overrides",
        {
          staffUserId: regularStaff.id,
          permissionKey: "branches.read",
          branchId: firstBranch.id,
          effect: "allow",
          reason: "Tugas audit lintas cabang",
        },
        ownerCookie,
      ),
    );
    expect(updatedAllowResponse.status).toBe(201);
    expect(await listPermissionOverrides()).toHaveLength(2);
    const forbiddenOverrideResponse = await setPermissionOverrideRoute(
      jsonRequest(
        "/api/access/permission-overrides",
        {
          staffUserId: regularStaff.id,
          permissionKey: "branches.read",
          branchId: firstBranch.id,
          effect: "deny",
          reason: "Percobaan tanpa izin",
        },
        staffCookie,
      ),
    );
    expect(forbiddenOverrideResponse.status).toBe(403);
    const overrideListResponse = await listPermissionOverridesRoute(
      new NextRequest("http://localhost/api/access/permission-overrides", {
        headers: { Cookie: ownerCookie },
      }),
    );
    expect(overrideListResponse.status).toBe(200);
    await expect(overrideListResponse.json()).resolves.toMatchObject({
      overrides: expect.arrayContaining([
        expect.objectContaining({ effect: "deny", branchId: secondBranch.id }),
        expect.objectContaining({
          effect: "allow",
          branchId: firstBranch.id,
          reason: "Tugas audit lintas cabang",
        }),
      ]),
    });
    await expect(
      authorizeStaff(authenticatedStaff, "branches.read", secondBranch.id),
    ).resolves.toBeNull();
    await expect(
      authorizeStaff(authenticatedStaff, "branches.read", firstBranch.id),
    ).resolves.toMatchObject({ dataScope: "all", branchScope: "all" });

    const restrictedBranchList = await listBranchesRoute(
      new NextRequest("http://localhost/api/branches", { headers: { Cookie: staffCookie } }),
    );
    expect(restrictedBranchList.status).toBe(200);
    const restrictedBranches = await restrictedBranchList.json();
    expect(restrictedBranches.branches).toHaveLength(2);
    expect(restrictedBranches.branches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "JKT-01" }),
        expect.objectContaining({ code: "SBY-01" }),
      ]),
    );
    const deniedOverride = (await listPermissionOverrides()).find(
      ({ effect, branchId }) => effect === "deny" && branchId === secondBranch.id,
    );
    if (!deniedOverride) {
      throw new Error("Pengecualian penolakan untuk cabang Bandung tidak ditemukan.");
    }
    const removeOverrideResponse = await removePermissionOverrideRoute(
      new NextRequest(`http://localhost/api/access/permission-overrides/${deniedOverride.id}`, {
        method: "DELETE",
        headers: { Origin: "http://localhost", Cookie: ownerCookie },
      }),
      { params: Promise.resolve({ overrideId: deniedOverride.id }) },
    );
    expect(removeOverrideResponse.status).toBe(200);
    await expect(listBranchesForStaff(authenticatedStaff)).resolves.toHaveLength(3);

    const ownerCatalogResponse = await listAccessRolesRoute(
      new NextRequest("http://localhost/api/access/roles", {
        headers: { Cookie: ownerCookie },
      }),
    );
    expect(ownerCatalogResponse.status).toBe(200);
    await expect(ownerCatalogResponse.json()).resolves.toMatchObject({
      permissions: [
        { key: "access.manage", branchScoped: false, highRisk: true },
        { key: "audit.read", branchScoped: false, highRisk: true },
        { key: "branches.manage", branchScoped: false, highRisk: true },
        { key: "branches.read", branchScoped: true, supportsOwnScope: true, highRisk: false },
        { key: "customers.manage", branchScoped: false, supportsOwnScope: true, highRisk: true },
        { key: "customers.read", branchScoped: false, supportsOwnScope: true, highRisk: true },
        { key: "settings.manage", branchScoped: false, highRisk: true },
      ],
    });

    const accessAudit = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(inArray(auditEvents.action, ["access.role_created", "access.role_assigned"]));
    const roleCreatedAudit = accessAudit.filter(({ action }) => action === "access.role_created");
    const roleAssignedAudit = accessAudit.filter(({ action }) => action === "access.role_assigned");
    expect(roleCreatedAudit).toHaveLength(3);
    expect(roleAssignedAudit).toHaveLength(3);
    expect(roleCreatedAudit.every(({ metadata }) => metadata.requiresTwoFactor === "false")).toBe(
      true,
    );
    expect(roleAssignedAudit.every(({ metadata }) => Object.keys(metadata).length === 0)).toBe(
      true,
    );
    const overrideAudit = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(
        inArray(auditEvents.action, [
          "access.permission_override_set",
          "access.permission_override_removed",
        ]),
      );
    expect(
      overrideAudit.filter(({ action }) => action === "access.permission_override_set"),
    ).toHaveLength(3);
    expect(
      overrideAudit.filter(({ action }) => action === "access.permission_override_removed"),
    ).toHaveLength(1);
    expect(JSON.stringify(overrideAudit)).not.toContain("Pembatasan akses sementara");
  });

  it("enrolls TOTP, gates login, consumes recovery codes once, and enforces required roles", async () => {
    await clearTestData();

    const owner = await bootstrapOwner(setupInput);
    const ownerCookie = `${SESSION_COOKIE_NAME}=${owner.token}`;
    const staffPassword = "kata-sandi-staf-yang-aman";
    const createdStaff = await createStaffRoute(
      jsonRequest(
        "/api/staff",
        { name: "Staf TOTP", email: "totp@example.test", password: staffPassword },
        ownerCookie,
      ),
    );
    expect(createdStaff.status).toBe(201);
    const staff = (await listStaffUsers()).find(({ email }) => email === "totp@example.test");
    if (!staff) {
      throw new Error("Akun staf 2FA tidak ditemukan.");
    }

    const initialLogin = await loginStaff({ email: staff.email, password: staffPassword });
    if (!initialLogin || "twoFactorRequired" in initialLogin) {
      throw new Error("Login awal staf seharusnya berhasil.");
    }
    const staffCookie = `${SESSION_COOKIE_NAME}=${initialLogin.token}`;
    const enrollmentResponse = await enrollTotpRoute(
      jsonRequest("/api/auth/totp", {}, staffCookie),
    );
    expect(enrollmentResponse.status).toBe(200);
    const enrollmentBody: unknown = await enrollmentResponse.json();
    if (
      typeof enrollmentBody !== "object" ||
      enrollmentBody === null ||
      !("secret" in enrollmentBody) ||
      typeof enrollmentBody.secret !== "string"
    ) {
      throw new Error("Respons pendaftaran 2FA tidak berisi secret.");
    }
    const secret = enrollmentBody.secret;

    const confirmationResponse = await confirmTotpRoute(
      jsonRequest("/api/auth/totp/confirm", { code: currentTotpCode(secret) }, staffCookie),
    );
    expect(confirmationResponse.status).toBe(200);
    const confirmationBody: unknown = await confirmationResponse.json();
    if (
      typeof confirmationBody !== "object" ||
      confirmationBody === null ||
      !("recoveryCodes" in confirmationBody) ||
      !Array.isArray(confirmationBody.recoveryCodes) ||
      !confirmationBody.recoveryCodes.every((code) => typeof code === "string")
    ) {
      throw new Error("Kode pemulihan 2FA tidak dikembalikan setelah enrollment.");
    }
    const recoveryCodes = confirmationBody.recoveryCodes;
    expect(recoveryCodes).toHaveLength(10);

    const [storedStaff] = await getDatabase()
      .select({
        encryptedSecret: staffUsers.totpSecretCiphertext,
        enabledAt: staffUsers.totpEnabledAt,
      })
      .from(staffUsers)
      .where(eq(staffUsers.id, staff.id));
    expect(storedStaff?.encryptedSecret).toBeTruthy();
    expect(storedStaff?.encryptedSecret).not.toContain(secret);
    expect(storedStaff?.enabledAt).toBeInstanceOf(Date);

    const requiredRole = await createAccessRole(
      {
        name: "Supervisor wajib 2FA",
        description: "",
        requiresTwoFactor: true,
        permissions: [],
      },
      owner.staff.id,
    );
    const [unenrolledStaff] = await getDatabase()
      .insert(staffUsers)
      .values({
        name: "Staf tanpa 2FA",
        email: "no-totp@example.test",
        passwordHash: await hashPassword("kata-sandi-staf-lain-aman"),
      })
      .returning({ id: staffUsers.id });
    if (!unenrolledStaff) {
      throw new Error("Akun staf tanpa 2FA gagal dibuat.");
    }
    await expect(
      assignAccessRole(
        {
          staffUserId: unenrolledStaff.id,
          roleId: requiredRole.id,
          branchId: null,
        },
        owner.staff.id,
      ),
    ).rejects.toBeInstanceOf(TwoFactorEnrollmentRequiredError);
    await assignAccessRole(
      { staffUserId: staff.id, roleId: requiredRole.id, branchId: null },
      owner.staff.id,
    );

    const passwordLoginResponse = await loginRoute(
      jsonRequest("/api/auth/login", { email: staff.email, password: staffPassword }),
    );
    expect(passwordLoginResponse.status).toBe(200);
    expect(passwordLoginResponse.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
    const passwordLoginBody: unknown = await passwordLoginResponse.json();
    if (
      typeof passwordLoginBody !== "object" ||
      passwordLoginBody === null ||
      !("challengeToken" in passwordLoginBody) ||
      typeof passwordLoginBody.challengeToken !== "string"
    ) {
      throw new Error("Login dengan 2FA tidak menerbitkan challenge.");
    }
    const challengeToken = passwordLoginBody.challengeToken;
    const validTotpCode = currentTotpCode(secret, 1);
    const currentCodes = new Set(
      [-1, 0, 1, 2].map((stepOffset) => currentTotpCode(secret, stepOffset)),
    );
    let invalidTotpCode = "000000";
    while (currentCodes.has(invalidTotpCode)) {
      invalidTotpCode = String(Number(invalidTotpCode) + 1).padStart(6, "0");
    }
    const invalidChallengeResponse = await totpChallengeRoute(
      jsonRequest("/api/auth/totp/challenge", { challengeToken, code: invalidTotpCode }),
    );
    expect(invalidChallengeResponse.status).toBe(401);
    const verifiedChallengeResponse = await totpChallengeRoute(
      jsonRequest("/api/auth/totp/challenge", { challengeToken, code: validTotpCode }),
    );
    expect(verifiedChallengeResponse.status).toBe(200);
    const totpSessionToken = verifiedChallengeResponse.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!totpSessionToken) {
      throw new Error("Challenge TOTP tidak menerbitkan sesi.");
    }

    const recoveryLoginResponse = await loginRoute(
      jsonRequest("/api/auth/login", { email: staff.email, password: staffPassword }),
    );
    const recoveryLoginBody: unknown = await recoveryLoginResponse.json();
    if (
      typeof recoveryLoginBody !== "object" ||
      recoveryLoginBody === null ||
      !("challengeToken" in recoveryLoginBody) ||
      typeof recoveryLoginBody.challengeToken !== "string"
    ) {
      throw new Error("Login pemulihan tidak menerbitkan challenge.");
    }
    const firstRecoveryCode = recoveryCodes[0];
    const secondRecoveryCode = recoveryCodes[1];
    if (typeof firstRecoveryCode !== "string" || typeof secondRecoveryCode !== "string") {
      throw new Error("Kode pemulihan yang dihasilkan tidak lengkap.");
    }
    const recoveryResponse = await totpChallengeRoute(
      jsonRequest("/api/auth/totp/challenge", {
        challengeToken: recoveryLoginBody.challengeToken,
        code: firstRecoveryCode,
      }),
    );
    expect(recoveryResponse.status).toBe(200);

    const reuseLoginResponse = await loginRoute(
      jsonRequest("/api/auth/login", { email: staff.email, password: staffPassword }),
    );
    const reuseLoginBody: unknown = await reuseLoginResponse.json();
    if (
      typeof reuseLoginBody !== "object" ||
      reuseLoginBody === null ||
      !("challengeToken" in reuseLoginBody) ||
      typeof reuseLoginBody.challengeToken !== "string"
    ) {
      throw new Error("Login untuk uji kode pemulihan tidak menerbitkan challenge.");
    }
    const reusedRecoveryResponse = await totpChallengeRoute(
      jsonRequest("/api/auth/totp/challenge", {
        challengeToken: reuseLoginBody.challengeToken,
        code: firstRecoveryCode,
      }),
    );
    expect(reusedRecoveryResponse.status).toBe(401);

    const rateLimitLoginResponse = await loginRoute(
      jsonRequest("/api/auth/login", { email: staff.email, password: staffPassword }),
    );
    const rateLimitLoginBody: unknown = await rateLimitLoginResponse.json();
    if (
      typeof rateLimitLoginBody !== "object" ||
      rateLimitLoginBody === null ||
      !("challengeToken" in rateLimitLoginBody) ||
      typeof rateLimitLoginBody.challengeToken !== "string"
    ) {
      throw new Error("Login untuk uji pembatasan tidak menerbitkan challenge.");
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedAttempt = await totpChallengeRoute(
        jsonRequest("/api/auth/totp/challenge", {
          challengeToken: rateLimitLoginBody.challengeToken,
          code: invalidTotpCode,
        }),
      );
      expect(failedAttempt.status).toBe(401);
    }
    const afterRateLimitResponse = await totpChallengeRoute(
      jsonRequest("/api/auth/totp/challenge", {
        challengeToken: rateLimitLoginBody.challengeToken,
        code: secondRecoveryCode,
      }),
    );
    expect(afterRateLimitResponse.status).toBe(401);

    const blockedDisableResponse = await disableTotpRoute(
      jsonRequest(
        "/api/auth/totp/disable",
        { password: staffPassword, code: secondRecoveryCode },
        staffCookie,
      ),
    );
    expect(blockedDisableResponse.status).toBe(409);
    await expect(disableTotp(staff.id, staffPassword, secondRecoveryCode)).rejects.toBeInstanceOf(
      TotpRequiredByRoleError,
    );

    await getDatabase()
      .delete(staffRoleAssignments)
      .where(eq(staffRoleAssignments.staffUserId, staff.id));
    const disableResponse = await disableTotpRoute(
      jsonRequest(
        "/api/auth/totp/disable",
        { password: staffPassword, code: secondRecoveryCode },
        staffCookie,
      ),
    );
    expect(disableResponse.status).toBe(200);
    await expect(getStaffSession(initialLogin.token)).resolves.toBeNull();
    await expect(getStaffSession(totpSessionToken)).resolves.toBeNull();
    await expect(getDatabase().select().from(authTotpRecoveryCodes)).resolves.toHaveLength(0);

    const totpAudit = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(
        inArray(auditEvents.action, [
          "auth.totp_enabled",
          "auth.totp_disabled",
          "auth.totp_challenge_issued",
          "auth.login",
        ]),
      );
    expect(totpAudit.some(({ action }) => action === "auth.totp_enabled")).toBe(true);
    expect(totpAudit.some(({ action }) => action === "auth.totp_disabled")).toBe(true);
    expect(totpAudit.some(({ metadata }) => metadata.secondFactor === "recovery_code")).toBe(true);
    expect(JSON.stringify(totpAudit)).not.toContain(secret);
    expect(JSON.stringify(totpAudit)).not.toContain(firstRecoveryCode);
  });

  it("updates Owner settings and document numbering while denying staff access", async () => {
    await clearTestData();

    const owner = await bootstrapOwner(setupInput);
    const ownerCookie = `${SESSION_COOKIE_NAME}=${owner.token}`;
    const updatedSettings = {
      businessName: "PETORA Klinik Bandung",
      defaultTimezone: "Asia/Makassar",
      locale: "en-US",
      taxEnabled: true,
      taxRateBps: 1100,
      taxIncluded: true,
      quietHoursEnabled: true,
      quietHoursStart: "21:30",
      quietHoursEnd: "07:15",
      primaryColor: "#006699",
      theme: "dark",
      features: { commissions: true, loyalty: false, inpatient: true },
    };
    const settingsResponse = await updateSettingsRoute(
      jsonRequest("/api/settings", updatedSettings, ownerCookie, "PATCH"),
    );
    expect(settingsResponse.status).toBe(200);
    expect(await getBusinessSettings()).toMatchObject(updatedSettings);
    expect(await getSetupStatus()).toMatchObject({ businessName: updatedSettings.businessName });

    const [branch] = await getDatabase()
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.code, setupInput.branchCode));
    if (!branch) {
      throw new Error("Cabang setup awal tidak ditemukan.");
    }

    const globalSequenceResponse = await updateDocumentSettingsRoute(
      jsonRequest(
        "/api/settings/document-numbering",
        {
          documentType: "invoice",
          branchId: null,
          prefix: "INV-ID",
          nextNumber: 42,
          minimumWidth: 7,
        },
        ownerCookie,
        "PATCH",
      ),
    );
    expect(globalSequenceResponse.status).toBe(200);
    const branchSequenceResponse = await updateDocumentSettingsRoute(
      jsonRequest(
        "/api/settings/document-numbering",
        {
          documentType: "purchase_order",
          branchId: branch.id,
          prefix: "PO-JKT",
          nextNumber: 12,
          minimumWidth: 4,
        },
        ownerCookie,
        "PATCH",
      ),
    );
    expect(branchSequenceResponse.status).toBe(200);
    const ownerSettingsResponse = await getSettingsRoute(
      new NextRequest("http://localhost/api/settings", {
        headers: { Cookie: ownerCookie },
      }),
    );
    expect(ownerSettingsResponse.status).toBe(200);
    const ownerSettingsBody = await ownerSettingsResponse.json();
    expect(ownerSettingsBody.documentSequences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentType: "invoice",
          branchId: null,
          prefix: "INV-ID",
          nextNumber: 42,
          minimumWidth: 7,
        }),
        expect.objectContaining({
          documentType: "purchase_order",
          branchId: branch.id,
          prefix: "PO-JKT",
          nextNumber: 12,
          minimumWidth: 4,
        }),
      ]),
    );

    const parallelInvoiceNumbers = await Promise.all(
      Array.from({ length: 5 }, () =>
        getDatabase().transaction((tx) =>
          nextDocumentNumber(tx, { documentType: "invoice", branchId: null }),
        ),
      ),
    );
    expect(parallelInvoiceNumbers.sort()).toEqual(
      [
        "INV-ID/GLOBAL/0000042",
        "INV-ID/GLOBAL/0000043",
        "INV-ID/GLOBAL/0000044",
        "INV-ID/GLOBAL/0000045",
        "INV-ID/GLOBAL/0000046",
      ].sort(),
    );
    await expect(
      getDatabase().transaction((tx) =>
        nextDocumentNumber(tx, { documentType: "purchase_order", branchId: branch.id }),
      ),
    ).resolves.toBe("PO-JKT/JKT-01/0012");
    const rolledBackSequence = getDatabase().transaction(async (tx) => {
      const number = await nextDocumentNumber(tx, {
        documentType: "receipt",
        branchId: null,
      });
      expect(number).toBe("RCP/GLOBAL/00001");
      throw new Error("Simulasi rollback transaksi dokumen.");
    });
    await expect(rolledBackSequence).rejects.toThrow("Simulasi rollback");
    await expect(
      getDatabase().transaction((tx) =>
        nextDocumentNumber(tx, { documentType: "receipt", branchId: null }),
      ),
    ).resolves.toBe("RCP/GLOBAL/00001");

    const invalidTaxSettings = await updateSettingsRoute(
      jsonRequest("/api/settings", { ...updatedSettings, taxRateBps: 0 }, ownerCookie, "PATCH"),
    );
    expect(invalidTaxSettings.status).toBe(400);
    const invalidQuietHours = await updateSettingsRoute(
      jsonRequest(
        "/api/settings",
        { ...updatedSettings, quietHoursEnd: updatedSettings.quietHoursStart },
        ownerCookie,
        "PATCH",
      ),
    );
    expect(invalidQuietHours.status).toBe(400);

    const staffPassword = "kata-sandi-staf-yang-aman";
    await createStaffRoute(
      jsonRequest(
        "/api/staff",
        { name: "Staf Pengaturan", email: "settings-staff@example.test", password: staffPassword },
        ownerCookie,
      ),
    );
    const staffLogin = await loginStaff({
      email: "settings-staff@example.test",
      password: staffPassword,
    });
    if (!staffLogin || "twoFactorRequired" in staffLogin) {
      throw new Error("Login staf untuk uji izin pengaturan gagal.");
    }
    const staffSettingsResponse = await getSettingsRoute(
      new NextRequest("http://localhost/api/settings", {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${staffLogin.token}` },
      }),
    );
    expect(staffSettingsResponse.status).toBe(403);

    const settingAudit = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(
        inArray(auditEvents.action, [
          "settings.business_updated",
          "settings.document_sequence_updated",
        ]),
      );
    expect(
      settingAudit.filter(({ action }) => action === "settings.business_updated"),
    ).toHaveLength(1);
    expect(
      settingAudit.filter(({ action }) => action === "settings.document_sequence_updated"),
    ).toHaveLength(2);
    expect(JSON.stringify(settingAudit)).not.toContain(updatedSettings.businessName);
    expect(JSON.stringify(settingAudit)).not.toContain(updatedSettings.primaryColor);
  });

  it("creates staff accounts, revokes sessions after sensitive changes, and protects Owner", async () => {
    await clearTestData();

    const owner = await bootstrapOwner(setupInput);
    const ownerCookie = `${SESSION_COOKIE_NAME}=${owner.token}`;
    const staffPassword = "kata-sandi-staf-yang-aman";
    const createResponse = await createStaffRoute(
      jsonRequest(
        "/api/staff",
        { name: "Staf PETORA", email: "staff@example.test", password: staffPassword },
        ownerCookie,
      ),
    );
    expect(createResponse.status).toBe(201);

    const staff = (await listStaffUsers()).find(({ email }) => email === "staff@example.test");
    if (!staff) {
      throw new Error("Akun staf yang dibuat melalui API tidak ditemukan.");
    }

    const ownerDeactivateResponse = await updateStaffRoute(
      jsonRequest(`/api/staff/${owner.staff.id}`, { isActive: false }, ownerCookie, "PATCH"),
      { params: Promise.resolve({ staffUserId: owner.staff.id }) },
    );
    expect(ownerDeactivateResponse.status).toBe(409);
    await expect(getStaffSession(owner.token)).resolves.toMatchObject({ isOwner: true });

    const firstLogin = await loginStaff({ email: staff.email, password: staffPassword });
    if (!firstLogin || "twoFactorRequired" in firstLogin) {
      throw new Error("Login awal staf tes seharusnya berhasil.");
    }

    const newPassword = "kata-sandi-staf-baru-aman";
    const passwordUpdateResponse = await updateStaffRoute(
      jsonRequest(`/api/staff/${staff.id}`, { password: newPassword }, ownerCookie, "PATCH"),
      { params: Promise.resolve({ staffUserId: staff.id }) },
    );
    expect(passwordUpdateResponse.status).toBe(200);
    await expect(getStaffSession(firstLogin.token)).resolves.toBeNull();
    await expect(loginStaff({ email: staff.email, password: staffPassword })).resolves.toBeNull();

    const secondLogin = await loginStaff({ email: staff.email, password: newPassword });
    if (!secondLogin || "twoFactorRequired" in secondLogin) {
      throw new Error("Login dengan kata sandi baru seharusnya berhasil.");
    }

    const deactivateResponse = await updateStaffRoute(
      jsonRequest(`/api/staff/${staff.id}`, { isActive: false }, ownerCookie, "PATCH"),
      { params: Promise.resolve({ staffUserId: staff.id }) },
    );
    expect(deactivateResponse.status).toBe(200);
    await expect(getStaffSession(secondLogin.token)).resolves.toBeNull();
    await expect(loginStaff({ email: staff.email, password: newPassword })).resolves.toBeNull();

    const reactivateResponse = await updateStaffRoute(
      jsonRequest(`/api/staff/${staff.id}`, { isActive: true }, ownerCookie, "PATCH"),
      { params: Promise.resolve({ staffUserId: staff.id }) },
    );
    expect(reactivateResponse.status).toBe(200);
    await expect(loginStaff({ email: staff.email, password: newPassword })).resolves.toMatchObject({
      staff: { id: staff.id },
    });

    const staffAudit = await getDatabase()
      .select({ action: auditEvents.action, metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(
        inArray(auditEvents.action, [
          "staff.created",
          "staff.password_changed",
          "staff.deactivated",
          "staff.updated",
        ]),
      );
    expect(staffAudit.map(({ action }) => action)).toEqual([
      "staff.created",
      "staff.password_changed",
      "staff.deactivated",
      "staff.updated",
    ]);
    expect(staffAudit.every(({ metadata }) => Object.keys(metadata).length === 0)).toBe(true);
  });
});
