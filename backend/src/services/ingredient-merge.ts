import { PlannedMealRow, RecipeRow } from '../db/db.js';

export interface MergedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  category: string | null;
  ah_search_term: string | null;
  raw_items: string[];
}

// Unit normalization maps
// We convert everything to a base unit for addition, then format it nicely
const UNIT_TO_BASE: Record<string, { base: string; multiplier: number }> = {
  // Mass
  'g': { base: 'g', multiplier: 1 },
  'kg': { base: 'g', multiplier: 1000 },
  'gram': { base: 'g', multiplier: 1 },
  'grams': { base: 'g', multiplier: 1 },
  'kilogram': { base: 'g', multiplier: 1000 },
  'kilograms': { base: 'g', multiplier: 1000 },
  'mg': { base: 'g', multiplier: 0.001 },
  'oz': { base: 'g', multiplier: 28.3495 },
  'lb': { base: 'g', multiplier: 453.592 },
  'pound': { base: 'g', multiplier: 453.592 },
  'pounds': { base: 'g', multiplier: 453.592 },
  
  // Volume
  'ml': { base: 'ml', multiplier: 1 },
  'l': { base: 'ml', multiplier: 1000 },
  'liter': { base: 'ml', multiplier: 1000 },
  'liters': { base: 'ml', multiplier: 1000 },
  'litre': { base: 'ml', multiplier: 1000 },
  'litres': { base: 'ml', multiplier: 1000 },
  'tsp': { base: 'ml', multiplier: 5 },
  'teaspoon': { base: 'ml', multiplier: 5 },
  'teaspoons': { base: 'ml', multiplier: 5 },
  'tbsp': { base: 'ml', multiplier: 15 },
  'tablespoon': { base: 'ml', multiplier: 15 },
  'tablespoons': { base: 'ml', multiplier: 15 },
  'cup': { base: 'ml', multiplier: 240 },
  'cups': { base: 'ml', multiplier: 240 },
  'fl oz': { base: 'ml', multiplier: 29.5735 },
  'pint': { base: 'ml', multiplier: 473.176 },
};

function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;
  const lowerUnit = unit.toLowerCase().trim();
  // Return the base unit class (e.g. return 'g' for 'kg', 'lb', 'oz')
  return UNIT_TO_BASE[lowerUnit] ? UNIT_TO_BASE[lowerUnit].base : lowerUnit;
}

function convertToBaseAmount(amount: number, unit: string | null): number {
  if (!unit) return amount;
  const lowerUnit = unit.toLowerCase().trim();
  const conversion = UNIT_TO_BASE[lowerUnit];
  return conversion ? amount * conversion.multiplier : amount;
}

function formatAmountAndUnit(baseAmount: number, baseUnit: string | null): { amount: number; unit: string | null } {
  if (!baseUnit) return { amount: Number(baseAmount.toFixed(2)), unit: null };

  if (baseUnit === 'g' && baseAmount >= 1000) {
    return { amount: Number((baseAmount / 1000).toFixed(2)), unit: 'kg' };
  }
  
  if (baseUnit === 'ml' && baseAmount >= 1000) {
    return { amount: Number((baseAmount / 1000).toFixed(2)), unit: 'l' };
  }

  // Round to max 2 decimal places to avoid floating point weirdness
  return { amount: Number(baseAmount.toFixed(2)), unit: baseUnit };
}

// Function to normalize ingredient names to catch slight variations
function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();
  
  // Remove common descriptive adjectives and preparation instructions
  const adjectivesToRemove = [
    'fresh', 'chopped', 'diced', 'sliced', 'peeled', 'minced', 'grated', 
    'crushed', 'organic', 'raw', 'cooked', 'dried', 'ground', 'finely',
    'roughly', 'thinly', 'thickly', 'leaves', 'bunch'
  ];
  
  for (const adj of adjectivesToRemove) {
    const regex = new RegExp(`\\b${adj}\\b`, 'g');
    n = n.replace(regex, '');
  }
  
  // Clean up extra spaces left by replacements
  n = n.replace(/\s+/g, ' ').trim();

  // basic pluralization handling (remove trailing s if length > 3)
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) {
      n = n.slice(0, -1);
  }
  return n;
}

export function mergeIngredients(plannedMeals: Array<PlannedMealRow & { recipe: RecipeRow }>): MergedIngredient[] {
  // Map key is a combination of normalized name and base unit
  const mergedMap = new Map<string, MergedIngredient>();

  for (const meal of plannedMeals) {
    let recipeIngredients: any[] = [];
    try {
      recipeIngredients = JSON.parse(meal.recipe.ingredients);
    } catch (e) {
      console.error(`Failed to parse ingredients for recipe ${meal.recipe.id}`);
      continue;
    }

    // Determine scaling factor if servings were overridden
    // Defaults: if meal.servings is null, assume normal recipe servings
    const targetServings = meal.servings ?? meal.recipe.servings;
    const baseServings = meal.recipe.servings;
    const scaleFactor = (baseServings > 0 && targetServings > 0) ? targetServings / baseServings : 1;

    for (const ing of recipeIngredients) {
      const normalizedName = normalizeName(ing.name);
      const baseUnit = normalizeUnit(ing.unit);
      
      // We group by "name + baseUnit" so we don't accidentally merge "1 cup spinach" with "1 whole spinach"
      const key = `${normalizedName}|${baseUnit || 'none'}`;

      const scaledAmount = ing.amount ? ing.amount * scaleFactor : null;
      const baseAmount = scaledAmount ? convertToBaseAmount(scaledAmount, ing.unit) : null;

      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        if (existing.amount !== null && baseAmount !== null) {
          existing.amount += baseAmount;
        } else if (existing.amount === null && baseAmount !== null) {
          // If we previously had null amount (e.g., "salt"), and now we have an amount, use the amount
          existing.amount = baseAmount;
        }
        existing.raw_items.push(ing.raw);
        // Take category and AH search term from wherever it exists
        if (!existing.category && ing.category) existing.category = ing.category;
        if (!existing.ah_search_term && ing.ah_search_term) existing.ah_search_term = ing.ah_search_term;
      } else {
        mergedMap.set(key, {
          name: ing.name, // keep original display name for the first item
          amount: baseAmount,
          unit: baseUnit,
          category: ing.category || null,
          ah_search_term: ing.ah_search_term || null,
          raw_items: [ing.raw],
        });
      }
    }
  }

  // Format the outputs back to sensible units (e.g., 1500g -> 1.5kg)
  const result: MergedIngredient[] = [];
  for (const item of mergedMap.values()) {
    if (item.amount !== null) {
      const formatted = formatAmountAndUnit(item.amount, item.unit);
      item.amount = formatted.amount;
      item.unit = formatted.unit;
    }
    result.push(item);
  }

  // Sort by category, then name
  result.sort((a, b) => {
    const catA = a.category || 'z_other';
    const catB = b.category || 'z_other';
    if (catA !== catB) {
       return catA.localeCompare(catB);
    }
    return a.name.localeCompare(b.name);
  });

  return result;
}
