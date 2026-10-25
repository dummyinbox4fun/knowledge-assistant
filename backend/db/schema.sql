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
