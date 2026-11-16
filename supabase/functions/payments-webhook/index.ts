// Supabase Edge Function: receives Razorpay + PayPal webhooks and keeps Premium in sync.
// Deploy:  npx supabase functions deploy payments-webhook --no-verify-jwt
//
// Webhook URLs to paste in the dashboards:
//   Razorpay → https://<project-ref>.supabase.co/functions/v1/payments-webhook?gateway=razorpay
//   PayPal   → https://<project-ref>.supabase.co/functions/v1/payments-webhook?gateway=paypal
//
// It also serves `?return=paypal` — the page PayPal sends the buyer back to — which simply
// redirects into the app (moodcircle://payment-return).
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  applySubscription, isUuid, json, normalizeRazorpay, paypalFetch, recordEvent, verifyPaypalWebhook,
  verifyRazorpaySignature, type Db, type NormalizedSub, type RazorpaySubEntity,
} from '../_shared/payments.ts';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const db = supabase as unknown as Db;

const APP_RETURN_URL = Deno.env.get('APP_RETURN_URL') || 'moodcircle://payment-return';

async function userFor(sub: NormalizedSub): Promise<string | null> {
  if (sub.userId) return sub.userId;
  // Fall back to the row we created when the checkout started
  const { data } = await supabase.from('subscriptions').select('user_id').eq('gateway_subscription_id', sub.subscriptionId).maybeSingle();
  return data?.user_id && isUuid(data.user_id) ? data.user_id : null;
}

async function previousEnd(subId: string) {
  const { data } = await supabase.from('subscriptions').select('expires_at').eq('gateway_subscription_id', subId).maybeSingle();
  return data?.expires_at ? new Date(data.expires_at) : null;
}

async function handleRazorpay(req: Request) {
  const raw = await req.text();
  if (!(await verifyRazorpaySignature(raw, req.headers.get('x-razorpay-signature')))) {
    return new Response('Invalid signature', { status: 401 });
  }
  const event = JSON.parse(raw) as { event?: string; payload?: { subscription?: { entity?: RazorpaySubEntity } } };
  const entity = event.payload?.subscription?.entity;
  if (!event.event?.startsWith('subscription.') || !entity?.id) return new Response('ignored');

  const sub = normalizeRazorpay(entity);
  const userId = await userFor(sub);
  const eventId = req.headers.get('x-razorpay-event-id') ?? `${entity.id}:${event.event}:${entity.current_end ?? ''}:${entity.status}`;
  // Applying is idempotent, so a retried/duplicate webhook is harmless. We record the event
  // only after it has been applied, so a failed attempt is retried by Razorpay.
  if (userId) await applySubscription(db, userId, { ...sub, userId });
  await recordEvent(db, { id: eventId, gateway: 'razorpay', type: event.event, subscriptionId: sub.subscriptionId, userId, payload: event });
  return new Response(userId ? 'ok' : 'no user for subscription');
}

async function handlePaypal(req: Request) {
  const raw = await req.text();
  let event: { id?: string; event_type?: string; resource?: { id?: string; billing_agreement_id?: string } };
  try { event = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }

  if (!(await verifyPaypalWebhook(req.headers, event))) return new Response('Invalid signature', { status: 401 });

  const type = event.event_type ?? '';
  // Subscription lifecycle events carry the subscription; renewal payments carry billing_agreement_id.
  const subId = type.startsWith('BILLING.SUBSCRIPTION.') ? event.resource?.id
    : type.startsWith('PAYMENT.SALE.') ? event.resource?.billing_agreement_id
    : undefined;
  if (!subId || !event.id) return new Response('ignored');

  // Always re-read the subscription from PayPal so we store its true, current state.
  const sub = await paypalFetch(subId, await previousEnd(subId));
  const userId = await userFor(sub);
  if (userId) await applySubscription(db, userId, { ...sub, userId });
  await recordEvent(db, { id: event.id, gateway: 'paypal', type, subscriptionId: subId, userId, payload: event });
  return new Response(userId ? 'ok' : 'no user for subscription');
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Buyer returning from PayPal checkout → bounce back into the app
  const ret = url.searchParams.get('return');
  if (ret) {
    const target = new URL(APP_RETURN_URL);
    target.searchParams.set('gateway', ret);
    target.searchParams.set('result', url.searchParams.get('result') ?? 'success');
    const sid = url.searchParams.get('subscription_id');
    if (sid) target.searchParams.set('subscription_id', sid);
    return new Response(null, { status: 302, headers: { Location: target.toString() } });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const gateway = url.searchParams.get('gateway');
    if (gateway === 'razorpay') return await handleRazorpay(req);
    if (gateway === 'paypal') return await handlePaypal(req);
    return json({ error: 'Add ?gateway=razorpay or ?gateway=paypal to the webhook URL' }, 400);
  } catch (e) {
    console.error(e);
    // 500 makes the gateway retry later, which is what we want for temporary failures.
    return new Response('error', { status: 500 });
  }
});
