-- Supabase publishes everything in the public schema through its REST API,
-- reachable with the public (publishable) key. Enable row-level security with
-- NO policies so that API denies everything. The backend connects as the
-- postgres role, which bypasses RLS, so it is unaffected.
alter table documents enable row level security;
alter table chunks enable row level security;
