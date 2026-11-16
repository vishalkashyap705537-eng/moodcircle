// Supabase Edge Function: Razorpay + PayPal subscriptions for signed-in app users.
// Deploy:  npx supabase functions deploy payments
// (JWT verification stays ON — the app calls it with the user's session.)
//
// Actions (POST JSON):
//   { action: 'config' }                                  → enabled gateways + live plan prices
//   { action: 'create', gateway, plan }                   → { url, subscription_id }  (open url in browser)
//   { action: 'verify', gateway?, subscription_id? }      → { status, is_premium }     (sync after returning)
//   { action: 'cancel' }                                  → cancels at the end of the paid period
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  applySubscription, gatewayEnabled, HttpError, json, paypalCancel, paypalCreate, paypalFetch, paypalPlanPrice,
  razorpayCancel, razorpayCreate, razorpayFetch, razorpayPlanPrice,
  type Db, type Gateway, type NormalizedSub, type PlanId,
} from '../_shared/payments.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const db = supabase as unknown as Db;

const GATEWAYS: Gateway[] = ['razorpay', 'paypal'];
const PLANS: PlanId[] = ['monthly', 'yearly'];

function functionsUrl() {
  return `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
}

async function currentUser(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Please sign in again');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Please sign in again');
  return data.user;
}

async function config() {
  const gateways = await Promise.all(GATEWAYS.filter(gatewayEnabled).map(async (g) => {
    const plans = await Promise.all(PLANS.map(async (p) => {
      try {
        const price = g === 'razorpay' ? await razorpayPlanPrice(p) : await paypalPlanPrice(p);
        return price ? { id: p, ...price } : null;
      } catch (e) {
        console.error(`price lookup failed for ${g}/${p}:`, (e as Error).message);
        return null;
      }
    }));
    return { id: g, plans: plans.filter(Boolean) };
  }));
  return { gateways: gateways.filter((g) => g.plans.length > 0) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const user = await currentUser(req);
    const body = await req.json().catch(() => ({})) as { action?: string; gateway?: Gateway; plan?: PlanId; subscription_id?: string };

    if (body.action === 'config') return json(await config());

    if (body.action === 'create') {
      const gateway = body.gateway;
      const plan = body.plan;
      if (!gateway || !GATEWAYS.includes(gateway) || !gatewayEnabled(gateway)) throw new HttpError(400, 'This payment method is not available');
      if (!plan || !PLANS.includes(plan)) throw new HttpError(400, 'Choose a plan');

      const { data: profile } = await supabase.from('profiles').select('is_premium, premium_until, status').eq('id', user.id).maybeSingle();
      if (!profile) throw new HttpError(404, 'Profile not found');
      if (profile.status === 'banned') throw new HttpError(403, 'Account not allowed');
      const stillPremium = profile.is_premium && (!profile.premium_until || new Date(profile.premium_until) > new Date());
      if (stillPremium) throw new HttpError(409, 'You already have MoodCircle Plus');

      const returnBase = `${functionsUrl()}/payments-webhook?return=${gateway}`;
      const created = gateway === 'razorpay'
        ? await razorpayCreate(user.id, plan)
        : await paypalCreate(user.id, plan, `${returnBase}&result=success`, `${returnBase}&result=cancel`);

      await applySubscription(db, user.id, { ...created.sub, userId: user.id, plan });
      return json({ url: created.url, subscription_id: created.subscriptionId, gateway });
    }

    if (body.action === 'verify' || body.action === 'cancel') {
      const { data: row } = await supabase.from('subscriptions')
        .select('store, status, expires_at, gateway_subscription_id').eq('user_id', user.id).maybeSingle();
      const gateway = (body.gateway ?? (row?.store === 'RAZORPAY' ? 'razorpay' : row?.store === 'PAYPAL' ? 'paypal' : null)) as Gateway | null;
      const subId = body.subscription_id ?? row?.gateway_subscription_id ?? null;
      if (!gateway || !subId) return json({ status: row?.status ?? 'none', is_premium: null });
      const previousEnd = row?.expires_at ? new Date(row.expires_at) : null;

      let sub: NormalizedSub;
      if (body.action === 'cancel') {
        if (subId !== row?.gateway_subscription_id) throw new HttpError(403, 'Not your subscription');
        sub = gateway === 'razorpay' ? await razorpayCancel(subId) : await paypalCancel(subId, previousEnd);
      } else {
        sub = gateway === 'razorpay' ? await razorpayFetch(subId) : await paypalFetch(subId, previousEnd);
      }
      // Only ever touch subscriptions that were created for this user.
      if (sub.userId && sub.userId !== user.id) throw new HttpError(403, 'Not your subscription');
      if (!sub.userId && subId !== row?.gateway_subscription_id) throw new HttpError(403, 'Not your subscription');

      const result = await applySubscription(db, user.id, { ...sub, userId: user.id });
      return json({
        status: sub.status,
        is_premium: result.isPremium,
        expires_at: sub.periodEnd?.toISOString() ?? null,
        cancel_at_period_end: sub.cancelAtPeriodEnd,
      });
    }

    throw new HttpError(400, 'Unknown action');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status >= 500) console.error(e);
    return json({ error: e instanceof HttpError ? e.message : 'Something went wrong' }, status);
  }
});
