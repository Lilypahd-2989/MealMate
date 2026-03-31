import { PlannedMealRow, RecipeRow } from '../db/db.js';

export interface MergedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  category: string | null;
  ah_search_term: string | null;
  raw_items: string[];
  notes: string[] | null;    // per-recipe preparation notes when names differ
  is_leftover: boolean;      // true → "use leftovers" flag, not a shopping qty
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

const COUNTABLE_UNITS = new Set([
  'none', 'clove', 'cloves', 'piece', 'pieces', 'can', 'cans', 'tin', 'tins', 
  'medium', 'small', 'large', 'whole', 'handful', 'handfuls', 'sprig', 'sprigs', 
  'bunch', 'bunches', 'slice', 'slices', 'pinch', 'pinches'
]);

/**
 * Round to sensible culinary precision after scaling / merging.
 * - Countable (no unit, or clove, can, piece, etc): whole number
 * - tsp / tbsp / cup / oz / lb: nearest ¼
 * - g / kg / ml / l: nearest whole gram/ml (or 5g above 20g)
 */
function roundCulinary(amount: number, groupKey: string | null): number {
  const normKey = (!groupKey || groupKey === 'none') ? 'none' : groupKey;
  
  if (COUNTABLE_UNITS.has(normKey)) {
    // Countable item — round to nearest whole number (never 0 if original > 0)
    const rounded = Math.round(amount);
    return rounded === 0 && amount > 0 ? 1 : rounded;
  }
  switch (normKey) {
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

// Words to strip when building a normalised merge key.
// Adjectives/adverbs — describe how it's prepared but not what it is.
const PREP_WORDS = [
  'fresh', 'chopped', 'diced', 'sliced', 'peeled', 'minced', 'grated',
  'crushed', 'organic', 'raw', 'cooked', 'dried', 'ground', 'finely',
  'roughly', 'thinly', 'thickly', 'leaves', 'bunch', 'boneless', 'skinless',
  'trimmed', 'halved', 'quartered', 'shredded', 'toasted', 'roasted',
];

// Cut / part qualifiers — name the specific piece of an ingredient.
// Stripping these groups "chicken breast" + "chicken thighs" → "chicken",
// "broccoli florets" + "broccoli" → "broccoli", etc.
const PART_WORDS = [
  'breast', 'breasts', 'thigh', 'thighs', 'drumstick', 'drumsticks',
  'wing', 'wings', 'mince', 'loin', 'chop', 'chops', 'fillet', 'fillets',
  'filet', 'filets', 'cutlet', 'cutlets', 'leg', 'legs', 'rack',
  'floret', 'florets', 'stalk', 'stalks', 'stem', 'stems',
  'head', 'clove', 'cloves', 'piece', 'pieces', 'sprig', 'sprigs',
];

// Normalise ingredient names to a base key used for grouping/merging.
function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();

  for (const word of [...PREP_WORDS, ...PART_WORDS]) {
    n = n.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
  }

  n = n.replace(/\s+/g, ' ').trim();

  // Basic de-pluralise (remove trailing s if length > 3 and not ending ss/us/is)
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss') && !n.endsWith('us') && !n.endsWith('is')) {
    n = n.slice(0, -1);
  }
  return n;
}

export function mergeIngredients(plannedMeals: Array<PlannedMealRow & { recipe: RecipeRow }>): MergedIngredient[] {
  // Key: normalised-name + '|' + unitGroupKey
  const mergedMap = new Map<string, {
    item: MergedIngredient;
    groupKey: string;
    // track original name per recipe to detect variations
    originalNames: Set<string>;
    recipeNotes: string[];
  }>();

  // Separate list for leftover items (keyed by ingredient name + recipe)
  const leftoverItems: MergedIngredient[] = [];

  for (const meal of plannedMeals) {
    let recipeIngredients: any[] = [];
    try {
      recipeIngredients = JSON.parse(meal.recipe.ingredients);
    } catch {
      console.error(`Failed to parse ingredients for recipe ${meal.recipe.id}`);
      continue;
    }

    const recipeTitle = meal.recipe.title;
    const targetServings = meal.servings ?? meal.recipe.servings;
    const baseServings = meal.recipe.servings;
    const scaleFactor = baseServings > 0 && targetServings > 0 ? targetServings / baseServings : 1;

    for (const ing of recipeIngredients) {
      const lowerName = ing.name.toLowerCase();

      // Leftover detection — never add to the shopping list
      if (lowerName.includes('leftover')) {
        leftoverItems.push({
          name: ing.name,
          amount: null,
          unit: null,
          category: ing.category || null,
          ah_search_term: null,
          raw_items: [ing.raw],
          notes: [`Use leftovers from: ${recipeTitle}`],
          is_leftover: true,
        });
        continue;
      }

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

        // Track name variation for this recipe
        if (!entry.originalNames.has(ing.name.toLowerCase())) {
          entry.originalNames.add(ing.name.toLowerCase());
          entry.recipeNotes.push(`${recipeTitle}: ${ing.name}`);
        }
      } else {
        // Capitalise the normalized base name for display when merging occurs
        const displayName = normalizedName
          ? normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1)
          : ing.name;

        mergedMap.set(mapKey, {
          item: {
            name: displayName,
            amount: baseAmount,
            unit: gKey === 'none' ? null : gKey,
            category: ing.category || null,
            ah_search_term: ing.ah_search_term || null,
            raw_items: [ing.raw],
            notes: null,
            is_leftover: false,
          },
          groupKey: gKey,
          originalNames: new Set([ing.name.toLowerCase()]),
          recipeNotes: [`${recipeTitle}: ${ing.name}`],
        });
      }
    }
  }

  // Format amounts back to display units with culinary rounding
  const result: MergedIngredient[] = [];
  for (const { item, groupKey, originalNames, recipeNotes } of mergedMap.values()) {
    if (item.amount !== null) {
      const formatted = formatAmountAndUnit(item.amount, groupKey);
      item.amount = formatted.amount;
      item.unit = formatted.unit;
    }
    // Only attach notes when there are genuine name variations across recipes
    if (originalNames.size > 1) {
      item.notes = recipeNotes;
    }
    result.push(item);
  }

  // Append leftover flags at the end
  result.push(...leftoverItems);

  result.sort((a, b) => {
    // Leftovers sink to the bottom
    if (a.is_leftover !== b.is_leftover) return a.is_leftover ? 1 : -1;
    const catA = a.category || 'z_other';
    const catB = b.category || 'z_other';
    if (catA !== catB) return catA.localeCompare(catB);
    return a.name.localeCompare(b.name);
  });

  return result;
}
