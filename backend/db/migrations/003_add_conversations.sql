-- V4.1: chats and their messages, owned by a Supabase user.
-- Additive only: two new tables, nothing existing is changed, so older
-- app versions keep working against this schema.
-- Row-level security is on with no policies (same as documents/chunks):
-- the backend connects as `postgres` and filters every query by user_id.
-- Message timestamps use clock_timestamp() (not now()) so two messages saved
-- in the same transaction still sort in the order they were written.

create table if not exists conversations (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    title text not null default 'New chat',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
    on conversations (user_id, updated_at desc);

create table if not exists messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references conversations(id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    sources jsonb,
    status text not null default 'complete'
        check (status in ('complete', 'stopped', 'error')),
    created_at timestamptz not null default clock_timestamp()
);

create index if not exists messages_conversation_created_idx
    on messages (conversation_id, created_at);

alter table conversations enable row level security;
alter table messages enable row level security;
