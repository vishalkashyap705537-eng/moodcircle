-- =====================================================================
-- MoodCircle — full database schema (Supabase / Postgres)
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.
-- Privacy rules, the 18+ age gate, anonymity, bad-language moderation
-- and DM limits are all enforced HERE on the server, not just in the app.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Moods ----------
create table public.moods (
  id text primary key,
  label text not null,
  emoji text not null,
  color text not null,
  sort int not null default 0
);

-- ---------- Profiles (PUBLIC fields only) ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar text not null default '🌙',
  bio text not null default '' check (char_length(bio) <= 160),
  current_mood text references public.moods(id),
  show_mood boolean not null default true,
  show_communities boolean not null default true,
  allow_dm_requests boolean not null default true,
  is_premium boolean not null default false,
  premium_until timestamptz,
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended','banned')),
  suspended_until timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Private data (never visible to other users) ----------
create table public.profile_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dob date not null,
  created_at timestamptz not null default now()
);

-- ---------- Helper functions ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from profiles where id = auth.uid()
      and (status = 'active' or (status = 'suspended' and suspended_until < now()))
  );
$$;

create or replace function public.has_premium(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_premium and (premium_until is null or premium_until > now())
                   from profiles where id = uid), false);
$$;

-- ---------- New user: create profile + enforce 18+ ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_dob date := (new.raw_user_meta_data->>'dob')::date;
  v_username text := new.raw_user_meta_data->>'username';
begin
  if v_dob is null or v_dob > (current_date - interval '18 years') then
    raise exception 'You must be 18 or older to use MoodCircle';
  end if;
  insert into profiles (id, username, avatar)
    values (new.id, v_username, coalesce(new.raw_user_meta_data->>'avatar', '🌙'));
  insert into profile_private (user_id, dob) values (new.id, v_dob);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Username availability check usable before sign-up
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists(select 1 from profiles where lower(username) = lower(p_username));
$$;

-- ---------- Bad-language moderation ----------
create table public.banned_words (
  word text primary key,
  severity text not null default 'block' check (severity in ('block','flag'))
);

