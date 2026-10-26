import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasAdminAccess,
  hasSuperAdminAccess,
  isValidFirebaseUid,
  isValidAdminPassword,
  INVESTOR_MINIMUM_PURCHASE,
  isQualifyingInvestorPurchase,
  parseFinancialValue,
  formatCurrency,
  extractReceiptUrl,
  isValidProofUrl,
  maskIban,
  maskPhone,
  validateRechargeTransition,
  normalizeRechargeStatus,
  calculateRechargeApprovalMutation,
  normalizeWithdrawalStatus,
  validateWithdrawalTransition,
  calculateWithdrawalMutation,
  validateProductData,
  UserAccount,
  PaymentBotRecord,
  RetiradaRecord,
} from './adminLogic';

test('Security: Authorization claim verification', () => {
  // Non-admins
  assert.equal(hasAdminAccess(null), false);
  assert.equal(hasAdminAccess(undefined), false);
  assert.equal(hasAdminAccess({ email: 'admin@teggram.com' }), false, 'Never trust email alone');
  assert.equal(hasAdminAccess({ role: 'user' }), false);
  assert.equal(hasAdminAccess({ admin: false }), false);

  // Genuine Admin custom claims
  assert.equal(hasAdminAccess({ admin: true }), true);
  assert.equal(hasAdminAccess({ role: 'admin' }), true);
  assert.equal(hasAdminAccess({ role: 'superadmin' }), true);

  // SuperAdmin check
  assert.equal(hasSuperAdminAccess({ admin: true }), false);
  assert.equal(hasSuperAdminAccess({ role: 'superadmin' }), true);
});

test('Security: Validate administrative user targets and password length', () => {
  assert.equal(isValidFirebaseUid('firebaseUid_123'), true);
  assert.equal(isValidFirebaseUid(''), false);
  assert.equal(isValidFirebaseUid(' user '), false);
  assert.equal(isValidFirebaseUid('uid/nested'), false);
  assert.equal(isValidFirebaseUid('u'.repeat(129)), false);

  assert.equal(isValidAdminPassword('123456'), true);
  assert.equal(isValidAdminPassword('12345'), false);
  assert.equal(isValidAdminPassword('p'.repeat(4096)), true);
  assert.equal(isValidAdminPassword('p'.repeat(4097)), false);
  assert.equal(isValidAdminPassword(undefined), false);
});

test('Investors: Only purchases priced at or above 12,000 KZ qualify', () => {
  assert.equal(INVESTOR_MINIMUM_PURCHASE, 12000);
  assert.equal(isQualifyingInvestorPurchase(12000), true);
  assert.equal(isQualifyingInvestorPurchase('12000'), true);
  assert.equal(isQualifyingInvestorPurchase(150000), true);
  assert.equal(isQualifyingInvestorPurchase(11999.99), false);
  assert.equal(isQualifyingInvestorPurchase('11999.99'), false);
  assert.equal(isQualifyingInvestorPurchase('invalid'), false);
  assert.equal(isQualifyingInvestorPurchase(undefined), false);
});

test('Finance: Decimal string and number parsing', () => {
  assert.equal(parseFinancialValue('10000.00'), 10000);
  assert.equal(parseFinancialValue('1500.50'), 1500.50);
  assert.equal(parseFinancialValue(25000), 25000);
  assert.equal(parseFinancialValue('  5000 KZ '), 5000);
  assert.equal(parseFinancialValue(null), 0);
  assert.equal(parseFinancialValue('invalid'), 0);

  const formatted = formatCurrency('12500.50', 'KZ');
  assert.ok(formatted.includes('12') && formatted.includes('500,50') && formatted.includes('KZ'));
});

test('Privacy & Security: IBAN and Phone masking', () => {
  const maskedIban = maskIban('AO06004000001234567890123');
  assert.equal(maskedIban, 'AO06 •••• •••• •••• 0123');

  const maskedPhone = maskPhone('+244923456789');
  assert.equal(maskedPhone, '+••• ••• 6789');

  assert.equal(maskIban(''), '---');
  assert.equal(maskPhone(''), '---');
});

