"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";
import type { getBusinessSettings } from "@/server/settings/service";

type BusinessSettingsData = Awaited<ReturnType<typeof getBusinessSettings>>;

interface BranchOption {
  id: string;
  code: string;
  name: string;
}

interface SuperAdminSettingsProps {
  settings: BusinessSettingsData;
  branches: BranchOption[];
}

const DOCUMENT_LABELS = {
  invoice: "Invoice",
  purchase_request: "Permintaan pembelian",
  purchase_order: "Purchase order",
  inventory_transfer: "Transfer stok",
  goods_receipt: "Penerimaan barang",
  supplier_return: "Retur supplier",
  receipt: "Kuitansi",
} as const;

export function SuperAdminSettings({ settings, branches }: SuperAdminSettingsProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function save(path: string, payload: unknown): Promise<boolean> {
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Pengaturan belum dapat disimpan."));
        return false;
      }

      setMessage("Pengaturan berhasil disimpan.");
      router.refresh();
      return true;
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const taxPercent = Number(values.get("taxRatePercent"));
    const logoUrl = values.get("logoUrl");
    const invoiceTemplate = values.get("invoiceTemplate");
    const receiptTemplate = values.get("receiptTemplate");
    const certificateTemplate = values.get("certificateTemplate");
    void save("/api/settings", {
      businessName: values.get("businessName"),
      defaultTimezone: values.get("defaultTimezone"),
      locale: values.get("locale"),
      taxEnabled: values.get("taxEnabled") === "on",
      taxRateBps: Math.round(taxPercent * 100),
      taxIncluded: values.get("taxIncluded") === "on",
      inventoryCostMethod: values.get("inventoryCostMethod"),
      quietHoursEnabled: values.get("quietHoursEnabled") === "on",
      quietHoursStart: values.get("quietHoursStart"),
      quietHoursEnd: values.get("quietHoursEnd"),
      primaryColor: values.get("primaryColor"),
      theme: values.get("theme"),
      logoUrl: typeof logoUrl === "string" && logoUrl.trim() ? logoUrl.trim() : null,
      invoiceTemplate:
        typeof invoiceTemplate === "string" && invoiceTemplate.trim()
          ? invoiceTemplate.trim()
          : null,
      receiptTemplate:
        typeof receiptTemplate === "string" && receiptTemplate.trim()
          ? receiptTemplate.trim()
          : null,
      certificateTemplate:
        typeof certificateTemplate === "string" && certificateTemplate.trim()
          ? certificateTemplate.trim()
          : null,
      features: {
        commissions: values.get("featureCommissions") === "on",
        loyalty: values.get("featureLoyalty") === "on",
        inpatient: values.get("featureInpatient") === "on",
      },
    });
  }

  function saveSequence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const branchId = values.get("branchId");
    void save("/api/settings/document-numbering", {
      documentType: values.get("documentType"),
      branchId: typeof branchId === "string" && branchId ? branchId : null,
      prefix: values.get("prefix"),
      nextNumber: Number(values.get("nextNumber")),
      minimumWidth: Number(values.get("minimumWidth")),
    });
  }

  return (
    <section aria-labelledby="settings-title" className="staff-management">
      <div>
        <p className="welcome__eyebrow">KONFIGURASI BISNIS</p>
        <h2 id="settings-title">Pengaturan Owner</h2>
      </div>
      <div className="staff-management__forms">
        <form className="auth-form" onSubmit={saveSettings}>
          <h3>Profil, pajak, dan tampilan</h3>
          <label>
            Nama bisnis
            <input
              defaultValue={settings.businessName ?? ""}
              maxLength={120}
              minLength={2}
              name="businessName"
              required
            />
          </label>
          <label>
            Zona waktu default
            <input
              defaultValue={settings.defaultTimezone}
              maxLength={80}
              name="defaultTimezone"
              required
            />
          </label>
          <label>
            Bahasa dan format
            <select defaultValue={settings.locale} name="locale">
              <option value="id-ID">Indonesia</option>
              <option value="en-US">English</option>
            </select>
          </label>
          <label className="permission-option">
            <input defaultChecked={settings.taxEnabled} name="taxEnabled" type="checkbox" />
            <span>Bisnis mengenakan pajak</span>
          </label>
          <label>
            Tarif pajak (%)
            <input
              defaultValue={(settings.taxRateBps / 100).toFixed(2)}
              max="100"
              min="0"
              name="taxRatePercent"
              required
              step="0.01"
              type="number"
            />
          </label>
          <label className="permission-option">
            <input defaultChecked={settings.taxIncluded} name="taxIncluded" type="checkbox" />
            <span>Harga sudah termasuk pajak</span>
          </label>
          <fieldset className="permission-options">
            <legend>Jam tenang untuk notifikasi</legend>
            <label className="permission-option">
              <input
                defaultChecked={settings.quietHoursEnabled}
                name="quietHoursEnabled"
                type="checkbox"
              />
              <span>Tunda notifikasi selama jam tenang</span>
            </label>
            <label>
              Mulai
              <input
                defaultValue={settings.quietHoursStart}
                name="quietHoursStart"
                required
                type="time"
              />
            </label>
            <label>
              Selesai
              <input
                defaultValue={settings.quietHoursEnd}
                name="quietHoursEnd"
                required
                type="time"
              />
            </label>
            <p className="auth-card__description">
              Mengikuti zona waktu default bisnis. Notifikasi dalam aplikasi akan ditunda selama
              rentang ini.
            </p>
          </fieldset>
          <label>
            Warna aksen
            <input defaultValue={settings.primaryColor} name="primaryColor" type="color" />
          </label>
          <label>
            Tema
            <select defaultValue={settings.theme} name="theme">
              <option value="system">Ikuti perangkat</option>
              <option value="light">Terang</option>
              <option value="dark">Gelap</option>
            </select>
          </label>
          <label>
            URL logo
            <input
              defaultValue={settings.logoUrl ?? ""}
              maxLength={2048}
              name="logoUrl"
              placeholder="https://..."
            />
          </label>
          <fieldset className="permission-options">
            <legend>Template dokumen</legend>
            <label>
              Template invoice
              <textarea
                defaultValue={settings.invoiceTemplate ?? ""}
                maxLength={8192}
                name="invoiceTemplate"
                rows={4}
              />
            </label>
            <label>
              Template kuitansi
              <textarea
                defaultValue={settings.receiptTemplate ?? ""}
                maxLength={8192}
                name="receiptTemplate"
                rows={4}
              />
            </label>
            <label>
              Template sertifikat
              <textarea
                defaultValue={settings.certificateTemplate ?? ""}
                maxLength={8192}
                name="certificateTemplate"
                rows={4}
              />
            </label>
            <p className="auth-card__description">
              Gunakan placeholder seperti {"{{businessName}}"}, {"{{total}}"}, dan {"{{date}}"}.
            </p>
          </fieldset>
          <fieldset className="permission-options">
            <legend>Fitur modul</legend>
            <label className="permission-option">
              <input
                defaultChecked={settings.features.commissions}
                name="featureCommissions"
                type="checkbox"
              />
              <span>Komisi staf</span>
            </label>
            <label className="permission-option">
              <input
                defaultChecked={settings.features.loyalty}
                name="featureLoyalty"
                type="checkbox"
              />
              <span>Loyalitas pelanggan</span>
            </label>
            <label className="permission-option">
              <input
                defaultChecked={settings.features.inpatient}
                name="featureInpatient"
                type="checkbox"
              />
              <span>Rawat inap</span>
            </label>
          </fieldset>
          <label>
            Metode HPP persediaan
            <select defaultValue={settings.inventoryCostMethod} name="inventoryCostMethod">
              <option value="fifo">FIFO berdasarkan batch</option>
              <option value="average">Rata-rata tertimbang</option>
            </select>
          </label>
          <button className="button button--primary" disabled={submitting} type="submit">
            Simpan pengaturan
          </button>
        </form>

        <div>
          <h3>Penomoran dokumen</h3>
          <ul className="staff-list">
            {settings.documentSequences.map((sequence) => {
              const branch = branches.find((item) => item.id === sequence.branchId);
              const example = `${sequence.prefix}/${branch?.code ?? "GLOBAL"}/${String(sequence.nextNumber).padStart(sequence.minimumWidth, "0")}`;
              return (
                <li key={sequence.id}>
                  <div>
                    <strong>{DOCUMENT_LABELS[sequence.documentType]}</strong>
                    <span>
                      {branch?.name ?? "Semua cabang"} · berikutnya {example}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <form className="auth-form" onSubmit={saveSequence}>
            <label>
              Jenis dokumen
              <select defaultValue="invoice" name="documentType">
                <option value="invoice">Invoice</option>
                <option value="purchase_request">Permintaan pembelian</option>
                <option value="purchase_order">Purchase order</option>
                <option value="inventory_transfer">Transfer stok</option>
                <option value="goods_receipt">Penerimaan barang</option>
                <option value="supplier_return">Retur supplier</option>
                <option value="receipt">Kuitansi</option>
              </select>
            </label>
            <label>
              Cakupan cabang
              <select defaultValue="" name="branchId">
                <option value="">Default semua cabang</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Awalan
              <input defaultValue="INV" maxLength={16} name="prefix" required />
            </label>
            <label>
              Nomor berikutnya
              <input
                defaultValue={1}
                max={999_999_999_999}
                min={1}
                name="nextNumber"
                required
                type="number"
              />
            </label>
            <label>
              Lebar angka minimum
              <input defaultValue={5} max={12} min={1} name="minimumWidth" required type="number" />
            </label>
            <button className="button button--primary" disabled={submitting} type="submit">
              Simpan penomoran
            </button>
          </form>
        </div>
      </div>
      {message ? (
        <p className="auth-form__message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
