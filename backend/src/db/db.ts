import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/mealmate.db');
    const dbDir = path.dirname(dbPath);

    // Ensure data directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);

    console.log('✅ Database initialized at:', dbPath);
  }

  return db;
}

// ------ Recipe Queries ------

export interface RecipeRow {
  id: string;
  title: string;
  source_url: string | null;
  source: string | null;
  image_url: string | null;
  servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  total_time_min: number | null;
  cuisine: string | null;
  tags: string;
  ingredients: string;
  instructions: string;
  nutrition: string;
  leftover_friendly: number;
  leftover_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipeFilters {
  search?: string;
  cuisine?: string;
  maxTime?: number;
  tags?: string[];
  source?: string;
}

export function getAllRecipes(filters: RecipeFilters = {}): RecipeRow[] {
  const db = getDb();
  let query = 'SELECT * FROM recipes WHERE 1=1';
  const params: any[] = [];

  if (filters.search) {
    query += ' AND (title LIKE ? OR cuisine LIKE ?)';
    const searchTerm = `%${filters.search}%`;
    params.push(searchTerm, searchTerm);
  }

  if (filters.cuisine) {
    query += ' AND cuisine = ?';
    params.push(filters.cuisine);
  }

  if (filters.maxTime) {
    query += ' AND total_time_min <= ?';
    params.push(filters.maxTime);
  }

  if (filters.source) {
    query += ' AND source = ?';
    params.push(filters.source);
  }

  if (filters.tags && filters.tags.length > 0) {
    for (const tag of filters.tags) {
      query += ' AND tags LIKE ?';
      params.push(`%"${tag}"%`);
    }
  }

  query += ' ORDER BY created_at DESC';

  return db.prepare(query).all(...params) as RecipeRow[];
}

export function getRecipeById(id: string): RecipeRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as RecipeRow | undefined;
}

export function insertRecipe(recipe: Omit<RecipeRow, 'created_at' | 'updated_at'>): RecipeRow {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO recipes (id, title, source_url, source, image_url, servings, prep_time_min, cook_time_min, total_time_min, cuisine, tags, ingredients, instructions, nutrition, leftover_friendly, leftover_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    recipe.id,
    recipe.title,
    recipe.source_url,
    recipe.source,
    recipe.image_url,
    recipe.servings,
    recipe.prep_time_min,
    recipe.cook_time_min,
    recipe.total_time_min,
    recipe.cuisine,
    recipe.tags,
    recipe.ingredients,
    recipe.instructions,
    recipe.nutrition,
    recipe.leftover_friendly,
    recipe.leftover_note
  );

  return getRecipeById(recipe.id) as RecipeRow;
}

export function updateRecipe(id: string, updates: Partial<RecipeRow>): RecipeRow | undefined {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id' && key !== 'created_at') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0) return getRecipeById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.prepare(`UPDATE recipes SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getRecipeById(id);
}

export function deleteRecipe(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  return result.changes > 0;
}

// ------ Pantry Queries ------

export function getPantryItems(): Array<{ id: string; name: string }> {
  const db = getDb();
  return db.prepare('SELECT * FROM pantry_items ORDER BY name').all() as Array<{ id: string; name: string }>;
}

export function getDistinctCuisines(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT cuisine FROM recipes WHERE cuisine IS NOT NULL ORDER BY cuisine').all() as Array<{ cuisine: string }>;
  return rows.map(r => r.cuisine);
}

export function getRecipeCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM recipes').get() as { count: number };
  return row.count;
}

// ------ Meal Plan Queries ------

export interface MealPlanRow {
  id: string;
  week_start: string;
  created_at: string;
}

export interface PlannedMealRow {
  id: string;
  plan_id: string;
  recipe_id: string;
  day: string;
  meal_type: string;
  servings: number | null;
  created_at: string;
}

/** All meal plans, newest first */
export function getAllMealPlans(): MealPlanRow[] {
  const db = getDb();
  return db.prepare('SELECT * FROM meal_plans ORDER BY week_start DESC').all() as MealPlanRow[];
}

