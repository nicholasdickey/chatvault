-- pgvector must exist before any table migrations that use vector columns (Prompt3 non-negotiable).
CREATE EXTENSION IF NOT EXISTS vector;