export interface ValidatedProductPurchaseData {
  price: number;
  dailyIncome: number;
  durationDays: number;
  purchaseLimit: number;
  name: string;
}

export function getProductDocumentId(name: string): string {
  return name.trim().replace(/\s+/g, '');
}

export function hasCanonicalProductDocumentId(productId: string, name: string): boolean {
  return productId === getProductDocumentId(name);
}

export function validateProductForPurchase(
  product: Record<string, unknown>,
): ValidatedProductPurchaseData | null {
  const price = Number(product.preco);
  const dailyIncome = Number(product.renda_diaria);
  const durationDays = Number(product.duracao_dias);
  const purchaseLimit = Number(product.limite_compra);
  const name = typeof product.nome === 'string' ? product.nome.trim() : '';

  if (
    product.ativo !== true
    || !name
    || !Number.isFinite(price)
    || price <= 0
    || !Number.isFinite(dailyIncome)
    || dailyIncome < 0
    || !Number.isInteger(durationDays)
    || durationDays <= 0
    || !Number.isInteger(purchaseLimit)
    || purchaseLimit <= 0
  ) {
    return null;
  }
  return { price, dailyIncome, durationDays, purchaseLimit, name };
}

export function countPurchasesForProduct(
  purchases: Array<{ produto_id?: unknown }>,
  productId: string,
): number {
  return purchases.filter((purchase) => purchase.produto_id === productId).length;
}
