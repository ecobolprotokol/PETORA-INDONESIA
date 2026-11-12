"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";
import { code39Modules } from "@/components/products/code39";
import type { PermissionDataScope } from "@/server/access/permissions";
import type { ProductRecord } from "@/server/products/service";

type CatalogOptions = {
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  units: Array<{
    id: string;
    name: string;
    abbreviation: string;
    dimension: "count" | "mass" | "volume" | "length";
    baseUnitId: string | null;
    toBaseFactor: string;
  }>;
  priceTiers: Array<{ id: string; name: string; description: string }>;
};

type ProductSummary = ProductRecord & {
  canEdit: boolean;
  canReadCost: boolean;
  canManageCost: boolean;
};
type PriceDraft = {
  id: string;
  variantSku: string;
  branchId: string;
  priceTierId: string;
  purchasePrice: string;
  sellingPrice: string;
};
type VariantDraft = { id: string; name: string; sku: string; barcodes: string };
type ConversionDraft = { id: string; unitId: string; conversionFactor: string };
type ProductLabel = {
  productName: string;
  sku: string;
  variantName: string | null;
  barcode: string;
};

function Code39Barcode({ value }: { value: string }) {
  const modules = code39Modules(value);
  if (!modules) return null;
  return (
    <svg
      aria-label={`Barcode ${value}`}
      className="product-label__barcode"
      role="img"
      viewBox={`0 0 ${modules.length + 20} 36`}
      preserveAspectRatio="none"
    >
      <path
        d={modules.map((isBar, index) => (isBar ? `M${index + 10} 0h1v36h-1z` : "")).join("")}
      />
    </svg>
  );
}
type BundleLineDraft = {
  id: string;
  productId: string;
  variantId: string;
  quantity: string;
};

interface ProductManagementProps {
  products: ProductSummary[];
  options: CatalogOptions;
  branches: Array<{ id: string; name: string }>;
  canRead: boolean;
  costManageScope: PermissionDataScope | null;
  manageScope: PermissionDataScope | null;
}

