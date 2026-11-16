// Shared Razorpay + PayPal subscription logic for the `payments` and `payments-webhook`
// Edge Functions. All secrets come from Supabase secrets (Deno.env) — never from the app.

export type Gateway = 'razorpay' | 'paypal';
export type PlanId = 'monthly' | 'yearly';
export type SubStatus = 'active' | 'pending' | 'past_due' | 'suspended' | 'cancelled' | 'expired';

export type NormalizedSub = {
  gateway: Gateway;
  subscriptionId: string;
  userId: string | null;
  plan: PlanId | null;
  status: SubStatus;
  periodEnd: Date | null;      // end of the period the user has paid for
  cancelAtPeriodEnd: boolean;
};

type Env = (k: string) => string | undefined;
const defaultEnv: Env = (k) => (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(k);
let env: Env = defaultEnv;
/** For tests only. */
export function _setEnv(e: Env | null) { env = e ?? defaultEnv; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

const GRACE_MS = 24 * 60 * 60 * 1000; // keep Premium 1 day past period end while a renewal is processed

export function planIdFor(gateway: Gateway, plan: PlanId): string | undefined {
  const key = `${gateway === 'razorpay' ? 'RAZORPAY' : 'PAYPAL'}_PLAN_${plan.toUpperCase()}`;
  return env(key) || undefined;
}

function planFromGatewayPlanId(gateway: Gateway, gatewayPlanId: string | undefined | null): PlanId | null {
  if (!gatewayPlanId) return null;
  if (planIdFor(gateway, 'monthly') === gatewayPlanId) return 'monthly';
  if (planIdFor(gateway, 'yearly') === gatewayPlanId) return 'yearly';
  return null;
}

export function gatewayEnabled(g: Gateway): boolean {
  if (g === 'razorpay') return !!(env('RAZORPAY_KEY_ID') && env('RAZORPAY_KEY_SECRET') && (planIdFor(g, 'monthly') || planIdFor(g, 'yearly')));
  return !!(env('PAYPAL_CLIENT_ID') && env('PAYPAL_CLIENT_SECRET') && (planIdFor(g, 'monthly') || planIdFor(g, 'yearly')));
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function readJson(res: Response, what: string) {
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const b = body as { error?: { description?: string }; message?: string; details?: { description?: string }[] } | null;
    const msg = b?.error?.description ?? b?.details?.[0]?.description ?? b?.message ?? `HTTP ${res.status}`;
    throw new HttpError(502, `${what} failed: ${msg}`);
  }
  return body as Record<string, unknown>;
}

// ───────────────────────────── Razorpay ─────────────────────────────

const rzpBase = () => env('RAZORPAY_API_BASE') || 'https://api.razorpay.com/v1'; // override only for tests

function rzpAuth() {
  return 'Basic ' + btoa(`${env('RAZORPAY_KEY_ID')}:${env('RAZORPAY_KEY_SECRET')}`);
}

async function rzp(path: string, init: RequestInit = {}) {
  const res = await fetch(`${rzpBase()}${path}`, {
    ...init,
    headers: { Authorization: rzpAuth(), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  return readJson(res, `Razorpay ${path}`);
}

export type RazorpaySubEntity = {
  id: string; status: string; plan_id?: string; current_end?: number | null; end_at?: number | null;
  charge_at?: number | null; notes?: Record<string, string> | unknown[]; short_url?: string;
};

export function normalizeRazorpay(s: RazorpaySubEntity, cancelAtPeriodEnd = false): NormalizedSub {
  const notes = (Array.isArray(s.notes) ? {} : s.notes ?? {}) as Record<string, string>;
  const statusMap: Record<string, SubStatus> = {
    created: 'pending', authenticated: 'pending', active: 'active', pending: 'past_due',
    halted: 'suspended', paused: 'suspended', cancelled: 'cancelled', completed: 'expired', expired: 'expired',
  };
  const end = s.current_end ?? null;
  return {
    gateway: 'razorpay',
    subscriptionId: s.id,
    userId: isUuid(notes.user_id) ? notes.user_id : null,
    plan: (notes.plan === 'monthly' || notes.plan === 'yearly') ? notes.plan : planFromGatewayPlanId('razorpay', s.plan_id),
    status: statusMap[s.status] ?? 'pending',
    periodEnd: end ? new Date(end * 1000) : null,
    cancelAtPeriodEnd,
  };
}

export async function razorpayCreate(userId: string, plan: PlanId) {
  const planId = planIdFor('razorpay', plan);
  if (!planId) throw new HttpError(400, `Razorpay ${plan} plan is not configured`);
  const s = await rzp('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      total_count: plan === 'monthly' ? 120 : 10, // max renewals; user can cancel any time
      quantity: 1,
      customer_notify: 1,
      notes: { user_id: userId, plan, app: 'moodcircle' },
    }),
  }) as unknown as RazorpaySubEntity;
  if (!s.short_url) throw new HttpError(502, 'Razorpay did not return a payment link');
  return { subscriptionId: s.id, url: s.short_url, sub: normalizeRazorpay(s) };
}

export async function razorpayFetch(id: string) {
  return normalizeRazorpay(await rzp(`/subscriptions/${encodeURIComponent(id)}`) as unknown as RazorpaySubEntity);
}

export async function razorpayCancel(id: string) {
  const s = await rzp(`/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: 'POST', body: JSON.stringify({ cancel_at_cycle_end: 1 }),
  }) as unknown as RazorpaySubEntity;
  return normalizeRazorpay(s, true);
}

export async function razorpayPlanPrice(plan: PlanId) {
  const id = planIdFor('razorpay', plan);
  if (!id) return null;
  const p = await rzp(`/plans/${encodeURIComponent(id)}`) as { item?: { amount?: number; currency?: string } };
  if (!p.item?.amount) return null;
  return { amount: p.item.amount / 100, currency: p.item.currency ?? 'INR' };
}

async function hmacHex(secret: string, data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Razorpay signs the raw request body with your webhook secret (HMAC-SHA256, hex). */
export async function verifyRazorpaySignature(rawBody: string, signature: string | null) {
  const secret = env('RAZORPAY_WEBHOOK_SECRET');
  if (!secret || !signature) return false;
  return safeEqual(await hmacHex(secret, rawBody), signature);
}

// ───────────────────────────── PayPal ─────────────────────────────

export function paypalBase() {
  const override = env('PAYPAL_API_BASE'); // only for tests
  if (override) return override;
  return env('PAYPAL_ENV') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

let tokenCache: { token: string; exp: number } | null = null;
export function _resetPaypalToken() { tokenCache = null; }

async function paypalToken() {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_CLIENT_SECRET')}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const j = await readJson(res, 'PayPal sign-in') as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 300) * 1000 };
  return j.access_token;
}

async function pp(path: string, init: RequestInit = {}) {
  const res = await fetch(`${paypalBase()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await paypalToken()}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 204) return {};
  return readJson(res, `PayPal ${path}`);
}

export type PaypalSub = {
  id: string; status: string; plan_id?: string; custom_id?: string;
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string } };
  links?: { href: string; rel: string }[];
};

