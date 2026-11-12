"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { ServiceRecord } from "@/server/services/service";

type ServiceSummary = ServiceRecord & { canEdit: boolean };
type PriceDraft = { id: string; branchId: string; priceTierId: string; price: string };

interface ServiceManagementProps {
  services: ServiceSummary[];
  categories: Array<{ id: string; name: string }>;
  priceTiers: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  canRead: boolean;
  manageScope: PermissionDataScope | null;
}

function centsToRupiah(cents: number) {
  return (cents / 100).toFixed(2);
}

function rupiahToCents(value: string) {
  const amount = Number(value.trim().replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : Number.NaN;
}

function emptyPrice(): PriceDraft {
  return { id: crypto.randomUUID(), branchId: "", priceTierId: "", price: "" };
}

export function ServiceManagement({
  services,
  categories,
  priceTiers,
  branches,
  canRead,
  manageScope,
}: ServiceManagementProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ServiceSummary | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [priceRows, setPriceRows] = useState<PriceDraft[]>([emptyPrice()]);

  const visibleServices = services.filter((service) =>
    `${service.name} ${service.code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  function editService(service: ServiceSummary) {
    setEditing(service);
    setPriceRows(
      service.prices.length
        ? service.prices.map((price) => ({
            id: price.id,
            branchId: price.branchId ?? "",
            priceTierId: price.priceTierId ?? "",
            price: centsToRupiah(price.priceCents),
          }))
        : [emptyPrice()],
    );
    setMessage("");
  }

  async function submitService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      code: data.get("code"),
      categoryId: data.get("categoryId") || null,
      description: data.get("description"),
      durationMinutes: Number(data.get("durationMinutes")),
      isActive: data.get("isActive") === "on",
      prices: priceRows.map((price) => ({
        branchId: price.branchId || null,
        priceTierId: price.priceTierId || null,
        priceCents: rupiahToCents(price.price),
      })),
    };
    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch(editing ? `/api/services/${editing.id}` : "/api/services", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Data layanan belum dapat disimpan."));
        return;
      }
      setEditing(null);
      setPriceRows([emptyPrice()]);
      setFormVersion((current) => current + 1);
      setMessage("Data layanan berhasil disimpan.");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/services/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: new FormData(form).get("name") }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Kategori layanan belum dapat disimpan."));
        return;
      }
      form.reset();
      setMessage("Kategori layanan berhasil ditambahkan.");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="services-title" className="customer-management">
      <div>
        <p className="welcome__eyebrow">DATA MASTER</p>
        <h2 id="services-title">Katalog layanan</h2>
        <p className="auth-card__description">
          Kelola layanan, durasi, kategori, dan harga berdasarkan cabang atau tingkat harga.
        </p>
      </div>
      {message ? (
        <p aria-live="polite" className="form-message">
          {message}
        </p>
      ) : null}
      {manageScope ? (
        <form
          className="auth-form staff-edit-form"
          key={editing?.id ?? `new-${formVersion}`}
          onSubmit={(event) => void submitService(event)}
        >
          <h3>{editing ? "Perbarui layanan" : "Tambah layanan"}</h3>
          <div className="staff-form-grid">
            <label>
              Nama layanan
              <input defaultValue={editing?.name} maxLength={160} name="name" required />
            </label>
            <label>
              Kode
              <input defaultValue={editing?.code} maxLength={80} name="code" required />
            </label>
            <label>
              Kategori
              <select defaultValue={editing?.categoryId ?? ""} name="categoryId">
                <option value="">Tanpa kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Durasi (menit)
              <input
                defaultValue={editing?.durationMinutes ?? 30}
                max="1440"
                min="1"
                name="durationMinutes"
                required
                type="number"
              />
            </label>
          </div>
          <label>
            Deskripsi
            <textarea
              defaultValue={editing?.description ?? ""}
              maxLength={4000}
              name="description"
            />
          </label>
          <label className="permission-option">
            <input defaultChecked={editing?.isActive ?? true} name="isActive" type="checkbox" />
            <span>Layanan aktif</span>
          </label>
          <div>
            <h4>Harga layanan (Rupiah)</h4>
            {priceRows.map((price, index) => (
              <div className="staff-form-grid" key={price.id}>
                <label>
                  Cabang
                  <select
                    onChange={(event) =>
                      setPriceRows((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, branchId: event.target.value } : row,
                        ),
                      )
                    }
                    value={price.branchId}
                  >
                    <option value="">Semua cabang</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tingkat harga
                  <select
                    onChange={(event) =>
                      setPriceRows((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, priceTierId: event.target.value } : row,
                        ),
                      )
                    }
                    value={price.priceTierId}
                  >
                    <option value="">Harga umum</option>
                    {priceTiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Harga
                  <input
                    min="0"
                    onChange={(event) =>
                      setPriceRows((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, price: event.target.value } : row,
                        ),
                      )
                    }
                    required
                    step="0.01"
                    type="number"
                    value={price.price}
                  />
                </label>
                <button
                  className="button button--quiet"
                  disabled={priceRows.length < 2}
                  onClick={() => setPriceRows((current) => current.filter((_, i) => i !== index))}
                  type="button"
                >
                  Hapus harga
                </button>
              </div>
            ))}
            <button
              className="button button--quiet"
              onClick={() => setPriceRows((rows) => [...rows, emptyPrice()])}
              type="button"
            >
              Tambah harga
            </button>
          </div>
          <div className="staff-list__actions">
            <button className="button button--primary" disabled={submitting} type="submit">
              {submitting ? "Menyimpan..." : editing ? "Simpan perubahan" : "Simpan layanan"}
            </button>
            {editing ? (
              <button
                className="button button--quiet"
                onClick={() => {
                  setEditing(null);
                  setPriceRows([emptyPrice()]);
                  setFormVersion((current) => current + 1);
                }}
                type="button"
              >
                Batal
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
      {manageScope ? (
        <details>
          <summary>Tambah kategori layanan</summary>
          <form className="auth-form" onSubmit={(event) => void submitCategory(event)}>
            <label>
              Nama kategori
              <input maxLength={120} name="name" required />
            </label>
            <button className="button button--primary" disabled={submitting} type="submit">
              Simpan kategori
            </button>
          </form>
        </details>
      ) : null}
      {canRead ? (
        <div>
          <label>
            Cari layanan
            <input onChange={(event) => setSearch(event.target.value)} value={search} />
          </label>
          <h3>Layanan terdaftar</h3>
          {visibleServices.length ? (
            <ul className="staff-list">
              {visibleServices.map((service) => (
                <li key={service.id}>
                  <div>
                    <strong>{service.name}</strong>
                    <span>
                      Kode: {service.code} · Durasi: {service.durationMinutes} menit
                    </span>
                    {service.categoryName ? <span>Kategori: {service.categoryName}</span> : null}
                    {service.prices.map((price) => (
                      <span key={price.id}>
                        {branches.find(({ id }) => id === price.branchId)?.name ?? "Semua cabang"}
                        {" · "}
                        {priceTiers.find(({ id }) => id === price.priceTierId)?.name ?? "Umum"}
                        {`: Rp${centsToRupiah(price.priceCents)}`}
                      </span>
                    ))}
                    {!service.isActive ? <span>Nonaktif</span> : null}
                  </div>
                  {service.canEdit ? (
                    <button
                      className="button button--quiet"
                      onClick={() => editService(service)}
                      type="button"
                    >
                      Ubah
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="auth-card__description">Belum ada layanan yang cocok dengan pencarian.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