test('Receipt URL validation & legacy schema handling', () => {
  // Safe modern schema
  const modernRecord: Partial<PaymentBotRecord> = {
    detalhes_transacao: {
      comprovativo_url: 'https://firebasestorage.googleapis.com/v0/b/proofs/123.jpg',
    },
  };
  assert.equal(extractReceiptUrl(modernRecord), 'https://firebasestorage.googleapis.com/v0/b/proofs/123.jpg');

  // Legacy schema
  const legacyRecord: Partial<PaymentBotRecord> = {
    comprovativo_url: 'https://firebasestorage.googleapis.com/v0/b/proofs/legacy.png',
  };
  assert.equal(extractReceiptUrl(legacyRecord), 'https://firebasestorage.googleapis.com/v0/b/proofs/legacy.png');

  // Malicious / invalid URL rejection
  assert.equal(isValidProofUrl('javascript:alert(1)'), false);
  assert.equal(isValidProofUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isValidProofUrl('https://valid.com/image.jpg'), true);
});

test('Recharge workflow: validation & atomic approval calculation', () => {
  const mockRecord: PaymentBotRecord = {
    id: 'rec_001',
    uid: 'user_123',
    valor: '5000.00',
    metodo: 'multicaixa_express',
    status: 'pendente',
    criado_em: '2026-10-25T10:00:00Z',
    detalhes_transacao: {
      comprovativo_url: 'https://storage/proof.jpg',
    },
  };

  const mockUser: UserAccount = {
    uid: 'user_123',
    saldo: 1500,
    total_retirado: 0,
    total_investido: 10000,
    status: 'ativo',
  };

  // 1. Validating pending status
  const valApprove = validateRechargeTransition(mockRecord, 'approve');
  assert.equal(valApprove.valid, true);

  // 2. Reject requires reason
  const valRejectNoReason = validateRechargeTransition(mockRecord, 'reject', '');
  assert.equal(valRejectNoReason.valid, false);

  const valRejectWithReason = validateRechargeTransition(mockRecord, 'reject', 'Comprovativo ilegível');
  assert.equal(valRejectWithReason.valid, true);

  // 3. Cannot process already processed record
  const processedRecord: PaymentBotRecord = { ...mockRecord, status: 'aprovado' };
  const valAlreadyApproved = validateRechargeTransition(processedRecord, 'approve');
  assert.equal(valAlreadyApproved.valid, false);

  // 4. Atomic approval calculation
  const mutation = calculateRechargeApprovalMutation(mockUser, mockRecord, 'admin_super', 'admin@teggram.com');
  assert.equal(mutation.updatedUser.saldo, 6500, 'Saldo should increment from 1500 to 6500');
  assert.equal(mutation.updatedRecord.status, 'concluido');
  assert.equal(mutation.extratoEntry.tipo, 'recarga');
  assert.equal(mutation.extratoEntry.valor, 5000);
  assert.equal(mutation.extratoEntry.saldo_anterior, 1500);
  assert.equal(mutation.extratoEntry.saldo_posterior, 6500);
  assert.equal(mutation.auditLog.acao, 'APROVAR_RECARGA');
});

test('Recharge status normalization supports completed legacy values in the approved filter', () => {
  for (const status of ['aprovado', 'approved', 'concluído', 'completado', 'completed', 'pago']) {
    assert.equal(normalizeRechargeStatus(status), 'concluido');
  }
  assert.equal(normalizeRechargeStatus('pendente'), 'pendente');
  assert.equal(normalizeRechargeStatus('rejeitado'), 'rejeitado');
  assert.equal(normalizeRechargeStatus(undefined), 'estado_indisponivel');
});

