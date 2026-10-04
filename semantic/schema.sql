CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    summary_text TEXT NOT NULL,
    embedding VECTOR(384)
);
