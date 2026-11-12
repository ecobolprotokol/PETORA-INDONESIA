"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { CustomerRecord } from "@/server/customers/service";
import type { PetRecord } from "@/server/pets/service";

type PetSummary = PetRecord & { canEdit: boolean };
type PetWeight = { id: string; weightKg: string; recordedAt: string; note: string | null };

interface PetManagementProps {
  pets: PetSummary[];
  customers: Pick<CustomerRecord, "id" | "name">[];
  canRead: boolean;
  manageScope: PermissionDataScope | null;
}

const speciesOptions = [
  ["dog", "Anjing"],
  ["cat", "Kucing"],
  ["bird", "Burung"],
  ["small_mammal", "Mamalia kecil"],
  ["reptile", "Reptil"],
  ["other", "Lainnya"],
] as const;

export function PetManagement({ pets, customers, canRead, manageScope }: PetManagementProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingPet, setEditingPet] = useState<PetSummary | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<PetRecord[]>([]);
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [search, setSearch] = useState("");
  const [visiblePets, setVisiblePets] = useState(pets);
  const [keepPet, setKeepPet] = useState<PetSummary | null>(null);
  const [expandedPetId, setExpandedPetId] = useState<string | null>(null);
  const [weights, setWeights] = useState<PetWeight[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => setVisiblePets(pets), [pets]);

  function getPetPayload(form: HTMLFormElement) {
    const formData = new FormData(form);
    const ownerIds = formData
      .getAll("ownerIds")
      .filter((value): value is string => typeof value === "string");
    const primaryOwnerId = String(formData.get("primaryOwnerId") ?? "");
    if (ownerIds.length === 0 || !ownerIds.includes(primaryOwnerId)) {
      setMessage("Pilih setidaknya satu pemilik dan tetapkan salah satunya sebagai pemilik utama.");
      return null;
    }

    const ageMonths = String(formData.get("estimatedAgeMonths") ?? "").trim();
    return {
      name: formData.get("name"),
      species: formData.get("species"),
      breed: formData.get("breed"),
      sex: formData.get("sex"),
      birthDate: formData.get("birthDate") || null,
      estimatedAgeMonths: ageMonths ? Number(ageMonths) : null,
      color: formData.get("color"),
      microchipNumber: formData.get("microchipNumber"),
      photoUrl: formData.get("photoUrl"),
      isSterilized: formData.get("isSterilized") === "on",
      allergies: String(formData.get("allergies") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      behaviorNotes: formData.get("behaviorNotes"),
      status: formData.get("status"),
      owners: ownerIds.map((customerId) => ({
        customerId,
        relationship: "Pemilik",
        isPrimary: customerId === primaryOwnerId,
      })),
    };
  }

  async function savePet(
    payload: Record<string, unknown>,
    form: HTMLFormElement | null,
    petId?: string,
  ) {
    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch(petId ? `/api/pets/${petId}` : "/api/pets", {
        method: petId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Data hewan belum dapat disimpan."));
        return;
      }
      form?.reset();
      setEditingPet(null);
      setDuplicateCandidates([]);
      setPendingPayload(null);
      setMessage("Data hewan berhasil disimpan.");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function importPetCsv() {
    const file = importFileRef.current?.files?.[0];
    if (!file) {
      setMessage("Pilih berkas CSV hewan terlebih dahulu.");
      return;
    }
    if (file.size > 1_000_000) {
      setMessage("Ukuran CSV maksimum 1 MB.");
      return;
    }
    setImporting(true);
    setMessage("");
    try {
      const response = await fetch("/api/pets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: await file.text() }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Impor hewan belum dapat dilakukan."));
        return;
      }
      const imported =
        typeof result === "object" && result !== null && "imported" in result
          ? result.imported
          : null;
      if (typeof imported !== "number") {
        setMessage("Respons server untuk impor hewan tidak valid.");
        return;
      }
      if (importFileRef.current) {
        importFileRef.current.value = "";
      }
      setMessage(`${imported} hewan berhasil diimpor.`);
      router.refresh();
    } catch {
      setMessage("Berkas CSV belum dapat dibaca. Periksa berkas lalu coba lagi.");
    } finally {
      setImporting(false);
    }
  }

  async function submitPet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = getPetPayload(form);
    if (!payload) {
      return;
    }

    setMessage("");
    if (!editingPet) {
      const query = new URLSearchParams({
        name: String(payload.name),
        species: String(payload.species),
      });
      for (const owner of payload.owners as Array<{ customerId: string }>) {
        query.append("ownerId", owner.customerId);
      }
      try {
        const response = await fetch(`/api/pets/duplicates?${query}`, { cache: "no-store" });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          setMessage(getApiErrorMessage(result, "Pemeriksaan duplikasi belum dapat dilakukan."));
          return;
        }
        const matches =
          typeof result === "object" &&
          result !== null &&
          "pets" in result &&
          Array.isArray(result.pets)
            ? (result.pets as PetRecord[])
            : [];
        if (matches.length > 0) {
          setDuplicateCandidates(matches);
          setPendingPayload(payload);
          setMessage(
            "Ditemukan kemungkinan data hewan ganda. Tinjau sebelum tetap membuat record.",
          );
          return;
        }
      } catch {
        setMessage("Pemeriksaan data ganda gagal. Periksa koneksi lalu coba lagi.");
        return;
      }
    }

    await savePet(payload, form, editingPet?.id);
  }

  async function searchPets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch(`/api/pets?q=${encodeURIComponent(search)}`, {
        cache: "no-store",
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Pencarian hewan gagal."));
        return;
      }
      if (
        typeof result === "object" &&
        result !== null &&
        "pets" in result &&
        Array.isArray(result.pets)
      ) {
        setVisiblePets(result.pets as PetSummary[]);
      }
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }
  }

  async function mergePet(duplicatePetId: string) {
    if (
      !keepPet ||
      !window.confirm(`Gabungkan pemilik dan riwayat ke ${keepPet.name}? Data sumber akan dihapus.`)
    ) {
      return;
    }
    try {
      const response = await fetch("/api/pets/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicatePetId, keepPetId: keepPet.id }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Data hewan belum dapat digabungkan."));
        return;
      }
      setKeepPet(null);
      setMessage("Data hewan berhasil digabungkan.");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }
  }

  async function toggleWeights(petId: string) {
    if (expandedPetId === petId) {
      setExpandedPetId(null);
      return;
    }
    try {
      const response = await fetch(`/api/pets/${petId}/weights`, { cache: "no-store" });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Riwayat berat belum dapat dimuat."));
        return;
      }
      const nextWeights =
        typeof result === "object" &&
        result !== null &&
        "weights" in result &&
        Array.isArray(result.weights)
          ? (result.weights as PetWeight[])
          : [];
      setWeights(nextWeights);
      setExpandedPetId(petId);
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }
  }

  async function submitWeight(event: FormEvent<HTMLFormElement>, petId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch(`/api/pets/${petId}/weights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: Number(formData.get("weightKg")),
          note: formData.get("note"),
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Berat hewan belum dapat dicatat."));
        return;
      }
      form.reset();
      await toggleWeights(petId);
      setMessage("Berat hewan berhasil dicatat.");
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    }
  }

  return (
    <section aria-labelledby="pets-title" className="staff-management">
      <div>
        <p className="welcome__eyebrow">DATA INDUK</p>
        <h2 id="pets-title">Hewan</h2>
        <p className="auth-card__description">
          Satu hewan dapat terhubung ke beberapa pelanggan. Cakupan “milik sendiri” mengikuti
          kepemilikan oleh pelanggan yang dibuat staf.
        </p>
      </div>
      {manageScope && customers.length > 0 ? (
        <form
          className="auth-form"
          key={editingPet?.id ?? "new"}
          onSubmit={(event) => void submitPet(event)}
          ref={formRef}
        >
          <h3>{editingPet ? `Ubah ${editingPet.name}` : "Tambah hewan"}</h3>
          <label>
            Nama hewan
            <input
              defaultValue={editingPet?.name}
              maxLength={120}
              minLength={1}
              name="name"
              required
            />
          </label>
          <label>
            Jenis
            <select defaultValue={editingPet?.species ?? "dog"} name="species" required>
              {speciesOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ras
            <input defaultValue={editingPet?.breed ?? ""} maxLength={120} name="breed" />
          </label>
          <label>
            Jenis kelamin
            <select defaultValue={editingPet?.sex ?? "unknown"} name="sex">
              <option value="unknown">Tidak diketahui</option>
              <option value="male">Jantan</option>
              <option value="female">Betina</option>
            </select>
          </label>
          <label>
            Tanggal lahir (opsional)
            <input defaultValue={editingPet?.birthDate ?? ""} name="birthDate" type="date" />
          </label>
          <label>
            Perkiraan usia (bulan)
            <input
              defaultValue={editingPet?.estimatedAgeMonths ?? ""}
              max="2400"
              min="0"
              name="estimatedAgeMonths"
              type="number"
            />
          </label>
          <label>
            Warna
            <input defaultValue={editingPet?.color ?? ""} maxLength={120} name="color" />
          </label>
          <label>
            Nomor microchip
            <input
              defaultValue={editingPet?.microchipNumber ?? ""}
              maxLength={80}
              name="microchipNumber"
            />
          </label>
          <label>
            URL foto
            <input
              defaultValue={editingPet?.photoUrl ?? ""}
              maxLength={2048}
              name="photoUrl"
              type="url"
            />
          </label>
          <label>
            Alergi (pisahkan dengan koma)
            <input
              defaultValue={editingPet?.allergies.join(", ") ?? ""}
              maxLength={3600}
              name="allergies"
            />
          </label>
          <label>
            Catatan perilaku
            <textarea
              defaultValue={editingPet?.behaviorNotes ?? ""}
              maxLength={4000}
              name="behaviorNotes"
            />
          </label>
          <label>
            Status
            <select defaultValue={editingPet?.status ?? "active"} name="status">
              <option value="active">Aktif</option>
              <option value="deceased">Meninggal</option>
              <option value="transferred">Dipindahkan</option>
            </select>
          </label>
          <label className="permission-option">
            <input
              defaultChecked={editingPet?.isSterilized ?? false}
              name="isSterilized"
              type="checkbox"
            />
            <span>Sudah disterilkan</span>
          </label>
          <fieldset className="permission-options">
            <legend>Pemilik (pilih satu atau lebih)</legend>
            {customers.map((customer) => (
              <label className="permission-option" key={customer.id}>
                <input
                  defaultChecked={editingPet?.owners.some(
                    (owner) => owner.customerId === customer.id,
                  )}
                  name="ownerIds"
                  type="checkbox"
                  value={customer.id}
                />
                <span>{customer.name}</span>
              </label>
            ))}
          </fieldset>
          <label>
            Pemilik utama
            <select
              defaultValue={
                editingPet?.owners.find(({ isPrimary }) => isPrimary)?.customerId ??
                customers[0]?.id
              }
              name="primaryOwnerId"
              required
            >
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <div className="staff-list__actions">
            <button className="button button--primary" disabled={submitting} type="submit">
              {submitting ? "Menyimpan..." : editingPet ? "Simpan perubahan" : "Simpan hewan"}
            </button>
            {editingPet ? (
              <button
                className="button button--quiet"
                onClick={() => setEditingPet(null)}
                type="button"
              >
                Batal
              </button>
            ) : null}
          </div>
        </form>
      ) : manageScope ? (
        <p className="auth-card__description">
          Tambahkan pelanggan dan berikan izin `customers.read` untuk mengaitkan pemilik hewan.
        </p>
      ) : null}
      {duplicateCandidates.length > 0 ? (
        <div className="auth-card__description" role="status">
          <p>Data yang mirip:</p>
          <ul>
            {duplicateCandidates.map((pet) => (
              <li key={pet.id}>
                {pet.name} — {pet.owners.map(({ name }) => name).join(", ")}
              </li>
            ))}
          </ul>
          <button
            className="button button--quiet"
            disabled={submitting}
            onClick={() => {
              if (pendingPayload && formRef.current) {
                void savePet(pendingPayload, formRef.current);
              }
            }}
            type="button"
          >
            Tetap buat record baru
          </button>
        </div>
      ) : null}
      {canRead ? (
        <div>
          <h3>Daftar hewan</h3>
          <a className="button button--quiet" href="/api/pets/export">
            Ekspor CSV
          </a>
          <form className="auth-form" onSubmit={(event) => void searchPets(event)}>
            <label>
              Cari nama hewan
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
          {keepPet ? (
            <p className="auth-form__hint" role="status">
              Record utama: {keepPet.name}. Pilih hewan lain untuk menggabungkan pemilik dan
              riwayat.
              <button
                className="button button--quiet"
                onClick={() => setKeepPet(null)}
                type="button"
              >
                Batal pilih
              </button>
            </p>
          ) : null}
          {visiblePets.length > 0 ? (
            <ul className="staff-list">
              {visiblePets.map((pet) => (
                <li key={pet.id}>
                  <div>
                    <strong>{pet.name}</strong>
                    <span>
                      {speciesOptions.find(([value]) => value === pet.species)?.[1] ?? pet.species}
                      {pet.breed ? ` · ${pet.breed}` : ""}
                    </span>
                    <span>Pemilik: {pet.owners.map(({ name }) => name).join(", ")}</span>
                    {pet.microchipNumber ? <span>Microchip: {pet.microchipNumber}</span> : null}
                  </div>
                  <div className="staff-list__actions">
                    {pet.canEdit ? (
                      <button
                        className="button button--quiet"
                        onClick={() => setEditingPet(pet)}
                        type="button"
                      >
                        Ubah
                      </button>
                    ) : null}
                    {pet.canEdit && keepPet?.id !== pet.id ? (
                      keepPet ? (
                        <button
                          className="button button--quiet"
                          onClick={() => void mergePet(pet.id)}
                          type="button"
                        >
                          Gabungkan ke {keepPet.name}
                        </button>
                      ) : (
                        <button
                          className="button button--quiet"
                          onClick={() => setKeepPet(pet)}
                          type="button"
                        >
                          Pilih sebagai utama
                        </button>
                      )
                    ) : null}
                    <button
                      className="button button--quiet"
                      onClick={() => void toggleWeights(pet.id)}
                      type="button"
                    >
                      {expandedPetId === pet.id ? "Tutup berat" : "Riwayat berat"}
                    </button>
                  </div>
                  {expandedPetId === pet.id ? (
                    <div className="auth-form">
                      <h4>Riwayat berat</h4>
                      {weights.map((weight) => (
                        <p className="auth-form__hint" key={weight.id}>
                          {weight.weightKg} kg ·{" "}
                          {new Date(weight.recordedAt).toLocaleString("id-ID")}
                          {weight.note ? ` · ${weight.note}` : ""}
                        </p>
                      ))}
                      {manageScope ? (
                        <form onSubmit={(event) => void submitWeight(event, pet.id)}>
                          <label>
                            Berat (kg)
                            <input
                              min="0.001"
                              name="weightKg"
                              required
                              step="0.001"
                              type="number"
                            />
                          </label>
                          <label>
                            Catatan
                            <input maxLength={500} name="note" />
                          </label>
                          <button className="button button--quiet" type="submit">
                            Catat berat
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="auth-card__description">Belum ada data hewan dalam cakupan Anda.</p>
          )}
        </div>
      ) : null}
      {manageScope ? (
        <div className="auth-form">
          <h3>Impor hewan</h3>
          <p className="auth-form__hint">
            CSV maksimal 500 baris dan 1 MB. Gunakan kolom ownersJson berisi array JSON dengan
            customerId, relationship, dan isPrimary. Impor seluruh berkas diproses atomik.
          </p>
          <label>
            Berkas CSV
            <input accept=".csv,text/csv" ref={importFileRef} type="file" />
          </label>
          <button
            className="button button--primary"
            disabled={importing}
            onClick={() => void importPetCsv()}
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