export function normalizePaypal(s: PaypalSub, previousEnd: Date | null = null): NormalizedSub {
  const statusMap: Record<string, SubStatus> = {
    APPROVAL_PENDING: 'pending', APPROVED: 'pending', ACTIVE: 'active',
    SUSPENDED: 'suspended', CANCELLED: 'cancelled', EXPIRED: 'expired',
  };
  const plan = planFromGatewayPlanId('paypal', s.plan_id);
  const next = s.billing_info?.next_billing_time ? new Date(s.billing_info.next_billing_time) : null;
  let periodEnd = next;
  if (!periodEnd && s.status === 'CANCELLED') {
    // After cancelling, PayPal drops next_billing_time. Keep what was already paid for.
    const last = s.billing_info?.last_payment?.time ? new Date(s.billing_info.last_payment.time) : null;
    if (last) {
      const end = new Date(last);
      if (plan === 'yearly') end.setUTCFullYear(end.getUTCFullYear() + 1); else end.setUTCMonth(end.getUTCMonth() + 1);
      periodEnd = end;
    } else periodEnd = previousEnd;
  }
  return {
    gateway: 'paypal',
    subscriptionId: s.id,
    userId: isUuid(s.custom_id) ? s.custom_id : null,
    plan,
    status: statusMap[s.status] ?? 'pending',
    periodEnd,
    cancelAtPeriodEnd: s.status === 'CANCELLED',
  };
}

export async function paypalCreate(userId: string, plan: PlanId, returnUrl: string, cancelUrl: string) {
  const planId = planIdFor('paypal', plan);
  if (!planId) throw new HttpError(400, `PayPal ${plan} plan is not configured`);
  const s = await pp('/v1/billing/subscriptions', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': crypto.randomUUID(), Prefer: 'return=representation' },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: userId,
      application_context: {
        brand_name: env('PAYPAL_BRAND_NAME') || 'MoodCircle',
        user_action: 'SUBSCRIBE_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  }) as unknown as PaypalSub;
  const approve = s.links?.find((l) => l.rel === 'approve')?.href;
  if (!approve) throw new HttpError(502, 'PayPal did not return an approval link');
  return { subscriptionId: s.id, url: approve, sub: normalizePaypal(s) };
}

export async function paypalFetch(id: string, previousEnd: Date | null = null) {
  return normalizePaypal(await pp(`/v1/billing/subscriptions/${encodeURIComponent(id)}`) as unknown as PaypalSub, previousEnd);
}

export async function paypalCancel(id: string, previousEnd: Date | null) {
  await pp(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: 'POST', body: JSON.stringify({ reason: 'Cancelled by the user in the MoodCircle app' }),
  });
  return paypalFetch(id, previousEnd);
}

export async function paypalPlanPrice(plan: PlanId) {
  const id = planIdFor('paypal', plan);
  if (!id) return null;
  const p = await pp(`/v1/billing/plans/${encodeURIComponent(id)}`) as {
    billing_cycles?: { tenure_type?: string; pricing_scheme?: { fixed_price?: { value?: string; currency_code?: string } } }[];
  };
  const cycle = p.billing_cycles?.find((c) => c.tenure_type === 'REGULAR') ?? p.billing_cycles?.[0];
  const fp = cycle?.pricing_scheme?.fixed_price;
  if (!fp?.value) return null;
  return { amount: Number(fp.value), currency: fp.currency_code ?? 'USD' };
}

/** Asks PayPal to confirm a webhook really came from PayPal. */
export async function verifyPaypalWebhook(headers: Headers, event: unknown) {
  const webhookId = env('PAYPAL_WEBHOOK_ID');
  if (!webhookId) return false;
  const h = (k: string) => headers.get(k);
  if (!h('paypal-transmission-id') || !h('paypal-transmission-sig')) return false;
  const r = await pp('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: h('paypal-auth-algo'),
      cert_url: h('paypal-cert-url'),
      transmission_id: h('paypal-transmission-id'),
      transmission_sig: h('paypal-transmission-sig'),
      transmission_time: h('paypal-transmission-time'),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  }) as { verification_status?: string };
  return r.verification_status === 'SUCCESS';
}

