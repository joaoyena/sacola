export const COMMISSION_RATES = [0.1, 0.06, 0.02] as const;
export const MINIMUM_COMMISSION_PURCHASE = 3_000;
export const MAXIMUM_COMMISSION_PURCHASE = 2_800_000;

export interface CommissionAward {
  level: number;
  rate: number;
  amount: number;
}

export function calculatePurchaseCommissions(
  purchaseAmount: number,
  isFirstPurchase: boolean,
): CommissionAward[] {
  if (
    !isFirstPurchase ||
    !Number.isFinite(purchaseAmount) ||
    purchaseAmount < MINIMUM_COMMISSION_PURCHASE ||
    purchaseAmount > MAXIMUM_COMMISSION_PURCHASE
  ) {
    return [];
  }

  return COMMISSION_RATES.map((rate, index) => ({
    level: index + 1,
    rate,
    amount: Math.round(purchaseAmount * rate * 100) / 100,
  }));
}
