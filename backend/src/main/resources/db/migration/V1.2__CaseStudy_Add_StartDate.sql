-- Add optional start date for case studies
ALTER TABLE case_studies
    ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
