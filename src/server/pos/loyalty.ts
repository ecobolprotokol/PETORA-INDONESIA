import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { getDatabase } from "@/db";
import {
  customerDeposits,
  customerDepositTransactions,
  loyaltyAccounts,
  loyaltyTransactions,
} from "@/db/schema";

type LoyaltyTransaction = PgTransaction<
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

export class LoyaltyAccountNotFoundError extends Error {}
export class LoyaltyInsufficientPointsError extends Error {}
export class LoyaltyTierNotFoundError extends Error {}
export class LoyaltyInvalidError extends Error {}
export class CustomerDepositNotFoundError extends Error {}
export class CustomerDepositInsufficientBalanceError extends Error {}
export class CustomerDepositInvalidError extends Error {}

function isConstraint(error: unknown, constraint: string) {
  const cause =
    typeof error === "object" && error !== null && "cause" in error ? error.cause : error;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "23505" &&
    "constraint" in cause &&
    cause.constraint === constraint
  );
}

export interface LoyaltyAccount {
  id: string;
  customerId: string;
  branchId: string;
  pointsBalance: number;
  tier: "member" | "silver" | "gold" | "platinum";
  enrolledAt: Date;
  lastActivityAt: Date;
}

export interface LoyaltyTierConfig {
  name: "member" | "silver" | "gold" | "platinum";
  minPoints: number;
  earnRateBps: number;
  redeemRateBps: number;
  minRedeemPoints: number;
  benefits: Record<string, unknown>;
}

export interface CreateLoyaltyAccountInput {
  customerId: string;
  branchId: string;
  tier?: "member" | "silver" | "gold" | "platinum";
}

