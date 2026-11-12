"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";

type PosBranch = {
  id: string;
  name: string;
  posRead: boolean;
  posManage: boolean;
  posRefund: boolean;
};
type PosCatalogProduct = {
  productId: string;
  productName: string;
  sku: string;
  variantId: string | null;
  variantName: string | null;
  variantSku: string | null;
  priceCents: number;
  prices: Array<{ priceTierId: string | null; priceCents: number }>;
  barcodes: string[];
};
type PosCatalogService = {
  serviceId: string;
  name: string;
  code: string;
  priceCents: number;
  prices: Array<{ priceTierId: string | null; priceCents: number }>;
};
type PosCustomer = { id: string; name: string };
type PosPet = {
  id: string;
  name: string;
  owners: Array<{ customerId: string; name: string }>;
};
type PosShift = {
  id: string;
  warehouseId: string;
  warehouseName: string;
  cashierId: string;
  status: "open" | "closed";
  openingCashCents: number;
  openedAt: string;
  closedAt: string | null;
  closingCashCents: number | null;
  expectedCashCents: number | null;
};
type PosSale = {
  id: string;
  invoiceNumber: string;
  status: string;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  createdAt: string;
  cashierId: string;
  customerName: string | null;
};
type PosReceipt = {
  businessName: string | null;
  invoiceNumber: string;
  status: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  taxRateBps: number;
  taxIncluded: boolean;
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  createdAt: string;
  customerName: string | null;
  lines: Array<{
    id: string;
    itemType: "product" | "service";
    itemName: string;
    itemSku: string;
    quantity: string;
    returnedQuantity: string;
    unitPriceCents: number;
    lineTotalCents: number;
    refundableAmountCents: number;
  }>;
  payments: Array<{ method: string; amountCents: number; reference: string | null }>;
};
type CartPayment = { id: string; method: string; amountCents: number };
type PosData = {
  shifts: PosShift[];
  sales: PosSale[];
  warehouses: Array<{ id: string; name: string; code: string }>;
  products: PosCatalogProduct[];
  services: PosCatalogService[];
  priceTiers: Array<{ id: string; name: string }>;
};
type CartLine =
  | {
      id: string;
      itemType: "product";
      productId: string;
      variantId: string | null;
      name: string;
      sku: string;
      priceCents: number;
      quantity: string;
    }
  | {
      id: string;
      itemType: "service";
      serviceId: string;
      name: string;
      sku: string;
      priceCents: number;
      quantity: string;
    };

