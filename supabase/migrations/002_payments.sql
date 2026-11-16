-- MoodCircle — Razorpay + PayPal subscriptions
-- Run this AFTER 001_init.sql (Supabase → SQL Editor → New query → paste → Run).
-- It only ADDS columns/tables. Nothing existing is changed or removed, and the
-- RevenueCat (Google Play / App Store) flow keeps working exactly as before.

-- The existing `subscriptions` table is reused for all payment methods:
--   store = 'RAZORPAY' | 'PAYPAL' | (RevenueCat values such as 'PLAY_STORE', 'APP_STORE')
alter table public.subscriptions add column if not exists gateway_subscription_id text;
alter table public.subscriptions add column if not exists plan text;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;

create index if not exists subscriptions_gateway_sub_idx
  on public.subscriptions (gateway_subscription_id);

-- Every webhook we receive, stored once (makes webhooks idempotent + gives admins an audit trail)
create table if not exists public.payment_events (
  id text primary key,                 -- gateway event id
  gateway text not null check (gateway in ('razorpay', 'paypal')),
  event_type text not null,
  gateway_subscription_id text,
  user_id uuid references public.profiles(id) on delete set null,
  payload jsonb,
  received_at timestamptz not null default now()
);

alter table public.payment_events enable row level security;

drop policy if exists "payment events admin read" on public.payment_events;
create policy "payment events admin read" on public.payment_events
  for select to authenticated using (is_admin());
-- No insert/update policies: only the Edge Functions (service role) write here.
