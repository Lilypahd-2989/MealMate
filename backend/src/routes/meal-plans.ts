import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getAllMealPlans,
  getMealPlanById,
  insertMealPlan,
  deleteMealPlan,
  getPlannedMealsForPlan,
  insertPlannedMeal,
  deletePlannedMeal,
  getPlannedMealByDayAndType,
  updatePlannedMealServings
} from '../db/db.js';
import { mergeIngredients } from '../services/ingredient-merge.js';

const router = Router();

/**
 * GET /api/meal-plans
 * List all weekly meal plans
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const plans = getAllMealPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    res.status(500).json({ error: 'Failed to fetch meal plans' });
  }
});

/**
 * POST /api/meal-plans
 * Create a new weekly plan
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { week_start } = req.body;
    if (!week_start) {
      res.status(400).json({ error: 'week_start is required (YYYY-MM-DD)' });
      return;
    }

    const id = uuidv4();
    const plan = insertMealPlan(id, week_start);
    res.status(201).json(plan);
  } catch (error) {
    console.error('Error creating meal plan:', error);
    res.status(500).json({ error: 'Failed to create meal plan' });
  }
});

/**
 * GET /api/meal-plans/:id
 * Get a specific plan, along with all its planned meals (recipes)
 * and generate a fresh merged grocery list automatically.
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const planId = req.params.id as string;
    const plan = getMealPlanById(planId);
    if (!plan) {
      res.status(404).json({ error: 'Meal plan not found' });
      return;
    }

    const plannedMeals = getPlannedMealsForPlan(planId);
    const groceryList = mergeIngredients(plannedMeals);

    // Reparse the recipe JSON fields of the joined recipes.
    const mealsWithParsedRecipes = plannedMeals.map(pm => {
      const parsedRecipe = {
        ...pm.recipe,
        tags: JSON.parse(pm.recipe.tags),
        ingredients: JSON.parse(pm.recipe.ingredients),
        instructions: JSON.parse(pm.recipe.instructions),
        nutrition: JSON.parse(pm.recipe.nutrition),
        leftover_friendly: Boolean(pm.recipe.leftover_friendly),
      };
      return { ...pm, recipe: parsedRecipe };
    });

    res.json({
      ...plan,
      meals: mealsWithParsedRecipes,
      generated_grocery_list: groceryList
    });
  } catch (error) {
    console.error('Error fetching meal plan details:', error);
    res.status(500).json({ error: 'Failed to fetch meal plan details' });
  }
});

/**
 * DELETE /api/meal-plans/:id
 * Delete an entire meal plan
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteMealPlan(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: 'Meal plan not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    res.status(500).json({ error: 'Failed to delete meal plan' });
  }
});

/**
 * POST /api/meal-plans/:id/meals
 * Assign a recipe to a specific day slot in this meal plan
 */
router.post('/:id/meals', (req: Request, res: Response) => {
  try {
    const planId = req.params.id as string;
    const { recipe_id, day, meal_type, servings } = req.body;
    
    if (!recipe_id || !day) {
      res.status(400).json({ error: 'recipe_id and day are required' });
      return;
    }

    // Optional constraint checking - see if one exists?
    const type = meal_type || 'dinner';
    const existing = getPlannedMealByDayAndType(planId, day, type);
    if (existing) {
        // Technically, you might want to overwrite or allow multiples.
        // We will just let them add multiples for now.
    }

    const id = uuidv4();
    const plannedMeal = insertPlannedMeal({
      id,
      plan_id: planId,
      recipe_id,
      day,
      meal_type: type,
      servings: servings || null
    });

    res.status(201).json(plannedMeal);
  } catch (error) {
    console.error('Error adding meal to plan:', error);
    res.status(500).json({ error: 'Failed to add meal to plan' });
  }
});

/**
 * DELETE /api/meal-plans/:id/meals/:mealId
 * Remove a planned meal from a slot
 */
router.delete('/:id/meals/:mealId', (req: Request, res: Response) => {
  try {
    const deleted = deletePlannedMeal(req.params.mealId as string);
    if (!deleted) {
      res.status(404).json({ error: 'Planned meal not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing meal from plan:', error);
    res.status(500).json({ error: 'Failed to remove meal from plan' });
  }
});

/**
 * PATCH /api/meal-plans/:id/meals/:mealId
 * Update serving size of a planned meal
 */
router.patch('/:id/meals/:mealId', (req: Request, res: Response) => {
  try {
    const { servings } = req.body;
    const updated = updatePlannedMealServings(req.params.mealId as string, servings);
    if (!updated) {
      res.status(404).json({ error: 'Planned meal not found' });
      return;
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating meal servings:', error);
    res.status(500).json({ error: 'Failed to update meal servings' });
  }
});

export default router;