interface PosManagementProps {
  branches: PosBranch[];
  staffId: string;
  taxEnabled: boolean;
  taxRateBps: number;
  taxIncluded: boolean;
  customers: PosCustomer[];
  pets: PosPet[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(getApiErrorMessage(payload, "Operasi kasir gagal."));
  return payload as T;
}

function rupiah(cents: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function amountCents(quantity: string, priceCents: number) {
  const match = /^(0|[1-9]\d{0,10})(?:\.(\d{1,3}))?$/u.exec(quantity);
  if (!match) return 0;
  const milli = BigInt(match[1] ?? "0") * 1000n + BigInt((match[2] ?? "").padEnd(3, "0") || "0");
  return Number((milli * BigInt(priceCents) + 999n) / 1000n);
}

function taxAmount(amount: number, rateBps: number, included: boolean) {
  if (!rateBps) return 0;
  const numerator = BigInt(amount) * BigInt(rateBps);
  const denominator = included ? 10_000n + BigInt(rateBps) : 10_000n;
  return Number((numerator + denominator / 2n) / denominator);
}

function quantityMilli(value: string) {
  const match = /^(0|[1-9]\d{0,10})(?:\.(\d{1,3}))?$/u.exec(value);
  if (!match) return null;
  return BigInt(match[1] ?? "0") * 1000n + BigInt((match[2] ?? "").padEnd(3, "0") || "0");
}

function hasPriceForTier(
  prices: Array<{ priceTierId: string | null; priceCents: number }>,
  tierId: string,
) {
  return prices.some(({ priceTierId }) => priceTierId === (tierId || null) || priceTierId === null);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export function PosManagement({
  branches,
  staffId,
  taxEnabled,
  taxRateBps,
  taxIncluded,
  customers,
  pets,
}: PosManagementProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [data, setData] = useState<PosData | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [petId, setPetId] = useState("");
  const [priceTierId, setPriceTierId] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [itemType, setItemType] = useState<"product" | "service">("product");
  const [itemId, setItemId] = useState("");
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentRupiah, setPaymentRupiah] = useState("");
  const [cartPayments, setCartPayments] = useState<CartPayment[]>([]);
  const [supervisorPin, setSupervisorPin] = useState("");
  const [cashType, setCashType] = useState<"cash_in" | "cash_out">("cash_in");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const branch = branches.find((item) => item.id === branchId);
  const openShift = data?.shifts.find(
    (shift) => shift.cashierId === staffId && shift.status === "open",
  );
  const matchingProducts = (data?.products ?? []).filter(
    (product) =>
      hasPriceForTier(product.prices, priceTierId) &&
      `${product.productName} ${product.sku} ${product.variantName ?? ""} ${product.barcodes.join(" ")}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const matchingServices = (data?.services ?? []).filter(
    (service) =>
      hasPriceForTier(service.prices, priceTierId) &&
      `${service.name} ${service.code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const cartTotal = useMemo(() => {
    const subtotal = cart.reduce(
      (sum, line) => sum + amountCents(line.quantity, line.priceCents),
      0,
    );
    const bps = Math.min(10_000, Math.max(0, Math.round(Number(discountPercent) * 100) || 0));
    const discount = Number((BigInt(subtotal) * BigInt(bps) + 5_000n) / 10_000n);
    const tax = taxEnabled ? taxAmount(subtotal - discount, taxRateBps, taxIncluded) : 0;
    return subtotal - discount + (taxIncluded ? 0 : tax);
  }, [cart, discountPercent, taxEnabled, taxIncluded, taxRateBps]);
  const cartPaidTotal = cartPayments.reduce((total, payment) => total + payment.amountCents, 0);
  const cartBalance = cartTotal - cartPaidTotal;
  const matchingPets = pets.filter(
    (pet) => !customerId || pet.owners.some((owner) => owner.customerId === customerId),
  );

  function priceForTier(
    prices: Array<{ priceTierId: string | null; priceCents: number }>,
    tierId: string,
  ) {
    return (
      prices.find(({ priceTierId: id }) => id === (tierId || null))?.priceCents ??
      prices.find(({ priceTierId: id }) => id === null)?.priceCents ??
      0
    );
  }

  function changePriceTier(nextTierId: string) {
    setPriceTierId(nextTierId);
    setCart((current) =>
      current.map((line) => {
        if (line.itemType === "product") {
          const item = data?.products.find(
            ({ productId: id, variantId }) => id === line.productId && variantId === line.variantId,
          );
          return item ? { ...line, priceCents: priceForTier(item.prices, nextTierId) } : line;
        }
        const item = data?.services.find(({ serviceId }) => serviceId === line.serviceId);
        return item ? { ...line, priceCents: priceForTier(item.prices, nextTierId) } : line;
      }),
    );
  }

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    void request<PosData>(
      `/api/pos?branchId=${encodeURIComponent(branchId)}&refreshVersion=${refreshVersion}`,
    )
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setWarehouseId(result.warehouses[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setData(null);
          setMessage(error instanceof Error ? error.message : "Data kasir tidak dapat dimuat.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branchId, refreshVersion]);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operasi kasir gagal.");
    } finally {
      setBusy(false);
    }
  }

  function checkoutLines() {
    return cart.map((line) =>
      line.itemType === "product"
        ? {
            itemType: "product",
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          }
        : { itemType: "service", serviceId: line.serviceId, quantity: line.quantity },
    );
  }

  async function saveSale(hold: boolean) {
    const result = await request<{ sale: { invoiceNumber: string; totalCents: number } }>(
      "/api/pos/sales",
      {
        method: "POST",
        body: JSON.stringify({
          shiftId: openShift?.id,
          idempotencyKey: crypto.randomUUID(),
          priceTierId: priceTierId || null,
          customerId: customerId || null,
          petId: petId || null,
          hold,
          discountBps: Math.round(Number(discountPercent) * 100) || 0,
          supervisorPin: supervisorPin || undefined,
          lines: checkoutLines(),
          payments: hold ? [] : cartPayments,
        }),
      },
    );
    setMessage(
      `${hold ? "Transaksi ditahan" : "Tagihan"} ${result.sale.invoiceNumber} tersimpan · ${rupiah(result.sale.totalCents)}.`,
    );
    setCart([]);
    setCartPayments([]);
    setSupervisorPin("");
    setPaymentRupiah("");
    setRefreshVersion((value) => value + 1);
  }

  async function printReceipt(saleId: string) {
    const popup = window.open("", "_blank");
    if (!popup) throw new Error("Izinkan pop-up untuk mencetak struk.");
    popup.opener = null;
    const { sale } = await request<{ sale: PosReceipt }>(`/api/pos/sales/${saleId}`);
    const rows = sale.lines
      .map(
        (line) =>
          `<tr><td>${escapeHtml(line.itemName)}<br><small>${escapeHtml(line.itemSku)}</small></td><td>${escapeHtml(line.quantity)}</td><td>${escapeHtml(rupiah(line.unitPriceCents))}</td><td>${escapeHtml(rupiah(line.lineTotalCents))}</td></tr>`,
      )
      .join("");
    const payments = sale.payments
      .map(
        (payment) =>
          `<li>${escapeHtml(payment.method)}: ${escapeHtml(rupiah(payment.amountCents))}</li>`,
      )
      .join("");
    popup.document.open();
    popup.document.write(
      `<!doctype html><html lang="id"><meta charset="utf-8"><title>${escapeHtml(sale.invoiceNumber)}</title><style>body{font:14px system-ui;max-width:720px;margin:24px auto;color:#111}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #ccc}th:last-child,td:last-child{text-align:right}.totals{text-align:right}.muted{color:#555}@media print{body{margin:0}}</style><h1>${escapeHtml(sale.businessName ?? "Petora Indonesia")}</h1><p>${escapeHtml(sale.invoiceNumber)} · ${escapeHtml(new Date(sale.createdAt).toLocaleString("id-ID"))}</p><p>Pelanggan: ${escapeHtml(sale.customerName ?? "Umum")} · Status: ${escapeHtml(sale.status)}</p><table><thead><tr><th>Item</th><th>Jumlah</th><th>Harga</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><p>Subtotal: ${escapeHtml(rupiah(sale.subtotalCents))}</p><p>Diskon: ${escapeHtml(rupiah(sale.discountCents))}</p><p>Pajak${sale.taxIncluded ? " (termasuk)" : ""} ${sale.taxRateBps / 100}%: ${escapeHtml(rupiah(sale.taxCents))}</p><h2>Total: ${escapeHtml(rupiah(sale.totalCents))}</h2><p>Dibayar: ${escapeHtml(rupiah(sale.paidCents))}</p><p>Refund: ${escapeHtml(rupiah(sale.refundedCents))}</p></div><h3>Pembayaran</h3><ul>${payments}</ul><p class="muted">Terima kasih.</p></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function resumeSale(saleId: string) {
    await request(`/api/pos/sales/${saleId}/resume`, {
      method: "POST",
      body: JSON.stringify({
        shiftId: openShift?.id,
        idempotencyKey: crypto.randomUUID(),
        payments: [],
      }),
    });
    setMessage("Transaksi dilanjutkan; stok telah diperiksa dan dipotong.");
    setRefreshVersion((value) => value + 1);
  }

  async function settleSale(sale: PosSale) {
    const amount = window.prompt(
      `Sisa tagihan ${rupiah(sale.totalCents - sale.paidCents)}. Masukkan pembayaran (Rp):`,
      String(Math.floor((sale.totalCents - sale.paidCents) / 100)),
    );
    if (amount === null) return;
    const amountCents = Math.round(Number(amount) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents < 1)
      throw new Error("Jumlah pembayaran tidak valid.");
    await request(`/api/pos/sales/${sale.id}/payments`, {
      method: "POST",
      body: JSON.stringify({
        shiftId: openShift?.id,
        idempotencyKey: crypto.randomUUID(),
        payments: [{ method: paymentMethod, amountCents }],
      }),
    });
    setMessage("Pembayaran tagihan dicatat.");
    setRefreshVersion((value) => value + 1);
  }

  async function refundSale(saleId: string) {
    const { sale } = await request<{ sale: PosReceipt }>(`/api/pos/sales/${saleId}`);
    const refundableLines = sale.lines.filter((line) => {
      const quantity = quantityMilli(line.quantity);
      const returned = quantityMilli(line.returnedQuantity);
      return quantity !== null && returned !== null && quantity > returned;
    });
    if (!refundableLines.length) throw new Error("Semua item penjualan sudah diretur.");
    const choices = refundableLines
      .map(
        (line, index) =>
          `${index + 1}. ${line.itemName} (sisa ${Number(line.quantity) - Number(line.returnedQuantity)})`,
      )
      .join("\n");
    const selection = Number(window.prompt(`Pilih satu item untuk retur:\n${choices}`, "1"));
    if (!Number.isInteger(selection) || selection < 1 || selection > refundableLines.length) return;
    const line = refundableLines[selection - 1];
    if (!line) return;
    const originalQuantity = quantityMilli(line.quantity);
    const alreadyReturned = quantityMilli(line.returnedQuantity);
    if (originalQuantity === null || alreadyReturned === null)
      throw new Error("Jumlah pada tagihan tidak valid.");
    const remainingQuantity = originalQuantity - alreadyReturned;
    const quantity = window.prompt(
      `Jumlah ${line.itemName} yang diretur:`,
      (Number(remainingQuantity) / 1000).toString(),
    );
    if (quantity === null) return;
    const returnedMilli = quantityMilli(quantity);
    if (!returnedMilli || returnedMilli < 1n || returnedMilli > remainingQuantity)
      throw new Error("Jumlah retur tidak valid.");
    const remainingAmount = line.refundableAmountCents;
    const amountCents =
      returnedMilli === remainingQuantity
        ? remainingAmount
        : Number(
            (BigInt(remainingAmount) * returnedMilli + remainingQuantity / 2n) / remainingQuantity,
          );
    if (amountCents < 1) throw new Error("Nilai refund harus lebih besar dari nol.");
    const reason = window.prompt("Alasan retur (minimal 5 karakter):");
    if (reason === null) return;
    const supervisorPin = window.prompt("PIN supervisor (kosongkan jika tidak diperlukan):") ?? "";
    const method = window.prompt(
      "Metode pengembalian (cash, bank_transfer, card, qris, ewallet, virtual_account):",
      "cash",
    );
    if (!method) return;
    await request(`/api/pos/sales/${saleId}/refunds`, {
      method: "POST",
      body: JSON.stringify({
        shiftId: openShift?.id,
        idempotencyKey: crypto.randomUUID(),
        reason,
        supervisorPin: supervisorPin || undefined,
        lines: [{ saleLineId: line.id, quantity }],
        payments: [{ method, amountCents }],
      }),
    });
    setMessage(`Retur tercatat · ${rupiah(amountCents)} dikembalikan.`);
    setRefreshVersion((value) => value + 1);
  }

  async function voidSale(saleId: string) {
    const reason = window.prompt("Alasan pembatalan (minimal 5 karakter):");
    if (reason === null) return;
    const supervisorPin = window.prompt("PIN supervisor (kosongkan jika tidak diperlukan):") ?? "";
    await request(`/api/pos/sales/${saleId}/void`, {
      method: "POST",
      body: JSON.stringify({
        shiftId: openShift?.id,
        idempotencyKey: crypto.randomUUID(),
        reason,
        supervisorPin: supervisorPin || undefined,
      }),
    });
    setMessage("Penjualan dibatalkan dan stok dikembalikan.");
    setRefreshVersion((value) => value + 1);
  }

  function addToCart() {
    const product =
      itemType === "product"
        ? data?.products.find(
            ({ productId, variantId }) => `${productId}:${variantId ?? ""}` === itemId,
          )
        : null;
    const service =
      itemType === "service" ? data?.services.find(({ serviceId }) => serviceId === itemId) : null;
    if (product) {
      setCart((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          itemType: "product",
          productId: product.productId,
          variantId: product.variantId,
          name: product.variantName
            ? `${product.productName} · ${product.variantName}`
            : product.productName,
          sku: product.variantSku ?? product.sku,
          priceCents: priceForTier(product.prices, priceTierId),
          quantity,
        },
      ]);
    } else if (service) {
      setCart((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          itemType: "service",
          serviceId: service.serviceId,
          name: service.name,
          sku: service.code,
          priceCents: priceForTier(service.prices, priceTierId),
          quantity,
        },
      ]);
    }
    setItemId("");
    setSearch("");
  }

  return (
    <section aria-labelledby="pos-title" className="customer-management">
      <h2 id="pos-title">Kasir dan tagihan</h2>
      {branches.length > 1 ? (
        <label>
          Cabang kasir
          <select
            disabled={busy || cart.length > 0}
            onChange={(event) => setBranchId(event.target.value)}
            value={branchId}
          >
            {branches.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          {cart.length ? (
            <span className="muted">Kosongkan keranjang sebelum pindah cabang.</span>
          ) : null}
        </label>
      ) : branch ? (
        <p>{branch.name}</p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {branch?.posManage && !openShift ? (
        <article className="management-card">
          <h3>Buka shift</h3>
          <label>
            Gudang
            <select onChange={(event) => setWarehouseId(event.target.value)} value={warehouseId}>
              <option value="">Pilih gudang</option>
              {(data?.warehouses ?? []).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} · {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kas awal (Rp)
            <input
              min="0"
              onChange={(event) => setOpeningCash(event.target.value)}
              type="number"
              value={openingCash}
            />
          </label>
          <button
            disabled={busy || !warehouseId}
            onClick={() =>
              void perform(async () => {
                await request("/api/pos", {
                  method: "POST",
                  body: JSON.stringify({
                    branchId,
                    warehouseId,
                    openingCashCents: Math.round(Number(openingCash) * 100),
                  }),
                });
                setRefreshVersion((value) => value + 1);
              })
            }
            type="button"
          >
            Buka shift
          </button>
        </article>
      ) : null}
      {openShift && branch?.posManage ? (
        <div className="management-grid">
          <article className="management-card">
            <h3>Shift aktif · {openShift.warehouseName}</h3>
            <p>Kas awal: {rupiah(openShift.openingCashCents)}</p>
            {customers.length ? (
              <label>
                Pelanggan
                <select
                  onChange={(event) => {
                    setCustomerId(event.target.value);
                    setPetId("");
                  }}
                  value={customerId}
                >
                  <option value="">Pelanggan umum</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {matchingPets.length ? (
              <label>
                Hewan
                <select onChange={(event) => setPetId(event.target.value)} value={petId}>
                  <option value="">Tanpa hewan</option>
                  {matchingPets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} · {pet.owners.map(({ name }) => name).join(", ")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {data?.priceTiers.length ? (
              <label>
                Tier harga
                <select
                  onChange={(event) => changePriceTier(event.target.value)}
                  value={priceTierId}
                >
                  <option value="">Harga dasar</option>
                  {data.priceTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Pencarian produk/barcode/layanan
              <input onChange={(event) => setSearch(event.target.value)} value={search} />
            </label>
            <label>
              Jenis item
              <select
                onChange={(event) => {
                  setItemType(event.target.value as "product" | "service");
                  setItemId("");
                }}
                value={itemType}
              >
                <option value="product">Produk</option>
                <option value="service">Layanan</option>
              </select>
            </label>
            <label>
              Item
              <select onChange={(event) => setItemId(event.target.value)} value={itemId}>
                <option value="">Pilih item</option>
                {itemType === "product"
                  ? matchingProducts.map((product) => {
                      const key = `${product.productId}:${product.variantId ?? ""}`;
                      return (
                        <option key={key} value={key}>
                          {product.productName} · {product.variantName ?? product.sku} —{" "}
                          {rupiah(product.priceCents)}
                        </option>
                      );
                    })
                  : matchingServices.map((service) => (
                      <option key={service.serviceId} value={service.serviceId}>
                        {service.name} · {service.code} — {rupiah(service.priceCents)}
                      </option>
                    ))}
              </select>
            </label>
            <label>
              Jumlah
              <input
                min="0.001"
                onChange={(event) => setQuantity(event.target.value)}
                step="0.001"
                type="number"
                value={quantity}
              />
            </label>
            <button disabled={!itemId || busy} onClick={addToCart} type="button">
              Tambah ke keranjang
            </button>
          </article>
          <article className="management-card">
            <h3>Keranjang</h3>
            {cart.length ? (
              <ul className="management-list">
                {cart.map((line) => (
                  <li key={line.id}>
                    <span>
                      {line.name} · {line.quantity} × {rupiah(line.priceCents)}
                    </span>
                    <button
                      onClick={() =>
                        setCart((current) => current.filter(({ id }) => id !== line.id))
                      }
                      type="button"
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Belum ada item.</p>
            )}
            <label>
              Diskon transaksi (%)
              <input
                max="100"
                min="0"
                onChange={(event) => setDiscountPercent(event.target.value)}
                step="0.01"
                type="number"
                value={discountPercent}
              />
            </label>
            <label>
              Metode pembayaran
              <select
                onChange={(event) => setPaymentMethod(event.target.value)}
                value={paymentMethod}
              >
                <option value="cash">Tunai</option>
                <option value="bank_transfer">Transfer</option>
                <option value="card">Kartu/EDC</option>
                <option value="qris">QRIS</option>
                <option value="ewallet">E-wallet</option>
                <option value="virtual_account">Virtual account</option>
              </select>
            </label>
            <label>
              Jumlah pembayaran (Rp)
              <input
                min="1"
                onChange={(event) => setPaymentRupiah(event.target.value)}
                type="number"
                value={paymentRupiah}
              />
            </label>
            <button
              disabled={busy || !paymentRupiah || Number(paymentRupiah) <= 0}
              onClick={() => {
                const amountCents = Math.round(Number(paymentRupiah) * 100);
                if (!Number.isSafeInteger(amountCents) || amountCents < 1) {
                  setMessage("Jumlah pembayaran tidak valid.");
                  return;
                }
                setCartPayments((current) => [
                  ...current,
                  { id: crypto.randomUUID(), method: paymentMethod, amountCents },
                ]);
                setPaymentRupiah("");
              }}
              type="button"
            >
              Tambah pembayaran
            </button>
            {cartPayments.length ? (
              <ul className="management-list">
                {cartPayments.map((payment) => (
                  <li key={payment.id}>
                    <span>
                      {payment.method}: {rupiah(payment.amountCents)}
                    </span>
                    <button
                      onClick={() =>
                        setCartPayments((current) => current.filter(({ id }) => id !== payment.id))
                      }
                      type="button"
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <label>
              PIN supervisor jika diminta
              <input
                autoComplete="off"
                onChange={(event) => setSupervisorPin(event.target.value)}
                type="password"
                value={supervisorPin}
              />
            </label>
            <strong>Total: {rupiah(cartTotal)}</strong>
            <p>
              Pembayaran: {rupiah(cartPaidTotal)} · Sisa: {rupiah(Math.max(0, cartBalance))}
            </p>
            {cartBalance < 0 ? <p role="alert">Pembayaran melebihi total tagihan.</p> : null}
            <p className="muted">
              Menahan transaksi tidak memotong stok; stok diperiksa saat transaksi dilanjutkan.
            </p>
            <button
              disabled={!cart.length || busy || cartBalance < 0}
              onClick={() => void perform(() => saveSale(false))}
              type="button"
            >
              Simpan penjualan
            </button>
            <button
              disabled={!cart.length || busy}
              onClick={() => void perform(() => saveSale(true))}
              type="button"
            >
              Tahan transaksi
            </button>
          </article>
          <article className="management-card">
            <h3>Mutasi kas</h3>
            <select
              onChange={(event) => setCashType(event.target.value as "cash_in" | "cash_out")}
              value={cashType}
            >
              <option value="cash_in">Kas masuk</option>
              <option value="cash_out">Kas keluar</option>
            </select>
            <label>
              Jumlah (Rp)
              <input
                min="1"
                onChange={(event) => setCashAmount(event.target.value)}
                type="number"
                value={cashAmount}
              />
            </label>
            <label>
              Alasan
              <input onChange={(event) => setCashReason(event.target.value)} value={cashReason} />
            </label>
            <button
              disabled={busy || !cashAmount || cashReason.trim().length < 5}
              onClick={() =>
                void perform(async () => {
                  await request(`/api/pos/shifts/${openShift.id}/cash-movements`, {
                    method: "POST",
                    body: JSON.stringify({
                      movementType: cashType,
                      amountCents: Math.round(Number(cashAmount) * 100),
                      reason: cashReason,
                    }),
                  });
                  setCashAmount("");
                  setCashReason("");
                  setMessage("Mutasi kas tercatat.");
                })
              }
              type="button"
            >
              Catat mutasi kas
            </button>
            <label>
              Kas fisik saat tutup (Rp)
              <input
                min="0"
                onChange={(event) => setClosingCash(event.target.value)}
                type="number"
                value={closingCash}
              />
            </label>
            <button
              disabled={busy || closingCash === ""}
              onClick={() =>
                void perform(async () => {
                  const result = await request<{
                    shift: { expectedCashCents: number; differenceCents: number };
                  }>(`/api/pos/shifts/${openShift.id}/close`, {
                    method: "POST",
                    body: JSON.stringify({
                      closingCashCents: Math.round(Number(closingCash) * 100),
                    }),
                  });
                  setMessage(
                    `Shift ditutup. Ekspektasi ${rupiah(result.shift.expectedCashCents)}; selisih ${rupiah(result.shift.differenceCents)}.`,
                  );
                  setClosingCash("");
                  setRefreshVersion((value) => value + 1);
                })
              }
              type="button"
            >
              Tutup shift
            </button>
          </article>
        </div>
      ) : null}
      {data && (branch?.posRead || branch?.posManage || branch?.posRefund) ? (
        <article className="management-card">
          <h3>Penjualan terbaru</h3>
          {data.sales.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Waktu</th>
                    <th>Pelanggan</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Dibayar</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.invoiceNumber}</td>
                      <td>{new Date(sale.createdAt).toLocaleString("id-ID")}</td>
                      <td>{sale.customerName ?? "Umum"}</td>
                      <td>{sale.status}</td>
                      <td>{rupiah(sale.totalCents)}</td>
                      <td>{rupiah(sale.paidCents)}</td>
                      <td>
                        <div className="button-row">
                          <button
                            disabled={busy}
                            onClick={() => void perform(() => printReceipt(sale.id))}
                            type="button"
                          >
                            Cetak
                          </button>
                          {openShift && branch?.posManage && sale.status === "held" ? (
                            <button
                              disabled={busy}
                              onClick={() => void perform(() => resumeSale(sale.id))}
                              type="button"
                            >
                              Lanjutkan
                            </button>
                          ) : null}
                          {openShift &&
                          branch?.posManage &&
                          sale.status === "partially_paid" &&
                          sale.paidCents < sale.totalCents ? (
                            <button
                              disabled={busy}
                              onClick={() => void perform(() => settleSale(sale))}
                              type="button"
                            >
                              Bayar saldo
                            </button>
                          ) : null}
                          {openShift &&
                          branch?.posRefund &&
                          sale.paidCents > sale.refundedCents &&
                          sale.status !== "voided" &&
                          sale.status !== "refunded" ? (
                            <button
                              disabled={busy}
                              onClick={() => void perform(() => refundSale(sale.id))}
                              type="button"
                            >
                              Retur
                            </button>
                          ) : null}
                          {openShift &&
                          branch?.posRefund &&
                          sale.paidCents === 0 &&
                          (sale.status === "held" || sale.status === "partially_paid") ? (
                            <button
                              disabled={busy}
                              onClick={() => void perform(() => voidSale(sale.id))}
                              type="button"
                            >
                              Batalkan
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Belum ada penjualan.</p>
          )}
        </article>
      ) : null}
    </section>
  );
}
