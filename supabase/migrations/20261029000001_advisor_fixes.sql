-- Fixes from the Supabase advisors after the initial schema.

-- on_confirmation() only runs as a trigger; don't expose it at /rest/v1/rpc.
revoke execute on function public.on_confirmation() from public, anon, authenticated;

-- Covers the reporter_id foreign key (used when an auth user is deleted).
create index submissions_reporter_idx on public.submissions (reporter_id);
