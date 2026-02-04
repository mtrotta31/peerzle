-- Migration 007: Password Reset Tokens
-- Adds support for password reset / forgot password flow

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

COMMENT ON TABLE password_reset_tokens IS 'Stores password reset tokens for the forgot password flow';
COMMENT ON COLUMN password_reset_tokens.token IS 'Secure random token sent via email';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Token expiration time (1 hour from creation)';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Timestamp when token was used to reset password';
