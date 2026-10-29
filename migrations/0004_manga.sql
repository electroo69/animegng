-- MangaGang (/manga): continue reading, plus the Saved and Reading list shelves. Series and chapter ids are
-- WeebCentral's 26-character ids; `series` is a small JSON card ({ id, title, cover, slug }) so lists render
-- without another lookup.
CREATE TABLE manga_history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id TEXT NOT NULL,
  series TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  chapter_name TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, series_id)
);

CREATE TABLE manga_library (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list TEXT NOT NULL CHECK (list IN ('saved', 'plan')),
  series_id TEXT NOT NULL,
  series TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, list, series_id)
);
