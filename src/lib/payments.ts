// Razorpay + PayPal subscriptions.
// The app never holds a secret key: it asks our Supabase Edge Function (`payments`) to create
// the subscription, opens the gateway's secure hosted checkout in an in-app browser, then asks
// the server to confirm the result. Webhooks (`payments-webhook`) keep the status in sync
// for renewals, failures and cancellations.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export type Gateway = 'razorpay' | 'paypal';
export type PlanId = 'monthly' | 'yearly';
export type GatewayPlan = { id: PlanId; amount: number; currency: string };
export type GatewayConfig = { id: Gateway; plans: GatewayPlan[] };
export type VerifyResult = { status: string; is_premium: boolean | null; expires_at?: string | null; cancel_at_period_end?: boolean };

export const GATEWAY_INFO: Record<Gateway, { name: string; blurb: string }> = {
  razorpay: { name: 'Razorpay', blurb: 'UPI, cards, net banking & wallets (India)' },
  paypal: { name: 'PayPal', blurb: 'PayPal balance or international cards' },
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('payments', { body });
  if (error) {
    // Surface the server's message (e.g. "You already have MoodCircle Plus")
    const ctx = (error as { context?: Response }).context;
    let msg = error.message;
    try {
      const j = ctx ? await ctx.clone().json() : null;
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function formatPrice(p: GatewayPlan) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency, maximumFractionDigits: p.amount % 1 ? 2 : 0 }).format(p.amount);
  } catch {
    return `${p.currency} ${p.amount}`;
  }
}

/** Which gateways are switched on (server has keys + plans), with live prices from the gateway. */
export async function getGatewayConfig(): Promise<GatewayConfig[]> {
  try {
    const r = await call<{ gateways: GatewayConfig[] }>({ action: 'config' });
    return r.gateways ?? [];
  } catch {
    return [];
  }
}

export async function verifySubscription(gateway?: Gateway, subscriptionId?: string): Promise<VerifyResult> {
  return call<VerifyResult>({ action: 'verify', gateway, subscription_id: subscriptionId });
}

export async function cancelSubscription(): Promise<VerifyResult> {
  return call<VerifyResult>({ action: 'cancel' });
}

/**
 * Full checkout: create → hosted payment page → confirm.
 * Resolves with the final status once the browser closes (polls briefly while the gateway confirms).
 */
export async function checkout(gateway: Gateway, plan: PlanId): Promise<VerifyResult & { opened: boolean }> {
  const { url, subscription_id } = await call<{ url: string; subscription_id: string }>({ action: 'create', gateway, plan });
  const returnUrl = Linking.createURL('payment-return');
  await WebBrowser.openAuthSessionAsync(url, returnUrl, { showInRecents: true }).catch(() =>
    WebBrowser.openBrowserAsync(url),
  );

  // Whether the user finished, cancelled or just closed the page, ask the server for the truth.
  let last: VerifyResult = { status: 'pending', is_premium: false };
  for (let i = 0; i < 6; i++) {
    try {
      last = await verifySubscription(gateway, subscription_id);
      if (last.is_premium || ['active', 'cancelled', 'expired', 'suspended'].includes(last.status)) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ...last, opened: true };
}

// Warm up the browser on Android for a faster checkout open.
export function warmUpBrowser() {
  WebBrowser.warmUpAsync().catch(() => {});
  return () => {
    WebBrowser.coolDownAsync().catch(() => {});
  };
}
