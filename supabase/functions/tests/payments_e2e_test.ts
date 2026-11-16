// Run:  deno test -A supabase/functions/tests/payments_e2e_test.ts   (no real keys or network needed)
// End-to-end tests for the `payments` and `payments-webhook` Edge Functions.
// Runs the real function code as separate processes against a local mock of
// Supabase (Auth + PostgREST), Razorpay and PayPal.
function assert(c: unknown, msg = 'assertion failed'): asserts c { if (!c) throw new Error(msg); }
function assertEquals(a: unknown, b: unknown, msg = '') {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`expected ${y}\n     got ${x} ${msg}`);
}

const FN = Deno.args[0] ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const MOCK = 'http://127.0.0.1:8201';
const PAY = 'http://127.0.0.1:8202';
const HOOK = 'http://127.0.0.1:8203';
const USER = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const RZP_WEBHOOK_SECRET = 'whsec_test_123';

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = { profiles: [], subscriptions: [], payment_events: [] };
const calls: { method: string; path: string; body?: unknown }[] = [];
const rzpSubs: Record<string, Row> = {};
const ppSubs: Record<string, Row> = {};
let ppVerify = 'SUCCESS';

function reset() {
  db.profiles = [
    { id: USER, is_premium: false, premium_until: null, status: 'active' },
    { id: OTHER, is_premium: false, premium_until: null, status: 'active' },
  ];
  db.subscriptions = [];
  db.payment_events = [];
  calls.length = 0;
  for (const k of Object.keys(rzpSubs)) delete rzpSubs[k];
  for (const k of Object.keys(ppSubs)) delete ppSubs[k];
  ppVerify = 'SUCCESS';
}

function filt(rows: Row[], params: URLSearchParams) {
  return rows.filter((r) => [...params.entries()].every(([k, v]) => {
    if (['select', 'on_conflict', 'columns'].includes(k)) return true;
    if (v.startsWith('eq.')) return String(r[k]) === v.slice(3);
    return true;
  }));
}

const pk: Record<string, string> = { profiles: 'id', subscriptions: 'user_id', payment_events: 'id' };
const j = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });

