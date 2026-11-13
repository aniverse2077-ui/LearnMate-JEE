import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  AuthenticatedRequest,
  logStructuredEvent,
  requireAuthenticatedStudent,
} from '../middleware/authAndSecurity';
import {
  createRouteRateLimiter,
  getDailyUidQuotaSnapshot,
  setStudentSubscriptionTier,
  SubscriptionTier,
} from '../middleware/rateLimiterAndQuotas';
import {
  adminGetDoc,
  adminListCollection,
  adminSetDoc,
  resetDevPersistenceMemoryForTest,
} from '../persistence/firestoreAdminStore';

export const billingRouter = Router();

export type SubscriptionStatus = 'active' | 'grace_period' | 'cancelled' | 'expired';
export type BillingCurrency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED';

export interface BillingEntitlementRecord {
  uid: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: 'monthly' | 'annual' | 'none';
  currentPeriodEndIso: string | null;
  cancelAtPeriodEnd: boolean;
  providerCustomerId: string | null;
  updatedAtIso: string;
}

export interface BillingInvoiceRecord {
  invoiceId: string;
  uid: string;
  planId: string;
  amount: number;
  amountInr: number;
  currency: BillingCurrency;
  status: 'paid' | 'refunded' | 'open';
  createdAtIso: string;
}

const CURRENCY_RATE_FROM_INR: Record<BillingCurrency, { factor: number; symbol: string }> = {
  INR: { factor: 1, symbol: '₹' },
  USD: { factor: 0.012, symbol: '$' },
  GBP: { factor: 0.0095, symbol: '£' },
  EUR: { factor: 0.011, symbol: '€' },
  AED: { factor: 0.044, symbol: 'AED ' },
};

export function convertInrToCurrency(
  amountInr: number,
  currency: BillingCurrency
): number {
  if (currency === 'INR') return amountInr;
  const factor = CURRENCY_RATE_FROM_INR[currency]?.factor || 0.012;
  return Number((amountInr * factor).toFixed(2));
}

export const COMMERCIAL_PLANS_CATALOG = [
  {
    planId: 'free',
    tier: 'free' as SubscriptionTier,
    name: 'Free Aspirant',
    monthlyPriceInr: 0,
    annualPriceInr: 0,
    aiRequestsPerDay: 25,
    highlights: [
      '25 AI tutor & document scans per day',
      'Official 58-chapter JEE/NEET/BITSAT PYQ explorer',
      'Mistake Book + SM-2 Spaced Repetition',
      'Local IndexedDB storage workspace',
    ],
  },
  {
    planId: 'pro_aspirant',
    tier: 'pro' as SubscriptionTier,
    name: 'Pro Aspirant Pass',
    monthlyPriceInr: 499,
    annualPriceInr: 2999,
    aiRequestsPerDay: 500,
    highlights: [
      '500 AI Tutor, Vision OCR & Socratic requests/day',
      'Unlimited proctored CBT mocks & multi-page PDF packs',
      'Live Classroom Voice Tutor (Hindi, Hinglish & English)',
      'Cloud Storage sync & Priority Ingestion Queue',
    ],
  },
  {
    planId: 'institute_cohort',
    tier: 'institute' as SubscriptionTier,
    name: 'Institute Cohort Seat',
    monthlyPriceInr: 1499,
    annualPriceInr: 11999,
    aiRequestsPerDay: 2500,
    highlights: [
      '2,500 AI requests/day + batch test assignments',
      'Dedicated faculty question provenance audit queue',
      'Multi-device institutional sync & SLA support',
    ],
  },
];

export function isPaymentsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    env.PAYMENT_WEBHOOK_SECRET?.trim() &&
      (env.RAZORPAY_KEY_SECRET?.trim() ||
        env.STRIPE_SECRET_KEY?.trim() ||
        env.PAYMENT_GATEWAY_API_KEY?.trim())
  );
}

