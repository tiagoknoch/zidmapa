-- ZidMapa initial schema: reports, submissions, admins, photo storage.
-- Run once in the Supabase SQL editor (or `supabase db push`).

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

create policy "admins can see admins" on public.admins
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reports: one row per physical graffiti spot (public data only)
-- ---------------------------------------------------------------------------
create type public.report_status as enum ('reported', 'cleaned', 'hidden');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  location extensions.geography(Point, 4326) generated always as (
    extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
  ) stored,
  photo_path text not null,
  note text check (char_length(note) <= 500),
  status public.report_status not null default 'reported',
  confirm_count integer not null default 1,
  ai_labels jsonb, -- reserved for v3 (Gemini classification)
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  cleaned_at timestamptz
);

create index reports_location_idx on public.reports using gist (location);
create index reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

create policy "public can read visible reports" on public.reports
  for select to anon, authenticated
  using (status <> 'hidden' or public.is_admin());

create policy "admins can update reports" on public.reports
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "admins can delete reports" on public.reports
  for delete to authenticated
  using (public.is_admin());

-- Inserts only happen server-side with the secret key (bypasses RLS).

-- ---------------------------------------------------------------------------
-- Submissions: every individual report or "same one" confirmation.
-- Private (who / from where), used for rate limiting and moderation.
-- ---------------------------------------------------------------------------
create type public.submission_kind as enum ('new', 'confirm');

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  kind public.submission_kind not null,
  photo_path text,
  reporter_id uuid references auth.users (id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index submissions_report_idx on public.submissions (report_id);
create index submissions_ip_recent_idx on public.submissions (ip_hash, created_at desc);

alter table public.submissions enable row level security;

create policy "admins can read submissions" on public.submissions
  for select to authenticated using (public.is_admin());

-- A confirmation bumps the counter and re-opens a spot that was cleaned
-- but has been tagged again.
create or replace function public.on_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'confirm' then
    update public.reports
       set confirm_count = confirm_count + 1,
           last_seen_at = now(),
           status = case when status = 'cleaned' then 'reported'::public.report_status else status end,
           cleaned_at = case when status = 'cleaned' then null else cleaned_at end
     where id = new.report_id;
  end if;
  return new;
end;
$$;

create trigger submissions_confirm
  after insert on public.submissions
  for each row execute function public.on_confirmation();

-- ---------------------------------------------------------------------------
-- Nearby lookup used by the "is it one of these?" step
-- ---------------------------------------------------------------------------
create or replace function public.nearby_reports(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision default 25
)
returns table (
  id uuid,
  lat double precision,
  lng double precision,
  photo_path text,
  status public.report_status,
  confirm_count integer,
  created_at timestamptz,
  distance_m double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with here as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select r.id, r.lat, r.lng, r.photo_path, r.status, r.confirm_count, r.created_at,
         extensions.st_distance(r.location, here.g) as distance_m
    from public.reports r, here
   where r.status <> 'hidden'
     and extensions.st_dwithin(r.location, here.g, least(p_radius_m, 200))
   order by distance_m
   limit 10;
$$;
grant execute on function public.nearby_reports(double precision, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage (public read, uploads via server only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "admins can delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.is_admin());
