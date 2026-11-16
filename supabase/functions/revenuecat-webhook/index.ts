// Supabase Edge Function: receives RevenueCat webhooks and marks users Premium.
// Deploy:  supabase functions deploy revenuecat-webhook --no-verify-jwt
// Secret:  supabase secrets set REVENUECAT_WEBHOOK_SECRET=<any long random string>
// In RevenueCat → Integrations → Webhooks, set the URL to
//   https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
// and the Authorization header value to:  Bearer <same secret>
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { event } = await req.json();
  if (!event?.app_user_id) return new Response("ok");

  const userId: string = event.app_user_id;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return new Response("ignored anonymous user");

  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const ended = event.type === "EXPIRATION";
  const active = !ended && (!expiresAt || expiresAt > new Date());

  await supabase.from("subscriptions").upsert({
    user_id: userId,
    product_id: event.product_id ?? null,
    store: event.store ?? null,
    status: ended ? "expired" : event.type === "CANCELLATION" ? "cancelled" : "active",
    expires_at: expiresAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  });

  await supabase.from("profiles").update({
    is_premium: active,
    premium_until: expiresAt?.toISOString() ?? null,
  }).eq("id", userId);

  return new Response("ok");
});
