const QUANTITY_SCALE = 1000n;

export function parseQuantity(value: string): bigint {
  const match = /^(0|[1-9]\d{0,10})(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) {
    throw new Error("Jumlah harus positif dan memiliki maksimal tiga angka desimal.");
  }
  const fractional = (match[2] ?? "").padEnd(3, "0");
  return BigInt(match[1]) * QUANTITY_SCALE + BigInt(fractional || "0");
}

export function formatQuantity(value: bigint): string {
  const isNegative = value < 0n;
  const absolute = isNegative ? -value : value;
  const whole = absolute / QUANTITY_SCALE;
  const fractional = String(absolute % QUANTITY_SCALE)
    .padStart(3, "0")
    .replace(/0+$/u, "");
  const formatted = fractional ? `${whole}.${fractional}` : String(whole);
  return isNegative ? `-${formatted}` : formatted;
}

export function centsForQuantity(quantityMilli: bigint, unitCostCents: number): number {
  const total = quantityMilli * BigInt(unitCostCents);
  const roundedUp = (total + QUANTITY_SCALE - 1n) / QUANTITY_SCALE;
  if (roundedUp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Nilai stok melebihi batas yang dapat diproses.");
  }
  return Number(roundedUp);
}

export function weightedAverageCost(quantitiesMilli: bigint[], costsCents: number[]): number {
  if (quantitiesMilli.length !== costsCents.length) {
    throw new Error("Jumlah data biaya dan kuantitas tidak sama.");
  }
  const totalQuantity = quantitiesMilli.reduce((total, quantity) => total + quantity, 0n);
  if (totalQuantity <= 0n) {
    return 0;
  }
  const totalValue = quantitiesMilli.reduce(
    (total, quantity, index) => total + quantity * BigInt(costsCents[index] ?? 0),
    0n,
  );
  return Number((totalValue + totalQuantity / 2n) / totalQuantity);
}
