"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getApiErrorMessage } from "@/components/auth/api-message";

type BranchAccess = {
  id: string;
  name: string;
  inventoryRead: boolean;
  inventoryManage: boolean;
  inventoryAdjust: boolean;
  inventoryTransfer: boolean;
  inventoryApprove: boolean;
  procurementRead: boolean;
  procurementManage: boolean;
  procurementApprove: boolean;
  procurementCostRead: boolean;
  inventoryCostRead: boolean;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  variants: Array<{ id: string; name: string }>;
};

type Warehouse = { id: string; branchId: string; code: string; name: string; isActive: boolean };
type StockRow = {
  batchId: string;
  productId: string;
  supplierId: string | null;
  productName: string;
  sku: string;
  variantId: string | null;
  batchNumber: string;
  expiresOn: string | null;
  quantity: string;
  unitCostCents?: number;
  inventoryValueCents?: number;
};
type StockMovement = {
  id: string;
  batchId: string;
  batchNumber: string;
  movementType: string;
  quantityDelta: string;
  balanceAfter: string;
  sourceType: string;
  reason: string | null;
  createdAt: string;
  unitCostCents?: number;
};
type InventoryReports = {
  today: string;
  expiryThrough: string;
  expiringBatches: Array<{
    batchId: string;
    productName: string;
    sku: string;
    variantName: string | null;
    batchNumber: string;
    expiresOn: string;
    quantity: string;
    isExpired: boolean;
  }>;
  slowMovingProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    variantId: string | null;
    variantName: string | null;
    currentQuantity: string;
    batchCount: number;
    lastOutboundAt: string | null;
  }>;
};
type Supplier = { id: string; name: string; isActive: boolean };
type Transfer = {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  status: string;
  reason: string;
  lines: Array<{ productName: string; sku: string; variantName: string | null; quantity: string }>;
  batchLines: Array<{
    id: string;
    productName: string;
    sku: string;
    shippedQuantity: string;
    receivedQuantity: string;
  }>;
};
type PurchaseOrder = {
  id: string;
  orderNumber: string;
  supplierName: string;
  warehouseId: string;
  warehouseName: string;
  status: string;
  lines: Array<{
    id: string;
    productId: string;
    productName: string;
    sku: string;
    variantId: string | null;
    variantName: string | null;
    quantity: string;
    receivedQuantity: string;
    unitCostCents?: number;
  }>;
};
type PurchaseRequestRecord = {
  id: string;
  requestNumber: string;
  status: string;
  notes: string | null;
  lines: Array<{ productId: string; productName: string; sku: string; quantity: string }>;
};
type ReorderLevel = {
  productId: string;
  variantId: string | null;
  productName: string;
  sku: string;
  minimumQuantity: string;
  reorderQuantity: string;
};
type ReorderSuggestion = {
  productId: string;
  productName: string;
  sku: string;
  minimumQuantity: string;
  reorderQuantity: string;
  currentQuantity: string;
};
type Stocktake = {
  id: string;
  status: string;
  reason: string;
  lineCount: number;
  createdBy: string;
};
type Payable = { supplierId: string; supplierName: string; balanceCents: number };

interface InventoryManagementProps {
  branches: BranchAccess[];
  products: ProductOption[];
  canManageSuppliers: boolean;
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
  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "Permintaan operasional gagal."));
  }
  return payload as T;
}

