-- Normalize legacy system_logs text columns and add AI error insight storage.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'system_logs'
          AND column_name = 'request_details'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE system_logs
            ALTER COLUMN request_details TYPE TEXT
            USING CASE
                WHEN request_details IS NULL THEN NULL
                ELSE convert_from(lo_get(request_details), 'UTF8')
            END;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'system_logs'
          AND column_name = 'request_details'
          AND udt_name IN ('varchar', 'bpchar')
    ) THEN
        ALTER TABLE system_logs
            ALTER COLUMN request_details TYPE TEXT
            USING request_details::TEXT;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'system_logs'
          AND column_name = 'response_details'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE system_logs
            ALTER COLUMN response_details TYPE TEXT
            USING CASE
                WHEN response_details IS NULL THEN NULL
                ELSE convert_from(lo_get(response_details), 'UTF8')
            END;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'system_logs'
          AND column_name = 'response_details'
          AND udt_name IN ('varchar', 'bpchar')
    ) THEN
        ALTER TABLE system_logs
            ALTER COLUMN response_details TYPE TEXT
            USING response_details::TEXT;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'system_logs'
          AND column_name = 'error_message'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE system_logs
            ALTER COLUMN error_message TYPE TEXT
            USING CASE
                WHEN error_message IS NULL THEN NULL
                ELSE convert_from(lo_get(error_message), 'UTF8')
            END;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'system_logs'
          AND column_name = 'error_message'
          AND udt_name IN ('varchar', 'bpchar')
    ) THEN
        ALTER TABLE system_logs
            ALTER COLUMN error_message TYPE TEXT
            USING error_message::TEXT;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'system_logs'
          AND column_name = 'stack_trace'
          AND udt_name = 'oid'
    ) THEN
        ALTER TABLE system_logs
            ALTER COLUMN stack_trace TYPE TEXT
            USING CASE
                WHEN stack_trace IS NULL THEN NULL
                ELSE convert_from(lo_get(stack_trace), 'UTF8')
            END;
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'system_logs'
          AND column_name = 'stack_trace'
          AND udt_name IN ('varchar', 'bpchar')
    ) THEN
        ALTER TABLE system_logs
            ALTER COLUMN stack_trace TYPE TEXT
            USING stack_trace::TEXT;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS system_error_insights (
    id VARCHAR(255) PRIMARY KEY,
    fingerprint VARCHAR(190) NOT NULL UNIQUE,
    endpoint VARCHAR(255),
    http_status INTEGER,
    severity VARCHAR(20),
    error_type VARCHAR(120),
    error_message TEXT,
    sample_stack_trace TEXT,
    ai_diagnosis TEXT,
    ai_recommendations TEXT,
    ai_confidence DOUBLE PRECISION,
    occurrences BIGINT NOT NULL,
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    last_analyzed_at TIMESTAMP,
    last_log_id VARCHAR(120),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_error_insights_last_seen ON system_error_insights(last_seen);
CREATE INDEX IF NOT EXISTS idx_error_insights_severity ON system_error_insights(severity);
CREATE UNIQUE INDEX IF NOT EXISTS idx_error_insights_fingerprint ON system_error_insights(fingerprint);
