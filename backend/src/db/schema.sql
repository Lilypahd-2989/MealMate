-- MealMate Database Schema
-- SQLite with JSON columns for flexible data

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  preferences TEXT DEFAULT '{}',  -- JSON: dietary prefs, pantry staples
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recipes (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  source_url        TEXT,
  source            TEXT,  -- 'bbc_good_food', 'allrecipes', 'bon_appetit', 'ah_allerhande', 'manual'
  image_url         TEXT,
  servings          INTEGER DEFAULT 4,
  prep_time_min     INTEGER,
  cook_time_min     INTEGER,
  total_time_min    INTEGER,
  cuisine           TEXT,
  tags              TEXT DEFAULT '[]',   -- JSON array
  ingredients       TEXT DEFAULT '[]',   -- JSON array of ingredient objects
  instructions      TEXT DEFAULT '[]',   -- JSON array of step strings
  nutrition         TEXT DEFAULT '{}',   -- JSON: per-serving macros
  leftover_friendly INTEGER DEFAULT 0,  -- boolean
  leftover_note     TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meal_plans (
  id          TEXT PRIMARY KEY,
  week_start  DATE NOT NULL UNIQUE,  -- Monday of the week, one plan per week
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS planned_meals (
  id          TEXT PRIMARY KEY,
  plan_id     TEXT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id   TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,  -- 'monday', 'tuesday', etc.
  meal_type   TEXT DEFAULT 'dinner',  -- 'dinner', 'lunch', 'breakfast'
  servings    INTEGER,  -- override recipe default
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id          TEXT PRIMARY KEY,
  plan_id     TEXT NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  items       TEXT DEFAULT '[]',  -- JSON: merged ingredient list with AH matches
  status      TEXT DEFAULT 'draft',  -- 'draft', 'reviewed', 'ordered'
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pantry_items (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_recipes_source ON recipes(source);
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX IF NOT EXISTS idx_planned_meals_plan ON planned_meals(plan_id);
CREATE INDEX IF NOT EXISTS idx_planned_meals_day ON planned_meals(day);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_plan ON shopping_lists(plan_id);

-- Default pantry staples
INSERT OR IGNORE INTO pantry_items (id, name) VALUES
  ('pantry-001', 'olive oil'),
  ('pantry-002', 'salt'),
  ('pantry-003', 'black pepper'),
  ('pantry-004', 'garlic'),
  ('pantry-005', 'onion'),
  ('pantry-006', 'butter'),
  ('pantry-007', 'vegetable oil'),
  ('pantry-008', 'soy sauce'),
  ('pantry-009', 'paprika'),
  ('pantry-010', 'cumin');

-- Default user
INSERT OR IGNORE INTO users (id, name, preferences) VALUES (
  'user-001',
  'Lee',
  '{"diet": "high-protein", "proteins": ["chicken", "fish"], "cooking_time_max": 45, "servings": 2, "gym_days": ["monday", "wednesday", "friday"]}'
);
