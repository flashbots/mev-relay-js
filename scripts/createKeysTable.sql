CREATE TABLE miner_keys (
    id bigserial primary key,
    key text,
    inserted_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

CREATE index miners_key_idx ON miner_keys(key);

CREATE index miners_inserted_at_idx ON miner_keys(inserted_at);

CREATE index miners_updated_at_idx ON miner_keys(updated_at);
