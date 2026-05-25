-- Chat messaging schema

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY,
    sender_email VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    read_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_recipient_created
    ON chat_messages(sender_email, recipient_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient_read
    ON chat_messages(recipient_email, read_at);
