import { PlannedMealRow, RecipeRow } from '../db/db.js';

export interface MergedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  category: string | null;
  ah_search_term: string | null;
  raw_items: string[];
}

// SI units that should be normalised into a common base for merging.
// Culinary units (tsp, tbsp, cup, oz, lb) stay as-is — never convert to ml.
const SI_MASS: Record<string, number> = {
  'g': 1, 'gram': 1, 'grams': 1,
  'kg': 1000, 'kilogram': 1000, 'kilograms': 1000,
  'mg': 0.001,
};

const SI_VOLUME: Record<string, number> = {
  'ml': 1,
  'l': 1000, 'litre': 1000, 'litres': 1000, 'liter': 1000, 'liters': 1000,
};

// Canonical display name for each culinary unit (handles plural forms).
const CULINARY_CANONICAL: Record<string, string> = {
  'tsp': 'tsp', 'teaspoon': 'tsp', 'teaspoons': 'tsp',
  'tbsp': 'tbsp', 'tablespoon': 'tbsp', 'tablespoons': 'tbsp',
  'cup': 'cup', 'cups': 'cup',
  'oz': 'oz',
  'lb': 'lb', 'pound': 'lb', 'pounds': 'lb',
};

/**
 * Return the key used for grouping: SI units collapse to 'g' or 'ml';
 * culinary units keep their canonical name; everything else is verbatim.
 */
function unitGroupKey(unit: string | null): string {
  if (!unit) return 'none';
  const lwr = unit.toLowerCase().trim();
  if (lwr in SI_MASS) return 'g';
  if (lwr in SI_VOLUME) return 'ml';
  if (lwr in CULINARY_CANONICAL) return CULINARY_CANONICAL[lwr];
  return lwr;
}

/**
 * Convert an amount to the base unit used for summing.
 * SI → base (g or ml).  Culinary → no conversion (already in natural units).
 */
function toBaseAmount(amount: number, unit: string | null): number {
  if (!unit) return amount;
  const lwr = unit.toLowerCase().trim();
  if (lwr in SI_MASS) return amount * SI_MASS[lwr];
  if (lwr in SI_VOLUME) return amount * SI_VOLUME[lwr];
  return amount; // culinary or unknown: no conversion
}

/**
 * Round to sensible culinary precision after scaling / merging.
 * - Countable (no unit): whole number
 * - tsp / tbsp / cup / oz / lb: nearest ¼
 * - g / kg / ml / l: nearest whole gram/ml (or 5g above 20g)
 */
function roundCulinary(amount: number, groupKey: string | null): number {
  if (!groupKey || groupKey === 'none') {
    // Countable item — round to nearest whole
    return Math.round(amount);
  }
  switch (groupKey) {
    case 'tsp':
    case 'tbsp':
    case 'cup':
    case 'oz':
    case 'lb':
      // Nearest quarter
      return Math.round(amount * 4) / 4;
    case 'g':
      if (amount >= 20) return Math.round(amount / 5) * 5;
      return Math.round(amount);
    case 'ml':
      if (amount >= 20) return Math.round(amount / 5) * 5;
      return Math.round(amount);
    default:
      return Math.round(amount * 4) / 4;
  }
}

/**
 * Format the summed base amount back to a display-friendly amount+unit,
 * upgrading g→kg or ml→l when appropriate.
 */
function formatAmountAndUnit(baseAmount: number, groupKey: string): { amount: number; unit: string | null } {
  if (groupKey === 'g' && baseAmount >= 1000) {
    const v = roundCulinary(baseAmount / 1000, 'kg');
    return { amount: v, unit: 'kg' };
  }
  if (groupKey === 'ml' && baseAmount >= 1000) {
    const v = roundCulinary(baseAmount / 1000, 'l');
    return { amount: v, unit: 'l' };
  }
  if (groupKey === 'none') {
    return { amount: roundCulinary(baseAmount, null), unit: null };
  }
  return { amount: roundCulinary(baseAmount, groupKey), unit: groupKey === 'g' || groupKey === 'ml' ? groupKey : groupKey };
}

// Normalise ingredient names to catch slight variations when merging.
function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();

  const adjectivesToRemove = [
    'fresh', 'chopped', 'diced', 'sliced', 'peeled', 'minced', 'grated',
    'crushed', 'organic', 'raw', 'cooked', 'dried', 'ground', 'finely',
    'roughly', 'thinly', 'thickly', 'leaves', 'bunch',
  ];

  for (const adj of adjectivesToRemove) {
    const regex = new RegExp(`\\b${adj}\\b`, 'g');
    n = n.replace(regex, '');
  }

  n = n.replace(/\s+/g, ' ').trim();

  // Basic de-pluralise (remove trailing s if length > 3 and not ending ss)
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) {
    n = n.slice(0, -1);
  }
  return n;
}

export function mergeIngredients(plannedMeals: Array<PlannedMealRow & { recipe: RecipeRow }>): MergedIngredient[] {
  // Key: normalised-name + '|' + unitGroupKey
  const mergedMap = new Map<string, { item: MergedIngredient; groupKey: string }>();

  for (const meal of plannedMeals) {
    let recipeIngredients: any[] = [];
    try {
      recipeIngredients = JSON.parse(meal.recipe.ingredients);
    } catch {
      console.error(`Failed to parse ingredients for recipe ${meal.recipe.id}`);
      continue;
    }

    const targetServings = meal.servings ?? meal.recipe.servings;
    const baseServings = meal.recipe.servings;
    const scaleFactor = baseServings > 0 && targetServings > 0 ? targetServings / baseServings : 1;

    for (const ing of recipeIngredients) {
      const normalizedName = normalizeName(ing.name);
      const gKey = unitGroupKey(ing.unit);
      const mapKey = `${normalizedName}|${gKey}`;

      const scaledAmount = ing.amount != null ? ing.amount * scaleFactor : null;
      const baseAmount = scaledAmount != null ? toBaseAmount(scaledAmount, ing.unit) : null;

      if (mergedMap.has(mapKey)) {
        const entry = mergedMap.get(mapKey)!;
        if (entry.item.amount !== null && baseAmount !== null) {
          entry.item.amount += baseAmount;
        } else if (entry.item.amount === null && baseAmount !== null) {
          entry.item.amount = baseAmount;
        }
        entry.item.raw_items.push(ing.raw);
        if (!entry.item.category && ing.category) entry.item.category = ing.category;
        if (!entry.item.ah_search_term && ing.ah_search_term) entry.item.ah_search_term = ing.ah_search_term;
      } else {
        mergedMap.set(mapKey, {
          item: {
            name: ing.name,
            amount: baseAmount,
            unit: gKey === 'none' ? null : gKey,
            category: ing.category || null,
            ah_search_term: ing.ah_search_term || null,
            raw_items: [ing.raw],
          },
          groupKey: gKey,
        });
      }
    }
  }

  // Format amounts back to display units with culinary rounding
  const result: MergedIngredient[] = [];
  for (const { item, groupKey } of mergedMap.values()) {
    if (item.amount !== null) {
      const formatted = formatAmountAndUnit(item.amount, groupKey);
      item.amount = formatted.amount;
      item.unit = formatted.unit;
    }
    result.push(item);
  }

  result.sort((a, b) => {
    const catA = a.category || 'z_other';
    const catB = b.category || 'z_other';
    if (catA !== catB) return catA.localeCompare(catB);
    return a.name.localeCompare(b.name);
  });

  return result;
}