/** Single meal plan by id */
export function getMealPlanById(id: string): MealPlanRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(id) as MealPlanRow | undefined;
}

/**
 * Get all planned meals for a plan, with the full recipe row joined.
 * Returns a flat row with recipe fields prefixed as r_*.
 */
export function getPlannedMealsForPlan(planId: string): Array<PlannedMealRow & { recipe: RecipeRow }> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      pm.id, pm.plan_id, pm.recipe_id, pm.day, pm.meal_type, pm.servings, pm.created_at,
      r.id            AS r_id,
      r.title         AS r_title,
      r.image_url     AS r_image_url,
      r.servings      AS r_servings,
      r.prep_time_min AS r_prep_time_min,
      r.cook_time_min AS r_cook_time_min,
      r.total_time_min AS r_total_time_min,
      r.cuisine       AS r_cuisine,
      r.tags          AS r_tags,
      r.ingredients   AS r_ingredients,
      r.instructions  AS r_instructions,
      r.nutrition     AS r_nutrition,
      r.leftover_friendly AS r_leftover_friendly,
      r.leftover_note AS r_leftover_note
    FROM planned_meals pm
    JOIN recipes r ON r.id = pm.recipe_id
    WHERE pm.plan_id = ?
    ORDER BY pm.day, pm.meal_type
  `).all(planId) as any[];

  return rows.map(row => ({
    id: row.id,
    plan_id: row.plan_id,
    recipe_id: row.recipe_id,
    day: row.day,
    meal_type: row.meal_type,
    servings: row.servings,
    created_at: row.created_at,
    recipe: {
      id: row.r_id,
      title: row.r_title,
      source_url: null,
      source: null,
      image_url: row.r_image_url,
      servings: row.r_servings,
      prep_time_min: row.r_prep_time_min,
      cook_time_min: row.r_cook_time_min,
      total_time_min: row.r_total_time_min,
      cuisine: row.r_cuisine,
      tags: row.r_tags,
      ingredients: row.r_ingredients,
      instructions: row.r_instructions,
      nutrition: row.r_nutrition,
      leftover_friendly: row.r_leftover_friendly,
      leftover_note: row.r_leftover_note,
      created_at: '',
      updated_at: '',
    } as RecipeRow,
  }));
}

export function insertMealPlan(id: string, weekStart: string): MealPlanRow {
  const db = getDb();
  db.prepare('INSERT INTO meal_plans (id, week_start) VALUES (?, ?)').run(id, weekStart);
  return getMealPlanById(id) as MealPlanRow;
}

export function deleteMealPlan(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM meal_plans WHERE id = ?').run(id);
  return result.changes > 0;
}

export function insertPlannedMeal(meal: Omit<PlannedMealRow, 'created_at'>): PlannedMealRow {
  const db = getDb();
  db.prepare(`
    INSERT INTO planned_meals (id, plan_id, recipe_id, day, meal_type, servings)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(meal.id, meal.plan_id, meal.recipe_id, meal.day, meal.meal_type, meal.servings ?? null);

  return db.prepare('SELECT * FROM planned_meals WHERE id = ?').get(meal.id) as PlannedMealRow;
}

export function deletePlannedMeal(mealId: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM planned_meals WHERE id = ?').run(mealId);
  return result.changes > 0;
}

export function updatePlannedMealServings(mealId: string, servings: number | null): PlannedMealRow | undefined {
  const db = getDb();
  db.prepare('UPDATE planned_meals SET servings = ? WHERE id = ?').run(servings, mealId);
  return db.prepare('SELECT * FROM planned_meals WHERE id = ?').get(mealId) as PlannedMealRow | undefined;
}

/** Check whether a recipe is already assigned to a day in this plan */
export function getPlannedMealByDayAndType(planId: string, day: string, mealType: string): PlannedMealRow | undefined {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM planned_meals WHERE plan_id = ? AND day = ? AND meal_type = ?'
  ).get(planId, day, mealType) as PlannedMealRow | undefined;
}
