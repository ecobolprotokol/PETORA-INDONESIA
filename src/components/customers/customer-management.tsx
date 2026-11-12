"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { CustomerRecord } from "@/server/customers/service";

type CustomerSummary = Pick<
  CustomerRecord,
  | "id"
  | "name"
  | "phone"
  | "email"
  | "isSample"
  | "address"
  | "notes"
  | "tags"
  | "marketingConsent"
  | "notificationPreferences"
> & { canEdit: boolean };
type DuplicateCandidate = Pick<CustomerRecord, "id" | "name" | "phone">;

interface CustomerManagementProps {
  customers: CustomerSummary[];
  canRead: boolean;
  canClearSamples: boolean;
  manageScope: PermissionDataScope | null;
}

function isCustomerSummary(value: unknown): value is CustomerSummary {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "phone" in value &&
    typeof value.phone === "string" &&
    "email" in value &&
    (typeof value.email === "string" || value.email === null) &&
    "address" in value &&
    (typeof value.address === "string" || value.address === null) &&
    "notes" in value &&
    (typeof value.notes === "string" || value.notes === null) &&
    "tags" in value &&
    Array.isArray(value.tags) &&
    "isSample" in value &&
    typeof value.isSample === "boolean" &&
    "marketingConsent" in value &&
    typeof value.marketingConsent === "boolean" &&
    "notificationPreferences" in value &&
    typeof value.notificationPreferences === "object" &&
    value.notificationPreferences !== null &&
    "appointments" in value.notificationPreferences &&
    typeof value.notificationPreferences.appointments === "boolean" &&
    "marketing" in value.notificationPreferences &&
    typeof value.notificationPreferences.marketing === "boolean" &&
    "canEdit" in value &&
    typeof value.canEdit === "boolean"
  );
}

