import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { AuditLog } from "@/components/audit/audit-log";
import { LogoutButton } from "@/components/auth/logout-button";
import { SessionManagement } from "@/components/auth/session-management";
import { TwoFactorManagement } from "@/components/auth/two-factor-management";
import { CreateBranchForm } from "@/components/branches/create-branch-form";
import { CustomerManagement } from "@/components/customers/customer-management";
import {
  NotificationInbox,
  NotificationTemplateManagement,
} from "@/components/notifications/notification-center";
import { SuperAdminSettings } from "@/components/settings/super-admin-settings";
import { StaffManagement } from "@/components/staff/staff-management";
import { SupervisorPinManagement } from "@/components/supervisor/pin-management";
import {
  authorizeStaff,
  listAccessRoles,
  listBranchesForStaff,
  listPermissionCatalog,
  listPermissionOverrides,
} from "@/server/access/service";
import { listAuditEvents } from "@/server/audit/service";
import { getCurrentStaff, getCurrentStaffSessions } from "@/server/auth/cookies";
import { getSetupStatus, getTotpStatus } from "@/server/auth/service";
import { listCustomers } from "@/server/customers/service";
import { listNotificationTemplates, listStaffNotifications } from "@/server/notifications/queue";
import { getBusinessSettings } from "@/server/settings/service";
import { listStaffUsers } from "@/server/staff/service";
import { getSupervisorPinStatus } from "@/server/supervisor/pin";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const staff = await getCurrentStaff();

  if (!staff) {
    redirect("/login");
  }

  const setup = await getSetupStatus();
  const settings = await getBusinessSettings();
  const twoFactor = await getTotpStatus(staff.id);
  const sessions = await getCurrentStaffSessions(staff.id);
  const branches = await listBranchesForStaff(staff);
  const supervisorPin = await getSupervisorPinStatus(staff.id);
  const canManageBranches = (await authorizeStaff(staff, "branches.manage")) !== null;
  const [accessGrant, settingsGrant, auditGrant, customerReadGrant, customerManageGrant] =
    await Promise.all([
      authorizeStaff(staff, "access.manage"),
      authorizeStaff(staff, "settings.manage"),
      authorizeStaff(staff, "audit.read"),
      authorizeStaff(staff, "customers.read"),
      authorizeStaff(staff, "customers.manage"),
    ]);
  const canManageAccess = accessGrant !== null;
  const canManageSettings = settingsGrant !== null;
  const canReadAudit = auditGrant !== null;
  const customers = customerReadGrant
    ? await listCustomers(staff.id, customerReadGrant.dataScope)
    : [];
  const customerSummaries = customers.map(({ createdBy, ...customer }) => ({
    ...customer,
    canEdit:
      customerManageGrant?.dataScope === "all" ||
      (customerManageGrant?.dataScope === "own" && createdBy === staff.id),
  }));
  const [notifications, notificationTemplates] = await Promise.all([
    listStaffNotifications(staff.id),
    canManageSettings ? listNotificationTemplates() : Promise.resolve([]),
  ]);
  const [staffUsers, roles, permissions, permissionOverrides] = canManageAccess
    ? await Promise.all([
        listStaffUsers(),
        listAccessRoles(),
        listPermissionCatalog(),
        listPermissionOverrides(),
      ])
    : [[], [], [], []];
  const auditPage = canReadAudit ? await listAuditEvents(30) : { events: [], nextCursor: null };
  const themeStyle: CSSProperties & {
    "--color-accent": string;
    "--color-accent-soft": string;
  } = {
    "--color-accent": settings.primaryColor,
    "--color-accent-soft": `color-mix(in srgb, ${settings.primaryColor} 15%, white)`,
  };

  return (
    <main className="dashboard-shell" data-theme={settings.theme} style={themeStyle}>
      <header className="dashboard-header">
        <Link className="brand-link" href="/">
          PETORA<span> INDONESIA</span>
        </Link>
        <LogoutButton />
      </header>
      <section className="dashboard-welcome">
        <p className="welcome__eyebrow">{staff.isOwner ? "OWNER" : "STAF"}</p>
        <h1>Selamat datang, {staff.name}</h1>
        <p className="welcome__lead">
          Anda masuk ke akun {staff.isOwner ? "Owner" : "staf"} untuk {setup.businessName}.
        </p>
      </section>
      {branches !== null || canManageBranches ? (
        <section aria-labelledby="branches-title" className="branch-management">
          <div>
            <p className="welcome__eyebrow">OPERASIONAL</p>
            <h2 id="branches-title">Cabang bisnis</h2>
            {branches?.length ? (
              <ul className="branch-list">
                {branches.map((branch) => (
                  <li key={branch.id}>
                    <span>{branch.name}</span>
                    <span>
                      {branch.code} · {branch.timezone}
                    </span>
                  </li>
                ))}
              </ul>
            ) : branches ? (
              <p className="auth-card__description">Belum ada cabang yang terdaftar.</p>
            ) : (
              <p className="auth-card__description">Anda belum memiliki izin melihat cabang.</p>
            )}
          </div>
          {canManageBranches ? (
            <div className="branch-create">
              <h3>Tambah cabang</h3>
              <CreateBranchForm />
            </div>
          ) : null}
        </section>
      ) : null}
      {customerReadGrant || customerManageGrant ? (
        <CustomerManagement
          canRead={customerReadGrant !== null}
          canClearSamples={staff.isOwner}
          customers={customerSummaries}
          manageScope={customerManageGrant?.dataScope ?? null}
        />
      ) : null}
      {canManageAccess ? (
        <StaffManagement
          branches={branches ?? []}
          permissions={permissions}
          roles={roles}
          staff={staffUsers}
          overrides={permissionOverrides}
        />
      ) : null}
      {canManageSettings ? (
        <SuperAdminSettings settings={settings} branches={branches ?? []} />
      ) : null}
      {canManageSettings ? (
        <NotificationTemplateManagement templates={notificationTemplates} />
      ) : null}
      <NotificationInbox
        locale={settings.locale}
        notifications={notifications}
        timeZone={settings.defaultTimezone}
      />
      {canReadAudit ? (
        <AuditLog
          initialCursor={auditPage.nextCursor}
          initialEvents={auditPage.events}
          locale={settings.locale}
          timeZone={settings.defaultTimezone}
        />
      ) : null}
      <SessionManagement
        locale={settings.locale}
        sessions={sessions}
        timeZone={settings.defaultTimezone}
      />
      <TwoFactorManagement enabled={twoFactor.enabled} />
      <SupervisorPinManagement pinSet={supervisorPin.isSet} />
      <footer>Powered by PETORA INDONESIA</footer>
    </main>
  );
}
