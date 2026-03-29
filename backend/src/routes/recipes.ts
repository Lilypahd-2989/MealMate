import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllRecipes,
  getRecipeById,
  insertRecipe,
  updateRecipe,
  deleteRecipe,
  getDistinctCuisines,
  getRecipeCount,
  type RecipeFilters,
} from '../db/db.js';
import { scrapeRecipeFromUrl } from '../scrapers/base.js';

const router = Router();

/** Decode HTML entities in a string (handles &amp; &lt; &gt; &quot; &#39;) */
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Split comma-blob tags and decode HTML entities (fixes legacy DB data) */
function parseTags(raw: string): string[] {
  const arr: string[] = JSON.parse(raw);
  return arr
    .flatMap(t => t.includes(',') ? t.split(',').map(s => s.trim()) : [t])
    .map(decodeHtml)
    .filter(Boolean);
}

/**
 * GET /api/recipes
 * List all recipes with optional filters
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const filters: RecipeFilters = {};

    if (req.query.search) filters.search = String(req.query.search);
    if (req.query.cuisine) filters.cuisine = String(req.query.cuisine);
    if (req.query.maxTime) filters.maxTime = parseInt(String(req.query.maxTime), 10);
    if (req.query.source) filters.source = String(req.query.source);
    if (req.query.tags) {
      filters.tags = String(req.query.tags).split(',');
    }

    const recipes = getAllRecipes(filters);

    // Parse JSON fields for the response
    const parsed = recipes.map(r => ({
      ...r,
      tags: parseTags(r.tags),
      ingredients: JSON.parse(r.ingredients),
      instructions: JSON.parse(r.instructions),
      nutrition: JSON.parse(r.nutrition),
      leftover_friendly: Boolean(r.leftover_friendly),
    }));

    res.json({ recipes: parsed, total: parsed.length });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

/**
 * GET /api/recipes/meta
 * Get metadata (cuisines, count)
 */
router.get('/meta', (_req: Request, res: Response) => {
  try {
    const cuisines = getDistinctCuisines();
    const count = getRecipeCount();
    res.json({ cuisines, count });
  } catch (error) {
    console.error('Error fetching meta:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
});

/**
 * GET /api/recipes/:id
 * Get a single recipe
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const recipe = getRecipeById(req.params.id as string);
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    res.json({
      ...recipe,
      tags: JSON.parse(recipe.tags),
      ingredients: JSON.parse(recipe.ingredients),
      instructions: JSON.parse(recipe.instructions),
      nutrition: JSON.parse(recipe.nutrition),
      leftover_friendly: Boolean(recipe.leftover_friendly),
    });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

/**
 * POST /api/recipes/import
 * Import a recipe by scraping a URL
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    console.log(`🔍 Scraping recipe from: ${url}`);
    const scraped = await scrapeRecipeFromUrl(url);
    console.log(`🖼️  image_url after scrape: ${scraped.image_url}`);

    const id = uuidv4();
    const recipe = insertRecipe({
      id,
      title: scraped.title,
      source_url: scraped.source_url,
      source: scraped.source,
      image_url: scraped.image_url,
      servings: scraped.servings,
      prep_time_min: scraped.prep_time_min,
      cook_time_min: scraped.cook_time_min,
      total_time_min: scraped.total_time_min,
      cuisine: scraped.cuisine,
      tags: JSON.stringify(scraped.tags),
      ingredients: JSON.stringify(scraped.ingredients),
      instructions: JSON.stringify(scraped.instructions),
      nutrition: JSON.stringify(scraped.nutrition),
      leftover_friendly: scraped.leftover_friendly ? 1 : 0,
      leftover_note: scraped.leftover_note,
    });

    res.status(201).json({
      ...recipe,
      tags: JSON.parse(recipe.tags),
      ingredients: JSON.parse(recipe.ingredients),
      instructions: JSON.parse(recipe.instructions),
      nutrition: JSON.parse(recipe.nutrition),
      leftover_friendly: Boolean(recipe.leftover_friendly),
    });
  } catch (error: any) {
    console.error('Error importing recipe:', error);
    res.status(500).json({ error: `Failed to import recipe: ${error.message}` });
  }
});

/**
 * POST /api/recipes
 * Create a recipe manually
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const id = uuidv4();
    const recipe = insertRecipe({
      id,
      title: req.body.title || 'Untitled Recipe',
      source_url: req.body.source_url || null,
      source: req.body.source || 'manual',
      image_url: req.body.image_url || null,
      servings: req.body.servings || 4,
      prep_time_min: req.body.prep_time_min || null,
      cook_time_min: req.body.cook_time_min || null,
      total_time_min: req.body.total_time_min || null,
      cuisine: req.body.cuisine || null,
      tags: JSON.stringify(req.body.tags || []),
      ingredients: JSON.stringify(req.body.ingredients || []),
      instructions: JSON.stringify(req.body.instructions || []),
      nutrition: JSON.stringify(req.body.nutrition || {}),
      leftover_friendly: req.body.leftover_friendly ? 1 : 0,
      leftover_note: req.body.leftover_note || null,
    });

    res.status(201).json({
      ...recipe,
      tags: JSON.parse(recipe.tags),
      ingredients: JSON.parse(recipe.ingredients),
      instructions: JSON.parse(recipe.instructions),
      nutrition: JSON.parse(recipe.nutrition),
      leftover_friendly: Boolean(recipe.leftover_friendly),
    });
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

/**
 * PUT /api/recipes/:id
 * Update a recipe
 */
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = getRecipeById(req.params.id as string);
    if (!existing) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    const updates: any = {};
    const fields = ['title', 'source_url', 'source', 'image_url', 'servings', 'prep_time_min', 'cook_time_min', 'total_time_min', 'cuisine', 'leftover_note'];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Handle JSON fields
    if (req.body.tags !== undefined) updates.tags = JSON.stringify(req.body.tags);
    if (req.body.ingredients !== undefined) updates.ingredients = JSON.stringify(req.body.ingredients);
    if (req.body.instructions !== undefined) updates.instructions = JSON.stringify(req.body.instructions);
    if (req.body.nutrition !== undefined) updates.nutrition = JSON.stringify(req.body.nutrition);
    if (req.body.leftover_friendly !== undefined) updates.leftover_friendly = req.body.leftover_friendly ? 1 : 0;

    const recipe = updateRecipe(req.params.id as string, updates);
    if (!recipe) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    res.json({
      ...recipe,
      tags: JSON.parse(recipe.tags),
      ingredients: JSON.parse(recipe.ingredients),
      instructions: JSON.parse(recipe.instructions),
      nutrition: JSON.parse(recipe.nutrition),
      leftover_friendly: Boolean(recipe.leftover_friendly),
    });
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

/**
 * DELETE /api/recipes/:id
 * Delete a recipe
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteRecipe(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

export default router;
