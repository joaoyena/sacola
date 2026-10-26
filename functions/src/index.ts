import { initializeApp, getApps } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import webpush from 'web-push';
import { calculatePurchaseCommissions } from './commission.js';
import {
  countPurchasesForProduct,
  hasCanonicalProductDocumentId,
  validateProductForPurchase,
} from './productPurchase.js';

const app = getApps()[0] ?? initializeApp();
const db = getFirestore(app);
const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineString('VAPID_PUBLIC_KEY');
const SIGNUP_REFERRAL_REWARD = 100;
const VAPID_SUBJECT = defineString('VAPID_SUBJECT', {
  default: 'mailto:suporte@telegramas.cc',
});

interface PurchaseRequest {
  productId?: unknown;
}

interface Sponsor {
  id: string;
  level: number;
  profile: FirebaseFirestore.DocumentData;
}

export const awardReferralSignupBonus = onDocumentCreated(
  {
    document: 'users/{userId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    const userId = event.params.userId;
    const newProfile = event.data?.data();
    const referralCode = newProfile?.referred_by || newProfile?.codigo_convite_ref;

    if (typeof referralCode !== 'string' || !referralCode.trim()) return;

    const sponsors = await db.collection('users')
      .where('codigo_meu_refferal', '==', referralCode.trim())
      .limit(1)
      .get();
    const sponsorSnapshot = sponsors.docs[0];

    if (!sponsorSnapshot || sponsorSnapshot.id === userId) {
      logger.warn('Affiliate signup reward skipped: no valid inviter found.', { userId });
      return;
    }

    const sponsorRef = sponsorSnapshot.ref;
    const rewardRef = db.collection('extrato_mcpn').doc(`referral_signup_${userId}`);

    await db.runTransaction(async (transaction) => {
      const [currentSponsor, existingReward] = await Promise.all([
        transaction.get(sponsorRef),
        transaction.get(rewardRef),
      ]);

      if (existingReward.exists) return;
      if (!currentSponsor.exists) {
        throw new Error(`Inviter profile missing for referral signup reward: ${sponsorSnapshot.id}`);
      }

      const sponsor = currentSponsor.data()!;
      const balance = typeof sponsor.balance === 'number' ? sponsor.balance : Number.NaN;
      const totalCommissions = Number(sponsor.total_comissao_equipe || 0);
      if (!Number.isFinite(balance) || !Number.isFinite(totalCommissions)) {
        throw new Error(`Inviter financial data is invalid for referral signup reward: ${sponsorSnapshot.id}`);
      }

      const createdAt = new Date().toISOString();
      transaction.update(sponsorRef, {
        balance: balance + SIGNUP_REFERRAL_REWARD,
        total_comissao_equipe: totalCommissions + SIGNUP_REFERRAL_REWARD,
        updated_at: createdAt,
      });
      transaction.create(rewardRef, {
        id: rewardRef.id,
        user_id: sponsorSnapshot.id,
        tipo: 'bonus_convite',
        from_user_id: userId,
        valor: SIGNUP_REFERRAL_REWARD,
        nivel: 1,
        related_document_id: userId,
        detalhes: {
          descricao: 'Bónus por cadastro confirmado através de convite',
          moeda: 'AOA',
        },
        created_at: createdAt,
      });
    });
  },
);

function getBalance(profile: FirebaseFirestore.DocumentData): number {
  return typeof profile.balance === 'number' ? profile.balance : Number.NaN;
}