const mock = Deno.serve({ hostname: '127.0.0.1', port: 8201, onListen() {} }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const text = req.method === 'GET' ? '' : await req.text();
  const body = text ? JSON.parse(text.startsWith('{') || text.startsWith('[') ? text : '{}') : undefined;
  calls.push({ method: req.method, path: path + url.search, body });

  // ── Supabase Auth
  if (path === '/auth/v1/user') {
    const tok = req.headers.get('authorization')?.replace('Bearer ', '');
    if (tok === 'user-token') return j({ id: USER, aud: 'authenticated', email: 'u@test.dev' });
    if (tok === 'other-token') return j({ id: OTHER, aud: 'authenticated', email: 'o@test.dev' });
    return j({ msg: 'bad jwt' }, 401);
  }
  // ── PostgREST
  if (path.startsWith('/rest/v1/')) {
    const table = path.split('/')[3];
    const rows = db[table] ??= [];
    if (req.method === 'GET') return j(filt(rows, url.searchParams));
    if (req.method === 'POST') {
      const items = Array.isArray(body) ? body : [body];
      const upsert = (req.headers.get('prefer') ?? '').includes('merge-duplicates');
      for (const it of items as Row[]) {
        const key = pk[table];
        const ex = rows.find((r) => r[key] === it[key]);
        if (ex && !upsert) return j({ code: '23505', message: 'duplicate key' }, 409);
        if (ex) Object.assign(ex, it); else rows.push({ ...it });
      }
      return new Response(null, { status: 201 });
    }
    if (req.method === 'PATCH') {
      for (const r of filt(rows, url.searchParams)) Object.assign(r, body);
      return new Response(null, { status: 204 });
    }
  }
  // ── Razorpay
  const auth = req.headers.get('authorization') ?? '';
  if (path.startsWith('/rzp/')) {
    if (auth !== 'Basic ' + btoa('rzp_test_key:rzp_test_secret')) return j({ error: { description: 'Authentication failed' } }, 401);
    if (path === '/rzp/plans/plan_RZ_M') return j({ id: 'plan_RZ_M', period: 'monthly', item: { amount: 9900, currency: 'INR' } });
    if (path === '/rzp/plans/plan_RZ_Y') return j({ id: 'plan_RZ_Y', period: 'yearly', item: { amount: 79900, currency: 'INR' } });
    if (path === '/rzp/subscriptions' && req.method === 'POST') {
      const id = `sub_${Object.keys(rzpSubs).length + 1}`;
      rzpSubs[id] = { id, status: 'created', plan_id: (body as Row).plan_id, notes: (body as Row).notes, current_end: null, short_url: `https://rzp.io/i/${id}` };
      return j(rzpSubs[id]);
    }
    const m = path.match(/^\/rzp\/subscriptions\/([^/]+)(\/cancel)?$/);
    if (m && rzpSubs[m[1]]) {
      if (m[2]) rzpSubs[m[1]].has_cancel = true;
      return j(rzpSubs[m[1]]);
    }
    return j({ error: { description: 'not found' } }, 404);
  }
  // ── PayPal
  if (path.startsWith('/pp/')) {
    if (path === '/pp/v1/oauth2/token') {
      if (auth !== 'Basic ' + btoa('pp_client:pp_secret')) return j({ error: 'invalid_client' }, 401);
      return j({ access_token: 'pp-access', expires_in: 3600 });
    }
    if (auth !== 'Bearer pp-access') return j({ message: 'unauthorized' }, 401);
    if (path === '/pp/v1/billing/plans/P-MONTH') return j({ id: 'P-MONTH', billing_cycles: [{ tenure_type: 'REGULAR', pricing_scheme: { fixed_price: { value: '2.99', currency_code: 'USD' } } }] });
    if (path === '/pp/v1/billing/plans/P-YEAR') return j({ id: 'P-YEAR', billing_cycles: [{ tenure_type: 'REGULAR', pricing_scheme: { fixed_price: { value: '24.99', currency_code: 'USD' } } }] });
    if (path === '/pp/v1/billing/subscriptions' && req.method === 'POST') {
      const id = `I-${Object.keys(ppSubs).length + 1}`;
      const b = body as Row & { application_context: Row };
      ppSubs[id] = { id, status: 'APPROVAL_PENDING', plan_id: b.plan_id, custom_id: b.custom_id, _return: b.application_context.return_url,
        links: [{ rel: 'approve', href: `https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=${id}` }] };
      return j(ppSubs[id], 201);
    }
    if (path === '/pp/v1/notifications/verify-webhook-signature') return j({ verification_status: ppVerify });
    const m = path.match(/^\/pp\/v1\/billing\/subscriptions\/([^/]+)(\/cancel)?$/);
    if (m && ppSubs[m[1]]) {
      if (m[2]) { ppSubs[m[1]].status = 'CANCELLED'; delete (ppSubs[m[1]].billing_info as Row)?.next_billing_time; return new Response(null, { status: 204 }); }
      return j(ppSubs[m[1]]);
    }
    return j({ message: 'not found' }, 404);
  }
  return j({ error: 'unhandled ' + path }, 500);
});

const env = {
  SUPABASE_URL: MOCK,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  RAZORPAY_API_BASE: `${MOCK}/rzp`,
  RAZORPAY_KEY_ID: 'rzp_test_key',
  RAZORPAY_KEY_SECRET: 'rzp_test_secret',
  RAZORPAY_WEBHOOK_SECRET: RZP_WEBHOOK_SECRET,
  RAZORPAY_PLAN_MONTHLY: 'plan_RZ_M',
  RAZORPAY_PLAN_YEARLY: 'plan_RZ_Y',
  PAYPAL_API_BASE: `${MOCK}/pp`,
  PAYPAL_CLIENT_ID: 'pp_client',
  PAYPAL_CLIENT_SECRET: 'pp_secret',
  PAYPAL_WEBHOOK_ID: 'WH-TEST',
  PAYPAL_PLAN_MONTHLY: 'P-MONTH',
  PAYPAL_PLAN_YEARLY: 'P-YEAR',
};