export async function getOrCreateLoyaltyAccount(
  customerId: string,
  branchId: string,
  actorUserId: string,
): Promise<LoyaltyAccount> {
  let [account] = await getDatabase()
    .select()
    .from(loyaltyAccounts)
    .where(and(eq(loyaltyAccounts.customerId, customerId), eq(loyaltyAccounts.branchId, branchId)))
    .limit(1);

  if (!account) {
    const [newAccount] = await getDatabase()
      .insert(loyaltyAccounts)
      .values({
        customerId,
        branchId,
        tier: "member",
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning();
    if (!newAccount) throw new Error("Akun loyalitas gagal dibuat.");
    account = newAccount;
  }

  return account;
}

export async function getLoyaltyAccount(
  customerId: string,
  branchId: string,
): Promise<LoyaltyAccount | null> {
  const [account] = await getDatabase()
    .select()
    .from(loyaltyAccounts)
    .where(and(eq(loyaltyAccounts.customerId, customerId), eq(loyaltyAccounts.branchId, branchId)))
    .limit(1);
  return account ?? null;
}

export async function getLoyaltyTiers(branchId: string): Promise<LoyaltyTierConfig[]> {
  const tiers = await getDatabase()
    .select()
    .from(loyaltyTiers)
    .where(eq(loyaltyTiers.branchId, branchId))
    .orderBy(loyaltyTiers.minPoints);
  return tiers.map((t) => ({
    name: t.name,
    minPoints: t.minPoints,
    earnRateBps: t.earnRateBps,
    redeemRateBps: t.redeemRateBps,
    minRedeemPoints: t.minRedeemPoints,
    benefits: (t.benefits ?? {}) as Record<string, unknown>,
  }));
}

export async function createLoyaltyTier(
  branchId: string,
  input: Omit<LoyaltyTierConfig, "name"> & { name: "member" | "silver" | "gold" | "platinum" },
  actorUserId: string,
) {
  try {
    const [tier] = await getDatabase()
      .insert(loyaltyTiers)
      .values({
        branchId,
        name: input.name,
        minPoints: input.minPoints,
        earnRateBps: input.earnRateBps,
        redeemRateBps: input.redeemRateBps,
        minRedeemPoints: input.minRedeemPoints,
        benefits: input.benefits,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning();
    if (!tier) throw new Error("Tier loyalitas gagal dibuat.");
    return tier;
  } catch (error) {
    if (isConstraint(error, "loyalty_tiers_branch_name_unique")) {
      throw new LoyaltyInvalidError("Tier loyalitas sudah ada untuk cabang ini.");
    }
    throw error;
  }
}

export async function updateLoyaltyTier(
  branchId: string,
  name: "member" | "silver" | "gold" | "platinum",
  input: Partial<Omit<LoyaltyTierConfig, "name">>,
  actorUserId: string,
) {
  const [tier] = await getDatabase()
    .update(loyaltyTiers)
    .set({ ...input, updatedBy: actorUserId, updatedAt: new Date() })
    .where(and(eq(loyaltyTiers.branchId, branchId), eq(loyaltyTiers.name, name)))
    .returning();
  if (!tier) throw new LoyaltyTierNotFoundError("Tier loyalitas tidak ditemukan.");
  return tier;
}

function calculateEarnedPoints(amountCents: number, earnRateBps: number): number {
  return Math.floor((amountCents * earnRateBps) / 10000);
}

function calculateRedeemValue(points: number, redeemRateBps: number): number {
  return Math.floor((points * 10000) / redeemRateBps);
}

export async function earnLoyaltyPoints(
  tx: LoyaltyTransaction,
  customerId: string,
  branchId: string,
  amountCents: number,
  sourceType: "pos_sale" | "manual" | "promotion" | "voucher" | "system",
  sourceId: string | null,
  reason: string,
  actorUserId: string,
): Promise<{ pointsEarned: number; newBalance: number; newTier: string }> {
  const account = await getOrCreateLoyaltyAccount(customerId, branchId, actorUserId);
  const tiers = await getLoyaltyTiers(branchId);
  const currentTierConfig = tiers.find((t) => t.name === account.tier) ?? tiers[0];
  const pointsEarned = calculateEarnedPoints(amountCents, currentTierConfig.earnRateBps);
  if (pointsEarned === 0)
    return { pointsEarned: 0, newBalance: account.pointsBalance, newTier: account.tier };

  const newBalance = account.pointsBalance + pointsEarned;
  let newTier = account.tier;
  for (const tier of [...tiers].reverse()) {
    if (newBalance >= tier.minPoints) {
      newTier = tier.name;
      break;
    }
  }

  await tx
    .update(loyaltyAccounts)
    .set({
      pointsBalance: newBalance,
      tier: newTier,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(loyaltyAccounts.id, account.id));

  await tx.insert(loyaltyTransactions).values({
    accountId: account.id,
    type: "earn",
    points: pointsEarned,
    balanceAfter: newBalance,
    sourceType,
    sourceId,
    reason,
    actorUserId,
  });

  return { pointsEarned, newBalance, newTier };
}

export async function redeemLoyaltyPoints(
  tx: LoyaltyTransaction,
  customerId: string,
  branchId: string,
  points: number,
  sourceType: "pos_sale" | "manual" | "promotion" | "voucher" | "system",
  sourceId: string | null,
  reason: string,
  actorUserId: string,
): Promise<{ pointsRedeemed: number; redeemValueCents: number; newBalance: number }> {
  const [account] = await tx
    .select()
    .from(loyaltyAccounts)
    .where(and(eq(loyaltyAccounts.customerId, customerId), eq(loyaltyAccounts.branchId, branchId)))
    .for("update")
    .limit(1);
  if (!account) throw new LoyaltyAccountNotFoundError("Akun loyalitas tidak ditemukan.");

  const tiers = await getLoyaltyTiers(branchId);
  const tierConfig = tiers.find((t) => t.name === account.tier) ?? tiers[0];
  if (points < tierConfig.minRedeemPoints) {
    throw new LoyaltyInsufficientPointsError(
      `Minimum penukaran ${tierConfig.minRedeemPoints} poin.`,
    );
  }
  if (account.pointsBalance < points) {
    throw new LoyaltyInsufficientPointsError("Saldo poin tidak mencukupi.");
  }

  const newBalance = account.pointsBalance - points;
  const redeemValueCents = calculateRedeemValue(points, tierConfig.redeemRateBps);

  let newTier = account.tier;
  for (const tier of [...tiers].reverse()) {
    if (newBalance >= tier.minPoints) {
      newTier = tier.name;
      break;
    }
  }

  await tx
    .update(loyaltyAccounts)
    .set({
      pointsBalance: newBalance,
      tier: newTier,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(loyaltyAccounts.id, account.id));

  await tx.insert(loyaltyTransactions).values({
    accountId: account.id,
    type: "redeem",
    points: -points,
    balanceAfter: newBalance,
    sourceType,
    sourceId,
    reason,
    actorUserId,
  });

  return { pointsRedeemed: points, redeemValueCents, newBalance };
}

export async function adjustLoyaltyPoints(
  customerId: string,
  branchId: string,
  points: number,
  reason: string,
  actorUserId: string,
): Promise<{ newBalance: number; newTier: string }> {
  return getDatabase().transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(loyaltyAccounts)
      .where(
        and(eq(loyaltyAccounts.customerId, customerId), eq(loyaltyAccounts.branchId, branchId)),
      )
      .for("update")
      .limit(1);
    if (!account) throw new LoyaltyAccountNotFoundError("Akun loyalitas tidak ditemukan.");

    const newBalance = account.pointsBalance + points;
    if (newBalance < 0) throw new LoyaltyInvalidError("Saldo poin tidak boleh negatif.");

    const tiers = await getLoyaltyTiers(branchId);
    let newTier = account.tier;
    for (const tier of [...tiers].reverse()) {
      if (newBalance >= tier.minPoints) {
        newTier = tier.name;
        break;
      }
    }

    await tx
      .update(loyaltyAccounts)
      .set({
        pointsBalance: newBalance,
        tier: newTier,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccounts.id, account.id));

    await tx.insert(loyaltyTransactions).values({
      accountId: account.id,
      type: points >= 0 ? "adjust" : "adjust",
      points,
      balanceAfter: newBalance,
      sourceType: "manual",
      sourceId: null,
      reason,
      actorUserId,
    });

    return { newBalance, newTier };
  });
}

export async function refundLoyaltyPoints(
  customerId: string,
  branchId: string,
  points: number,
  sourceId: string,
  reason: string,
  actorUserId: string,
): Promise<{ newBalance: number; newTier: string }> {
  return getDatabase().transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(loyaltyAccounts)
      .where(
        and(eq(loyaltyAccounts.customerId, customerId), eq(loyaltyAccounts.branchId, branchId)),
      )
      .for("update")
      .limit(1);
    if (!account) throw new LoyaltyAccountNotFoundError("Akun loyalitas tidak ditemukan.");

    const newBalance = account.pointsBalance + points;
    if (newBalance < 0) throw new LoyaltyInvalidError("Saldo poin tidak boleh negatif.");

    const tiers = await getLoyaltyTiers(branchId);
    let newTier = account.tier;
    for (const tier of [...tiers].reverse()) {
      if (newBalance >= tier.minPoints) {
        newTier = tier.name;
        break;
      }
    }

    await tx
      .update(loyaltyAccounts)
      .set({
        pointsBalance: newBalance,
        tier: newTier,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loyaltyAccounts.id, account.id));

    await tx.insert(loyaltyTransactions).values({
      accountId: account.id,
      type: "refund",
      points,
      balanceAfter: newBalance,
      sourceType: "system",
      sourceId,
      reason,
      actorUserId,
    });

    return { newBalance, newTier };
  });
}

export async function getLoyaltyTransactions(accountId: string, limit = 50, offset = 0) {
  return getDatabase()
    .select()
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.accountId, accountId))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getCustomerDeposit(customerId: string, branchId: string) {
  const [deposit] = await getDatabase()
    .select()
    .from(customerDeposits)
    .where(
      and(eq(customerDeposits.customerId, customerId), eq(customerDeposits.branchId, branchId)),
    )
    .limit(1);
  return deposit ?? null;
}

export async function getOrCreateCustomerDeposit(
  customerId: string,
  branchId: string,
  actorUserId: string,
) {
  let [deposit] = await getDatabase()
    .select()
    .from(customerDeposits)
    .where(
      and(eq(customerDeposits.customerId, customerId), eq(customerDeposits.branchId, branchId)),
    )
    .limit(1);

  if (!deposit) {
    const [newDeposit] = await getDatabase()
      .insert(customerDeposits)
      .values({
        customerId,
        branchId,
        balanceCents: 0,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning();
    if (!newDeposit) throw new Error("Deposit pelanggan gagal dibuat.");
    deposit = newDeposit;
  }
  return deposit;
}

export async function topUpCustomerDeposit(
  tx: LoyaltyTransaction,
  customerId: string,
  branchId: string,
  amountCents: number,
  sourceType: "pos_sale" | "pos_refund" | "manual" | "transfer" | "system",
  sourceId: string | null,
  reference: string | null,
  actorUserId: string,
): Promise<{ newBalanceCents: number }> {
  const [deposit] = await tx
    .select()
    .from(customerDeposits)
    .where(
      and(eq(customerDeposits.customerId, customerId), eq(customerDeposits.branchId, branchId)),
    )
    .for("update")
    .limit(1);
  let depositRecord = deposit;
  if (!depositRecord) {
    const [newDeposit] = await tx
      .insert(customerDeposits)
      .values({
        customerId,
        branchId,
        balanceCents: 0,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning();
    if (!newDeposit) throw new Error("Deposit pelanggan gagal dibuat.");
    depositRecord = newDeposit;
  }

  const newBalanceCents = depositRecord.balanceCents + amountCents;

  await tx
    .update(customerDeposits)
    .set({ balanceCents: newBalanceCents, updatedBy: actorUserId, updatedAt: new Date() })
    .where(eq(customerDeposits.id, depositRecord.id));

  await tx.insert(customerDepositTransactions).values({
    depositId: depositRecord.id,
    type: "topup",
    amountCents,
    balanceAfterCents: newBalanceCents,
    sourceType,
    sourceId,
    reference,
    actorUserId,
  });

  return { newBalanceCents };
}

export async function payFromCustomerDeposit(
  tx: LoyaltyTransaction,
  customerId: string,
  branchId: string,
  amountCents: number,
  sourceType: "pos_sale" | "pos_refund" | "manual" | "transfer" | "system",
  sourceId: string | null,
  reference: string | null,
  actorUserId: string,
): Promise<{ newBalanceCents: number }> {
  const [deposit] = await tx
    .select()
    .from(customerDeposits)
    .where(
      and(eq(customerDeposits.customerId, customerId), eq(customerDeposits.branchId, branchId)),
    )
    .for("update")
    .limit(1);
  if (!deposit) throw new CustomerDepositNotFoundError("Deposit pelanggan tidak ditemukan.");
  if (deposit.balanceCents < amountCents) {
    throw new CustomerDepositInsufficientBalanceError("Saldo deposit tidak mencukupi.");
  }

  const newBalanceCents = deposit.balanceCents - amountCents;

  await tx
    .update(customerDeposits)
    .set({ balanceCents: newBalanceCents, updatedBy: actorUserId, updatedAt: new Date() })
    .where(eq(customerDeposits.id, deposit.id));

  await tx.insert(customerDepositTransactions).values({
    depositId: deposit.id,
    type: "payment",
    amountCents: -amountCents,
    balanceAfterCents: newBalanceCents,
    sourceType,
    sourceId,
    reference,
    actorUserId,
  });

  return { newBalanceCents };
}

export async function refundToCustomerDeposit(
  tx: LoyaltyTransaction,
  customerId: string,
  branchId: string,
  amountCents: number,
  sourceType: "pos_sale" | "pos_refund" | "manual" | "transfer" | "system",
  sourceId: string | null,
  reference: string | null,
  actorUserId: string,
): Promise<{ newBalanceCents: number }> {
  const [deposit] = await tx
    .select()
    .from(customerDeposits)
    .where(
      and(eq(customerDeposits.customerId, customerId), eq(customerDeposits.branchId, branchId)),
    )
    .for("update")
    .limit(1);
  let depositRecord = deposit;
  if (!depositRecord) {
    const [newDeposit] = await tx
      .insert(customerDeposits)
      .values({
        customerId,
        branchId,
        balanceCents: 0,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning();
    if (!newDeposit) throw new Error("Deposit pelanggan gagal dibuat.");
    depositRecord = newDeposit;
  }

  const newBalanceCents = depositRecord.balanceCents + amountCents;

  await tx
    .update(customerDeposits)
    .set({ balanceCents: newBalanceCents, updatedBy: actorUserId, updatedAt: new Date() })
    .where(eq(customerDeposits.id, depositRecord.id));

  await tx.insert(customerDepositTransactions).values({
    depositId: depositRecord.id,
    type: "refund",
    amountCents,
    balanceAfterCents: newBalanceCents,
    sourceType,
    sourceId,
    reference,
    actorUserId,
  });

  return { newBalanceCents };
}

export async function adjustCustomerDeposit(
  customerId: string,
  branchId: string,
  amountCents: number,
  reason: string,
  actorUserId: string,
): Promise<{ newBalanceCents: number }> {
  return getDatabase().transaction(async (tx) => {
    const [deposit] = await tx
      .select()
      .from(customerDeposits)
      .where(
        and(eq(customerDeposits.customerId, customerId), eq(customerDeposits.branchId, branchId)),
      )
      .for("update")
      .limit(1);
    let depositRecord = deposit;
    if (!depositRecord) {
      const [newDeposit] = await tx
        .insert(customerDeposits)
        .values({
          customerId,
          branchId,
          balanceCents: 0,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        })
        .returning();
      if (!newDeposit) throw new Error("Deposit pelanggan gagal dibuat.");
      depositRecord = newDeposit;
    }

    const newBalanceCents = depositRecord.balanceCents + amountCents;
    if (newBalanceCents < 0)
      throw new CustomerDepositInvalidError("Saldo deposit tidak boleh negatif.");

    await tx
      .update(customerDeposits)
      .set({ balanceCents: newBalanceCents, updatedBy: actorUserId, updatedAt: new Date() })
      .where(eq(customerDeposits.id, depositRecord.id));

    await tx.insert(customerDepositTransactions).values({
      depositId: depositRecord.id,
      type: "adjust",
      amountCents,
      balanceAfterCents: newBalanceCents,
      sourceType: "manual",
      sourceId: null,
      reference: reason,
      actorUserId,
    });

    return { newBalanceCents };
  });
}

export async function getCustomerDepositTransactions(depositId: string, limit = 50, offset = 0) {
  return getDatabase()
    .select()
    .from(customerDepositTransactions)
    .where(eq(customerDepositTransactions.depositId, depositId))
    .orderBy(desc(customerDepositTransactions.createdAt))
    .limit(limit)
    .offset(offset);
}