-- Returns 'block', 'flag' or null
create or replace function public.check_text(p text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists(select 1 from banned_words where severity='block'
                and p ~* ('(^|[^a-z0-9])' || word)) then 'block'
    when exists(select 1 from banned_words where severity='flag'
                and p ~* ('(^|[^a-z0-9])' || word || '([^a-z0-9]|$)')) then 'flag'
  end;
$$;

create or replace function public.moderate_body() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := check_text(new.body);
begin
  if r = 'block' then
    raise exception 'Your message contains language that is not allowed. Please rephrase it kindly.';
  elsif r = 'flag' then
    new.is_flagged := true;
  end if;
  return new;
end $$;

-- ---------- Communities ----------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 40),
  description text not null default '',
  emoji text not null default '💬',
  mood_id text not null references public.moods(id),
  is_active boolean not null default true,
  member_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.community_members (
  community_id uuid references public.communities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create or replace function public.bump_member_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update communities set member_count = member_count + 1 where id = new.community_id;
  else
    update communities set member_count = greatest(member_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end $$;
create trigger member_count after insert or delete on public.community_members
  for each row execute function public.bump_member_count();

-- ---------- Blocks ----------
create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;

-- ---------- Group chat ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  is_flagged boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.messages (community_id, created_at desc);
create trigger moderate before insert or update of body on public.messages
  for each row execute function public.moderate_body();

-- ---------- Posts ----------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  is_anonymous boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  mood_id text references public.moods(id),
  is_flagged boolean not null default false,
  is_hidden boolean not null default false,
  comment_count int not null default 0,
  reaction_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.posts (community_id, created_at desc);
create trigger moderate before insert or update of body on public.posts
  for each row execute function public.moderate_body();

-- ---------- Comments ----------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  is_anonymous boolean not null default false,
  body text not null check (char_length(body) between 1 and 1000),
  is_flagged boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.comments (post_id, created_at);
create trigger moderate before insert or update of body on public.comments
  for each row execute function public.moderate_body();

-- ---------- Reactions ----------
create table public.reactions (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('hug','same','support','strong')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------- Notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

-- Counters + notifications for comments / reactions
create or replace function public.on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id returning author_id into v_author;
    if v_author is not null and v_author <> new.author_id then
      insert into notifications (user_id, type, title, body, data)
      values (v_author, 'comment', 'New comment on your post', left(new.body, 80),
              jsonb_build_object('post_id', new.post_id));
    end if;
  else
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger comment_count after insert or delete on public.comments
  for each row execute function public.on_comment();

create or replace function public.on_reaction() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if tg_op = 'INSERT' then
    update posts set reaction_count = reaction_count + 1 where id = new.post_id returning author_id into v_author;
    if v_author is not null and v_author <> new.user_id then
      insert into notifications (user_id, type, title, body, data)
      values (v_author, 'reaction', 'Someone reacted to your post', '',
              jsonb_build_object('post_id', new.post_id));
    end if;
  elsif tg_op = 'DELETE' then
    update posts set reaction_count = greatest(reaction_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
create trigger reaction_count after insert or delete on public.reactions
  for each row execute function public.on_reaction();

-- ---------- Public feed views (hide anonymous authors) ----------
-- Views run with owner rights so they can read author info, but they only
-- expose author identity when the post/comment is NOT anonymous.
create or replace view public.feed_posts as
select p.id, p.community_id, p.body, p.mood_id, p.is_anonymous,
       p.comment_count, p.reaction_count, p.created_at,
       case when p.is_anonymous then null else p.author_id end as author_id,
       case when p.is_anonymous then 'Anonymous' else pr.username end as author_name,
       case when p.is_anonymous then '🎭' else pr.avatar end as author_avatar,
       case when p.is_anonymous then false else pr.is_premium end as author_premium,
       (p.author_id = auth.uid()) as is_mine,
       c.name as community_name, c.emoji as community_emoji,
       (select kind from reactions r where r.post_id = p.id and r.user_id = auth.uid()) as my_reaction
from posts p
join profiles pr on pr.id = p.author_id
join communities c on c.id = p.community_id
where p.is_hidden = false and pr.status <> 'banned' and c.is_active
  and not is_blocked_between(p.author_id, auth.uid());

create or replace view public.feed_comments as
select cm.id, cm.post_id, cm.body, cm.is_anonymous, cm.created_at,
       case when cm.is_anonymous then null else cm.author_id end as author_id,
       case when cm.is_anonymous then 'Anonymous' else pr.username end as author_name,
       case when cm.is_anonymous then '🎭' else pr.avatar end as author_avatar,
       (cm.author_id = auth.uid()) as is_mine
from comments cm
join profiles pr on pr.id = cm.author_id
where cm.is_hidden = false and pr.status <> 'banned'
  and not is_blocked_between(cm.author_id, auth.uid());

create or replace view public.chat_messages as
select m.id, m.community_id, m.body, m.created_at, m.user_id,
       pr.username as author_name, pr.avatar as author_avatar, pr.is_premium as author_premium
from messages m join profiles pr on pr.id = m.user_id
where m.is_hidden = false and pr.status <> 'banned'
  and not is_blocked_between(m.user_id, auth.uid());

grant select on public.feed_posts, public.feed_comments, public.chat_messages to authenticated;
revoke select on public.feed_posts, public.feed_comments, public.chat_messages from anon;

-- ---------- DMs (18+ only by design: every account is 18+) ----------
create table public.dm_requests (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 200),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create unique index dm_requests_one_pending on public.dm_requests (from_id, to_id) where status = 'pending';

create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_flagged boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.dm_messages (thread_id, created_at desc);
create trigger moderate before insert or update of body on public.dm_messages
  for each row execute function public.moderate_body();

create or replace function public.touch_thread() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update dm_threads set last_message_at = now() where id = new.thread_id;
  return null;
end $$;
create trigger touch_thread after insert on public.dm_messages
  for each row execute function public.touch_thread();

-- Free users: 3 DM requests per day. Premium: 50 per day.
create or replace function public.send_dm_request(p_to uuid, p_message text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_count int; v_limit int; v_id uuid;
begin
  if not is_active_user() then raise exception 'Your account cannot send requests right now'; end if;
  if p_to = auth.uid() then raise exception 'You cannot message yourself'; end if;
  if is_blocked_between(auth.uid(), p_to) then raise exception 'You cannot message this user'; end if;
  if not coalesce((select allow_dm_requests from profiles where id = p_to and status = 'active'), false) then
    raise exception 'This user is not accepting message requests';
  end if;
  if exists(select 1 from dm_threads where (user_a = auth.uid() and user_b = p_to) or (user_a = p_to and user_b = auth.uid())) then
    raise exception 'You already have a chat with this user';
  end if;
  if exists(select 1 from dm_requests where from_id = auth.uid() and to_id = p_to and status = 'pending') then
    raise exception 'You already sent this person a request';
  end if;
  if check_text(p_message) = 'block' then raise exception 'Your message contains language that is not allowed'; end if;
  v_limit := case when has_premium(auth.uid()) then 50 else 3 end;
  select count(*) into v_count from dm_requests where from_id = auth.uid() and created_at > now() - interval '1 day';
  if v_count >= v_limit then
    raise exception 'Daily DM request limit reached (%). Upgrade to Premium for more.', v_limit;
  end if;
  insert into dm_requests (from_id, to_id, message) values (auth.uid(), p_to, coalesce(p_message,'')) returning id into v_id;
  insert into notifications (user_id, type, title, body, data)
  values (p_to, 'dm_request', 'New message request',
          (select username from profiles where id = auth.uid()) || ' wants to chat with you',
          jsonb_build_object('request_id', v_id));
  return v_id;
end $$;

create or replace function public.respond_dm_request(p_id uuid, p_accept boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare r dm_requests; v_thread uuid;
begin
  select * into r from dm_requests where id = p_id and to_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Request not found'; end if;
  update dm_requests set status = case when p_accept then 'accepted' else 'declined' end where id = p_id;
  if p_accept then
    insert into dm_threads (user_a, user_b) values (least(r.from_id, r.to_id), greatest(r.from_id, r.to_id))
      on conflict (user_a, user_b) do update set last_message_at = now()
      returning id into v_thread;
    if r.message <> '' then
      insert into dm_messages (thread_id, sender_id, body) values (v_thread, r.from_id, r.message);
    end if;
    insert into notifications (user_id, type, title, body, data)
    values (r.from_id, 'dm_accepted', 'Request accepted',
            (select username from profiles where id = auth.uid()) || ' accepted your message request',
            jsonb_build_object('thread_id', v_thread));
  end if;
  return v_thread;
end $$;

create or replace view public.my_threads as
select t.id, t.last_message_at,
       o.id as other_id, o.username as other_name, o.avatar as other_avatar, o.is_premium as other_premium,
       (select body from dm_messages m where m.thread_id = t.id order by created_at desc limit 1) as last_message
from dm_threads t
join profiles o on o.id = case when t.user_a = auth.uid() then t.user_b else t.user_a end
where auth.uid() in (t.user_a, t.user_b);
grant select on public.my_threads to authenticated;
revoke select on public.my_threads from anon;

-- ---------- Reports ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','message','dm','user')),
  target_id uuid not null,
  reason text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Subscriptions (written by the RevenueCat webhook) ----------
create table public.subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  product_id text,
  store text,
  status text not null,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------- Admin helpers ----------
create or replace function public.admin_stats() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  return json_build_object(
    'users', (select count(*) from profiles),
    'new_users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'premium', (select count(*) from profiles where is_premium),
    'communities', (select count(*) from communities),
    'posts', (select count(*) from posts),
    'posts_7d', (select count(*) from posts where created_at > now() - interval '7 days'),
    'comments', (select count(*) from comments),
    'messages_7d', (select count(*) from messages where created_at > now() - interval '7 days'),
    'open_reports', (select count(*) from reports where status = 'open'),
    'flagged', (select (select count(*) from posts where is_flagged and not is_hidden)
                     + (select count(*) from comments where is_flagged and not is_hidden)
                     + (select count(*) from messages where is_flagged and not is_hidden)),
    'banned', (select count(*) from profiles where status <> 'active'),
    'daily', (select json_agg(d order by d.day) from (
        select g::date as day,
          (select count(*) from profiles where created_at::date = g::date) as signups,
          (select count(*) from posts where created_at::date = g::date) as posts,
          (select count(*) from messages where created_at::date = g::date) as messages
        from generate_series(current_date - 13, current_date, interval '1 day') g) d),
    'moods', (select json_agg(m) from (
        select current_mood as mood, count(*) as n from profiles
        where current_mood is not null group by current_mood order by n desc) m)
  );
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.moods enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.banned_words enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.blocks enable row level security;
alter table public.messages enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.notifications enable row level security;
alter table public.dm_requests enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.reports enable row level security;
alter table public.subscriptions enable row level security;

-- Moods
create policy "moods read" on moods for select to authenticated using (true);
create policy "moods admin" on moods for all to authenticated using (is_admin()) with check (is_admin());

-- Profiles: only public columns live here
create policy "profiles read" on profiles for select to authenticated using (true);
create policy "profiles update own" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin" on profiles for update to authenticated using (is_admin()) with check (is_admin());

-- Stop users from making themselves admin/premium/unbanned
-- (security invoker on purpose: current_user is then the caller's role)
create or replace function public.protect_profile_fields() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not is_admin() then
    new.is_admin := old.is_admin;
    new.is_premium := old.is_premium;
    new.premium_until := old.premium_until;
    new.status := old.status;
    new.suspended_until := old.suspended_until;
  end if;
  if check_text(new.username || ' ' || new.bio) = 'block' then
    raise exception 'Username or bio contains language that is not allowed';
  end if;
  return new;
end $$;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Private data: owner + admin only (admins see age, never shown to users)
create policy "private own" on profile_private for select to authenticated using (user_id = auth.uid() or is_admin());

-- Banned words: admins only
create policy "words admin" on banned_words for all to authenticated using (is_admin()) with check (is_admin());

-- Communities
create policy "communities read" on communities for select to authenticated using (is_active or is_admin());
create policy "communities admin" on communities for all to authenticated using (is_admin()) with check (is_admin());

create policy "members read" on community_members for select to authenticated using (true);
create policy "members join" on community_members for insert to authenticated
  with check (user_id = auth.uid() and is_active_user());
create policy "members leave" on community_members for delete to authenticated using (user_id = auth.uid());

-- Blocks
create policy "blocks own" on blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

-- Group chat messages: members only
create policy "messages read" on messages for select to authenticated using (
  is_admin() or exists(select 1 from community_members m where m.community_id = messages.community_id and m.user_id = auth.uid()));
create policy "messages write" on messages for insert to authenticated with check (
  user_id = auth.uid() and is_active_user() and
  exists(select 1 from community_members m where m.community_id = messages.community_id and m.user_id = auth.uid()));
create policy "messages delete own" on messages for delete to authenticated using (user_id = auth.uid());
create policy "messages admin" on messages for update to authenticated using (is_admin()) with check (is_admin());

-- Posts: raw table only for own rows & admins; everyone else reads feed_posts
create policy "posts own read" on posts for select to authenticated using (author_id = auth.uid() or is_admin());
create policy "posts write" on posts for insert to authenticated with check (
  author_id = auth.uid() and is_active_user() and
  exists(select 1 from community_members m where m.community_id = posts.community_id and m.user_id = auth.uid()));
create policy "posts delete" on posts for delete to authenticated using (author_id = auth.uid() or is_admin());
create policy "posts admin" on posts for update to authenticated using (is_admin()) with check (is_admin());

create policy "comments own read" on comments for select to authenticated using (author_id = auth.uid() or is_admin());
create policy "comments write" on comments for insert to authenticated with check (author_id = auth.uid() and is_active_user());
create policy "comments delete" on comments for delete to authenticated using (author_id = auth.uid() or is_admin());
create policy "comments admin" on comments for update to authenticated using (is_admin()) with check (is_admin());

create policy "reactions read" on reactions for select to authenticated using (true);
create policy "reactions write" on reactions for insert to authenticated with check (user_id = auth.uid() and is_active_user());
create policy "reactions update" on reactions for update to authenticated using (user_id = auth.uid());
create policy "reactions delete" on reactions for delete to authenticated using (user_id = auth.uid());

-- Notifications
create policy "notif own" on notifications for select to authenticated using (user_id = auth.uid());
create policy "notif update own" on notifications for update to authenticated using (user_id = auth.uid());
create policy "notif delete own" on notifications for delete to authenticated using (user_id = auth.uid());

-- DMs (writes to requests go through the RPC functions above)
create policy "dmreq read" on dm_requests for select to authenticated using (auth.uid() in (from_id, to_id));
create policy "threads read" on dm_threads for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "dm read" on dm_messages for select to authenticated using (
  exists(select 1 from dm_threads t where t.id = thread_id and auth.uid() in (t.user_a, t.user_b)));
create policy "dm write" on dm_messages for insert to authenticated with check (
  sender_id = auth.uid() and is_active_user() and
  exists(select 1 from dm_threads t where t.id = thread_id and auth.uid() in (t.user_a, t.user_b)
         and not is_blocked_between(t.user_a, t.user_b)));

-- Reports
create policy "reports create" on reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "reports read" on reports for select to authenticated using (reporter_id = auth.uid() or is_admin());
create policy "reports admin" on reports for update to authenticated using (is_admin()) with check (is_admin());

-- Subscriptions
create policy "subs read" on subscriptions for select to authenticated using (user_id = auth.uid() or is_admin());

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.messages, public.dm_messages, public.notifications;

-- =====================================================================
-- Seed data
-- =====================================================================
insert into moods (id, label, emoji, color, sort) values
  ('lonely','Lonely','🫂','#7C8CF8',1),
  ('anxious','Anxious','😰','#F4A261',2),
  ('sad','Sad','😢','#5DA9E9',3),
  ('stressed','Stressed','😫','#E76F51',4),
  ('overthinking','Overthinking','🌀','#9B5DE5',5),
  ('heartbroken','Heartbroken','💔','#F15BB5',6),
  ('bored','Bored','🥱','#90A4AE',7),
  ('happy','Happy','😊','#FFD166',8),
  ('motivated','Motivated','🔥','#FF7B54',9),
  ('calm','Calm','🌿','#4CC9A6',10);

insert into communities (name, description, emoji, mood_id) values
  ('Late Night Talks','For when the night feels too long and you need someone to talk to.','🌙','lonely'),
  ('Just Need Company','No pressure. Just people being around each other.','🫂','lonely'),
  ('Calm The Storm','Share what is making you anxious. Breathe together.','🌊','anxious'),
  ('Exam & Work Pressure','Deadlines, exams, bosses — vent and get support.','📚','stressed'),
  ('Rainy Day Hearts','It is okay to not be okay. Share gently.','🌧️','sad'),
  ('Brain Won''t Stop','Overthinkers unite. Untangle your thoughts here.','🌀','overthinking'),
  ('Healing Hearts','Breakups and heartbreak — you are not alone.','💔','heartbroken'),
  ('Kill The Boredom','Random chats, games, recommendations.','🎲','bored'),
  ('Good Vibes Only','Share your wins and happy moments.','✨','happy'),
  ('Grind Mode','Goals, gym, study, side hustles — keep each other going.','🔥','motivated'),
  ('Peaceful Corner','Slow, kind conversations. Music, nature, calm.','🌿','calm');

-- Starter word list (extend it from the Admin → Moderation screen)
insert into banned_words (word, severity) values
  ('fuck','block'),('bitch','block'),('bastard','block'),('cunt','block'),('motherfucker','block'),
  ('madarchod','block'),('behenchod','block'),('bhenchod','block'),('chutiya','block'),
  ('bhosdike','block'),('gandu','block'),('harami','flag'),('kill yourself','block'),('kys','block'),
  ('shit','flag'),('idiot','flag'),('stupid','flag'),('kamina','flag'),('loser','flag');

-- ---------- Account deletion (required by Apple & Google) ----------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.delete_my_account() from anon;