function spawn(file: string, addr: string) {
  return new Deno.Command(Deno.execPath(), {
    args: ['run', '-A', '--quiet', `${FN}/${file}`],
    env: { ...env, DENO_SERVE_ADDRESS: `tcp:${addr}` },
    stdout: 'null', stderr: 'piped',
  }).spawn();
}
const procs = [spawn('payments/index.ts', '127.0.0.1:8202'), spawn('payments-webhook/index.ts', '127.0.0.1:8203')];

async function waitUp(u: string) {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(u, { method: 'OPTIONS' }); await r.body?.cancel(); return; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error('server did not start: ' + u);
}
await waitUp(PAY);
await waitUp(HOOK);

async function pay(body: unknown, token = 'user-token') {
  const r = await fetch(PAY, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(RZP_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function rzpHook(event: string, entity: Row, opts: { badSig?: boolean; eventId?: string } = {}) {
  const raw = JSON.stringify({ event, payload: { subscription: { entity } } });
  const r = await fetch(`${HOOK}?gateway=razorpay`, {
    method: 'POST', body: raw,
    headers: { 'x-razorpay-signature': opts.badSig ? 'deadbeef' : await hmac(raw), 'x-razorpay-event-id': opts.eventId ?? crypto.randomUUID() },
  });
  return { status: r.status, text: await r.text() };
}
async function ppHook(event_type: string, resource: Row) {
  const r = await fetch(`${HOOK}?gateway=paypal`, {
    method: 'POST', body: JSON.stringify({ id: 'WH-' + crypto.randomUUID(), event_type, resource }),
    headers: { 'paypal-transmission-id': 't1', 'paypal-transmission-sig': 's1', 'paypal-transmission-time': new Date().toISOString(), 'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://api.paypal.com/cert' },
  });
  return { status: r.status, text: await r.text() };
}
const profile = (id = USER) => db.profiles.find((p) => p.id === id)!;
const subRow = (id = USER) => db.subscriptions.find((s) => s.user_id === id);
const future = (days: number) => Math.floor(Date.now() / 1000) + days * 86400;

const opts = { sanitizeOps: false, sanitizeResources: false };

Deno.test({ name: 'rejects calls without a valid session', ...opts, async fn() {
  reset();
  const r = await pay({ action: 'config' }, 'nope');
  assertEquals(r.status, 401);
} });

Deno.test({ name: 'config lists both gateways with live prices from the gateway', ...opts, async fn() {
  reset();
  const r = await pay({ action: 'config' });
  assertEquals(r.status, 200);
  assertEquals(r.body.gateways, [
    { id: 'razorpay', plans: [{ id: 'monthly', amount: 99, currency: 'INR' }, { id: 'yearly', amount: 799, currency: 'INR' }] },
    { id: 'paypal', plans: [{ id: 'monthly', amount: 2.99, currency: 'USD' }, { id: 'yearly', amount: 24.99, currency: 'USD' }] },
  ]);
} });

Deno.test({ name: 'Razorpay: full subscription lifecycle (create → paid → renew → cancel → end)', ...opts, async fn() {
  reset();
  // 1. create
  const c = await pay({ action: 'create', gateway: 'razorpay', plan: 'yearly' });
  assertEquals(c.status, 200, JSON.stringify(c.body));
  assertEquals(c.body.url, 'https://rzp.io/i/sub_1');
  const createCall = calls.find((x) => x.path === '/rzp/subscriptions')!;
  assertEquals((createCall.body as Row).plan_id, 'plan_RZ_Y');
  assertEquals(((createCall.body as Row).notes as Row).user_id, USER);
  assertEquals(subRow()?.status, 'pending');
  assertEquals(profile().is_premium, false);

  // 2. user returns before paying → verify says still pending
  let v = await pay({ action: 'verify', gateway: 'razorpay', subscription_id: 'sub_1' });
  assertEquals(v.body.status, 'pending');
  assertEquals(profile().is_premium, false);

  // 3. payment succeeds → webhook subscription.activated
  rzpSubs.sub_1.status = 'active';
  rzpSubs.sub_1.current_end = future(365);
  const h = await rzpHook('subscription.activated', rzpSubs.sub_1);
  assertEquals(h.status, 200);
  assertEquals(profile().is_premium, true);
  assertEquals(subRow()?.status, 'active');
  assertEquals(subRow()?.store, 'RAZORPAY');
  assertEquals(subRow()?.product_id, 'plus_yearly');
  assert(new Date(profile().premium_until as string) > new Date(Date.now() + 364 * 86400e3));

  // 4. app-side verify also confirms Premium
  v = await pay({ action: 'verify' });
  assertEquals(v.body.is_premium, true);

  // 5. can't buy twice
  const again = await pay({ action: 'create', gateway: 'paypal', plan: 'monthly' });
  assertEquals(again.status, 409);

  // 6. renewal charged → period extended
  rzpSubs.sub_1.current_end = future(730);
  await rzpHook('subscription.charged', rzpSubs.sub_1);
  assert(new Date(subRow()!.expires_at as string) > new Date(Date.now() + 729 * 86400e3));

  // 7. user cancels in the app → stays Premium until the period ends
  const cancel = await pay({ action: 'cancel' });
  assertEquals(cancel.status, 200, JSON.stringify(cancel.body));
  assert(calls.some((x) => x.path === '/rzp/subscriptions/sub_1/cancel' && (x.body as Row).cancel_at_cycle_end === 1));
  assertEquals(subRow()?.cancel_at_period_end, true);
  assertEquals(profile().is_premium, true);
  // a later webhook while still active keeps the "cancels at period end" flag
  await rzpHook('subscription.updated', rzpSubs.sub_1);
  assertEquals(subRow()?.cancel_at_period_end, true);

  // 8. period ends → completed → Premium removed
  rzpSubs.sub_1.status = 'completed';
  rzpSubs.sub_1.current_end = future(-1);
  await rzpHook('subscription.completed', rzpSubs.sub_1);
  assertEquals(profile().is_premium, false);
  assertEquals(subRow()?.status, 'expired');
} });

Deno.test({ name: 'Razorpay: failed renewal (halted) removes Premium; webhook with bad signature is rejected', ...opts, async fn() {
  reset();
  await pay({ action: 'create', gateway: 'razorpay', plan: 'monthly' });
  rzpSubs.sub_1.status = 'active'; rzpSubs.sub_1.current_end = future(30);
  const bad = await rzpHook('subscription.activated', rzpSubs.sub_1, { badSig: true });
  assertEquals(bad.status, 401);
  assertEquals(profile().is_premium, false);
  await rzpHook('subscription.activated', rzpSubs.sub_1);
  assertEquals(profile().is_premium, true);
  rzpSubs.sub_1.status = 'halted';
  await rzpHook('subscription.halted', rzpSubs.sub_1);
  assertEquals(profile().is_premium, false);
  assertEquals(subRow()?.status, 'suspended');
  assertEquals(db.payment_events.length, 2);
} });

Deno.test({ name: 'Razorpay: duplicate webhook delivery is harmless', ...opts, async fn() {
  reset();
  await pay({ action: 'create', gateway: 'razorpay', plan: 'monthly' });
  rzpSubs.sub_1.status = 'active'; rzpSubs.sub_1.current_end = future(30);
  const a = await rzpHook('subscription.activated', rzpSubs.sub_1, { eventId: 'evt_same' });
  const b = await rzpHook('subscription.activated', rzpSubs.sub_1, { eventId: 'evt_same' });
  assertEquals([a.status, b.status], [200, 200]);
  assertEquals(db.payment_events.length, 1);
  assertEquals(profile().is_premium, true);
} });

Deno.test({ name: 'PayPal: create → approve → return redirect → webhook → cancel', ...opts, async fn() {
  reset();
  const c = await pay({ action: 'create', gateway: 'paypal', plan: 'monthly' });
  assertEquals(c.status, 200, JSON.stringify(c.body));
  assert(c.body.url.includes('ba_token=I-1'));
  assertEquals(ppSubs['I-1'].custom_id, USER);
  assertEquals(ppSubs['I-1'].plan_id, 'P-MONTH');

  // PayPal sends the buyer to our return URL → redirect into the app
  const ret = await fetch(`${ppSubs['I-1']._return}&subscription_id=I-1`.replace(`${MOCK}/functions/v1/payments-webhook`, HOOK), { redirect: 'manual' });
  assertEquals(ret.status, 302);
  assertEquals(ret.headers.get('location'), 'moodcircle://payment-return?gateway=paypal&result=success&subscription_id=I-1');

  // Approved + first payment → ACTIVE
  ppSubs['I-1'].status = 'ACTIVE';
  ppSubs['I-1'].billing_info = { next_billing_time: new Date(Date.now() + 30 * 86400e3).toISOString(), last_payment: { time: new Date().toISOString() } };
  const v = await pay({ action: 'verify', gateway: 'paypal', subscription_id: 'I-1' });
  assertEquals(v.body.is_premium, true);
  assertEquals(profile().is_premium, true);
  assertEquals(subRow()?.store, 'PAYPAL');

  // Renewal payment webhook
  ppSubs['I-1'].billing_info = { next_billing_time: new Date(Date.now() + 60 * 86400e3).toISOString(), last_payment: { time: new Date().toISOString() } };
  const h = await ppHook('PAYMENT.SALE.COMPLETED', { id: 'SALE-1', billing_agreement_id: 'I-1' });
  assertEquals(h.status, 200);
  assert(new Date(subRow()!.expires_at as string) > new Date(Date.now() + 59 * 86400e3));

  // Cancel in app → keeps Premium for the month already paid
  const cancel = await pay({ action: 'cancel' });
  assertEquals(cancel.status, 200, JSON.stringify(cancel.body));
  assertEquals(cancel.body.status, 'cancelled');
  assertEquals(profile().is_premium, true);
  assertEquals(subRow()?.cancel_at_period_end, true);

  // Forged webhook rejected
  ppVerify = 'FAILURE';
  const forged = await ppHook('BILLING.SUBSCRIPTION.EXPIRED', { id: 'I-1' });
  assertEquals(forged.status, 401);
  assertEquals(profile().is_premium, true);
} });

Deno.test({ name: "users can't verify or cancel someone else's subscription", ...opts, async fn() {
  reset();
  await pay({ action: 'create', gateway: 'razorpay', plan: 'monthly' });
  rzpSubs.sub_1.status = 'active'; rzpSubs.sub_1.current_end = future(30);
  const r = await pay({ action: 'verify', gateway: 'razorpay', subscription_id: 'sub_1' }, 'other-token');
  assertEquals(r.status, 403);
  assertEquals(profile(OTHER).is_premium, false);
} });

Deno.test({ name: 'an abandoned web checkout never downgrades an active Google Play / App Store subscription', ...opts, async fn() {
  reset();
  db.subscriptions.push({ user_id: USER, store: 'PLAY_STORE', status: 'active', product_id: 'plus_monthly', gateway_subscription_id: null });
  // create a pending razorpay sub directly (user not premium in profile flag for this test)
  await pay({ action: 'create', gateway: 'razorpay', plan: 'monthly' });
  assertEquals(subRow()?.store, 'PLAY_STORE');
  rzpSubs.sub_1.status = 'expired';
  await rzpHook('subscription.expired', rzpSubs.sub_1);
  assertEquals(subRow()?.store, 'PLAY_STORE');
  assertEquals(subRow()?.status, 'active');
} });

Deno.test({ name: 'invalid input is rejected', ...opts, async fn() {
  reset();
  assertEquals((await pay({ action: 'create', gateway: 'stripe', plan: 'monthly' })).status, 400);
  assertEquals((await pay({ action: 'create', gateway: 'razorpay', plan: 'weekly' })).status, 400);
  assertEquals((await pay({ action: 'nope' })).status, 400);
  const r = await fetch(`${HOOK}?gateway=other`, { method: 'POST', body: '{}' });
  assertEquals(r.status, 400); await r.body?.cancel();
} });

Deno.test({ name: 'shutdown', ...opts, async fn() {
  for (const p of procs) { try { p.kill(); } catch {} await p.status; }
  await mock.shutdown();
} });
