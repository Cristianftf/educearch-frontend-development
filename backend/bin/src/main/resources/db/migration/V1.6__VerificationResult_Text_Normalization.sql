-- Normalize verification_results text columns to avoid truncation and PostgreSQL large object issues.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'claim_text'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN claim_text TYPE TEXT
            USING CASE
                WHEN claim_text IS NULL THEN NULL
                ELSE convert_from(lo_get(claim_text), 'UTF8')
            END;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'claim_text'
          AND udt_name IN ('varchar', 'bpchar')
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN claim_text TYPE TEXT
            USING claim_text::TEXT;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'source_url'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN source_url TYPE TEXT
            USING CASE
                WHEN source_url IS NULL THEN NULL
                ELSE convert_from(lo_get(source_url), 'UTF8')
            END;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'source_url'
          AND udt_name IN ('varchar', 'bpchar')
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN source_url TYPE TEXT
            USING source_url::TEXT;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'supporting_evidence'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN supporting_evidence TYPE TEXT
            USING CASE
                WHEN supporting_evidence IS NULL THEN NULL
                ELSE convert_from(lo_get(supporting_evidence), 'UTF8')
            END;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'conflicting_evidence'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN conflicting_evidence TYPE TEXT
            USING CASE
                WHEN conflicting_evidence IS NULL THEN NULL
                ELSE convert_from(lo_get(conflicting_evidence), 'UTF8')
            END;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'gen_text'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN gen_text TYPE TEXT
            USING CASE
                WHEN gen_text IS NULL THEN NULL
                ELSE convert_from(lo_get(gen_text), 'UTF8')
            END;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'explanations'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN explanations TYPE TEXT
            USING CASE
                WHEN explanations IS NULL THEN NULL
                ELSE convert_from(lo_get(explanations), 'UTF8')
            END;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'verification_results'
          AND column_name = 'recommendations'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE verification_results
            ALTER COLUMN recommendations TYPE TEXT
            USING CASE
                WHEN recommendations IS NULL THEN NULL
                ELSE convert_from(lo_get(recommendations), 'UTF8')
            END;
    END IF;
END $$;
