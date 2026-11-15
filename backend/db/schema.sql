create extension if not exists vector;

create table if not exists documents (
    filename text primary key,
    length_chars integer not null,
    chunk_count integer not null,
    uploaded_at timestamptz not null default now(),
    user_id uuid,
    display_name text
);

create index if not exists documents_user_id_idx
    on documents (user_id);

create unique index if not exists documents_user_display_name_key
    on documents (user_id, display_name)
    where user_id is not null;

create table if not exists chunks (
    id bigserial primary key,
    filename text not null references documents(filename) on delete cascade,
    position integer not null,
    content text not null,
    start_char integer,
    end_char integer,
    embedding vector(384) not null,
    unique (filename, position)
);

alter table documents enable row level security;
alter table chunks enable row level security;

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
