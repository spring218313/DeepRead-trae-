ALTER TABLE book_content
  ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', text)) STORED;

CREATE INDEX IF NOT EXISTS idx_book_content_tsv ON book_content USING GIN (tsv);