async function getSponsorChain(
  transaction: FirebaseFirestore.Transaction,
  buyerId: string,
  buyerProfile: FirebaseFirestore.DocumentData,
): Promise<Sponsor[]> {
  const sponsors: Sponsor[] = [];
  const visited = new Set([buyerId]);
  let currentId = buyerId;
  let currentProfile = buyerProfile;

  for (let level = 1; level <= 3; level += 1) {
    let sponsorId = currentProfile.patrocinador_id || currentProfile.referred_by;

    if (typeof sponsorId !== 'string' || !sponsorId) {
      const edges = await transaction.get(
        db.collection('equipe_mcpn').where('usuario_id', '==', currentId).limit(1),
      );
      sponsorId = edges.docs[0]?.data().patrocinador_id;
    }

    if (
      typeof sponsorId !== 'string' ||
      !sponsorId ||
      sponsorId === currentId ||
      visited.has(sponsorId)
    ) {
      break;
    }

    const sponsorSnapshot = await transaction.get(db.collection('users').doc(sponsorId));
    if (!sponsorSnapshot.exists) break;

    visited.add(sponsorId);
    const profile = sponsorSnapshot.data() ?? {};
    sponsors.push({ id: sponsorId, level, profile });
    currentId = sponsorId;
    currentProfile = profile;
  }

  return sponsors;
}

export const buyProduct = onCall<PurchaseRequest>(
  { region: 'us-central1' },
  async (request) => {
    const buyerId = request.auth?.uid;
    const productId = request.data?.productId;

    if (!buyerId || request.auth?.token.firebase?.sign_in_provider === 'anonymous') {
      throw new HttpsError('unauthenticated', 'Inicie sessão para ativar um bot.');
    }
    if (typeof productId !== 'string' || !productId.trim()) {
      throw new HttpsError('invalid-argument', 'O produto selecionado é inválido.');
    }

    const purchaseRef = db.collection('sys_600').doc();
    const purchaseHistoryRef = db.collection('extrato_mcpn').doc();

    try {
      return await db.runTransaction(async (transaction) => {
        const productRef = db.collection('produtos').doc(productId);
        const buyerRef = db.collection('users').doc(buyerId);
        const [productSnapshot, buyerSnapshot, purchasesSnapshot] = await Promise.all([
          transaction.get(productRef),
          transaction.get(buyerRef),
          transaction.get(db.collection('sys_600').where('user_id', '==', buyerId)),
        ]);

        if (!productSnapshot.exists || productSnapshot.data()?.ativo !== true) {
          return {
            success: false,
            message: 'Este bot/produto não está disponível para ativação no momento.',
          };
        }
        if (!buyerSnapshot.exists) {
          throw new HttpsError('failed-precondition', 'O perfil da conta não foi encontrado.');
        }

        const product = productSnapshot.data()!;
        const validatedProduct = validateProductForPurchase(product);
        if (!validatedProduct) {
          throw new HttpsError('failed-precondition', 'Os dados deste produto são inválidos.');
        }
        if (!hasCanonicalProductDocumentId(productId, validatedProduct.name)) {
          throw new HttpsError('failed-precondition', 'O identificador do produto não corresponde ao nome cadastrado.');
        }
        const {
          price,
          dailyIncome: income,
          durationDays: duration,
          purchaseLimit: productLimit,
          name: productName,
        } = validatedProduct;

        const productPurchaseCount = countPurchasesForProduct(
          purchasesSnapshot.docs.map((purchase) => purchase.data()),
          productId,
        );
        if (productPurchaseCount >= productLimit) {
          return {
            success: false,
            message: `Limite máximo de ativações atingido (${productLimit} unidade(s)).`,
          };
        }

        const buyerProfile = buyerSnapshot.data()!;
        const buyerBalance = getBalance(buyerProfile);
        if (!Number.isFinite(buyerBalance) || buyerBalance < 0) {
          throw new HttpsError('failed-precondition', 'O saldo da conta é inválido.');
        }
        if (buyerBalance < price) {
          return { success: false, message: 'Saldo insuficiente para adquirir este produto.' };
        }

        const firstPurchase = purchasesSnapshot.empty;
        const commissionAwards = calculatePurchaseCommissions(price, firstPurchase);
        const sponsors = commissionAwards.length
          ? await getSponsorChain(transaction, buyerId, buyerProfile)
          : [];
        const eligibleSponsors = sponsors.filter((sponsor) =>
          commissionAwards.some((award) => award.level === sponsor.level),
        );

        const now = new Date();
        const startedAt = now.toISOString();
        const endsAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000).toISOString();

        transaction.update(buyerRef, {
          balance: buyerBalance - price,
          last_financial_operation: {
            type: 'purchase',
            document_id: purchaseRef.id,
          },
          updated_at: startedAt,
        });
        transaction.set(purchaseRef, {
          id: purchaseRef.id,
          user_id: buyerId,
          produto_id: productId,
          produto_nome: productName,
          preco_pago: price,
          renda_diaria: income,
          data_inicio: startedAt,
          data_fim: endsAt,
          ativo: true,
          dias_restantes: duration,
          created_at: startedAt,
        });
        transaction.set(purchaseHistoryRef, {
          id: purchaseHistoryRef.id,
          user_id: buyerId,
          tipo: 'compra_produto',
          valor: price,
          related_document_id: purchaseRef.id,
          detalhes: { produto_id: productId, produto_nome: productName },
          created_at: startedAt,
        });

        for (const sponsor of eligibleSponsors) {
          const award = commissionAwards.find((entry) => entry.level === sponsor.level);
          if (!award) continue;

          const sponsorRef = db.collection('users').doc(sponsor.id);
          const commissionRef = db
            .collection('extrato_mcpn')
            .doc(`${purchaseRef.id}_commission_level_${sponsor.level}`);
          const sponsorBalance = getBalance(sponsor.profile);
          const totalCommissions = Number(sponsor.profile.total_comissao_equipe || 0);
          if (!Number.isFinite(sponsorBalance) || !Number.isFinite(totalCommissions)) {
            throw new HttpsError('failed-precondition', 'O saldo do convidador é inválido.');
          }

          transaction.update(sponsorRef, {
            balance: sponsorBalance + award.amount,
            total_comissao_equipe: totalCommissions + award.amount,
            updated_at: startedAt,
          });
          transaction.set(commissionRef, {
            id: commissionRef.id,
            user_id: sponsor.id,
            tipo: 'comissao_equipe',
            from_user_id: buyerId,
            valor: award.amount,
            nivel: sponsor.level,
            related_document_id: purchaseRef.id,
            detalhes: {
              descricao: `Comissão da primeira compra do nível ${sponsor.level}`,
              porcentagem_aplicada: award.rate * 100,
              valor_compra: price,
            },
            created_at: startedAt,
          });
        }

        return {
          success: true,
          message: `Bot ${productName} ativado com sucesso!`,
          commissionsPaid: eligibleSponsors.length,
        };
      });
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('Falha ao processar compra e comissões do bot.', error);
      throw new HttpsError('internal', 'Não foi possível processar a compra do bot.');
    }
  },
);