function rupiah(cents: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function InventoryManagement({
  branches,
  products,
  canManageSuppliers,
}: InventoryManagementProps) {
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState("");
  const [cardProductId, setCardProductId] = useState(products[0]?.id ?? "");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [stockCard, setStockCard] = useState<StockMovement[]>([]);
  const [reports, setReports] = useState<InventoryReports | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [reorderLevels, setReorderLevels] = useState<ReorderLevel[]>([]);
  const [reorderSuggestions, setReorderSuggestions] = useState<ReorderSuggestion[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const activeBranch = branches.find(({ id }) => id === branchId);
  const warehouseBranches = useMemo(
    () =>
      branches.filter(
        (branch) =>
          branch.inventoryRead ||
          branch.inventoryManage ||
          branch.inventoryAdjust ||
          branch.inventoryTransfer ||
          branch.inventoryApprove ||
          branch.procurementRead ||
          branch.procurementManage,
      ),
    [branches],
  );
  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.branchId === branchId && warehouse.isActive),
    [warehouses, branchId],
  );
  const activeProducts = products;

  useEffect(() => {
    let cancelled = false;
    async function loadWarehouses() {
      try {
        const results = await Promise.all(
          warehouseBranches.map(async (branch) => {
            const result = await request<{ warehouses: Warehouse[] }>(
              `/api/inventory/warehouses?branchId=${encodeURIComponent(branch.id)}`,
            );
            return result.warehouses;
          }),
        );
        if (cancelled) return;
        const allWarehouses = results.flat();
        setWarehouses(allWarehouses);
        const defaultWarehouse =
          allWarehouses.find(
            (warehouse) => warehouse.branchId === branchId && warehouse.isActive,
          ) ?? allWarehouses.find((warehouse) => warehouse.isActive);
        setWarehouseId((current) => current || defaultWarehouse?.id || "");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Gudang tidak dapat dimuat.");
        }
      }
    }
    if (warehouseBranches.length) void loadWarehouses();
    return () => {
      cancelled = true;
    };
  }, [warehouseBranches, branchId]);

  useEffect(() => {
    if (!activeBranch) return;
    const branchPermissions = {
      inventoryRead: activeBranch.inventoryRead,
      inventoryManage: activeBranch.inventoryManage,
      inventoryAdjust: activeBranch.inventoryAdjust,
      inventoryTransfer: activeBranch.inventoryTransfer,
      inventoryApprove: activeBranch.inventoryApprove,
      procurementRead: activeBranch.procurementRead,
      procurementManage: activeBranch.procurementManage,
      procurementCostRead: activeBranch.procurementCostRead,
    };
    let cancelled = false;
    async function loadBranchData(_reloadVersion: number) {
      setLoading(true);
      setMessage("");
      try {
        const [
          stockResult,
          transferResult,
          orderResult,
          requestResult,
          supplierResult,
          stocktakeResult,
          payableResult,
          reorderResult,
        ] = await Promise.all([
          branchPermissions.inventoryRead ||
          branchPermissions.inventoryManage ||
          branchPermissions.inventoryAdjust
            ? warehouseId &&
              warehouses.some(
                (warehouse) => warehouse.id === warehouseId && warehouse.branchId === branchId,
              )
              ? request<{ stock: StockRow[] }>(
                  `/api/inventory/stock?warehouseId=${encodeURIComponent(warehouseId)}`,
                )
              : Promise.resolve({ stock: [] })
            : Promise.resolve({ stock: [] }),
          branchPermissions.inventoryRead || branchPermissions.inventoryTransfer
            ? request<{ transfers: Transfer[] }>(
                `/api/inventory/transfers?branchId=${encodeURIComponent(branchId)}`,
              )
            : Promise.resolve({ transfers: [] }),
          branchPermissions.procurementRead
            ? request<{ orders: PurchaseOrder[] }>(
                `/api/procurement/orders?branchId=${encodeURIComponent(branchId)}`,
              )
            : Promise.resolve({ orders: [] }),
          branchPermissions.procurementRead
            ? request<{ requests: PurchaseRequestRecord[] }>(
                `/api/procurement/requests?branchId=${encodeURIComponent(branchId)}`,
              )
            : Promise.resolve({ requests: [] }),
          branchPermissions.procurementRead ||
          branchPermissions.procurementManage ||
          canManageSuppliers
            ? request<{ suppliers: Supplier[] }>(
                `/api/procurement/suppliers?branchId=${encodeURIComponent(branchId)}`,
              )
            : Promise.resolve({ suppliers: [] }),
          warehouseId &&
          (branchPermissions.inventoryRead ||
            branchPermissions.inventoryAdjust ||
            branchPermissions.inventoryApprove)
            ? request<{ stocktakes: Stocktake[] }>(
                `/api/inventory/stocktakes?warehouseId=${encodeURIComponent(warehouseId)}`,
              )
            : Promise.resolve({ stocktakes: [] }),
          branchPermissions.procurementCostRead
            ? request<{ payables: Payable[] }>(
                `/api/procurement/payables?branchId=${encodeURIComponent(branchId)}`,
              )
            : Promise.resolve({ payables: [] }),
          warehouseId &&
          (branchPermissions.inventoryRead || branchPermissions.inventoryManage) &&
          warehouses.some(
            (warehouse) => warehouse.id === warehouseId && warehouse.branchId === branchId,
          )
            ? request<{
                levels: ReorderLevel[];
                suggestions: ReorderSuggestion[];
              }>(`/api/inventory/reorder-levels?warehouseId=${encodeURIComponent(warehouseId)}`)
            : Promise.resolve({ levels: [], suggestions: [] }),
        ]);
        if (!cancelled) {
          setStock(stockResult.stock);
          setTransfers(transferResult.transfers);
          setOrders(orderResult.orders);
          setPurchaseRequests(requestResult.requests);
          setSuppliers(supplierResult.suppliers);
          setStocktakes(stocktakeResult.stocktakes);
          setPayables(payableResult.payables);
          setReorderLevels(reorderResult.levels);
          setReorderSuggestions(reorderResult.suggestions);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "Data operasional tidak dapat dimuat.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadBranchData(refreshVersion);
    return () => {
      cancelled = true;
    };
  }, [activeBranch, branchId, canManageSuppliers, refreshVersion, warehouseId, warehouses]);

  useEffect(() => {
    if (
      !activeBranch ||
      !warehouseId ||
      !warehouses.some(
        (warehouse) => warehouse.id === warehouseId && warehouse.branchId === branchId,
      )
    ) {
      setStockCard([]);
      setReports(null);
      return;
    }
    let cancelled = false;
    const canReadInventory =
      activeBranch.inventoryRead || activeBranch.inventoryManage || activeBranch.inventoryAdjust;
    async function loadReports() {
      if (!canReadInventory) return;
      try {
        const [cardResult, reportResult] = await Promise.all([
          cardProductId
            ? request<{ movements: StockMovement[] }>(
                `/api/inventory/stock/card?warehouseId=${encodeURIComponent(warehouseId)}&productId=${encodeURIComponent(cardProductId)}`,
              )
            : Promise.resolve({ movements: [] }),
          request<{ reports: InventoryReports }>(
            `/api/inventory/reports?warehouseId=${encodeURIComponent(warehouseId)}&refreshVersion=${refreshVersion}`,
          ),
        ]);
        if (!cancelled) {
          setStockCard(cardResult.movements);
          setReports(reportResult.reports);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "Laporan inventori tidak dapat dimuat.",
          );
        }
      }
    }
    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [activeBranch, branchId, cardProductId, refreshVersion, warehouseId, warehouses]);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: (form: FormData) => Promise<void>,
  ) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      await action(new FormData(event.currentTarget));
      setMessage("Perubahan berhasil disimpan.");
      setRefreshVersion((version) => version + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Perubahan tidak dapat disimpan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function post(url: string, body: unknown) {
    await request(url, { method: "POST", body: JSON.stringify(body) });
  }

  if (!activeBranch) return null;

  const warehouseNames = new Map(warehouses.map(({ id, name }) => [id, name]));
  const availableDestinations = warehouses.filter(({ isActive }) => isActive);
  const variantOptions = activeProducts.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      label: `${product.name} · ${variant.name}`,
    })),
  );

  return (
    <section aria-labelledby="inventory-title" className="inventory-management">
      <div className="management-section__header">
        <div>
          <p className="welcome__eyebrow">OPERASIONAL</p>
          <h2 id="inventory-title">Stok dan pengadaan</h2>
        </div>
        <label>
          Cabang operasional
          <select
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setWarehouseId("");
            }}
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
      {loading ? <p className="auth-card__description">Memuat data operasional…</p> : null}
      {!activeProducts.length ? (
        <p className="auth-card__description">
          Katalog produk belum dapat dipilih. Berikan izin produk baca kepada staf operasional.
        </p>
      ) : null}

      {activeBranch.inventoryRead ||
      activeBranch.inventoryManage ||
      activeBranch.inventoryAdjust ? (
        <div className="management-grid">
          {activeBranch.inventoryManage ? (
            <article className="management-card">
              <h3>Tambah gudang</h3>
              <form
                onSubmit={(event) =>
                  submit(event, async (form) => {
                    await post("/api/inventory/warehouses", {
                      branchId,
                      code: form.get("code"),
                      name: form.get("name"),
                    });
                  })
                }
              >
                <label>
                  Kode gudang
                  <input name="code" maxLength={20} required />
                </label>
                <label>
                  Nama gudang
                  <input name="name" minLength={2} maxLength={120} required />
                </label>
                <button disabled={submitting} type="submit">
                  Simpan gudang
                </button>
              </form>
            </article>
          ) : null}
          <article className="management-card">
            <h3>Saldo stok per batch</h3>
            <label>
              Gudang
              <select
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                required
              >
                <option value="">Pilih gudang</option>
                {activeWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name} ({warehouse.code})
                  </option>
                ))}
              </select>
            </label>
            {activeBranch.inventoryCostRead ? (
              <p className="auth-card__description">
                Nilai persediaan ditampilkan sesuai izin HPP.
              </p>
            ) : null}
            {stock.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Produk / SKU</th>
                      <th>Batch</th>
                      <th>Kedaluwarsa</th>
                      <th>Saldo</th>
                      {activeBranch.inventoryCostRead ? <th>Nilai batch</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map((row) => (
                      <tr key={row.batchId}>
                        <td>
                          {row.productName} · {row.sku}
                        </td>
                        <td>{row.batchNumber}</td>
                        <td>{row.expiresOn ?? "—"}</td>
                        <td>{row.quantity}</td>
                        {activeBranch.inventoryCostRead ? (
                          <td>{rupiah(row.inventoryValueCents ?? 0)}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="auth-card__description">Belum ada saldo stok pada gudang ini.</p>
            )}
          </article>

          {activeBranch.inventoryRead ||
          activeBranch.inventoryManage ||
          activeBranch.inventoryAdjust ? (
            <article className="management-card">
              <h3>Kartu stok</h3>
              <label>
                Produk
                <select
                  onChange={(event) => setCardProductId(event.target.value)}
                  value={cardProductId}
                >
                  <option value="">Pilih produk</option>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.sku}
                    </option>
                  ))}
                </select>
              </label>
              {stockCard.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Batch</th>
                        <th>Mutasi</th>
                        <th>Saldo batch</th>
                        <th>Sumber / alasan</th>
                        {activeBranch.inventoryCostRead ? <th>HPP/unit</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {stockCard.map((movement) => (
                        <tr key={movement.id}>
                          <td>{new Date(movement.createdAt).toLocaleString("id-ID")}</td>
                          <td>{movement.batchNumber}</td>
                          <td>
                            {movement.movementType} ({movement.quantityDelta})
                          </td>
                          <td>{movement.balanceAfter}</td>
                          <td>{movement.reason ?? movement.sourceType}</td>
                          {activeBranch.inventoryCostRead ? (
                            <td>
                              {movement.unitCostCents === undefined
                                ? "—"
                                : rupiah(movement.unitCostCents)}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="auth-card__description">
                  Pilih produk untuk melihat hingga 500 mutasi terakhir.
                </p>
              )}
            </article>
          ) : null}

          {reports ? (
            <>
              <article className="management-card">
                <h3>Batch kedaluwarsa / segera kedaluwarsa</h3>
                <p className="auth-card__description">
                  Per tanggal {reports.today}; rentang sampai {reports.expiryThrough}.
                </p>
                {reports.expiringBatches.length ? (
                  <ul className="management-list">
                    {reports.expiringBatches.map((batch) => (
                      <li key={batch.batchId}>
                        <div>
                          <strong>
                            {batch.productName} · {batch.sku} · {batch.batchNumber}
                          </strong>
                          <span>
                            {batch.isExpired ? "Kedaluwarsa" : "Kedaluwarsa pada"} {batch.expiresOn}{" "}
                            · saldo {batch.quantity}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="auth-card__description">
                    Tidak ada batch bersaldo yang kedaluwarsa dalam rentang ini.
                  </p>
                )}
              </article>
              <article className="management-card">
                <h3>Barang lambat bergerak</h3>
                <p className="auth-card__description">
                  Barang bersaldo tanpa mutasi stok keluar selama 90 hari.
                </p>
                {reports.slowMovingProducts.length ? (
                  <ul className="management-list">
                    {reports.slowMovingProducts.map((product) => (
                      <li key={`${product.productId}:${product.variantId ?? ""}`}>
                        <div>
                          <strong>
                            {product.productName} · {product.sku}
                            {product.variantName ? ` · ${product.variantName}` : ""}
                          </strong>
                          <span>
                            Saldo {product.currentQuantity} pada {product.batchCount} batch ·{" "}
                            {product.lastOutboundAt
                              ? `stok keluar terakhir ${new Date(product.lastOutboundAt).toLocaleDateString("id-ID")}`
                              : "belum pernah ada stok keluar"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="auth-card__description">
                    Tidak ada barang yang memenuhi kriteria lambat bergerak.
                  </p>
                )}
              </article>
            </>
          ) : null}

          {activeBranch.inventoryRead || activeBranch.inventoryManage ? (
            <article className="management-card">
              <h3>Stok minimum dan pemesanan ulang</h3>
              {reorderSuggestions.length ? (
                <ul className="management-list">
                  {reorderSuggestions.map((suggestion) => (
                    <li key={`${suggestion.productId}:${suggestion.sku}`}>
                      <span>
                        {suggestion.productName} · {suggestion.sku}: {suggestion.currentQuantity} /{" "}
                        {suggestion.minimumQuantity}
                      </span>
                      <strong>Pesan {suggestion.reorderQuantity}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="auth-card__description">Tidak ada saran pemesanan ulang.</p>
              )}
              {activeBranch.inventoryManage ? (
                <form
                  onSubmit={(event) =>
                    submit(event, async (form) => {
                      const productId = String(form.get("productId"));
                      const variantId = String(form.get("variantId") || "") || null;
                      const retainedLevels = reorderLevels
                        .filter(
                          (level) => level.productId !== productId || level.variantId !== variantId,
                        )
                        .map(({ productId, variantId, minimumQuantity, reorderQuantity }) => ({
                          productId,
                          variantId,
                          minimumQuantity,
                          reorderQuantity,
                        }));
                      const line = {
                        productId,
                        variantId,
                        minimumQuantity: form.get("minimumQuantity"),
                        reorderQuantity: form.get("reorderQuantity"),
                      };
                      await request("/api/inventory/reorder-levels", {
                        method: "PUT",
                        body: JSON.stringify({
                          warehouseId,
                          lines: [...retainedLevels, line],
                        }),
                      });
                    })
                  }
                >
                  <label>
                    Produk
                    <select name="productId" required>
                      {activeProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Varian (opsional)
                    <select name="variantId">
                      <option value="">Produk dasar</option>
                      {variantOptions.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Batas minimum
                    <input name="minimumQuantity" inputMode="decimal" required />
                  </label>
                  <label>
                    Jumlah pemesanan ulang
                    <input name="reorderQuantity" inputMode="decimal" required />
                  </label>
                  <button disabled={submitting || !warehouseId} type="submit">
                    Simpan ambang
                  </button>
                </form>
              ) : null}
            </article>
          ) : null}

          {activeBranch.inventoryAdjust ? (
            <article className="management-card">
              <h3>Penyesuaian stok</h3>
              <form
                onSubmit={(event) =>
                  submit(event, async (form) => {
                    await post("/api/inventory/adjustments", {
                      warehouseId,
                      productId: form.get("productId"),
                      variantId: form.get("variantId") || null,
                      direction: form.get("direction"),
                      quantity: form.get("quantity"),
                      batchNumber: form.get("batchNumber") || undefined,
                      expiresOn: form.get("expiresOn") || null,
                      unitCostCents: form.get("unitCost")
                        ? Math.round(Number(form.get("unitCost")) * 100)
                        : undefined,
                      reason: form.get("reason"),
                      supervisorPin: form.get("supervisorPin") || undefined,
                    });
                  })
                }
              >
                <label>
                  Produk
                  <select name="productId" required>
                    <option value="">Pilih produk</option>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {product.sku}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Varian (opsional)
                  <select name="variantId">
                    <option value="">Produk dasar</option>
                    {variantOptions.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Jenis
                  <select name="direction">
                    <option value="in">Stok masuk</option>
                    <option value="out">Stok keluar</option>
                  </select>
                </label>
                <label>
                  Jumlah
                  <input name="quantity" inputMode="decimal" placeholder="1.000" required />
                </label>
                <label>
                  Nomor batch
                  <input name="batchNumber" maxLength={100} />
                </label>
                <label>
                  Kedaluwarsa
                  <input name="expiresOn" type="date" />
                </label>
                <label>
                  HPP/unit (Rp, wajib untuk stok masuk)
                  <input name="unitCost" inputMode="decimal" min="0" />
                </label>
                <label>
                  Alasan
                  <input name="reason" minLength={5} maxLength={500} required />
                </label>
                <label>
                  PIN supervisor (jika diminta)
                  <input
                    name="supervisorPin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
                <button disabled={submitting || !warehouseId} type="submit">
                  Simpan penyesuaian
                </button>
              </form>
            </article>
          ) : null}

          {activeBranch.inventoryAdjust && stock.length ? (
            <article className="management-card">
              <h3>Opname stok</h3>
              <form
                onSubmit={(event) =>
                  submit(event, async (form) => {
                    const lines = stock.map((row) => ({
                      batchId: row.batchId,
                      countedQuantity: String(form.get(`count-${row.batchId}`) ?? row.quantity),
                    }));
                    const created = await request<{ stocktakeId: string }>(
                      "/api/inventory/stocktakes",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ warehouseId, reason: form.get("reason"), lines }),
                      },
                    );
                    await post(`/api/inventory/stocktakes/${created.stocktakeId}/submit`, {});
                  })
                }
              >
                <label>
                  Alasan opname
                  <input name="reason" minLength={5} maxLength={500} required />
                </label>
                {stock.map((row) => (
                  <label key={row.batchId}>
                    {row.productName} · {row.batchNumber} (sistem {row.quantity})
                    <input
                      name={`count-${row.batchId}`}
                      inputMode="decimal"
                      defaultValue={row.quantity}
                      required
                    />
                  </label>
                ))}
                <button disabled={submitting || !warehouseId} type="submit">
                  Ajukan opname
                </button>
              </form>
              <ul className="management-list">
                {stocktakes.map((stocktake) => (
                  <li key={stocktake.id}>
                    <span>
                      {stocktake.reason} · {stocktake.lineCount} batch · {stocktake.status}
                    </span>
                    {activeBranch.inventoryApprove && stocktake.status === "pending_approval" ? (
                      <button
                        disabled={submitting}
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            await post(`/api/inventory/stocktakes/${stocktake.id}/review`, {
                              decision: "approved",
                            });
                            setMessage("Opname disetujui.");
                            setRefreshVersion((version) => version + 1);
                          } catch (error) {
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "Opname tidak dapat disetujui.",
                            );
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        type="button"
                      >
                        Setujui
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
        </div>
      ) : null}

      {activeBranch.inventoryTransfer ? (
        <div className="management-grid">
          <article className="management-card">
            <h3>Transfer antar-gudang</h3>
            <form
              onSubmit={(event) =>
                submit(event, async (form) => {
                  await post("/api/inventory/transfers", {
                    sourceWarehouseId: form.get("sourceWarehouseId"),
                    destinationWarehouseId: form.get("destinationWarehouseId"),
                    reason: form.get("reason"),
                    lines: [
                      {
                        productId: form.get("productId"),
                        variantId: form.get("variantId") || null,
                        quantity: form.get("quantity"),
                      },
                    ],
                  });
                })
              }
            >
              <label>
                Gudang sumber
                <select name="sourceWarehouseId" required>
                  {activeWarehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Gudang tujuan
                <select name="destinationWarehouseId" required>
                  {availableDestinations
                    .filter((warehouse) => warehouse.id !== activeWarehouses[0]?.id)
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} · {warehouse.code}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Produk
                <select name="productId" required>
                  {activeProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.sku}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Varian (opsional)
                <select name="variantId">
                  <option value="">Produk dasar</option>
                  {variantOptions.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Jumlah
                <input name="quantity" inputMode="decimal" required />
              </label>
              <label>
                Alasan
                <input name="reason" minLength={5} maxLength={500} required />
              </label>
              <button
                disabled={submitting || !activeWarehouses.length || !activeProducts.length}
                type="submit"
              >
                Minta transfer
              </button>
            </form>
            <ul className="management-list">
              {transfers.map((transfer) => (
                <li key={transfer.id}>
                  <div>
                    <strong>
                      {transfer.transferNumber} · {transfer.status}
                    </strong>
                    <span>
                      {warehouseNames.get(transfer.sourceWarehouseId) ?? "Sumber"} →{" "}
                      {warehouseNames.get(transfer.destinationWarehouseId) ?? "Tujuan"}
                    </span>
                    <span>
                      {transfer.lines
                        .map((line) => `${line.productName}: ${line.quantity}`)
                        .join(", ")}
                    </span>
                  </div>
                  {transfer.status === "requested" &&
                  transfer.sourceWarehouseId &&
                  warehouses.some(
                    (warehouse) =>
                      warehouse.id === transfer.sourceWarehouseId &&
                      warehouse.branchId === branchId,
                  ) ? (
                    <form
                      onSubmit={(event) =>
                        submit(event, async (form) => {
                          await post(`/api/inventory/transfers/${transfer.id}/dispatch`, {
                            supervisorPin: form.get("supervisorPin") || undefined,
                          });
                        })
                      }
                    >
                      <label>
                        PIN supervisor (jika diminta)
                        <input
                          name="supervisorPin"
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                        />
                      </label>
                      <button disabled={submitting} type="submit">
                        Kirim
                      </button>
                    </form>
                  ) : null}
                  {transfer.status === "in_transit" &&
                  transfer.destinationWarehouseId &&
                  warehouses.some(
                    (warehouse) =>
                      warehouse.id === transfer.destinationWarehouseId &&
                      warehouse.branchId === branchId,
                  ) ? (
                    <form
                      onSubmit={(event) =>
                        submit(event, async (form) => {
                          await post(`/api/inventory/transfers/${transfer.id}/receive`, {
                            discrepancyReason: form.get("discrepancyReason") || undefined,
                            lines: transfer.batchLines.map((line) => ({
                              transferBatchLineId: line.id,
                              receivedQuantity:
                                form.get(`received-${line.id}`) || line.shippedQuantity,
                            })),
                          });
                        })
                      }
                    >
                      {transfer.batchLines.map((line) => (
                        <label key={line.id}>
                          {line.productName} · dikirim {line.shippedQuantity}
                          <input
                            name={`received-${line.id}`}
                            inputMode="decimal"
                            defaultValue={line.shippedQuantity}
                            required
                          />
                        </label>
                      ))}
                      <label>
                        Alasan selisih (jika ada)
                        <input name="discrepancyReason" minLength={5} maxLength={500} />
                      </label>
                      <button disabled={submitting} type="submit">
                        Terima transfer
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}

      {activeBranch.procurementManage ||
      activeBranch.procurementRead ||
      activeBranch.procurementCostRead ||
      canManageSuppliers ? (
        <div className="management-grid">
          {canManageSuppliers ? (
            <article className="management-card">
              <h3>Tambah supplier</h3>
              <form
                onSubmit={(event) =>
                  submit(event, async (form) => {
                    await post("/api/procurement/suppliers", {
                      name: form.get("name"),
                      contactName: form.get("contactName") || null,
                      phone: form.get("phone") || null,
                      email: form.get("email") || null,
                      address: form.get("address") || null,
                      notes: null,
                      isActive: true,
                    });
                  })
                }
              >
                <label>
                  Nama supplier
                  <input name="name" minLength={2} maxLength={160} required />
                </label>
                <label>
                  Kontak
                  <input name="contactName" maxLength={120} />
                </label>
                <label>
                  Telepon
                  <input name="phone" maxLength={40} />
                </label>
                <label>
                  Email
                  <input name="email" type="email" maxLength={254} />
                </label>
                <label>
                  Alamat
                  <input name="address" maxLength={500} />
                </label>
                <button disabled={submitting} type="submit">
                  Simpan supplier
                </button>
              </form>
            </article>
          ) : null}
          {activeBranch.procurementRead || activeBranch.procurementManage ? (
            <article className="management-card">
              <h3>Permintaan pembelian</h3>
              {activeBranch.procurementManage ? (
                <form
                  onSubmit={(event) =>
                    submit(event, async (form) => {
                      const result = await request<{ request: { id: string } }>(
                        "/api/procurement/requests",
                        {
                          method: "POST",
                          body: JSON.stringify({
                            branchId,
                            notes: form.get("notes") || null,
                            lines: [
                              {
                                productId: form.get("productId"),
                                variantId: form.get("variantId") || null,
                                quantity: form.get("quantity"),
                              },
                            ],
                          }),
                        },
                      );
                      await post(`/api/procurement/requests/${result.request.id}/submit`, {});
                    })
                  }
                >
                  <label>
                    Produk
                    <select name="productId" required>
                      {activeProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · {product.sku}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Varian (opsional)
                    <select name="variantId">
                      <option value="">Produk dasar</option>
                      {variantOptions.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Jumlah
                    <input name="quantity" inputMode="decimal" required />
                  </label>
                  <label>
                    Catatan
                    <input name="notes" maxLength={2000} />
                  </label>
                  <button disabled={submitting || !activeProducts.length} type="submit">
                    Ajukan permintaan
                  </button>
                </form>
              ) : null}
              <ul className="management-list">
                {purchaseRequests.map((purchaseRequest) => (
                  <li key={purchaseRequest.id}>
                    <div>
                      <strong>
                        {purchaseRequest.requestNumber} · {purchaseRequest.status}
                      </strong>
                      {purchaseRequest.lines.map((line) => (
                        <span key={`${line.productId}:${line.sku}`}>
                          {line.productName} · {line.quantity}
                        </span>
                      ))}
                      {purchaseRequest.notes ? <span>{purchaseRequest.notes}</span> : null}
                    </div>
                    {activeBranch.procurementApprove && purchaseRequest.status === "submitted" ? (
                      <button
                        disabled={submitting}
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            await post(`/api/procurement/requests/${purchaseRequest.id}/review`, {
                              decision: "approved",
                            });
                            setMessage("Permintaan pembelian disetujui.");
                            setRefreshVersion((version) => version + 1);
                          } catch (error) {
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "Permintaan tidak dapat disetujui.",
                            );
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        type="button"
                      >
                        Setujui
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
          {activeBranch.procurementManage && activeBranch.inventoryManage ? (
            <article className="management-card">
              <h3>Retur ke supplier</h3>
              <form
                onSubmit={(event) =>
                  submit(event, async (form) => {
                    const batch = stock.find(({ batchId }) => batchId === form.get("batchId"));
                    if (!batch?.supplierId) {
                      throw new Error("Pilih batch yang memiliki asal supplier.");
                    }
                    await post("/api/procurement/returns", {
                      warehouseId,
                      supplierId: batch.supplierId,
                      reason: form.get("reason"),
                      lines: [
                        {
                          batchId: batch.batchId,
                          quantity: form.get("quantity"),
                        },
                      ],
                    });
                  })
                }
              >
                <label>
                  Batch supplier
                  <select name="batchId" required>
                    <option value="">Pilih batch</option>
                    {stock
                      .filter(({ supplierId }) => supplierId !== null)
                      .map((row) => (
                        <option key={row.batchId} value={row.batchId}>
                          {row.productName} · {row.batchNumber} ·{" "}
                          {suppliers.find(({ id }) => id === row.supplierId)?.name ?? "Supplier"}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Jumlah
                  <input name="quantity" inputMode="decimal" required />
                </label>
                <label>
                  Alasan retur
                  <input name="reason" minLength={5} maxLength={500} required />
                </label>
                <button
                  disabled={
                    submitting ||
                    !warehouseId ||
                    !stock.some(({ supplierId }) => supplierId !== null)
                  }
                  type="submit"
                >
                  Proses retur
                </button>
              </form>
            </article>
          ) : null}
          {activeBranch.procurementManage ? (
            <article className="management-card">
              <h3>Pesanan pembelian</h3>
              <form
                onSubmit={(event) =>
                  submit(event, async (form) => {
                    const lines = [
                      {
                        productId: form.get("productId"),
                        variantId: form.get("variantId") || null,
                        quantity: form.get("quantity"),
                        unitCostCents: Math.round(Number(form.get("unitCost")) * 100),
                      },
                    ];
                    await post("/api/procurement/orders", {
                      branchId,
                      warehouseId: form.get("warehouseId"),
                      supplierId: form.get("supplierId"),
                      requestId: form.get("requestId") || null,
                      lines,
                    });
                  })
                }
              >
                <label>
                  Supplier
                  <select name="supplierId" required>
                    {suppliers
                      .filter(({ isActive }) => isActive)
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Gudang
                  <select name="warehouseId" required>
                    {activeWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Permintaan disetujui (opsional)
                  <select name="requestId">
                    <option value="">Tanpa permintaan</option>
                    {purchaseRequests
                      .filter(({ status }) => status === "approved")
                      .map((purchaseRequest) => (
                        <option key={purchaseRequest.id} value={purchaseRequest.id}>
                          {purchaseRequest.requestNumber} ·{" "}
                          {purchaseRequest.lines
                            .map((line) => `${line.productName} ${line.quantity}`)
                            .join(", ")}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Produk
                  <select name="productId" required>
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {product.sku}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Varian (opsional)
                  <select name="variantId">
                    <option value="">Produk dasar</option>
                    {variantOptions.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Jumlah
                  <input name="quantity" inputMode="decimal" required />
                </label>
                <label>
                  HPP/unit (Rp)
                  <input name="unitCost" inputMode="decimal" min="0" required />
                </label>
                <button
                  disabled={
                    submitting ||
                    !suppliers.length ||
                    !activeWarehouses.length ||
                    !activeProducts.length
                  }
                  type="submit"
                >
                  Buat draft pesanan
                </button>
              </form>
              <ul className="management-list">
                {orders.map((order) => (
                  <li key={order.id}>
                    <div>
                      <strong>
                        {order.orderNumber} · {order.status}
                      </strong>
                      <span>
                        {order.supplierName} · {order.warehouseName}
                      </span>
                      {order.lines.map((line) => (
                        <span key={line.id}>
                          {line.productName} · {line.receivedQuantity}/{line.quantity}
                          {line.unitCostCents === undefined
                            ? ""
                            : ` · ${rupiah(line.unitCostCents)}/unit`}
                        </span>
                      ))}
                    </div>
                    {order.status === "draft" && activeBranch.procurementApprove ? (
                      <button
                        disabled={submitting}
                        onClick={async () => {
                          setSubmitting(true);
                          try {
                            await post(`/api/procurement/orders/${order.id}/submit`, {});
                            setMessage("Pesanan pembelian diterbitkan.");
                            setRefreshVersion((version) => version + 1);
                          } catch (error) {
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : "Pesanan tidak dapat diterbitkan.",
                            );
                          } finally {
                            setSubmitting(false);
                          }
                        }}
                        type="button"
                      >
                        Terbitkan
                      </button>
                    ) : null}
                    {(order.status === "ordered" || order.status === "partially_received") &&
                    activeBranch.inventoryManage ? (
                      <form
                        onSubmit={(event) =>
                          submit(event, async (form) => {
                            const line = order.lines.find(
                              ({ id }) => id === form.get("orderLineId"),
                            );
                            if (!line) throw new Error("Baris pesanan tidak ditemukan.");
                            await post(`/api/procurement/orders/${order.id}/receive`, {
                              idempotencyKey: crypto.randomUUID(),
                              lines: [
                                {
                                  orderLineId: line.id,
                                  batchNumber: form.get("batchNumber"),
                                  expiresOn: form.get("expiresOn") || null,
                                  quantity: form.get("receiveQuantity"),
                                },
                              ],
                            });
                          })
                        }
                      >
                        <label>
                          Baris
                          <select name="orderLineId" required>
                            {order.lines.map((line) => (
                              <option key={line.id} value={line.id}>
                                {line.productName} · sisa{" "}
                                {Number(line.quantity) - Number(line.receivedQuantity)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Batch
                          <input name="batchNumber" maxLength={100} required />
                        </label>
                        <label>
                          Kedaluwarsa
                          <input name="expiresOn" type="date" />
                        </label>
                        <label>
                          Jumlah diterima
                          <input name="receiveQuantity" inputMode="decimal" required />
                        </label>
                        <button disabled={submitting} type="submit">
                          Terima barang
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </article>
          ) : null}
          {activeBranch.procurementCostRead ? (
            <article className="management-card">
              <h3>Hutang supplier</h3>
              {payables.length ? (
                <ul className="management-list">
                  {payables.map((item) => (
                    <li key={item.supplierId}>
                      <span>{item.supplierName}</span>
                      <strong>{rupiah(item.balanceCents)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="auth-card__description">Belum ada saldo hutang supplier.</p>
              )}
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
