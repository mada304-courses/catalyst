-- ============================================================================
-- CATALYST — Supabase database schema
-- ============================================================================
-- Run this entire file once in: Supabase Dashboard → SQL Editor → New Query.
-- It is safe to re-run (uses "if not exists" / "or replace" / guarded seeds).
--
-- What this sets up:
--   1. profiles        — one row per user, holds the `role` that gates admin access
--   2. events          — all Catalyst events, public + admin-managed
--   3. site_settings   — small CMS table for banner / home / about / more / footer copy
--   4. Row Level Security policies enforcing everything server-side
--   5. Triggers that keep profiles in sync with auth.users and prevent
--      a user from ever promoting themselves to admin via the API
-- ============================================================================

create extension if not exists pgcrypto; -- gives us gen_random_uuid()

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A logged-in user can always read their own profile (needed to know their own role)
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Admins can read every profile (used by the dashboard's "Registered users" stat)
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- A user may update their own row (e.g. change their display name)...
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ...but see the trigger below: `role` cannot be changed this way.
-- There is deliberately NO insert policy — client code can never insert a
-- profile row directly. Rows are created only by the trusted trigger below.

-- SECURITY: block privilege escalation.
-- If a signed-in user tries to slip `role: "admin"` into a PATCH request on
-- their own profile, this trigger silently reverts it back to the old value.
-- `auth.uid()` is only populated for requests that go through Supabase's
-- normal client auth (anon/authenticated JWT). It is NULL when the change is
-- made from the SQL Editor or with the service_role key — i.e. a trusted
-- server-side action — so that path is allowed through (this is how you'll
-- promote your own account to admin, see the setup instructions).
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_escalation on public.profiles;
create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

-- Auto-create a profile row (role = 'user') whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    'user'
  );
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. EVENTS
-- ============================================================================
create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  category          text not null default 'WORKSHOP',   -- WORKSHOP / HACKATHON / ON-SITE / ...
  topic             text not null default '',
  description       text not null default '',
  event_date        date,
  event_time        text default 'TBA',
  location          text default 'TBA',
  image_url         text,
  registration_url  text,
  capacity          integer,
  organizer         text default '',
  tags              text[] not null default '{}',
  status            text not null default 'upcoming' check (status in ('upcoming', 'past')),
  published         boolean not null default false,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_events_published_status on public.events (published, status, event_date);

alter table public.events enable row level security;

-- Everyone (including anonymous visitors) can read PUBLISHED events only
drop policy if exists "events_select_published" on public.events;
create policy "events_select_published"
  on public.events for select
  using (published = true);

-- Admins can read every event, including unpublished drafts
drop policy if exists "events_select_admin" on public.events;
create policy "events_select_admin"
  on public.events for select
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Only admins may create events
drop policy if exists "events_insert_admin" on public.events;
create policy "events_insert_admin"
  on public.events for insert
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Only admins may edit events
drop policy if exists "events_update_admin" on public.events;
create policy "events_update_admin"
  on public.events for update
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Only admins may delete events
drop policy if exists "events_delete_admin" on public.events;
create policy "events_delete_admin"
  on public.events for delete
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. SITE SETTINGS  (lightweight CMS: banner, home, about, more, footer copy)
-- ============================================================================
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_select_public" on public.site_settings;
create policy "site_settings_select_public"
  on public.site_settings for select
  using (true);

drop policy if exists "site_settings_write_admin" on public.site_settings;
create policy "site_settings_write_admin"
  on public.site_settings for all
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- Seed default copy so the site reads exactly like the original before any
-- admin edits. Safe to re-run — only inserts rows that don't exist yet.
insert into public.site_settings (key, value) values
  ('banner', '{"enabled": true, "text": "⚠️ SYSTEM STATUS: SITE UNDER CONSTRUCTION // Launching Soon"}'),
  ('home', '{"heading": "Building The Future", "intro": "We organize workshops, hackathons, and real-world tech events. Our main portal is currently being upgraded to bring you a better experience.", "cta_heading": "Stay Updated", "cta_text": "Get notified when we launch our next hackathon:"}'),
  ('about', '{"heading": "About Our Team", "paragraph1": "We are a collective of organizers, developers, and creators passionate about hosting high-impact technology events.", "paragraph2": "Our mission is to create hands-on learning experiences through competitive hackathons and collaborative workshops."}'),
  ('more', '{"sponsorship_text": "Want to partner with us for upcoming events? Reach out via email.", "volunteer_text": "Join our core team and help organize our next big hackathon."}'),
  ('footer', '{"text": "© 2026 DEV_LABS. All rights reserved. | Built in Monochrome."}')
on conflict (key) do nothing;

-- Seed the 3 original placeholder events as UNPUBLISHED drafts, so there's
-- something to see/publish immediately in the admin dashboard.
-- Only runs if the events table is currently empty (won't duplicate on re-run).
insert into public.events (title, category, topic, description, event_date, event_time, location, status, published)
select * from (values
  ('Web3 & AI Fundamentals', 'WORKSHOP', 'Web3 & AI Fundamentals', 'A hands-on introduction to building with Web3 and AI.', null::date, 'TBA', 'TBA', 'upcoming', false),
  ('48-Hour Open Source Sprint', 'HACKATHON', '48-Hour Open Source Sprint', 'A weekend hackathon focused on contributing to open source projects.', null::date, 'TBA', 'TBA', 'upcoming', false),
  ('Community Tech Meetup', 'ON-SITE', 'Community Tech Meetup', 'An in-person meetup for the local tech community.', null::date, 'TBA', 'TBA', 'upcoming', false)
) as seed(title, category, topic, description, event_date, event_time, location, status, published)
where not exists (select 1 from public.events);

-- ============================================================================
-- 4. PROMOTE YOUR OWN ACCOUNT TO ADMIN
-- ============================================================================
-- 1. Sign up normally through the Catalyst website first (creates your profile row).
-- 2. Then run this (with your real email) from the SQL Editor:
--
--    update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- This works because the SQL Editor runs outside the normal API/JWT flow, so
-- the escalation-guard trigger above does not block it. See "Admin setup" in
-- the project README for details.
-- ============================================================================
