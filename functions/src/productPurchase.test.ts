import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countPurchasesForProduct,
  getProductDocumentId,
  hasCanonicalProductDocumentId,
  validateProductForPurchase,
} from './productPurchase.js';

const validProduct = {
  ativo: true,
  preco: '75000.00',
  renda_diaria: '2500.00',
  duracao_dias: 90,
  limite_compra: 1,
  nome: 'BOTFOTHER',
};

test('accepts the Firestore product field types and normalizes numeric strings', () => {
  assert.deepEqual(validateProductForPurchase(validProduct), {
    price: 75000,
    dailyIncome: 2500,
    durationDays: 90,
    purchaseLimit: 1,
    name: 'BOTFOTHER',
  });
});

test('rejects inactive or malformed product documents', () => {
  assert.equal(validateProductForPurchase({ ...validProduct, ativo: false }), null);
  assert.equal(validateProductForPurchase({ ...validProduct, preco: 'NaN' }), null);
  assert.equal(validateProductForPurchase({ ...validProduct, limite_compra: 0 }), null);
});

test('counts all purchases for the same product document ID', () => {
  assert.equal(countPurchasesForProduct([
    { produto_id: 'BOTFOTHER' },
    { produto_id: 'BOTFOTHER' },
    { produto_id: 'Skeddy Bot' },
    {},
  ], 'BOTFOTHER'), 2);
});

test('uses a stable name-based document ID without whitespace', () => {
  assert.equal(getProductDocumentId('Skeddy Bot'), 'SkeddyBot');
  assert.equal(getProductDocumentId('BOTFOTHER'), 'BOTFOTHER');
  assert.equal(hasCanonicalProductDocumentId('SkeddyBot', 'Skeddy Bot'), true);
  assert.equal(hasCanonicalProductDocumentId('random-id', 'Skeddy Bot'), false);
});
