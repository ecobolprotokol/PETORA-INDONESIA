"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, Fragment, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";
import type {
  listAccessRoles,
  listPermissionCatalog,
  listPermissionOverrides,
} from "@/server/access/service";
import type { StaffUserSummary } from "@/server/staff/service";

type RoleOption = Awaited<ReturnType<typeof listAccessRoles>>[number];
type PermissionOption = Awaited<ReturnType<typeof listPermissionCatalog>>[number];
type PermissionOverride = Awaited<ReturnType<typeof listPermissionOverrides>>[number];

function parseFinancialCap(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000) {
    return null;
  }
  return Math.floor(parsed);
}

function parseFinancialCents(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 999_999_999_999) {
    return null;
  }
  return Math.floor(parsed);
}

interface BranchOption {
  id: string;
  code: string;
  name: string;
}

interface StaffManagementProps {
  staff: StaffUserSummary[];
  roles: RoleOption[];
  permissions: PermissionOption[];
  branches: BranchOption[];
  overrides: PermissionOverride[];
}

export function StaffManagement({
  staff,
  roles,
  permissions,
  branches,
  overrides,
}: StaffManagementProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [overridePermissionKey, setOverridePermissionKey] = useState(permissions[0]?.key ?? "");
  const [overrideEffect, setOverrideEffect] = useState<"allow" | "deny">("allow");
  const [editingRole, setEditingRole] = useState<RoleOption | null>(null);
  const [cloningRole, setCloningRole] = useState<RoleOption | null>(null);

  async function send(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    payload: unknown,
    form?: HTMLFormElement,
  ): Promise<boolean> {
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Perubahan belum dapat disimpan."));
        return false;
      }

      setMessage("Perubahan berhasil disimpan.");
      form?.reset();
      router.refresh();
      return true;
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    void send(
      "/api/staff",
      "POST",
      {
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      },
      form,
    );
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedPermissions = formData
      .getAll("permissions")
      .filter((permission): permission is string => typeof permission === "string")
      .map((key) => ({
        key,
        dataScope: formData.get(`permissionScope:${key}`) === "own" ? "own" : "all",
        maxDiscountBps: parseFinancialCap(formData.get(`maxDiscountBps:${key}`)),
        maxRefundCents: parseFinancialCents(formData.get(`maxRefundCents:${key}`)),
        maxVoidCents: parseFinancialCents(formData.get(`maxVoidCents:${key}`)),
        maxTransferCents: parseFinancialCents(formData.get(`maxTransferCents:${key}`)),
        requiresSupervisorPin: formData.get(`requiresSupervisorPin:${key}`) === "on",
      }));

    const saved = await send(
      editingRole ? `/api/access/roles/${editingRole.id}` : "/api/access/roles",
      editingRole ? "PATCH" : "POST",
      {
        name: formData.get("name"),
        description: formData.get("description"),
        requiresTwoFactor: formData.get("requiresTwoFactor") === "on",
        permissions: selectedPermissions,
        ...(editingRole ? { isActive: formData.get("isActive") === "on" } : {}),
      },
      form,
    );
    if (saved) {
      setEditingRole(null);
      setCloningRole(null);
    }
  }

  function assignRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const branchId = formData.get("branchId");

    void send(
      "/api/access/role-assignments",
      "POST",
      {
        staffUserId: formData.get("staffUserId"),
        roleId: formData.get("roleId"),
        branchId: typeof branchId === "string" && branchId ? branchId : null,
      },
      form,
    );
  }

  function savePermissionOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const permission = permissions.find(({ key }) => key === overridePermissionKey);
    const branchId = formData.get("overrideBranchId");

    void send(
      "/api/access/permission-overrides",
      "POST",
      {
        staffUserId: formData.get("overrideStaffUserId"),
        permissionKey: overridePermissionKey,
        branchId:
          permission?.branchScoped && typeof branchId === "string" && branchId ? branchId : null,
        effect: overrideEffect,
        dataScope:
          overrideEffect === "allow" ? (formData.get("overrideDataScope") ?? "all") : "all",
        reason: formData.get("reason"),
        maxDiscountBps: parseFinancialCap(formData.get("overrideMaxDiscountBps")),
        maxRefundCents: parseFinancialCents(formData.get("overrideMaxRefundCents")),
        maxVoidCents: parseFinancialCents(formData.get("overrideMaxVoidCents")),
        maxTransferCents: parseFinancialCents(formData.get("overrideMaxTransferCents")),
        requiresSupervisorPin: formData.get("overrideRequiresSupervisorPin") === "on",
      },
      form,
    );
  }

  async function updateStaff(event: FormEvent<HTMLFormElement>, staffUserId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = formData.get("password");
    const updated = await send(
      `/api/staff/${staffUserId}`,
      "PATCH",
      {
        name: formData.get("name"),
        email: formData.get("email"),
        ...(typeof password === "string" && password ? { password } : {}),
      },
      form,
    );

    if (updated) {
      setEditingStaffId(null);
    }
  }

  return (
    <section aria-labelledby="staff-management-title" className="staff-management">
      <div>
        <p className="welcome__eyebrow">AKSES TIM</p>
        <h2 id="staff-management-title">Staf dan peran</h2>
        <h3>Peran tersedia</h3>
        {roles.length ? (
          <ul className="staff-list">
            {roles.map((role) => (
              <li key={role.id}>
                <div>
                  <strong>{role.name}</strong>
                  <span>
                    {role.isActive ? "Aktif" : "Nonaktif"}
                    {role.requiresTwoFactor ? " · 2FA wajib" : ""}
                  </span>
                  <span>
                    {role.permissions.map(({ description }) => description).join(" · ") ||
                      "Tanpa izin"}
                  </span>
                </div>
                <div className="staff-list__actions">
                  <button
                    className="button button--quiet"
                    disabled={submitting}
                    onClick={() => {
                      setCloningRole(null);
                      setEditingRole(role);
                    }}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="button button--quiet"
                    disabled={submitting}
                    onClick={() => {
                      setEditingRole(null);
                      setCloningRole(role);
                    }}
                    type="button"
                  >
                    Klon
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="auth-card__description">Belum ada peran kustom.</p>
        )}
        <ul className="staff-list">
          {staff.map((staffUser) => (
            <Fragment key={staffUser.id}>
              <li>
                <div>
                  <strong>{staffUser.name}</strong>
                  <span>{staffUser.email}</span>
                  <span>
                    {staffUser.isOwner ? "Owner" : staffUser.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                  {!staffUser.isOwner ? (
                    <span>{staffUser.hasTwoFactor ? "2FA aktif" : "2FA belum aktif"}</span>
                  ) : null}
                  {staffUser.assignments.map((assignment) => (
                    <span key={`${assignment.roleId}-${assignment.branchId ?? "global"}`}>
                      {assignment.roleName} · {assignment.branchName ?? "Semua cabang"}
                    </span>
                  ))}
                </div>
                <div className="staff-list__actions">
                  <button
                    className="button button--quiet"
                    disabled={submitting}
                    onClick={() =>
                      setEditingStaffId(editingStaffId === staffUser.id ? null : staffUser.id)
                    }
                    type="button"
                  >
                    {editingStaffId === staffUser.id ? "Tutup edit" : "Edit"}
                  </button>
                  {!staffUser.isOwner ? (
                    <button
                      className="button button--quiet"
                      disabled={submitting}
                      onClick={() =>
                        void send(`/api/staff/${staffUser.id}`, "PATCH", {
                          isActive: !staffUser.isActive,
                        })
                      }
                      type="button"
                    >
                      {staffUser.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  ) : null}
                </div>
              </li>
              {editingStaffId === staffUser.id ? (
                <li>
                  <form
                    className="auth-form staff-edit-form"
                    onSubmit={(event) => void updateStaff(event, staffUser.id)}
                  >
                    <label>
                      Nama
                      <input
                        autoComplete="name"
                        defaultValue={staffUser.name}
                        maxLength={80}
                        minLength={2}
                        name="name"
                        required
                      />
                    </label>
                    <label>
                      Email
                      <input
                        autoComplete="email"
                        defaultValue={staffUser.email}
                        maxLength={254}
                        name="email"
                        required
                        type="email"
                      />
                    </label>
                    <label>
                      Kata sandi baru (opsional)
                      <input
                        autoComplete="new-password"
                        maxLength={128}
                        minLength={12}
                        name="password"
                        type="password"
                      />
                    </label>
                    <button className="button button--primary" disabled={submitting} type="submit">
                      Simpan perubahan
                    </button>
                  </form>
                </li>
              ) : null}
            </Fragment>
          ))}
        </ul>
      </div>

      <div className="staff-management__forms">
        <form className="auth-form" onSubmit={createStaff}>
          <h3>Tambah staf</h3>
          <label>
            Nama
            <input autoComplete="name" maxLength={80} minLength={2} name="name" required />
          </label>
          <label>
            Email
            <input autoComplete="email" maxLength={254} name="email" required type="email" />
          </label>
          <label>
            Kata sandi awal
            <input
              autoComplete="new-password"
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          <button className="button button--primary" disabled={submitting} type="submit">
            Buat akun staf
          </button>
        </form>

        <form
          className="auth-form"
          key={editingRole?.id ?? cloningRole?.id ?? "new-role"}
          onSubmit={(event) => void saveRole(event)}
        >
          <h3>{editingRole ? "Edit peran" : cloningRole ? "Klon peran" : "Buat peran"}</h3>
          <label>
            Nama peran
            <input
              defaultValue={
                editingRole?.name ??
                (cloningRole ? `${cloningRole.name.slice(0, 70)} - salinan` : "")
              }
              maxLength={80}
              minLength={2}
              name="name"
              required
            />
          </label>
          <label>
            Keterangan
            <input
              defaultValue={editingRole?.description ?? cloningRole?.description}
              maxLength={500}
              name="description"
            />
          </label>
          <label className="permission-option">
            <input
              defaultChecked={
                editingRole?.requiresTwoFactor ?? cloningRole?.requiresTwoFactor ?? false
              }
              name="requiresTwoFactor"
              type="checkbox"
            />
            <span>Wajibkan autentikasi dua langkah untuk staf dengan peran ini</span>
          </label>
          {editingRole ? (
            <label className="permission-option">
              <input defaultChecked={editingRole.isActive} name="isActive" type="checkbox" />
              <span>Peran aktif</span>
            </label>
          ) : null}
          <fieldset className="permission-options">
            <legend>Izin</legend>
            {permissions.map((permission) => (
              <div className="permission-option" key={permission.key}>
                <label>
                  <input
                    defaultChecked={(editingRole ?? cloningRole)?.permissions.some(
                      ({ key }) => key === permission.key,
                    )}
                    name="permissions"
                    type="checkbox"
                    value={permission.key}
                  />
                  <span>{permission.description}</span>
                  {permission.highRisk ? (
                    <span className="auth-form__hint">
                      Akses sensitif — berikan hanya kepada admin tepercaya.
                    </span>
                  ) : null}
                </label>
                {permission.supportsOwnScope ? (
                  <label>
                    Cakupan data
                    <select
                      defaultValue={
                        (editingRole ?? cloningRole)?.permissions.find(
                          ({ key }) => key === permission.key,
                        )?.dataScope ?? "all"
                      }
                      name={`permissionScope:${permission.key}`}
                    >
                      <option value="all">Semua data pada cabang yang ditugaskan</option>
                      <option value="own">Hanya cabang yang dibuat staf</option>
                    </select>
                  </label>
                ) : null}
                <label>
                  Maks. diskon (bps, optional)
                  <input
                    defaultValue={
                      (editingRole ?? cloningRole)?.permissions.find(
                        ({ key }) => key === permission.key,
                      )?.maxDiscountBps ?? ""
                    }
                    max={10_000}
                    min={0}
                    name={`maxDiscountBps:${permission.key}`}
                    type="number"
                  />
                </label>
                <label>
                  Maks. refund (sen, optional)
                  <input
                    defaultValue={
                      (editingRole ?? cloningRole)?.permissions.find(
                        ({ key }) => key === permission.key,
                      )?.maxRefundCents ?? ""
                    }
                    max={999_999_999_999}
                    min={0}
                    name={`maxRefundCents:${permission.key}`}
                    type="number"
                  />
                </label>
                <label>
                  Maks. void (sen, optional)
                  <input
                    defaultValue={
                      (editingRole ?? cloningRole)?.permissions.find(
                        ({ key }) => key === permission.key,
                      )?.maxVoidCents ?? ""
                    }
                    max={999_999_999_999}
                    min={0}
                    name={`maxVoidCents:${permission.key}`}
                    type="number"
                  />
                </label>
                <label>
                  Maks. transfer (sen, optional)
                  <input
                    defaultValue={
                      (editingRole ?? cloningRole)?.permissions.find(
                        ({ key }) => key === permission.key,
                      )?.maxTransferCents ?? ""
                    }
                    max={999_999_999_999}
                    min={0}
                    name={`maxTransferCents:${permission.key}`}
                    type="number"
                  />
                </label>
                <label className="permission-option">
                  <input
                    defaultChecked={
                      (editingRole ?? cloningRole)?.permissions.find(
                        ({ key }) => key === permission.key,
                      )?.requiresSupervisorPin ?? false
                    }
                    name={`requiresSupervisorPin:${permission.key}`}
                    type="checkbox"
                  />
                  <span>Wajibkan PIN supervisor untuk aksi ini</span>
                </label>
              </div>
            ))}
          </fieldset>
          <button className="button button--primary" disabled={submitting} type="submit">
            {editingRole ? "Simpan perubahan peran" : "Simpan peran"}
          </button>
          {editingRole || cloningRole ? (
            <button
              className="button button--quiet"
              onClick={() => {
                setEditingRole(null);
                setCloningRole(null);
              }}
              type="button"
            >
              Batal
            </button>
          ) : null}
        </form>

        <form className="auth-form" onSubmit={assignRole}>
          <h3>Tugaskan peran</h3>
          <label>
            Staf
            <select name="staffUserId" required>
              <option value="">Pilih staf</option>
              {staff
                .filter((staffUser) => !staffUser.isOwner)
                .map((staffUser) => (
                  <option key={staffUser.id} value={staffUser.id}>
                    {staffUser.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Peran
            <select name="roleId" required>
              <option value="">Pilih peran</option>
              {roles
                .filter((role) => role.isActive)
                .map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                    {role.requiresTwoFactor ? " · 2FA wajib" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Cakupan cabang
            <select defaultValue="" name="branchId">
              <option value="">Semua cabang</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </label>
          <button
            className="button button--primary"
            disabled={
              submitting || staff.every((staffUser) => staffUser.isOwner) || roles.length === 0
            }
            type="submit"
          >
            Tugaskan peran
          </button>
        </form>

        <form className="auth-form" onSubmit={savePermissionOverride}>
          <h3>Pengecualian izin staf</h3>
          <label>
            Staf
            <select name="overrideStaffUserId" required>
              <option value="">Pilih staf</option>
              {staff
                .filter((staffUser) => !staffUser.isOwner)
                .map((staffUser) => (
                  <option key={staffUser.id} value={staffUser.id}>
                    {staffUser.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Izin
            <select
              name="permissionKey"
              onChange={(event) => setOverridePermissionKey(event.currentTarget.value)}
              value={overridePermissionKey}
            >
              {permissions.map((permission) => (
                <option key={permission.key} value={permission.key}>
                  {permission.description}
                </option>
              ))}
            </select>
          </label>
          {permissions.find(({ key }) => key === overridePermissionKey)?.branchScoped ? (
            <label>
              Cabang
              <select name="overrideBranchId" required>
                <option value="">Pilih cabang</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Keputusan
            <select
              name="effect"
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (value === "allow" || value === "deny") {
                  setOverrideEffect(value);
                }
              }}
              value={overrideEffect}
            >
              <option value="allow">Izinkan</option>
              <option value="deny">Tolak</option>
            </select>
          </label>
          {overrideEffect === "allow" &&
          permissions.find(({ key }) => key === overridePermissionKey)?.supportsOwnScope ? (
            <label>
              Cakupan data
              <select name="overrideDataScope">
                <option value="all">Semua data</option>
                <option value="own">Data milik sendiri</option>
              </select>
            </label>
          ) : null}
          <label>
            Maks. diskon (bps, optional)
            <input name="overrideMaxDiscountBps" type="number" min={0} max={10_000} />
          </label>
          <label>
            Maks. refund (sen, optional)
            <input name="overrideMaxRefundCents" type="number" min={0} max={999_999_999_999} />
          </label>
          <label>
            Maks. void (sen, optional)
            <input name="overrideMaxVoidCents" type="number" min={0} max={999_999_999_999} />
          </label>
          <label>
            Maks. transfer (sen, optional)
            <input name="overrideMaxTransferCents" type="number" min={0} max={999_999_999_999} />
          </label>
          <label className="permission-option">
            <input name="overrideRequiresSupervisorPin" type="checkbox" />
            <span>Wajibkan PIN supervisor</span>
          </label>
          <label>
            Alasan
            <input maxLength={500} minLength={5} name="reason" required />
          </label>
          <button
            className="button button--primary"
            disabled={submitting || staff.every((staffUser) => staffUser.isOwner)}
            type="submit"
          >
            Simpan pengecualian
          </button>
        </form>
      </div>
      <div>
        <h3>Pengecualian aktif</h3>
        {overrides.length ? (
          <ul className="staff-list">
            {overrides.map((override) => (
              <li key={override.id}>
                <div>
                  <strong>
                    {override.staffName} · {override.effect === "allow" ? "Diizinkan" : "Ditolak"}
                  </strong>
                  <span>{override.permissionKey}</span>
                  <span>
                    {override.branchName ?? "Semua cakupan"} · {override.reason}
                    {override.maxDiscountBps != null
                      ? ` · Maks diskon ${override.maxDiscountBps} bps`
                      : ""}
                    {override.maxRefundCents != null
                      ? ` · Maks refund ${override.maxRefundCents} sen`
                      : ""}
                    {override.maxVoidCents != null
                      ? ` · Maks void ${override.maxVoidCents} sen`
                      : ""}
                    {override.maxTransferCents != null
                      ? ` · Maks transfer ${override.maxTransferCents} sen`
                      : ""}
                    {override.requiresSupervisorPin ? " · PIN supervisor wajib" : ""}
                  </span>
                </div>
                <button
                  className="button button--quiet"
                  disabled={submitting}
                  onClick={() =>
                    void send(`/api/access/permission-overrides/${override.id}`, "DELETE", {})
                  }
                  type="button"
                >
                  Hapus pengecualian
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="auth-card__description">Belum ada pengecualian izin.</p>
        )}
      </div>
      {message ? (
        <p className="auth-form__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
