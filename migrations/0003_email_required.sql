-- Sign-up now requires an email. Track whether it has been confirmed (addresses set through the
-- Settings verification flow were already confirmed).
ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
UPDATE users SET email_verified = 1 WHERE email IS NOT NULL;