export function CustomerManagement({
  customers,
  canRead,
  canClearSamples,
  manageScope,
}: CustomerManagementProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [clearingSamples, setClearingSamples] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateCandidate[]>([]);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCustomers, setVisibleCustomers] = useState(customers);
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setVisibleCustomers(customers), [customers]);

  async function searchCustomers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();
    if (!query) {
      setVisibleCustomers(customers);
      return;
    }
    setMessage("");
    try {
      const response = await fetch(`/api/customers?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const result: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("customers" in result) ||
        !Array.isArray(result.customers) ||
        !result.customers.every(isCustomerSummary)
      ) {
        setMessage(getApiErrorMessage(result, "Pencarian pelanggan belum dapat dilakukan."));
        return;
      }
      setVisibleCustomers(result.customers);
      setMergeSourceId(null);
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }
  }

  async function checkCustomerDuplicates(form: HTMLFormElement) {
    const formData = new FormData(form);
    const params = new URLSearchParams({
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
    });
    setMessage("");
    try {
      const response = await fetch(`/api/customers/duplicates?${params}`, { cache: "no-store" });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Duplikasi pelanggan belum dapat diperiksa."));
        return;
      }
      if (
        typeof result !== "object" ||
        result === null ||
        !("customers" in result) ||
        !Array.isArray(result.customers)
      ) {
        setMessage("Respons pemeriksaan duplikasi tidak valid.");
        return;
      }
      const candidates = result.customers.filter(
        (candidate): candidate is DuplicateCandidate =>
          typeof candidate === "object" &&
          candidate !== null &&
          "id" in candidate &&
          typeof candidate.id === "string" &&
          "name" in candidate &&
          typeof candidate.name === "string" &&
          "phone" in candidate &&
          typeof candidate.phone === "string",
      );
      if (candidates.length !== result.customers.length) {
        setMessage("Respons pemeriksaan duplikasi tidak valid.");
        return;
      }
      setDuplicateMatches(candidates);
      setMessage(
        result.customers.length
          ? "Ditemukan kemungkinan data pelanggan yang sama."
          : "Tidak ditemukan pelanggan dengan nomor, email, atau nama yang sama.",
      );
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }
  }

  async function mergeCustomer() {
    if (!mergeSourceId || !mergeTargetId) {
      setMessage("Pilih data pelanggan yang akan dipertahankan.");
      return;
    }
    if (!window.confirm("Gabungkan pelanggan terpilih? Tindakan ini tidak dapat dibatalkan.")) {
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duplicateCustomerId: mergeSourceId,
          keepCustomerId: mergeTargetId,
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Pelanggan belum dapat digabungkan."));
        return;
      }
      setMergeSourceId(null);
      setMergeTargetId("");
      setMessage(
        "Data pelanggan berhasil digabungkan. Persetujuan dan preferensi tetap mengikuti data utama.",
      );
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function importCustomerCsv() {
    const file = importFileRef.current?.files?.[0];
    if (!file) {
      setMessage("Pilih berkas CSV pelanggan terlebih dahulu.");
      return;
    }
    if (file.size > 1_000_000) {
      setMessage("Ukuran CSV maksimum 1 MB.");
      return;
    }
    setImporting(true);
    setMessage("");
    try {
      const csv = await file.text();
      const response = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Impor pelanggan belum dapat dilakukan."));
        return;
      }
      const imported =
        typeof result === "object" && result !== null && "imported" in result
          ? result.imported
          : null;
      if (typeof imported !== "number") {
        setMessage("Respons server untuk impor pelanggan tidak valid.");
        return;
      }
      if (importFileRef.current) {
        importFileRef.current.value = "";
      }
      setMessage(`${imported} pelanggan berhasil diimpor.`);
      router.refresh();
    } catch {
      setMessage("Berkas CSV belum dapat dibaca. Periksa berkas lalu coba lagi.");
    } finally {
      setImporting(false);
    }
  }

  async function saveCustomer(
    path: string,
    method: "POST" | "PATCH",
    payload: unknown,
    form: HTMLFormElement,
  ) {
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
        setMessage(getApiErrorMessage(result, "Data pelanggan belum dapat disimpan."));
        return;
      }

      form.reset();
      setEditingCustomerId(null);
      setMessage("Data pelanggan berhasil disimpan.");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    void saveCustomer(
      "/api/customers",
      "POST",
      {
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        address: formData.get("address"),
        notes: formData.get("notes"),
        tags: String(formData.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        marketingConsent: formData.get("marketingConsent") === "on",
        notificationPreferences: {
          appointments: formData.get("notifyAppointments") === "on",
          marketing: formData.get("notifyMarketing") === "on",
        },
      },
      form,
    );
  }

  function submitUpdate(event: FormEvent<HTMLFormElement>, customerId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    void saveCustomer(
      `/api/customers/${customerId}`,
      "PATCH",
      {
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        address: formData.get("address"),
        notes: formData.get("notes"),
        tags: String(formData.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        marketingConsent: formData.get("marketingConsent") === "on",
        notificationPreferences: {
          appointments: formData.get("notifyAppointments") === "on",
          marketing: formData.get("notifyMarketing") === "on",
        },
      },
      form,
    );
  }

  function canEdit(customer: CustomerSummary) {
    return customer.canEdit;
  }

  async function clearSampleData() {
    if (
      !window.confirm("Hapus semua data contoh pelanggan? Data pelanggan biasa tidak terpengaruh.")
    ) {
      return;
    }

    setMessage("");
    setClearingSamples(true);
    try {
      const response = await fetch("/api/customers/samples", { method: "DELETE" });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Data contoh belum dapat dihapus."));
        return;
      }

      const deleted =
        typeof result === "object" && result !== null && "deleted" in result
          ? result.deleted
          : null;
      if (typeof deleted !== "number") {
        setMessage("Respons server untuk penghapusan data contoh tidak valid.");
        return;
      }

      setMessage(`${deleted} data contoh pelanggan dihapus.`);
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setClearingSamples(false);
    }
  }

  return (
    <section aria-labelledby="customers-title" className="staff-management">
      <div>
        <p className="welcome__eyebrow">OPERASIONAL</p>
        <h2 id="customers-title">Pelanggan</h2>
        <p className="auth-card__description">
          Data kontak bersama untuk seluruh cabang. Cakupan “milik sendiri” hanya menampilkan data
          yang dibuat oleh akun Anda.
        </p>
      </div>
      {manageScope ? (
        <form className="auth-form" onSubmit={submitCreate}>
          <h3>Tambah pelanggan</h3>
          <label>
            Nama pelanggan
            <input autoComplete="name" maxLength={120} minLength={2} name="name" required />
          </label>
          <label>
            Nomor telepon
            <input
              autoComplete="tel"
              maxLength={24}
              minLength={8}
              name="phone"
              pattern="(?:\+62|62|0)[0-9 ()-]{7,18}"
              required
              type="tel"
            />
          </label>
          <label>
            Email (opsional)
            <input autoComplete="email" maxLength={254} name="email" type="email" />
          </label>
          <button
            className="button button--quiet"
            disabled={submitting}
            onClick={(event) => {
              const form = event.currentTarget.form;
              if (form) {
                void checkCustomerDuplicates(form);
              }
            }}
            type="button"
          >
            Periksa kemungkinan duplikasi
          </button>
          <label>
            Alamat (opsional)
            <input autoComplete="street-address" maxLength={500} name="address" />
          </label>
          <label>
            Catatan internal
            <textarea maxLength={4000} name="notes" />
          </label>
          <label>
            Tag (pisahkan dengan koma)
            <input maxLength={400} name="tags" />
          </label>
          <label className="permission-option">
            <input name="marketingConsent" type="checkbox" />
            <span>Pelanggan menyetujui pesan promosi</span>
          </label>
          <label className="permission-option">
            <input defaultChecked name="notifyAppointments" type="checkbox" />
            <span>Izinkan pengingat janji temu</span>
          </label>
          <label className="permission-option">
            <input name="notifyMarketing" type="checkbox" />
            <span>Izinkan pesan promosi</span>
          </label>
          <button className="button button--primary" disabled={submitting} type="submit">
            {submitting ? "Menyimpan..." : "Simpan pelanggan"}
          </button>
        </form>
      ) : null}
      {canRead ? (
        <div>
          <h3>Daftar pelanggan terbaru</h3>
          <a className="button button--quiet" href="/api/customers/export">
            Ekspor CSV
          </a>
          {canClearSamples ? (
            <button
              className="button button--quiet"
              disabled={clearingSamples}
              onClick={() => void clearSampleData()}
              type="button"
            >
              {clearingSamples ? "Menghapus..." : "Hapus data contoh"}
            </button>
          ) : null}
          <form className="auth-form" onSubmit={(event) => void searchCustomers(event)}>
            <label>
              Cari pelanggan (nama, telepon, atau email)
              <input
                maxLength={120}
                onChange={(event) => setSearch(event.currentTarget.value)}
                value={search}
              />
            </label>
            <button className="button button--quiet" type="submit">
              Cari
            </button>
          </form>
          {visibleCustomers.length > 0 ? (
            <ul className="staff-list">
              {visibleCustomers.map((customer) => (
                <li key={customer.id}>
                  {editingCustomerId === customer.id ? (
                    <form
                      className="auth-form staff-edit-form"
                      onSubmit={(event) => submitUpdate(event, customer.id)}
                    >
                      <label>
                        Nama pelanggan
                        <input
                          autoComplete="name"
                          defaultValue={customer.name}
                          maxLength={120}
                          minLength={2}
                          name="name"
                          required
                        />
                      </label>
                      <label>
                        Nomor telepon
                        <input
                          autoComplete="tel"
                          defaultValue={customer.phone}
                          maxLength={24}
                          minLength={8}
                          name="phone"
                          pattern="(?:\+62|62|0)[0-9 ()-]{7,18}"
                          required
                          type="tel"
                        />
                      </label>
                      <label>
                        Email (opsional)
                        <input
                          autoComplete="email"
                          defaultValue={customer.email ?? ""}
                          maxLength={254}
                          name="email"
                          type="email"
                        />
                      </label>
                      <label>
                        Alamat (opsional)
                        <input
                          autoComplete="street-address"
                          defaultValue={customer.address ?? ""}
                          maxLength={500}
                          name="address"
                        />
                      </label>
                      <label>
                        Catatan internal
                        <textarea
                          defaultValue={customer.notes ?? ""}
                          maxLength={4000}
                          name="notes"
                        />
                      </label>
                      <label>
                        Tag (pisahkan dengan koma)
                        <input
                          defaultValue={customer.tags.join(", ")}
                          maxLength={400}
                          name="tags"
                        />
                      </label>
                      <label className="permission-option">
                        <input
                          defaultChecked={customer.marketingConsent}
                          name="marketingConsent"
                          type="checkbox"
                        />
                        <span>Pelanggan menyetujui pesan promosi</span>
                      </label>
                      <label className="permission-option">
                        <input
                          defaultChecked={customer.notificationPreferences.appointments}
                          name="notifyAppointments"
                          type="checkbox"
                        />
                        <span>Izinkan pengingat janji temu</span>
                      </label>
                      <label className="permission-option">
                        <input
                          defaultChecked={customer.notificationPreferences.marketing}
                          name="notifyMarketing"
                          type="checkbox"
                        />
                        <span>Izinkan pesan promosi</span>
                      </label>
                      <div className="staff-list__actions">
                        <button
                          className="button button--primary"
                          disabled={submitting}
                          type="submit"
                        >
                          Simpan
                        </button>
                        <button
                          className="button button--quiet"
                          onClick={() => setEditingCustomerId(null)}
                          type="button"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div>
                        <strong>{customer.name}</strong>
                        {customer.isSample ? <span>Data contoh</span> : null}
                        <span>{customer.phone}</span>
                        {customer.email ? <span>{customer.email}</span> : null}
                        {customer.address ? <span>{customer.address}</span> : null}
                        {customer.notes ? <span>Catatan: {customer.notes}</span> : null}
                        {customer.tags.length ? <span>Tag: {customer.tags.join(", ")}</span> : null}
                      </div>
                      {canEdit(customer) ? (
                        <div className="staff-list__actions">
                          <button
                            className="button button--quiet"
                            onClick={() => setEditingCustomerId(customer.id)}
                            type="button"
                          >
                            Ubah
                          </button>
                          {manageScope && visibleCustomers.length > 1 ? (
                            <button
                              className="button button--quiet"
                              onClick={() => {
                                setMergeSourceId(customer.id);
                                setMergeTargetId("");
                              }}
                              type="button"
                            >
                              Gabung
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {mergeSourceId === customer.id ? (
                        <div className="staff-list__actions">
                          <label>
                            Pertahankan data
                            <select
                              onChange={(event) => setMergeTargetId(event.target.value)}
                              value={mergeTargetId}
                            >
                              <option value="">Pilih pelanggan utama</option>
                              {visibleCustomers
                                .filter(
                                  (candidate) => candidate.id !== customer.id && candidate.canEdit,
                                )
                                .map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.name} · {candidate.phone}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <button
                            className="button button--primary"
                            disabled={submitting || !mergeTargetId}
                            onClick={() => void mergeCustomer()}
                            type="button"
                          >
                            Gabungkan data
                          </button>
                          <button
                            className="button button--quiet"
                            onClick={() => setMergeSourceId(null)}
                            type="button"
                          >
                            Batal
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="auth-card__description">Belum ada data pelanggan dalam cakupan Anda.</p>
          )}
          {visibleCustomers.length === 50 ? (
            <p className="auth-form__hint">Menampilkan 50 pelanggan terbaru.</p>
          ) : null}
          {duplicateMatches.length ? (
            <div>
              <h4>Kemungkinan pelanggan yang sama</h4>
              <ul className="staff-list">
                {duplicateMatches.map((customer) => (
                  <li key={customer.id}>
                    <span>
                      {customer.name} · {customer.phone}
                    </span>
                    {visibleCustomers.some(
                      (record) => record.id === customer.id && record.canEdit,
                    ) ? (
                      <button
                        className="button button--quiet"
                        onClick={() => setEditingCustomerId(customer.id)}
                        type="button"
                      >
                        Buka data
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : manageScope ? (
        <p className="auth-card__description">
          Anda dapat menambahkan pelanggan, tetapi tidak memiliki izin melihat daftar.
        </p>
      ) : null}
      {manageScope ? (
        <div className="auth-form">
          <h3>Impor pelanggan</h3>
          <p className="auth-form__hint">
            CSV maksimal 500 baris dan 1 MB. Kolom: name, phone, email, address, notes, tags
            (pisahkan dengan |), marketingConsent, notifyAppointments, notifyMarketing. Nomor yang
            sudah ada menolak seluruh impor agar tidak ada data parsial.
          </p>
          <label>
            Berkas CSV
            <input accept=".csv,text/csv" ref={importFileRef} type="file" />
          </label>
          <button
            className="button button--primary"
            disabled={importing}
            onClick={() => void importCustomerCsv()}
            type="button"
          >
            {importing ? "Mengimpor..." : "Impor CSV"}
          </button>
        </div>
      ) : null}
      {message ? (
        <p className="auth-form__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
