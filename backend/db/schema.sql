create extension if not exists vector;

create table if not exists documents (
    filename text primary key,
    length_chars integer not null,
    chunk_count integer not null,
    uploaded_at timestamptz not null default now()
);

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