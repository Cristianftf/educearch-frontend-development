-- Align case study schema with JPA entity and fix data inconsistencies

-- Ensure core columns exist
ALTER TABLE case_studies
    ADD COLUMN IF NOT EXISTS status VARCHAR(50);

ALTER TABLE case_studies
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Backfill created_by from professor_id when available
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'case_studies'
          AND column_name = 'professor_id'
    ) THEN
        EXECUTE 'UPDATE case_studies SET created_by = professor_id::text WHERE created_by IS NULL';
    END IF;
END $$;

-- Normalize status/difficulty values
UPDATE case_studies
SET status = 'DRAFT'
WHERE status IS NULL OR status = '';

UPDATE case_studies
SET difficulty = 'NOVICE'
WHERE difficulty IS NULL OR difficulty = '';

UPDATE case_studies
SET status = UPPER(status)
WHERE status IS NOT NULL;

UPDATE case_studies
SET difficulty = UPPER(difficulty)
WHERE difficulty IS NOT NULL;

-- Ensure created_by has a value
UPDATE case_studies
SET created_by = 'system'
WHERE created_by IS NULL OR created_by = '';

ALTER TABLE case_studies
    ALTER COLUMN status SET DEFAULT 'DRAFT';

ALTER TABLE case_studies
    ALTER COLUMN created_by SET NOT NULL;

-- Case rubric table (element collection)
CREATE TABLE IF NOT EXISTS case_rubric (
    case_id UUID REFERENCES case_studies(id),
    rubric_data TEXT
);

ALTER TABLE case_rubric
    ALTER COLUMN rubric_data TYPE TEXT;

-- Guiding questions length
ALTER TABLE case_guiding_questions
    ALTER COLUMN question TYPE VARCHAR(1000);

-- Required articles column alignment
ALTER TABLE case_required_articles
    ADD COLUMN IF NOT EXISTS article_id VARCHAR(255);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'case_required_articles'
          AND column_name = 'required_pmids'
    ) THEN
        EXECUTE 'UPDATE case_required_articles SET article_id = required_pmids WHERE article_id IS NULL';
    END IF;
END $$;

-- Optional articles column alignment
ALTER TABLE case_optional_articles
    ADD COLUMN IF NOT EXISTS article_id VARCHAR(255);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'case_optional_articles'
          AND column_name = 'optional_pmids'
    ) THEN
        EXECUTE 'UPDATE case_optional_articles SET article_id = optional_pmids WHERE article_id IS NULL';
    END IF;
END $$;

-- Assigned students table
CREATE TABLE IF NOT EXISTS case_assigned_students (
    case_id UUID REFERENCES case_studies(id),
    student_id VARCHAR(255)
);