test('Withdrawal workflow: financial invariants for payout & reject refund', () => {
  const mockWithdrawal: RetiradaRecord = {
    id: 'ret_888',
    uid: 'user_456',
    valor: 10000,
    valor_bruto: 8000,
    valor_liquido: 8000,
    taxa: 2000,
    status: 'pendente',
    criado_em: '2026-10-25T08:00:00Z',
    dados_bancarios_snapshot: {
      banco: 'Banco BAI',
      iban: 'AO06004000001234567890123',
      titular: 'João Manuel',
    },
  };

  const mockUser: UserAccount = {
    uid: 'user_456',
    saldo: 500, // Balance was already deducted upon withdrawal creation
    total_retirado: 50000,
    total_investido: 100000,
    status: 'ativo',
  };

  assert.equal(validateWithdrawalTransition(mockWithdrawal, 'approve_paid', undefined, 8000).valid, true);
  assert.equal(validateWithdrawalTransition(mockWithdrawal, 'approve_paid', undefined, 8000.01).valid, false);
  assert.equal(validateWithdrawalTransition(mockWithdrawal, 'approve_paid').valid, false);
  assert.equal(normalizeWithdrawalStatus('pago'), 'concluido');
  assert.equal(normalizeWithdrawalStatus('sucesso'), 'concluido');

  // Case 1: Payout approval
  const paidResult = calculateWithdrawalMutation(
    mockUser,
    mockWithdrawal,
    'approve_paid',
    'admin_finance',
    'finance@teggram.com',
  );
  assert.equal(paidResult.updatedUser.saldo, 500, 'Saldo remains deducted');
  assert.equal(paidResult.updatedUser.total_retirado, 60000, 'total_retirado increases by the debited amount');
  assert.equal(paidResult.updatedRecord.status, 'concluido');
  assert.equal(paidResult.auditLog.acao, 'PAGAR_SAQUE');

  const stringAmountsResult = calculateWithdrawalMutation(
    { ...mockUser, saldo: '500.00', total_retirado: '50000.00' },
    mockWithdrawal,
    'approve_paid',
    'admin_finance',
    'finance@teggram.com',
  );
  assert.equal(stringAmountsResult.updatedUser.saldo, '500.00');
  assert.equal(stringAmountsResult.updatedUser.total_retirado, 60000);

  // Case 2: Rejection refund - must restore the debited amount to user balance
  const rejectResult = calculateWithdrawalMutation(
    mockUser,
    mockWithdrawal,
    'reject',
    'admin_finance',
    'finance@teggram.com',
    { reason: 'Dados bancários com titular divergente' }
  );
  assert.equal(rejectResult.updatedUser.saldo, 10500, 'Refund must restore valor (500 + 10000), not valor_bruto');
  assert.equal(rejectResult.updatedRecord.status, 'rejeitado');
  assert.equal(rejectResult.extratoEntry?.tipo, 'reembolso_retirada');
  assert.equal(rejectResult.extratoEntry?.valor, 10000);
});

test('Product / Bot data normalization and decimal validation', () => {
  const result = validateProductData({
    nome: 'Bot Alfa v2',
    preco: '25000.00',
    renda_diaria: '1250.00',
    duracao_dias: 30,
    limite_compra: 2,
    ativo: true,
  });

  assert.equal(result.valid, true);
  assert.equal(result.normalized?.preco, '25000.00');
  assert.equal(result.normalized?.renda_diaria, '1250.00');
  assert.equal(result.normalized?.duracao_dias, 30);
  assert.equal(result.normalized?.limite_compra, 2);

  // Invalid test cases
  const badPrice = validateProductData({
    nome: 'Bad Bot',
    preco: '0',
    renda_diaria: '100',
    duracao_dias: 10,
    limite_compra: 1,
  });
  assert.equal(badPrice.valid, false);

  const badLimit = validateProductData({
    nome: 'Bot limite inválido',
    preco: '1000',
    renda_diaria: '100',
    duracao_dias: 10,
    limite_compra: 1.5,
  });
  assert.equal(badLimit.valid, false);

  const badId = validateProductData({
    id: 'bot/inválido',
    nome: 'Bot ID inválido',
    preco: '1000',
    renda_diaria: '100',
    duracao_dias: 10,
    limite_compra: 1,
  });
  assert.equal(badId.valid, false);
});