function notificationBody(message: FirebaseFirestore.DocumentData): string {
  const details = message.detalhes && typeof message.detalhes === 'object'
    ? message.detalhes
    : {};
  const text = typeof message.mensagem === 'string' ? message.mensagem.trim() : '';
  if (text) return text.slice(0, 240);
  if (details.tipo_midia === 'documento' || details.nome_arquivo) return 'Enviou um documento.';
  if (details.tipo_midia === 'imagem' || details.imagem_url) return 'Enviou uma imagem.';
  if (details.tipo_midia === 'audio' || details.audio_path) return 'Enviou uma mensagem de voz.';
  return 'Enviou uma mensagem no grupo.';
}

export const notifyCommunityMessage = onDocumentCreated(
  {
    document: 'chat_gruop/{messageId}',
    region: 'us-central1',
    retry: true,
    secrets: [VAPID_PRIVATE_KEY],
  },
  async (event) => {
    const messageSnapshot = event.data;
    if (!messageSnapshot) return;
    const message = messageSnapshot.data();
    const senderId = typeof message.uid_emissor === 'string' ? message.uid_emissor : '';
    if (!senderId) return;

    const privateKey = VAPID_PRIVATE_KEY.value();
    const publicKey = VAPID_PUBLIC_KEY.value();
    if (!privateKey || !publicKey) {
      throw new Error('As chaves VAPID não estão configuradas nas funções Firebase.');
    }

    webpush.setVapidDetails(VAPID_SUBJECT.value(), publicKey, privateKey);
    const [subscriptions, senderSnapshot] = await Promise.all([
      db.collection('push_subscriptions').get(),
      db.collection('users').doc(senderId).get(),
    ]);
    const senderProfile = senderSnapshot.data() ?? {};
    const senderName = String(
      senderProfile.nome_exibicao || senderProfile.name || senderProfile.nome || 'Membro',
    );
    const body = notificationBody(message);
    const messageId = messageSnapshot.id;

    const deliveries = subscriptions.docs
      .filter((subscription) => subscription.id !== senderId)
      .map(async (subscription) => {
        const subscriptionData = subscription.data();
        if (
          typeof subscriptionData.endpoint !== 'string' ||
          typeof subscriptionData.keys_p256dh !== 'string' ||
          typeof subscriptionData.keys_auth !== 'string'
        ) {
          logger.warn('Inscrição push incompleta; ignorando.', { userId: subscription.id });
          return;
        }

        const notificationRef = db
          .collection('notifications')
          .doc(`${messageId}_${subscription.id}`);
        const shouldSend = await db.runTransaction(async (transaction) => {
          const notificationSnapshot = await transaction.get(notificationRef);
          if (notificationSnapshot.data()?.delivery_status === 'sent') return false;

          transaction.set(notificationRef, {
            user_id: subscription.id,
            type: 'group_message',
            message_id: messageId,
            sender_id: senderId,
            title: senderName,
            body,
            url: '/grupo',
            read: false,
            delivery_status: 'pending',
            updated_at: FieldValue.serverTimestamp(),
            ...(!notificationSnapshot.exists
              ? { created_at: FieldValue.serverTimestamp() }
              : {}),
          }, { merge: true });
          return true;
        });

        if (!shouldSend) return;

        try {
          await webpush.sendNotification(
            {
              endpoint: subscriptionData.endpoint,
              keys: {
                p256dh: subscriptionData.keys_p256dh,
                auth: subscriptionData.keys_auth,
              },
            },
            JSON.stringify({
              title: senderName,
              body,
              icon: '/logo_tegx.jfif',
              badge: '/notification-badge.svg',
              tag: `community-message-${messageId}`,
              renotify: false,
              url: '/grupo',
            }),
          );
          await notificationRef.update({
            delivery_status: 'sent',
            delivered_at: FieldValue.serverTimestamp(),
          });
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if ([401, 403, 404, 410].includes(statusCode ?? 0)) {
            await subscription.ref.delete();
            try {
              await db.collection('users').doc(subscription.id).update({
                webpush_subscription: FieldValue.delete(),
              });
            } catch (profileUpdateError) {
              logger.warn('Não foi possível limpar a inscrição Web Push antiga do perfil.', {
                userId: subscription.id,
                error: profileUpdateError,
              });
            }
            await notificationRef.update({
              delivery_status: 'expired',
              updated_at: FieldValue.serverTimestamp(),
            });
            return;
          }

          await notificationRef.update({
            delivery_status: 'failed',
            updated_at: FieldValue.serverTimestamp(),
          });
          throw error;
        }
      });

    const results = await Promise.allSettled(deliveries);
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length > 0) {
      logger.error('Falha ao enviar notificações push de mensagem do grupo.', {
        messageId,
        failureCount: failures.length,
      });
      throw new Error(`Falha ao enviar ${failures.length} notificação(ões) push.`);
    }
  },
);
