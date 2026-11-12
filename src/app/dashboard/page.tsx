import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { AuditLog } from "@/components/audit/audit-log";
import { LogoutButton } from "@/components/auth/logout-button";
import { SessionManagement } from "@/components/auth/session-management";
import { TwoFactorManagement } from "@/components/auth/two-factor-management";
import { CreateBranchForm } from "@/components/branches/create-branch-form";
import { CustomerManagement } from "@/components/customers/customer-management";
import { InventoryManagement } from "@/components/inventory/inventory-management";
import {
  NotificationInbox,
  NotificationTemplateManagement,
} from "@/components/notifications/notification-center";
import { PetManagement } from "@/components/pets/pet-management";
import { PosManagement } from "@/components/pos/pos-management";
import { ProductManagement } from "@/components/products/product-management";
import { ServiceManagement } from "@/components/services/service-management";
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
import { listPets } from "@/server/pets/service";
import { listProductCatalogOptions, listProducts } from "@/server/products/service";
import {
  listServiceCategories,
  listServicePriceTiers,
  listServices,
} from "@/server/services/service";
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
  const [
    accessGrant,
    settingsGrant,
    auditGrant,
    customerReadGrant,
    customerManageGrant,
    petReadGrant,
    petManageGrant,
    productReadGrant,
    productManageGrant,
    productCostReadGrant,
    productCostManageGrant,
    serviceReadGrant,
    serviceManageGrant,
  ] = await Promise.all([
    authorizeStaff(staff, "access.manage"),
    authorizeStaff(staff, "settings.manage"),
    authorizeStaff(staff, "audit.read"),
    authorizeStaff(staff, "customers.read"),
    authorizeStaff(staff, "customers.manage"),
    authorizeStaff(staff, "pets.read"),
    authorizeStaff(staff, "pets.manage"),
    authorizeStaff(staff, "products.read"),
    authorizeStaff(staff, "products.manage"),
    authorizeStaff(staff, "products.cost.read"),
    authorizeStaff(staff, "products.cost.manage"),
    authorizeStaff(staff, "services.read"),
    authorizeStaff(staff, "services.manage"),
  ]);
  const canManageAccess = accessGrant !== null;
  const canManageSettings = settingsGrant !== null;
  const canReadAudit = auditGrant !== null;
  const productListGrant = productReadGrant ?? productManageGrant;
  const supplierManageGrant = await authorizeStaff(staff, "suppliers.manage");
  const inventoryBranchAccess = await Promise.all(
    (branches ?? []).map(async (branch) => {
      const [
        inventoryRead,
        inventoryManage,
        inventoryAdjust,
        inventoryTransfer,
        inventoryApprove,
        procurementRead,
        procurementManage,
        procurementApprove,
        procurementCostRead,
        inventoryCostRead,
        posRead,
        posManage,
        posRefund,
      ] = await Promise.all([
        authorizeStaff(staff, "inventory.read", branch.id),
        authorizeStaff(staff, "inventory.manage", branch.id),
        authorizeStaff(staff, "inventory.adjust", branch.id),
        authorizeStaff(staff, "inventory.transfer", branch.id),
        authorizeStaff(staff, "inventory.approve", branch.id),
        authorizeStaff(staff, "procurement.read", branch.id),
        authorizeStaff(staff, "procurement.manage", branch.id),
        authorizeStaff(staff, "procurement.approve", branch.id),
        authorizeStaff(staff, "procurement.cost.read", branch.id),
        authorizeStaff(staff, "inventory.cost.read", branch.id),
        authorizeStaff(staff, "pos.read", branch.id),
        authorizeStaff(staff, "pos.manage", branch.id),
        authorizeStaff(staff, "pos.refund", branch.id),
      ]);
      return {
        id: branch.id,
        name: branch.name,
        inventoryRead: inventoryRead !== null,
        inventoryManage: inventoryManage !== null,
        inventoryAdjust: inventoryAdjust !== null,
        inventoryTransfer: inventoryTransfer !== null,
        inventoryApprove: inventoryApprove !== null,
        procurementRead: procurementRead !== null,
        procurementManage: procurementManage !== null,
        procurementApprove: procurementApprove !== null,
        procurementCostRead: procurementCostRead !== null,
        inventoryCostRead: inventoryCostRead !== null,
        posRead: posRead !== null,
        posManage: posManage !== null,
        posRefund: posRefund !== null,
      };
    }),
  );
  const customers = customerReadGrant
    ? await listCustomers(staff.id, customerReadGrant.dataScope)
    : [];
  const petRecords = petReadGrant ? await listPets(staff.id, petReadGrant.dataScope) : [];
  const [rawProducts, productOptions, rawServices, serviceCategories, servicePriceTiers] =
    await Promise.all([
      productListGrant
        ? listProducts(
            staff.id,
            productListGrant.dataScope,
            productCostReadGrant?.dataScope ?? null,
          )
        : Promise.resolve([]),
      productReadGrant || productManageGrant
        ? listProductCatalogOptions()
        : Promise.resolve({ categories: [], units: [], priceTiers: [] }),
      serviceReadGrant ? listServices(staff.id, serviceReadGrant.dataScope) : Promise.resolve([]),
      serviceReadGrant || serviceManageGrant ? listServiceCategories() : Promise.resolve([]),
      serviceReadGrant || serviceManageGrant ? listServicePriceTiers() : Promise.resolve([]),
    ]);
  const productSummaries = rawProducts.map((product) => ({
    ...product,
    canEdit:
      productManageGrant?.dataScope === "all" ||
      (productManageGrant?.dataScope === "own" && product.createdBy === staff.id),
    canReadCost:
      productCostReadGrant?.dataScope === "all" ||
      (productCostReadGrant?.dataScope === "own" && product.createdBy === staff.id),
    canManageCost:
      productCostManageGrant?.dataScope === "all" ||
      (productCostManageGrant?.dataScope === "own" && product.createdBy === staff.id),
  }));
  const serviceSummaries = rawServices.map((service) => ({
    ...service,
    canEdit:
      serviceManageGrant?.dataScope === "all" ||
      (serviceManageGrant?.dataScope === "own" && service.createdBy === staff.id),
  }));
  const ownedCustomerIds = new Set(
    customers.filter(({ createdBy }) => createdBy === staff.id).map(({ id }) => id),
  );
  const petSummaries = petRecords.map((pet) => ({
    ...pet,
    canEdit:
      petManageGrant?.dataScope === "all" ||
      (petManageGrant?.dataScope === "own" &&
        pet.owners.every(({ customerId }) => ownedCustomerIds.has(customerId))),
  }));
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
      {petReadGrant || petManageGrant ? (
        <PetManagement
          canRead={petReadGrant !== null}
          customers={customers.map(({ id, name }) => ({ id, name }))}
          manageScope={petManageGrant?.dataScope ?? null}
          pets={petSummaries}
        />
      ) : null}
      {productReadGrant || productManageGrant ? (
        <ProductManagement
          branches={(branches ?? []).map(({ id, name }) => ({ id, name }))}
          canRead={productReadGrant !== null || productManageGrant !== null}
          costManageScope={productCostManageGrant?.dataScope ?? null}
          manageScope={productManageGrant?.dataScope ?? null}
          options={productOptions}
          products={productSummaries}
        />
      ) : null}
      {serviceReadGrant || serviceManageGrant ? (
        <ServiceManagement
          branches={(branches ?? []).map(({ id, name }) => ({ id, name }))}
          canRead={serviceReadGrant !== null}
          categories={serviceCategories}
          manageScope={serviceManageGrant?.dataScope ?? null}
          priceTiers={servicePriceTiers}
          services={serviceSummaries}
        />
      ) : null}
      {inventoryBranchAccess.some(
        (branch) =>
          branch.inventoryRead ||
          branch.inventoryManage ||
          branch.inventoryAdjust ||
          branch.inventoryTransfer ||
          branch.inventoryApprove ||
          branch.procurementRead ||
          branch.procurementManage,
      ) ? (
        <InventoryManagement
          branches={inventoryBranchAccess}
          canManageSuppliers={supplierManageGrant !== null}
          products={rawProducts
            .filter(({ isActive }) => isActive)
            .map(({ id, name, sku, variants }) => ({
              id,
              name,
              sku,
              variants: variants.map(({ id: variantId, name: variantName }) => ({
                id: variantId,
                name: variantName,
              })),
            }))}
        />
      ) : null}
      {inventoryBranchAccess.some(
        (branch) => branch.posRead || branch.posManage || branch.posRefund,
      ) ? (
        <PosManagement
          branches={inventoryBranchAccess
            .filter(({ posRead, posManage, posRefund }) => posRead || posManage || posRefund)
            .map(({ id, name, posRead, posManage, posRefund }) => ({
              id,
              name,
              posRead,
              posManage,
              posRefund,
            }))}
          customers={customerSummaries.map(({ id, name }) => ({ id, name }))}
          pets={petSummaries
            .filter(({ status }) => status === "active")
            .map(({ id, name, owners }) => ({
              id,
              name,
              owners: owners.map(({ customerId, name: ownerName }) => ({
                customerId,
                name: ownerName,
              })),
            }))}
          staffId={staff.id}
          taxEnabled={settings.taxEnabled}
          taxIncluded={settings.taxIncluded}
          taxRateBps={settings.taxRateBps}
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
