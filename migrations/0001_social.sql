-- Accounts and community features. Apply with:
--   npx wrangler d1 migrations apply animegng --remote

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  avatar TEXT,
  password_hash TEXT,              -- PBKDF2-SHA256, base64; null for OAuth-only accounts
  password_salt TEXT,
  google_id TEXT UNIQUE,
  discord_id TEXT UNIQUE,
  is_admin INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,             -- SHA-256 of the cookie token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- Continue watching, synced across devices. `anime` is the card JSON shown in the UI.
CREATE TABLE history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  episode_title TEXT,
  thumbnail TEXT,
  anime TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  duration INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, anime_id)
);
CREATE INDEX history_recent ON history(user_id, updated_at DESC);

CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX playlists_user ON playlists(user_id);

CREATE TABLE playlist_items (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  anime TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, anime_id)
);

CREATE TABLE subscriptions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  anime TEXT NOT NULL,
  last_notified_episode INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, anime_id)
);
CREATE INDEX subscriptions_anime ON subscriptions(anime_id);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,              -- 'episode' | 'reply'
  payload TEXT NOT NULL,           -- JSON
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX notifications_user ON notifications(user_id, created_at DESC);

-- Episode comments. `ts` (seconds into the episode) marks a live comment shown over the video.
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  anime_id INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT,
  body TEXT NOT NULL,
  spoiler INTEGER NOT NULL DEFAULT 0,
  ts REAL,
  likes INTEGER NOT NULL DEFAULT 0,
  dislikes INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_thread ON comments(anime_id, episode, parent_id, created_at DESC);
CREATE INDEX comments_live ON comments(anime_id, episode, ts) WHERE ts IS NOT NULL;
CREATE INDEX comments_user ON comments(user_id, created_at DESC);

-- One vote per user per target. target_type: 'episode' (target_id = "<anime>:<ep>") or 'comment'.
CREATE TABLE votes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  value INTEGER NOT NULL,          -- 1 like, -1 dislike
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE episode_stats (
  anime_id INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  dislikes INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (anime_id, episode)
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (comment_id, user_id)
);
