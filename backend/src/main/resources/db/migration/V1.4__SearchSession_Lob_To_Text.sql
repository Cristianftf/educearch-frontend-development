-- Prevent PostgreSQL large object reads for search session text fields.
-- Legacy schemas may keep these columns as OID when they were mapped as @Lob.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'search_sessions'
          AND column_name = 'filters_applied'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE search_sessions
            ALTER COLUMN filters_applied TYPE TEXT
            USING CASE
                WHEN filters_applied IS NULL THEN NULL
                ELSE convert_from(lo_get(filters_applied), 'UTF8')
            END;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'search_sessions'
          AND column_name = 'feedback'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE search_sessions
            ALTER COLUMN feedback TYPE TEXT
            USING CASE
                WHEN feedback IS NULL THEN NULL
                ELSE convert_from(lo_get(feedback), 'UTF8')
            END;
    END IF;
END $$;