/**
 * Supports:
 * 1) Standard HMAC hex (`x-learnmate-signature` / `x-razorpay-signature`)
 * 2) Stripe Webhook Signature (`stripe-signature`: `t=<unix>,v1=<hex>`) signed over `${t}.${rawBody}`
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;
  const trimmed = signatureHeader.trim();

  // Stripe signature header format: t=1700000000,v1=abcdef...
  if (trimmed.includes('t=') && trimmed.includes('v1=')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
    const v1Sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
    if (!timestamp || v1Sigs.length === 0) return false;

    const expectedStripe = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex');

    return v1Sigs.some((sigHex) => {
      try {
        const a = Buffer.from(sigHex, 'hex');
        const b = Buffer.from(expectedStripe, 'hex');
        return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
      } catch {
        return false;
      }
    });
  }

  const normalizedSig = trimmed.replace(/^sha256=/i, '').trim();
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  try {
    const a = Buffer.from(normalizedSig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function getOrInitEntitlement(uid: string): Promise<BillingEntitlementRecord> {
  const existing = await adminGetDoc<BillingEntitlementRecord>('billing_entitlements', uid);
  if (existing) {
    setStudentSubscriptionTier(uid, existing.tier);
    return existing;
  }
  const fresh: BillingEntitlementRecord = {
    uid,
    tier: 'free',
    status: 'active',
    billingCycle: 'none',
    currentPeriodEndIso: null,
    cancelAtPeriodEnd: false,
    providerCustomerId: null,
    updatedAtIso: new Date().toISOString(),
  };
  await adminSetDoc('billing_entitlements', uid, fresh, true);
  await adminSetDoc(
    `users/${uid}/entitlements`,
    'current',
    {
      userId: uid,
      tier: fresh.tier,
      status: fresh.status,
      updatedAtIso: fresh.updatedAtIso,
    },
    true
  );
  return fresh;
}

export async function processVerifiedWebhookEvent(event: {
  eventId: string;
  eventType:
    | 'subscription.activated'
    | 'subscription.renewed'
    | 'payment.failed'
    | 'subscription.cancelled'
    | 'subscription.expired'
    | 'charge.refunded';
  uid: string;
  tier?: SubscriptionTier;
  billingCycle?: 'monthly' | 'annual';
  amountInr?: number;
  currency?: BillingCurrency;
}): Promise<{ duplicate: boolean; entitlement: BillingEntitlementRecord }> {
  const seen = await adminGetDoc<{ eventId: string }>('webhook_events', event.eventId);
  if (seen) {
    return {
      duplicate: true,
      entitlement: await getOrInitEntitlement(event.uid),
    };
  }

  const current = await getOrInitEntitlement(event.uid);
  const now = new Date();
  const nextCycle =
    event.billingCycle || (current.billingCycle === 'none' ? 'monthly' : current.billingCycle);
  const targetTier: SubscriptionTier =
    event.tier || (current.tier === 'free' ? 'pro' : current.tier);
  const currency: BillingCurrency = event.currency || 'INR';

  if (event.eventType === 'subscription.activated' || event.eventType === 'subscription.renewed') {
    const end = new Date(now.getTime() + (nextCycle === 'annual' ? 365 : 30) * 86400 * 1000);
    current.tier = targetTier;
    current.status = 'active';
    current.billingCycle = nextCycle;
    current.cancelAtPeriodEnd = false;
    current.currentPeriodEndIso = end.toISOString();
    setStudentSubscriptionTier(event.uid, targetTier);

    const amountInr = event.amountInr ?? (nextCycle === 'annual' ? 2999 : 499);
    const invoiceId = `inv-${event.eventId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}`;
    const invoiceRecord: BillingInvoiceRecord = {
      invoiceId,
      uid: event.uid,
      planId: targetTier,
      amount: convertInrToCurrency(amountInr, currency),
      amountInr,
      currency,
      status: 'paid',
      createdAtIso: now.toISOString(),
    };
    await adminSetDoc(`billing_invoices/${event.uid}/items`, invoiceId, invoiceRecord, true);
  } else if (event.eventType === 'payment.failed') {
    current.status = 'grace_period';
  } else if (event.eventType === 'subscription.cancelled') {
    current.status = 'cancelled';
    current.cancelAtPeriodEnd = true;
  } else if (event.eventType === 'subscription.expired' || event.eventType === 'charge.refunded') {
    current.tier = 'free';
    current.status = event.eventType === 'charge.refunded' ? 'cancelled' : 'expired';
    current.billingCycle = 'none';
    setStudentSubscriptionTier(event.uid, 'free');
    if (event.eventType === 'charge.refunded') {
      const existingInvoices = await adminListCollection<BillingInvoiceRecord>(
        `billing_invoices/${event.uid}/items`,
        10
      );
      if (existingInvoices[0]) {
        await adminSetDoc(
          `billing_invoices/${event.uid}/items`,
          existingInvoices[0].invoiceId,
          { status: 'refunded' },
          true
        );
      }
    }
  }

  current.updatedAtIso = now.toISOString();
  await adminSetDoc('billing_entitlements', event.uid, current, true);
  await adminSetDoc(
    `users/${event.uid}/entitlements`,
    'current',
    {
      userId: event.uid,
      tier: current.tier,
      status: current.status,
      updatedAtIso: current.updatedAtIso,
    },
    true
  );
  await adminSetDoc(
    'webhook_events',
    event.eventId,
    {
      eventId: event.eventId,
      eventType: event.eventType,
      uid: event.uid,
      processedAtIso: now.toISOString(),
    },
    true
  );

  return { duplicate: false, entitlement: current };
}

export function resetBillingStoresForTest(): void {
  resetDevPersistenceMemoryForTest();
}

const checkoutRateLimit = createRouteRateLimiter({
  maxPerMinute: 12,
  keyPrefix: 'checkout',
  errorCode: 'CHECKOUT_RATE_LIMIT',
});

// Public Plans Catalog with multi-currency conversion
billingRouter.get('/plans', (req: Request, res: Response) => {
  const reqCurr = String(req.query?.currency || 'INR').toUpperCase() as BillingCurrency;
  const currency: BillingCurrency = reqCurr in CURRENCY_RATE_FROM_INR ? reqCurr : 'INR';

  res.json({
    paymentsConfigured: isPaymentsConfigured(),
    currency,
    supportedCurrencies: Object.keys(CURRENCY_RATE_FROM_INR),
    plans: COMMERCIAL_PLANS_CATALOG.map((p) => ({
      ...p,
      currency,
      monthlyPriceConverted: convertInrToCurrency(p.monthlyPriceInr, currency),
      annualPriceConverted: convertInrToCurrency(p.annualPriceInr, currency),
    })),
  });
});

// Authenticated Server-Authoritative Entitlements Snapshot
billingRouter.get(
  '/entitlements',
  requireAuthenticatedStudent,
  async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid!;
    try {
      const ent = await getOrInitEntitlement(uid);
      const quota = await getDailyUidQuotaSnapshot(uid);
      res.json({
        uid,
        tier: ent.tier,
        status: ent.status,
        billingCycle: ent.billingCycle,
        currentPeriodEndIso: ent.currentPeriodEndIso,
        cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
        paymentsConfigured: isPaymentsConfigured(),
        quota,
        features: {
          unlimitedCbtMocks: ent.tier === 'pro' || ent.tier === 'institute',
          twelveHourYoutubeMarathons: true,
          voiceClassroomTutor: true,
          interactive2DVectorDiagramMaker: true,
          cloudStorageCrossDeviceSync: ent.tier !== 'free',
        },
      });
    } catch (err: any) {
      res.status(err?.statusCode || 503).json({
        errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
        message: err?.message || 'Unable to load persistent subscription entitlements.',
        requestId: req.requestId,
      });
    }
  }
);

// Explicit Block on Legacy Insecure Self-Upgrade Endpoint
billingRouter.post(
  '/upgrade',
  requireAuthenticatedStudent,
  (req: AuthenticatedRequest, res: Response) => {
    logStructuredEvent('warn', 'blocked_client_self_upgrade_attempt', {
      requestId: req.requestId,
      uid: req.userUid ? `${req.userUid.slice(0, 6)}...` : 'anonymous',
    });
    res.status(403).json({
      errorCode: 'CLIENT_SELF_UPGRADE_DISABLED',
      message:
        'Direct client subscription upgrades are disabled for security. Subscriptions are activated only through verified payment gateway webhooks.',
      requestId: req.requestId,
    });
  }
);

// Live Stripe / Razorpay Checkout Session Creator (returns 503 PAYMENTS_NOT_CONFIGURED when secrets absent)
billingRouter.post(
  '/checkout',
  requireAuthenticatedStudent,
  checkoutRateLimit,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!isPaymentsConfigured()) {
      res.status(503).json({
        errorCode: 'PAYMENTS_NOT_CONFIGURED',
        paymentsConfigured: false,
        message:
          'Online payment gateway is not configured in this environment. Set PAYMENT_WEBHOOK_SECRET and STRIPE_SECRET_KEY or RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET to enable checkout.',
        requestId: req.requestId,
      });
      return;
    }

    const uid = req.userUid!;
    const planId = String(req.body?.planId || 'pro_aspirant');
    const billingCycle = req.body?.billingCycle === 'annual' ? 'annual' : 'monthly';
    const rawCurrency = String(req.body?.currency || 'INR').toUpperCase() as BillingCurrency;
    const currency: BillingCurrency = rawCurrency in CURRENCY_RATE_FROM_INR ? rawCurrency : 'INR';

    const plan = COMMERCIAL_PLANS_CATALOG.find((p) => p.planId === planId);
    if (!plan || plan.tier === 'free') {
      res.status(400).json({
        errorCode: 'INVALID_PLAN',
        message: 'Select a valid paid plan (pro_aspirant or institute_cohort).',
        requestId: req.requestId,
      });
      return;
    }

    const amountInr = billingCycle === 'annual' ? plan.annualPriceInr : plan.monthlyPriceInr;
    const amountConverted = convertInrToCurrency(amountInr, currency);
    const minorUnits = Math.round(amountConverted * 100);

    // Provider 1: Stripe Checkout Sessions REST API
    const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
    if (stripeSecret) {
      try {
        const origin =
          req.headers.origin || process.env.APP_PUBLIC_URL || 'http://localhost:3000';
        const form = new URLSearchParams();
        form.set('mode', 'payment');
        form.set('success_url', `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
        form.set('cancel_url', `${origin}/?checkout=cancelled`);
        form.set('client_reference_id', uid);
        form.set('metadata[uid]', uid);
        form.set('metadata[planId]', planId);
        form.set('metadata[tier]', plan.tier);
        form.set('metadata[billingCycle]', billingCycle);
        form.set('line_items[0][price_data][currency]', currency.toLowerCase());
        form.set('line_items[0][price_data][unit_amount]', String(minorUnits));
        form.set('line_items[0][price_data][product_data][name]', `LearnMate JEE ${plan.name} (${billingCycle})`);
        form.set('line_items[0][quantity]', '1');

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        });
        const stripeJson = (await stripeRes.json()) as any;
        if (!stripeRes.ok) {
          res.status(502).json({
            errorCode: 'STRIPE_CHECKOUT_FAILED',
            message: stripeJson?.error?.message || 'Unable to create Stripe checkout session.',
            requestId: req.requestId,
          });
          return;
        }
        res.json({
          status: 'CHECKOUT_SESSION_CREATED',
          provider: 'stripe',
          sessionId: stripeJson.id,
          checkoutUrl: stripeJson.url,
          uid,
          planId,
          billingCycle,
          amountInr,
          amount: amountConverted,
          currency,
          createdAtIso: new Date().toISOString(),
        });
        return;
      } catch (err: any) {
        res.status(502).json({
          errorCode: 'STRIPE_CHECKOUT_ERROR',
          message: err?.message || 'Stripe checkout communication failed.',
          requestId: req.requestId,
        });
        return;
      }
    }

    // Provider 2: Razorpay Orders REST API
    const rzpKeyId = process.env.RAZORPAY_KEY_ID?.trim();
    const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (rzpKeyId && rzpKeySecret) {
      try {
        const authBasic = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');
        const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authBasic}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: minorUnits,
            currency,
            receipt: `lm_${uid.slice(0, 12)}_${Date.now()}`,
            notes: {
              uid,
              planId,
              tier: plan.tier,
              billingCycle,
            },
          }),
        });
        const orderJson = (await orderRes.json()) as any;
        if (!orderRes.ok) {
          res.status(502).json({
            errorCode: 'RAZORPAY_ORDER_FAILED',
            message: orderJson?.error?.description || 'Unable to create Razorpay order.',
            requestId: req.requestId,
          });
          return;
        }
        res.json({
          status: 'CHECKOUT_SESSION_CREATED',
          provider: 'razorpay',
          sessionId: orderJson.id,
          razorpayKeyId: rzpKeyId,
          uid,
          planId,
          billingCycle,
          amountInr,
          amount: amountConverted,
          currency,
          createdAtIso: new Date().toISOString(),
        });
        return;
      } catch (err: any) {
        res.status(502).json({
          errorCode: 'RAZORPAY_ORDER_ERROR',
          message: err?.message || 'Razorpay order communication failed.',
          requestId: req.requestId,
        });
        return;
      }
    }

    // Fallback session descriptor if generic PAYMENT_GATEWAY_API_KEY configured
    const sessionId = `chk-${crypto.randomUUID().slice(0, 12)}`;
    res.json({
      status: 'CHECKOUT_SESSION_CREATED',
      provider: 'configured_gateway',
      sessionId,
      uid,
      planId,
      billingCycle,
      amountInr,
      amount: amountConverted,
      currency,
      createdAtIso: new Date().toISOString(),
    });
  }
);

// HMAC-SHA256 / Stripe Signed Payment Webhook Receiver (idempotent, persistent, fail-closed)
billingRouter.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || '';
  if (!secret) {
    res.status(503).json({
      errorCode: 'PAYMENTS_NOT_CONFIGURED',
      message: 'Webhook secret is not configured on the server.',
    });
    return;
  }

  const rawBody =
    typeof (req as any).rawBody === 'string'
      ? (req as any).rawBody
      : JSON.stringify(req.body || {});
  const sigHeader =
    (req.headers['x-learnmate-signature'] as string | undefined) ||
    (req.headers['x-razorpay-signature'] as string | undefined) ||
    (req.headers['stripe-signature'] as string | undefined);

  if (!verifyWebhookSignature(rawBody, sigHeader, secret)) {
    res.status(401).json({
      errorCode: 'INVALID_WEBHOOK_SIGNATURE',
      message: 'HMAC/Stripe webhook signature verification failed.',
    });
    return;
  }

  // Normalize either custom LearnMate webhook payload or Stripe Event payload
  let eventId = req.body?.eventId;
  let eventType = req.body?.eventType;
  let uid = req.body?.uid;
  let tier = req.body?.tier as SubscriptionTier | undefined;
  let billingCycle = req.body?.billingCycle as 'monthly' | 'annual' | undefined;
  let amountInr = req.body?.amountInr as number | undefined;

  if (!eventId && req.body?.id && typeof req.body?.type === 'string' && req.body?.data?.object) {
    eventId = req.body.id;
    const obj = req.body.data.object;
    uid = obj.metadata?.uid || obj.client_reference_id;
    tier = (obj.metadata?.tier as SubscriptionTier) || 'pro';
    billingCycle = obj.metadata?.billingCycle === 'annual' ? 'annual' : 'monthly';
    if (req.body.type === 'checkout.session.completed' || req.body.type === 'invoice.paid') {
      eventType = 'subscription.activated';
    } else if (req.body.type === 'charge.refunded') {
      eventType = 'charge.refunded';
    } else if (req.body.type === 'invoice.payment_failed') {
      eventType = 'payment.failed';
    } else if (req.body.type === 'customer.subscription.deleted') {
      eventType = 'subscription.cancelled';
    }
  }

  if (!eventId || !eventType || !uid) {
    res.status(400).json({
      errorCode: 'MALFORMED_WEBHOOK_EVENT',
      message: 'eventId, eventType, and uid are required.',
    });
    return;
  }

  try {
    const result = await processVerifiedWebhookEvent({
      eventId: String(eventId),
      eventType,
      uid: String(uid),
      tier,
      billingCycle,
      amountInr: typeof amountInr === 'number' ? amountInr : undefined,
    });

    res.json({
      received: true,
      duplicate: result.duplicate,
      entitlement: result.entitlement,
    });
  } catch (err: any) {
    res.status(err?.statusCode || 503).json({
      errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
      message: err?.message || 'Unable to persist verified billing webhook event.',
    });
  }
});

// Billing Invoices & History
billingRouter.get(
  '/invoices',
  requireAuthenticatedStudent,
  async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.userUid!;
    try {
      const invoices = await adminListCollection<BillingInvoiceRecord>(
        `billing_invoices/${uid}/items`,
        50
      );
      res.json({
        uid,
        invoices: invoices.sort((a, b) =>
          String(b.createdAtIso).localeCompare(String(a.createdAtIso))
        ),
      });
    } catch (err: any) {
      res.status(err?.statusCode || 503).json({
        errorCode: err?.errorCode || 'PERSISTENCE_UNAVAILABLE',
        message: err?.message || 'Unable to load persistent invoices.',
        requestId: req.requestId,
      });
    }
  }
);
