"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { CustomerRecord } from "@/server/customers/service";

type CustomerSummary = Omit<CustomerRecord, "createdBy"> & { canEdit: boolean };

interface CustomerManagementProps {
  customers: CustomerSummary[];
  canRead: boolean;
  canClearSamples: boolean;
  manageScope: PermissionDataScope | null;
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
          <button className="button button--primary" disabled={submitting} type="submit">
            {submitting ? "Menyimpan..." : "Simpan pelanggan"}
          </button>
        </form>
      ) : null}
      {canRead ? (
        <div>
          <h3>Daftar pelanggan terbaru</h3>
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
          {customers.length > 0 ? (
            <ul className="staff-list">
              {customers.map((customer) => (
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
                      </div>
                      {canEdit(customer) ? (
                        <button
                          className="button button--quiet"
                          onClick={() => setEditingCustomerId(customer.id)}
                          type="button"
                        >
                          Ubah
                        </button>
                      ) : null}
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="auth-card__description">Belum ada data pelanggan dalam cakupan Anda.</p>
          )}
          {customers.length === 50 ? (
            <p className="auth-form__hint">Menampilkan 50 pelanggan terbaru.</p>
          ) : null}
        </div>
      ) : manageScope ? (
        <p className="auth-card__description">
          Anda dapat menambahkan pelanggan, tetapi tidak memiliki izin melihat daftar.
        </p>
      ) : null}
      {message ? (
        <p className="auth-form__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