function centsToRupiah(cents: number | null | undefined) {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

function rupiahToCents(value: string) {
  const amount = Number(value.trim().replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : Number.NaN;
}

function emptyPrice(variantSku = ""): PriceDraft {
  return {
    id: crypto.randomUUID(),
    variantSku,
    branchId: "",
    priceTierId: "",
    purchasePrice: "",
    sellingPrice: "",
  };
}

export function ProductManagement({
  products,
  options,
  branches,
  canRead,
  costManageScope,
  manageScope,
}: ProductManagementProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState<ProductSummary | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [priceRows, setPriceRows] = useState<PriceDraft[]>([emptyPrice()]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [conversions, setConversions] = useState<ConversionDraft[]>([]);
  const [baseBarcodes, setBaseBarcodes] = useState("");
  const [bundleProductId, setBundleProductId] = useState(
    products.find((product) => product.canEdit && product.isActive)?.id ?? "",
  );
  const [bundleLines, setBundleLines] = useState<BundleLineDraft[]>([]);
  const [bundleMessage, setBundleMessage] = useState("");
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleSubmitting, setBundleSubmitting] = useState(false);
  const [printLabels, setPrintLabels] = useState<ProductLabel[] | null>(null);

  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.sku} ${product.barcodes.map(({ barcode }) => barcode).join(" ")}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const baseUnits = options.units.filter((unit) => unit.baseUnitId === null);
  const bundleProducts = products.filter((product) => product.canEdit && product.isActive);
  const componentProducts = products.filter((product) => product.isActive);
  const bundleVariants = componentProducts.flatMap((product) =>
    product.variants.map((variant) => ({
      productId: product.id,
      id: variant.id,
      label: `${product.name} · ${variant.name}`,
    })),
  );

  useEffect(() => {
    if (!printLabels) return;
    const timer = window.setTimeout(() => window.print(), 100);
    const clearPrintLabels = () => setPrintLabels(null);
    window.addEventListener("afterprint", clearPrintLabels);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", clearPrintLabels);
    };
  }, [printLabels]);

  useEffect(() => {
    if (!bundleProductId || !manageScope) return;
    let cancelled = false;
    async function loadBundle() {
      setBundleLoading(true);
      setBundleMessage("");
      try {
        const response = await fetch(`/api/products/${bundleProductId}/bundle`);
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Komposisi produk tidak dapat dimuat."));
        }
        const result = payload as {
          components: Array<{
            componentProductId: string;
            componentVariantId: string | null;
            quantity: string;
          }>;
        };
        if (!cancelled) {
          setBundleLines(
            result.components.map((component) => ({
              id: crypto.randomUUID(),
              productId: component.componentProductId,
              variantId: component.componentVariantId ?? "",
              quantity: component.quantity,
            })),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setBundleMessage(
            error instanceof Error ? error.message : "Komposisi produk tidak dapat dimuat.",
          );
        }
      } finally {
        if (!cancelled) setBundleLoading(false);
      }
    }
    void loadBundle();
    return () => {
      cancelled = true;
    };
  }, [bundleProductId, manageScope]);

  function editProduct(product: ProductSummary) {
    setEditingProduct(product);
    setBaseBarcodes(
      product.barcodes
        .filter(({ variantId }) => variantId === null)
        .map(({ barcode }) => barcode)
        .join(", "),
    );
    setVariants(
      product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        barcodes: product.barcodes
          .filter(({ variantId }) => variantId === variant.id)
          .map(({ barcode }) => barcode)
          .join(", "),
      })),
    );
    const prices = product.prices.map((price) => {
      const variantSku = product.variants.find(({ id }) => id === price.variantId)?.sku ?? "";
      return {
        id: price.id,
        variantSku,
        branchId: price.branchId ?? "",
        priceTierId: price.priceTierId ?? "",
        purchasePrice: centsToRupiah(price.purchasePriceCents),
        sellingPrice: centsToRupiah(price.sellingPriceCents),
      };
    });
    setPriceRows(prices.length ? prices : [emptyPrice()]);
    setConversions(
      product.conversions.map(({ unitId, factor }) => ({
        id: unitId,
        unitId,
        conversionFactor: factor,
      })),
    );
    setMessage("");
  }

  function updateVariant(index: number, field: keyof VariantDraft, value: string) {
    const previousSku = variants[index]?.sku;
    setVariants((current) =>
      current.map((variant, rowIndex) =>
        rowIndex === index ? { ...variant, [field]: value } : variant,
      ),
    );
    if (field === "sku" && value) {
      if (previousSku) {
        setPriceRows((current) =>
          current.map((price) =>
            price.variantSku === previousSku ? { ...price, variantSku: value } : price,
          ),
        );
      } else {
        setPriceRows((current) =>
          current.some((price) => price.variantSku === value)
            ? current
            : [...current, emptyPrice(value)],
        );
      }
    }
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      { id: crypto.randomUUID(), name: "", sku: "", barcodes: "" },
    ]);
  }

  function removeVariant(index: number) {
    const removedSku = variants[index]?.sku ?? "";
    setVariants((current) => current.filter((_, rowIndex) => rowIndex !== index));
    if (removedSku) {
      setPriceRows((current) => current.filter((price) => price.variantSku !== removedSku));
    }
  }

  function updatePrice(index: number, field: keyof PriceDraft, value: string) {
    setPriceRows((current) =>
      current.map((price, rowIndex) => (rowIndex === index ? { ...price, [field]: value } : price)),
    );
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const mayManageCost = editingProduct ? editingProduct.canManageCost : costManageScope !== null;
    const parsePrices = (variantSku: string) =>
      priceRows
        .filter((price) => price.variantSku === variantSku)
        .map((price) => ({
          branchId: price.branchId || null,
          priceTierId: price.priceTierId || null,
          ...(mayManageCost ? { purchasePriceCents: rupiahToCents(price.purchasePrice) } : {}),
          sellingPriceCents: rupiahToCents(price.sellingPrice),
        }));
    const payload = {
      name: formData.get("name"),
      sku: formData.get("sku"),
      productType: formData.get("productType"),
      categoryId: formData.get("categoryId") || null,
      brand: formData.get("brand"),
      photoUrl: formData.get("photoUrl"),
      description: formData.get("description"),
      baseUnitId: formData.get("baseUnitId") || null,
      medicineClass: formData.get("medicineClass"),
      prescriptionRequired: formData.get("prescriptionRequired") === "on",
      isActive: formData.get("isActive") === "on",
      barcodes: baseBarcodes
        .split(",")
        .map((barcode) => barcode.trim())
        .filter(Boolean),
      unitConversions: conversions
        .filter(({ unitId }) => unitId)
        .map(({ unitId, conversionFactor }) => ({
          unitId,
          conversionFactor: Number(conversionFactor),
        })),
      prices: parsePrices(""),
      variants: variants.map((variant) => ({
        name: variant.name,
        sku: variant.sku,
        barcodes: variant.barcodes
          .split(",")
          .map((barcode) => barcode.trim())
          .filter(Boolean),
        prices: parsePrices(variant.sku),
      })),
    };

    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch(
        editingProduct ? `/api/products/${editingProduct.id}` : "/api/products",
        {
          method: editingProduct ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Data produk belum dapat disimpan."));
        return;
      }
      form.reset();
      setEditingProduct(null);
      setPriceRows([emptyPrice()]);
      setVariants([]);
      setConversions([]);
      setBaseBarcodes("");
      setFormVersion((current) => current + 1);
      setMessage("Data produk berhasil disimpan.");
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createReference(
    event: FormEvent<HTMLFormElement>,
    endpoint: string,
    buildPayload: (data: FormData) => unknown,
    successMessage: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(new FormData(form))),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(getApiErrorMessage(result, "Referensi belum dapat disimpan."));
        return;
      }
      form.reset();
      setMessage(successMessage);
      router.refresh();
    } catch {
      setMessage("Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveBundle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBundleSubmitting(true);
    setBundleMessage("");
    try {
      const response = await fetch(`/api/products/${bundleProductId}/bundle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          components: bundleLines.map(({ productId, variantId, quantity }) => ({
            productId,
            variantId: variantId || null,
            quantity,
          })),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getApiErrorMessage(payload, "Komposisi produk tidak dapat disimpan."));
      }
      setBundleMessage("Komposisi bundel berhasil disimpan.");
      router.refresh();
    } catch (error) {
      setBundleMessage(
        error instanceof Error ? error.message : "Komposisi produk tidak dapat disimpan.",
      );
    } finally {
      setBundleSubmitting(false);
    }
  }

  function prepareLabels(product: ProductSummary) {
    const printable = product.barcodes.flatMap(({ barcode, variantId }) => {
      if (!code39Modules(barcode)) return [];
      const variant = product.variants.find((item) => item.id === variantId);
      return [
        {
          productName: product.name,
          sku: variant?.sku ?? product.sku,
          variantName: variant?.name ?? null,
          barcode,
        },
      ];
    });
    const unsupportedCount = product.barcodes.length - printable.length;
    setMessage(
      unsupportedCount
        ? `${unsupportedCount} barcode dilewati; hanya barcode ASCII yang cukup pendek untuk label Code 39 yang dicetak.`
        : "",
    );
    if (printable.length) setPrintLabels(printable);
  }

  return (
    <section aria-labelledby="products-title" className="customer-management">
      {printLabels ? (
        <div aria-hidden="true" className="product-label-print">
          {printLabels.map((label) => (
            <article className="product-label" key={label.barcode}>
              <strong>{label.productName}</strong>
              {label.variantName ? <span>{label.variantName}</span> : null}
              <span>SKU: {label.sku}</span>
              <Code39Barcode value={label.barcode} />
              <span className="product-label__value">{label.barcode}</span>
            </article>
          ))}
        </div>
      ) : null}
      <div>
        <p className="welcome__eyebrow">DATA MASTER</p>
        <h2 id="products-title">Katalog produk</h2>
        <p className="auth-card__description">
          Kelola produk, obat, varian, satuan, barcode, dan harga berdasarkan cabang atau tier.
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
          key={editingProduct?.id ?? `new-${formVersion}`}
          onSubmit={(event) => void submitProduct(event)}
          ref={formRef}
        >
          <h3>{editingProduct ? "Perbarui produk" : "Tambah produk"}</h3>
          <div className="staff-form-grid">
            <label>
              Nama produk
              <input defaultValue={editingProduct?.name} maxLength={160} name="name" required />
            </label>
            <label>
              SKU
              <input defaultValue={editingProduct?.sku} maxLength={80} name="sku" required />
            </label>
            <label>
              Jenis
              <select defaultValue={editingProduct?.productType ?? "general"} name="productType">
                <option value="general">Umum</option>
                <option value="medicine">Obat</option>
                <option value="feed">Pakan</option>
                <option value="accessory">Aksesori</option>
              </select>
            </label>
            <label>
              Kategori
              <select defaultValue={editingProduct?.categoryId ?? ""} name="categoryId">
                <option value="">Tanpa kategori</option>
                {options.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Merek
              <input defaultValue={editingProduct?.brand ?? ""} maxLength={120} name="brand" />
            </label>
            <label>
              Satuan dasar
              <select defaultValue={editingProduct?.baseUnitId ?? ""} name="baseUnitId">
                <option value="">Tanpa satuan</option>
                {baseUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} ({unit.abbreviation})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Golongan obat
              <input
                defaultValue={editingProduct?.medicineClass ?? ""}
                maxLength={120}
                name="medicineClass"
              />
            </label>
            <label>
              URL foto (opsional)
              <input
                defaultValue={editingProduct?.photoUrl ?? ""}
                maxLength={2048}
                name="photoUrl"
                type="url"
              />
            </label>
          </div>
          <label>
            Deskripsi
            <textarea
              defaultValue={editingProduct?.description ?? ""}
              maxLength={4000}
              name="description"
            />
          </label>
          <label>
            Barcode produk (pisahkan dengan koma)
            <input onChange={(event) => setBaseBarcodes(event.target.value)} value={baseBarcodes} />
          </label>
          <label className="permission-option">
            <input
              defaultChecked={editingProduct?.prescriptionRequired ?? false}
              name="prescriptionRequired"
              type="checkbox"
            />
            <span>Obat memerlukan resep</span>
          </label>
          <label className="permission-option">
            <input
              defaultChecked={editingProduct?.isActive ?? true}
              name="isActive"
              type="checkbox"
            />
            <span>Produk aktif</span>
          </label>

          <div>
            <h4>Konversi satuan</h4>
            {conversions.map((conversion, index) => (
              <div className="staff-form-grid" key={conversion.id}>
                <label>
                  Satuan alternatif
                  <select
                    onChange={(event) =>
                      setConversions((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...row, unitId: event.target.value } : row,
                        ),
                      )
                    }
                    value={conversion.unitId}
                  >
                    <option value="">Pilih satuan</option>
                    {options.units
                      .filter(({ baseUnitId }) => baseUnitId !== null)
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name} ({unit.abbreviation})
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Faktor ke satuan dasar
                  <input
                    min="0.000001"
                    onChange={(event) =>
                      setConversions((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, conversionFactor: event.target.value }
                            : row,
                        ),
                      )
                    }
                    step="any"
                    type="number"
                    value={conversion.conversionFactor}
                  />
                </label>
                <button
                  className="button button--quiet"
                  onClick={() => setConversions((current) => current.filter((_, i) => i !== index))}
                  type="button"
                >
                  Hapus
                </button>
              </div>
            ))}
            <button
              className="button button--quiet"
              onClick={() =>
                setConversions((current) => [
                  ...current,
                  { id: crypto.randomUUID(), unitId: "", conversionFactor: "1" },
                ])
              }
              type="button"
            >
              Tambah konversi
            </button>
          </div>

          <div>
            <h4>Varian</h4>
            {variants.map((variant, index) => (
              <div className="staff-form-grid" key={variant.id}>
                <label>
                  Nama varian
                  <input
                    onChange={(event) => updateVariant(index, "name", event.target.value)}
                    required
                    value={variant.name}
                  />
                </label>
                <label>
                  SKU varian
                  <input
                    onChange={(event) => updateVariant(index, "sku", event.target.value)}
                    required
                    value={variant.sku}
                  />
                </label>
                <label>
                  Barcode (pisahkan dengan koma)
                  <input
                    onChange={(event) => updateVariant(index, "barcodes", event.target.value)}
                    value={variant.barcodes}
                  />
                </label>
                <button
                  className="button button--quiet"
                  onClick={() => removeVariant(index)}
                  type="button"
                >
                  Hapus varian
                </button>
              </div>
            ))}
            <button className="button button--quiet" onClick={addVariant} type="button">
              Tambah varian
            </button>
          </div>

          <div>
            <h4>Harga dasar dan varian (Rupiah)</h4>
            {priceRows.map((price, index) => (
              <div className="staff-form-grid" key={price.id}>
                <label>
                  Berlaku untuk
                  <select
                    onChange={(event) => updatePrice(index, "variantSku", event.target.value)}
                    value={price.variantSku}
                  >
                    <option value="">Produk dasar</option>
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.sku}>
                        {variant.name || "Varian baru"} ({variant.sku || "SKU belum diisi"})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cabang
                  <select
                    onChange={(event) => updatePrice(index, "branchId", event.target.value)}
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
                    onChange={(event) => updatePrice(index, "priceTierId", event.target.value)}
                    value={price.priceTierId}
                  >
                    <option value="">Harga umum</option>
                    {options.priceTiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                </label>
                {(editingProduct ? editingProduct.canManageCost : costManageScope !== null) ? (
                  <label>
                    Harga beli
                    <input
                      min="0"
                      onChange={(event) => updatePrice(index, "purchasePrice", event.target.value)}
                      step="0.01"
                      type="number"
                      value={price.purchasePrice}
                    />
                  </label>
                ) : null}
                <label>
                  Harga jual
                  <input
                    min="0"
                    onChange={(event) => updatePrice(index, "sellingPrice", event.target.value)}
                    required
                    step="0.01"
                    type="number"
                    value={price.sellingPrice}
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
              onClick={() => setPriceRows((current) => [...current, emptyPrice()])}
              type="button"
            >
              Tambah harga
            </button>
          </div>
          <div className="staff-list__actions">
            <button className="button button--primary" disabled={submitting} type="submit">
              {submitting ? "Menyimpan..." : editingProduct ? "Simpan perubahan" : "Simpan produk"}
            </button>
            {editingProduct ? (
              <button
                className="button button--quiet"
                onClick={() => {
                  setEditingProduct(null);
                  setPriceRows([emptyPrice()]);
                  setVariants([]);
                  setConversions([]);
                  setBaseBarcodes("");
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
        <div className="staff-form-grid">
          <details>
            <summary>Tambah kategori</summary>
            <form
              className="auth-form"
              onSubmit={(event) =>
                void createReference(
                  event,
                  "/api/products/categories",
                  (data) => ({ name: data.get("name"), parentId: data.get("parentId") || null }),
                  "Kategori produk berhasil ditambahkan.",
                )
              }
            >
              <label>
                Nama kategori
                <input maxLength={120} name="name" required />
              </label>
              <label>
                Kategori induk
                <select defaultValue="" name="parentId">
                  <option value="">Tanpa induk</option>
                  {options.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button button--primary" disabled={submitting} type="submit">
                Simpan kategori
              </button>
            </form>
          </details>
          <details>
            <summary>Tambah satuan</summary>
            <form
              className="auth-form"
              onSubmit={(event) =>
                void createReference(
                  event,
                  "/api/products/units",
                  (data) => ({
                    name: data.get("name"),
                    abbreviation: data.get("abbreviation"),
                    dimension: data.get("dimension"),
                    baseUnitId: data.get("baseUnitId") || null,
                    toBaseFactor: Number(data.get("toBaseFactor")),
                  }),
                  "Satuan berhasil ditambahkan.",
                )
              }
            >
              <label>
                Nama satuan
                <input maxLength={80} name="name" required />
              </label>
              <label>
                Singkatan
                <input maxLength={20} name="abbreviation" required />
              </label>
              <label>
                Dimensi
                <select name="dimension">
                  <option value="count">Jumlah</option>
                  <option value="mass">Massa</option>
                  <option value="volume">Volume</option>
                  <option value="length">Panjang</option>
                </select>
              </label>
              <label>
                Satuan dasar (kosongkan untuk satuan dasar)
                <select defaultValue="" name="baseUnitId">
                  <option value="">Satuan dasar</option>
                  {baseUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.abbreviation})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Faktor konversi
                <input
                  defaultValue="1"
                  min="0.000001"
                  name="toBaseFactor"
                  required
                  step="any"
                  type="number"
                />
              </label>
              <button className="button button--primary" disabled={submitting} type="submit">
                Simpan satuan
              </button>
            </form>
          </details>
          <details>
            <summary>Tambah tingkat harga</summary>
            <form
              className="auth-form"
              onSubmit={(event) =>
                void createReference(
                  event,
                  "/api/products/price-tiers",
                  (data) => ({ name: data.get("name"), description: data.get("description") }),
                  "Tingkat harga berhasil ditambahkan.",
                )
              }
            >
              <label>
                Nama tingkat harga
                <input maxLength={80} name="name" required />
              </label>
              <label>
                Keterangan
                <input maxLength={500} name="description" />
              </label>
              <button className="button button--primary" disabled={submitting} type="submit">
                Simpan tingkat harga
              </button>
            </form>
          </details>
        </div>
      ) : null}

      {manageScope && bundleProducts.length ? (
        <div className="staff-management__forms">
          <section className="management-card" aria-labelledby="bundle-title">
            <h3 id="bundle-title">Komposisi bundel</h3>
            <label>
              Produk bundel
              <select
                onChange={(event) => setBundleProductId(event.target.value)}
                value={bundleProductId}
              >
                {bundleProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.sku}
                  </option>
                ))}
              </select>
            </label>
            {bundleLoading ? <p className="auth-card__description">Memuat komposisi…</p> : null}
            {bundleMessage ? (
              <p className="auth-form__message" role="status">
                {bundleMessage}
              </p>
            ) : null}
            <form className="auth-form" onSubmit={saveBundle}>
              {bundleLines.map((line) => (
                <div className="bundle-component-row" key={line.id}>
                  <label>
                    Produk komponen
                    <select
                      onChange={(event) =>
                        setBundleLines((current) =>
                          current.map((item) =>
                            item.id === line.id
                              ? { ...item, productId: event.target.value, variantId: "" }
                              : item,
                          ),
                        )
                      }
                      required
                      value={line.productId}
                    >
                      <option value="">Pilih produk</option>
                      {componentProducts
                        .filter(({ id }) => id !== bundleProductId)
                        .map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} · {product.sku}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Varian (opsional)
                    <select
                      onChange={(event) =>
                        setBundleLines((current) =>
                          current.map((item) =>
                            item.id === line.id ? { ...item, variantId: event.target.value } : item,
                          ),
                        )
                      }
                      value={line.variantId}
                    >
                      <option value="">Produk dasar</option>
                      {bundleVariants
                        .filter((variant) => variant.productId === line.productId)
                        .map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Jumlah per bundel
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        setBundleLines((current) =>
                          current.map((item) =>
                            item.id === line.id ? { ...item, quantity: event.target.value } : item,
                          ),
                        )
                      }
                      required
                      value={line.quantity}
                    />
                  </label>
                  <button
                    className="button button--quiet"
                    onClick={() =>
                      setBundleLines((current) => current.filter((item) => item.id !== line.id))
                    }
                    type="button"
                  >
                    Hapus komponen
                  </button>
                </div>
              ))}
              <button
                className="button button--quiet"
                onClick={() =>
                  setBundleLines((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      productId: "",
                      variantId: "",
                      quantity: "1",
                    },
                  ])
                }
                type="button"
              >
                Tambah komponen
              </button>
              <button
                className="button button--primary"
                disabled={bundleLoading || bundleSubmitting}
                type="submit"
              >
                Simpan komposisi
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {canRead ? (
        <div>
          <label>
            Cari produk
            <input onChange={(event) => setSearch(event.target.value)} value={search} />
          </label>
          <h3>Produk terdaftar</h3>
          {visibleProducts.length ? (
            <ul className="staff-list">
              {visibleProducts.map((product) => (
                <li key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>
                      SKU: {product.sku} · {product.productType}
                    </span>
                    {product.categoryName ? <span>Kategori: {product.categoryName}</span> : null}
                    {product.variants.length ? (
                      <span>Varian: {product.variants.map(({ name }) => name).join(", ")}</span>
                    ) : null}
                    {product.prices.map((price) => {
                      const branchName =
                        branches.find(({ id }) => id === price.branchId)?.name ?? "Semua cabang";
                      const tierName =
                        options.priceTiers.find(({ id }) => id === price.priceTierId)?.name ??
                        "Umum";
                      return (
                        <span key={price.id}>
                          {branchName} · {tierName}: Rp{centsToRupiah(price.sellingPriceCents)}
                          {product.canReadCost && price.purchasePriceCents != null
                            ? ` (beli Rp${centsToRupiah(price.purchasePriceCents)})`
                            : ""}
                        </span>
                      );
                    })}
                    {!product.isActive ? <span>Nonaktif</span> : null}
                  </div>
                  {product.canEdit ? (
                    <div className="staff-list__actions">
                      <button
                        className="button button--quiet"
                        onClick={() => editProduct(product)}
                        type="button"
                      >
                        Ubah
                      </button>
                    </div>
                  ) : null}
                  {product.barcodes.length ? (
                    <button
                      className="button button--quiet"
                      onClick={() => prepareLabels(product)}
                      type="button"
                    >
                      Cetak label/barcode
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="auth-card__description">Belum ada produk yang cocok dengan pencarian.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