// ───────────────────────────── Database ─────────────────────────────

// Minimal shape of the Supabase client we use (keeps this file testable).
export type Db = {
  from(table: string): {
    select(cols: string): { eq(c: string, v: unknown): { maybeSingle(): Promise<{ data: unknown; error: unknown }> } };
    upsert(row: Record<string, unknown>, opts?: Record<string, unknown>): Promise<{ error: unknown }>;
    update(row: Record<string, unknown>): { eq(c: string, v: unknown): Promise<{ error: unknown }> };
    insert(row: Record<string, unknown>): Promise<{ error: { code?: string } | null }>;
  };
};

export function premiumFrom(sub: NormalizedSub, now = new Date()) {
  const paidStatus = sub.status === 'active' || sub.status === 'past_due' || sub.status === 'cancelled';
  const until = sub.periodEnd ? new Date(sub.periodEnd.getTime() + GRACE_MS) : null;
  const isPremium = paidStatus && !!until && until > now;
  return { isPremium, premiumUntil: until };
}

/** Writes the subscription + the user's Premium flag. Returns the Premium state. */
export async function applySubscription(db: Db, userId: string, sub: NormalizedSub) {
  const { isPremium, premiumUntil } = premiumFrom(sub);

  // Don't let a stale event for an old/abandoned subscription overwrite a newer one.
  const { data: existing } = await db.from('subscriptions').select('gateway_subscription_id, status, store, cancel_at_period_end').eq('user_id', userId).maybeSingle() as
    { data: { gateway_subscription_id: string | null; status: string; store: string | null; cancel_at_period_end?: boolean } | null };
  // This also protects an active Google Play / App Store (RevenueCat) subscription, whose row
  // has no gateway_subscription_id, from being downgraded by an abandoned web checkout.
  if (existing && existing.status === 'active' && existing.gateway_subscription_id !== sub.subscriptionId && sub.status !== 'active') {
    return { isPremium: null, skipped: true };
  }

  const { error: e1 } = await db.from('subscriptions').upsert({
    user_id: userId,
    product_id: sub.plan ? `plus_${sub.plan}` : null,
    plan: sub.plan,
    store: sub.gateway.toUpperCase(),
    status: sub.status,
    expires_at: sub.periodEnd?.toISOString() ?? null,
    gateway_subscription_id: sub.subscriptionId,
    // Razorpay keeps status 'active' until a scheduled cancellation takes effect, so remember it.
    cancel_at_period_end: sub.cancelAtPeriodEnd ||
      (!!existing?.cancel_at_period_end && existing.gateway_subscription_id === sub.subscriptionId && sub.status === 'active'),
    updated_at: new Date().toISOString(),
  });
  if (e1) throw new HttpError(500, 'Could not save subscription');

  if (sub.status !== 'pending') {
    const { error: e2 } = await db.from('profiles').update({
      is_premium: isPremium,
      premium_until: premiumUntil?.toISOString() ?? null,
    }).eq('id', userId);
    if (e2) throw new HttpError(500, 'Could not update premium status');
  }
  return { isPremium, skipped: false };
}

/** Records a webhook event once. Returns false if we've already processed it. */
export async function recordEvent(db: Db, e: { id: string; gateway: Gateway; type: string; subscriptionId?: string | null; userId?: string | null; payload: unknown }) {
  const { error } = await db.from('payment_events').insert({
    id: `${e.gateway}:${e.id}`,
    gateway: e.gateway,
    event_type: e.type,
    gateway_subscription_id: e.subscriptionId ?? null,
    user_id: e.userId ?? null,
    payload: e.payload as Record<string, unknown>,
  });
  if (error?.code === '23505') return false; // duplicate → already handled
  return true;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}
