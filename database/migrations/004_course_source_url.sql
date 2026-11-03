-- Preserve a verifiable official source for each catalog record.
ALTER TABLE courses ADD COLUMN source_url TEXT;
ALTER TABLE courses ADD CONSTRAINT courses_source_url_https_check
    CHECK (source_url IS NULL OR source_url ~ '^https://');
