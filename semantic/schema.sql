CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE user_profiles (
    user_id VARCHAR(50) PRIMARY KEY,
    summary_text TEXT NOT NULL,
    embedding VECTOR(384)
);