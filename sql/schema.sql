-- ============================================================================
-- CATALYST — Supabase database schema
-- ============================================================================
-- RERUNNABLE / IDEMPOTENT SETUP
-- Run this entire file in Supabase Dashboard → SQL Editor.
--
-- This version safely recreates the policies/functions/triggers that belong to
-- Catalyst, adds missing columns when possible, avoids recursive profile RLS,
-- and seeds the global theme configuration used by the public site.
--
-- Theme rules:
--   * mode = 'monochrome' -> visitors may switch between black and white.
--   * mode = 'custom'      -> the admin-selected colors are fixed for visitors.
--   * Only admins may change the theme configuration.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text not null,
  role        text not null default 'user',
  created_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles add column if not exists created_at timestamptz not null default now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not public.is_admin() then
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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'user'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;
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
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'WORKSHOP',
  topic text not null default '',
  description text not null default '',
  event_date date,
  event_time text default 'TBA',
  location text default 'TBA',
  image_url text,
  registration_url text,
  capacity integer,
  organizer text default '',
  tags text[] not null default '{}',
  status text not null default 'upcoming',
  published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events add column if not exists title text not null default '';
alter table public.events add column if not exists category text not null default 'WORKSHOP';
alter table public.events add column if not exists topic text not null default '';
alter table public.events add column if not exists description text not null default '';
alter table public.events add column if not exists event_date date;
alter table public.events add column if not exists event_time text default 'TBA';
alter table public.events add column if not exists location text default 'TBA';
alter table public.events add column if not exists image_url text;
alter table public.events add column if not exists registration_url text;
alter table public.events add column if not exists capacity integer;
alter table public.events add column if not exists organizer text default '';
alter table public.events add column if not exists tags text[] not null default '{}';
alter table public.events add column if not exists status text not null default 'upcoming';
alter table public.events add column if not exists published boolean not null default false;
alter table public.events add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.events add column if not exists created_at timestamptz not null default now();
alter table public.events add column if not exists updated_at timestamptz not null default now();

alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check check (status in ('upcoming', 'past'));
create index if not exists idx_events_published_status on public.events (published, status, event_date);
alter table public.events enable row level security;

drop policy if exists "events_select_published" on public.events;
drop policy if exists "events_select_admin" on public.events;
drop policy if exists "events_insert_admin" on public.events;
drop policy if exists "events_update_admin" on public.events;
drop policy if exists "events_delete_admin" on public.events;

create policy "events_select_published" on public.events for select using (published = true);
create policy "events_select_admin" on public.events for select using (public.is_admin());
create policy "events_insert_admin" on public.events for insert with check (public.is_admin());
create policy "events_update_admin" on public.events for update using (public.is_admin()) with check (public.is_admin());
create policy "events_delete_admin" on public.events for delete using (public.is_admin());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at before update on public.events for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. SITE SETTINGS / CMS
-- ============================================================================
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings add column if not exists value jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();
alter table public.site_settings enable row level security;

drop policy if exists "site_settings_select_public" on public.site_settings;
drop policy if exists "site_settings_write_admin" on public.site_settings;
create policy "site_settings_select_public" on public.site_settings for select using (true);
create policy "site_settings_write_admin" on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists trg_site_settings_updated_at on public.site_settings;
create trigger trg_site_settings_updated_at before update on public.site_settings for each row execute function public.set_updated_at();

insert into public.site_settings (key, value) values
  ('banner', '{"enabled": true, "text": "⚠️ SYSTEM STATUS: SITE UNDER CONSTRUCTION // Launching Soon"}'),
  ('home', '{"heading": "Building The Future", "intro": "We organize workshops, hackathons, and real-world tech events. Our main portal is currently being upgraded to bring you a better experience.", "cta_heading": "Stay Updated", "cta_text": "Get notified when we launch our next hackathon:"}'),
  ('about', '{"heading": "About Our Team", "paragraph1": "We are a collective of organizers, developers, and creators passionate about hosting high-impact technology events.", "paragraph2": "Our mission is to create hands-on learning experiences through competitive hackathons and collaborative workshops."}'),
  ('more', '{"sponsorship_text": "Want to partner with us for upcoming events? Reach out via email.", "volunteer_text": "Join our core team and help organize our next big hackathon."}'),
  ('footer', '{"text": "© 2026 DEV_LABS. All rights reserved. | Built in Monochrome."}'),
  ('theme', '{"mode": "monochrome", "allow_user_toggle": true, "colors": {"dark": {"bg": "#000000", "text": "#ffffff", "border": "#333333", "accent": "#ffffff", "hover": "#222222", "card": "#111111"}, "light": {"bg": "#ffffff", "text": "#000000", "border": "#e0e0e0", "accent": "#000000", "hover": "#f0f0f0", "card": "#f9f9f9"}}}')
on conflict (key) do nothing;

insert into public.events (title, category, topic, description, event_date, event_time, location, status, published)
select * from (values
  ('Web3 & AI Fundamentals', 'WORKSHOP', 'Web3 & AI Fundamentals', 'A hands-on introduction to building with Web3 and AI.', null::date, 'TBA', 'TBA', 'upcoming', false),
  ('48-Hour Open Source Sprint', 'HACKATHON', '48-Hour Open Source Sprint', 'A weekend hackathon focused on contributing to open source projects.', null::date, 'TBA', 'TBA', 'upcoming', false),
  ('Community Tech Meetup', 'ON-SITE', 'Community Tech Meetup', 'An in-person meetup for the local tech community.', null::date, 'TBA', 'TBA', 'upcoming', false)
) as seed(title, category, topic, description, event_date, event_time, location, status, published)
where not exists (select 1 from public.events);

-- Admin promotion (run separately after signup):
-- update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================
