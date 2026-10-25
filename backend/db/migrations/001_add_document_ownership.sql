-- V3.3: per-user documents (#93).
--
-- Additive and safe to run while older versions of the app are still using
-- the same database: the new columns are nullable and the old `filename`
-- key is untouched, so old code keeps working exactly as before.
--
--   user_id       who owns the document (Supabase user id)
--   display_name  the name the user sees, e.g. "notes.md"
--
-- `filename` stays the globally unique key. For new documents it holds
-- "<user_id>:<display_name>", so two users can each have their own notes.md.
-- Documents created before V3.3 keep their plain filename as the key.

alter table documents add column if not exists user_id uuid;
alter table documents add column if not exists display_name text;

create index if not exists documents_user_id_idx
    on documents (user_id);

-- One display name per user (rows with no owner yet are exempt).
create unique index if not exists documents_user_display_name_key
    on documents (user_id, display_name)
    where user_id is not null;
