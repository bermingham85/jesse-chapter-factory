CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  series_order INTEGER NOT NULL,
  status TEXT DEFAULT 'planning',
  total_chapters INTEGER,
  summary TEXT,
  tone_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  species TEXT,
  role TEXT,
  family_role TEXT,
  personality TEXT,
  speech_pattern TEXT,
  quirks TEXT,
  voice_id TEXT,
  voice_settings TEXT,
  books TEXT DEFAULT 'all',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id),
  chapter_number INTEGER NOT NULL,
  title TEXT,
  part INTEGER,
  act TEXT,
  status TEXT DEFAULT 'outlined',
  planning_locked INTEGER DEFAULT 0,
  content_locked INTEGER DEFAULT 0,
  final_locked INTEGER DEFAULT 0,
  summary TEXT,
  key_events TEXT,
  characters_present TEXT,
  location TEXT,
  word_count INTEGER DEFAULT 0,
  prose TEXT,
  source TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(book_id, chapter_number)
);

CREATE TABLE canon_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  fact TEXT NOT NULL,
  source_chapter TEXT,
  confidence TEXT DEFAULT 'high',
  book_id INTEGER REFERENCES books(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER REFERENCES books(id),
  chapter_id INTEGER REFERENCES chapters(id),
  session_type TEXT,
  input_context_hash TEXT,
  output_summary TEXT,
  decisions_made TEXT,
  issues_found TEXT,
  next_steps TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE production_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  layer INTEGER NOT NULL,
  layer_name TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
