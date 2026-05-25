-- Prevent PostgreSQL large object reads for bibliography text fields.
-- Legacy schemas may keep these columns as OID when they were mapped as @Lob.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'bibliographies'
          AND column_name = 'content'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE bibliographies
            ALTER COLUMN content TYPE TEXT
            USING CASE
                WHEN content IS NULL THEN NULL
                ELSE convert_from(lo_get(content), 'UTF8')
            END;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'bibliographies'
          AND column_name = 'article_ids'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE bibliographies
            ALTER COLUMN article_ids TYPE TEXT
            USING CASE
                WHEN article_ids IS NULL THEN NULL
                ELSE convert_from(lo_get(article_ids), 'UTF8')
            END;
    END IF;
END $$;
