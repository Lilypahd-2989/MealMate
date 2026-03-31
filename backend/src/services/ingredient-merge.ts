import { PlannedMealRow, RecipeRow } from '../db/db.js';

export interface ChickenSubItem {
  recipeName: string;
  amount: number | null;
  unit: string | null;
  variant: string;
}

export interface MergedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  category: string | null;
  ah_search_term: string | null;
  raw_items: string[];
  isGroup?: boolean;
  subItems?: ChickenSubItem[];
  isLeftover?: boolean;
  leftoverNote?: string;
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
 */
function roundCulinary(amount: number, groupKey: string | null): number {
  const normKey = (!groupKey || groupKey === 'none') ? 'none' : groupKey;

  if (COUNTABLE_UNITS.has(normKey)) {
    const rounded = Math.round(amount);
    return rounded === 0 && amount > 0 ? 1 : rounded;
  }
  switch (normKey) {
    case 'tsp':
    case 'tbsp':
    case 'cup':
    case 'oz':
    case 'lb':
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
  return { amount: roundCulinary(baseAmount, groupKey), unit: groupKey };
}

/**
 * Strip prep notes and informal quantity prefixes for a clean display name.
 * Less aggressive than normalizeName — preserves casing, plurals, and
 * meaningful descriptors like "dried", "ground", "cooked".
 */
export function cleanDisplayName(name: string): string {
  let n = name.trim();

  // Strip leading informal quantity phrases: "a mugful of", "a cupful of", etc.
  n = n.replace(/^a\s+\w*ful\s+of\s+/i, '');
  n = n.replace(/^a\s+(?:few|bunch|handful|couple)\s+of\s+/i, '');

  // Strip leading measurement descriptors that the scraper left in the name
  // e.g. "heaped tsp Chinese five-spice" → "Chinese five-spice"
  n = n.replace(/^(?:heaped|rounded|level|generous)\s+(?:tsp|tbsp|teaspoon|tablespoon)\s+/i, '');

  // Strip trailing prep notes (most-specific phrases first to avoid partial matches)
  const trailingPrep = [
    'thinly sliced', 'roughly chopped', 'finely chopped', 'finely diced',
    'coarsely chopped', 'halved and sliced', 'zested and juiced',
    'sliced at an angle', 'at an angle',
    'thinly', 'shredded', 'halved', 'chopped', 'diced', 'sliced',
    'zested', 'juiced', 'trimmed', 'peeled', 'grated', 'minced', 'crushed',
  ];
  for (const prep of trailingPrep) {
    const regex = new RegExp(`[,\\s]+\\b${prep.replace(/\s+/g, '\\s+')}\\b[\\s,]*$`, 'gi');
    n = n.replace(regex, '');
  }

  n = n.replace(/\s+and\s*$/, '').replace(/[,;]\s*$/, '');

  // Collapse multiple spaces and trim
  n = n.replace(/\s+/g, ' ').trim();

  // Capitalise first letter
  if (!n) return name.trim(); // fallback to original if everything was stripped
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// Normalise ingredient names to catch slight variations when merging.
export function normalizeName(name: string): string {
  let n = name.toLowerCase().trim();

  // Strip leading informal quantity phrases so "a cupful of frozen peas"
  // and "frozen peas" normalise to the same key.
  n = n.replace(/^a\s+\w*ful\s+of\s+/i, '');
  n = n.replace(/^a\s+(?:few|bunch|handful|couple)\s+of\s+/i, '');
  n = n.replace(/^(?:heaped|rounded|level|generous)\s+(?:tsp|tbsp|teaspoon|tablespoon)\s+/i, '');

  // Prep descriptors and cut qualifiers to remove (word boundaries)
  const prepDescriptors = [
    'to serve', 'to taste', 'optional', 'separated', 'leaves only',
    'fresh', 'chopped', 'diced', 'sliced', 'peeled', 'minced', 'grated',
    'crushed', 'organic', 'raw', 'cooked', 'dried', 'ground', 'finely',
    'roughly', 'thinly', 'thickly', 'leaves', 'bunch', 'at an angle',
    'boneless', 'skinless', 'boneless', 'trimmed', 'cleaned',
  ];

  for (const desc of prepDescriptors) {
    const regex = new RegExp(`\\b${desc.replace(/\s+/g, '\\s+')}\\b`, 'g');
    n = n.replace(regex, '');
  }

  // Size descriptors (large, medium, small)
  n = n.replace(/\b(large|medium|small)\b/g, '');

  // Remove leading/trailing "and" or other connectors
  n = n.replace(/^\s*and\s+/, '').replace(/\s+and\s*$/, '');

  // Collapse whitespace
  n = n.replace(/\s+/g, ' ').trim();

  // Basic de-pluralise (remove trailing s if length > 3 and not ending ss)
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) {
    n = n.slice(0, -1);
  }
  return n;
}

// ---- Pantry matching ----

/**
 * Check if an ingredient name matches a pantry item.
 * Uses substring matching: pantry "garlic" matches "garlic clove",
 * pantry "olive oil" matches "extra virgin olive oil".
 */
function matchesPantry(ingredientName: string, normalizedPantryNames: string[]): boolean {
  const normIngredient = normalizeName(ingredientName);
  return normalizedPantryNames.some(pantry =>
    normIngredient.includes(pantry) || pantry.includes(normIngredient)
  );
}

// ---- Chicken grouping ----

// Non-meat chicken compounds that should NOT be grouped as chicken to buy
const CHICKEN_EXCLUSIONS = new Set([
  'chicken stock', 'chicken broth', 'chicken bouillon', 'chicken seasoning',
  'chicken powder', 'chicken salt',
]);

function isChickenVariant(normalizedName: string): boolean {
  if (!normalizedName.startsWith('chicken')) return false;
  return !CHICKEN_EXCLUSIONS.has(normalizedName);
}

function extractChickenVariant(normalizedName: string): string {
  return normalizedName.replace(/^chicken\s*/, '').trim() || 'chicken';
}

function isLeftoverIngredient(rawItems: string[]): boolean {
  const leftoverKws = ['leftover', 'left over', 'left-over', 'remaining'];
  return rawItems.some(raw =>
    leftoverKws.some(kw => raw.toLowerCase().includes(kw))
  );
}

// ---- Main merge function ----

interface MergeEntry {
  item: MergedIngredient;
  groupKey: string;
  recipeSources: Array<{ recipeName: string; amount: number | null; unit: string | null }>;
}

export function mergeIngredients(
  plannedMeals: Array<PlannedMealRow & { recipe: RecipeRow }>,
  pantryNames: string[] = [],
): { groceryList: MergedIngredient[]; pantryMatched: MergedIngredient[] } {
  const normalizedPantryNames = pantryNames.map(normalizeName);

  // Key: normalised-name + '|' + unitGroupKey
  const mergedMap = new Map<string, MergeEntry>();

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

      const source = {
        recipeName: meal.recipe.title,
        amount: scaledAmount,
        unit: gKey === 'none' ? null : gKey,
      };

      // If this item has no parseable amount (failed-parse like "a cupful of"),
      // try to merge it into an existing measured entry with the same name.
      const fallbackKey = baseAmount === null && gKey === 'none'
        ? [...mergedMap.keys()].find(k => k.startsWith(`${normalizedName}|`) && k !== mapKey)
        : undefined;
      const resolvedKey = fallbackKey ?? mapKey;

      if (mergedMap.has(resolvedKey)) {
        const entry = mergedMap.get(resolvedKey)!;
        if (entry.item.amount !== null && baseAmount !== null) {
          entry.item.amount += baseAmount;
        } else if (entry.item.amount === null && baseAmount !== null) {
          entry.item.amount = baseAmount;
        }
        entry.item.raw_items.push(ing.raw ?? '');
        entry.recipeSources.push(source);
        if (!entry.item.category && ing.category) entry.item.category = ing.category;
        if (!entry.item.ah_search_term && ing.ah_search_term) entry.item.ah_search_term = ing.ah_search_term;
      } else {
        mergedMap.set(mapKey, {
          item: {
            name: cleanDisplayName(ing.name),
            amount: baseAmount,
            unit: gKey === 'none' ? null : gKey,
            category: ing.category || null,
            ah_search_term: ing.ah_search_term || null,
            raw_items: [ing.raw ?? ''],
          },
          groupKey: gKey,
          recipeSources: [source],
        });
      }
    }
  }

  // ---- Post-merge: collapse null-amount "none" entries into measured same-name entries ----
  // Handles cases like "a cupful of frozen peas" (amount=null, unit=none) + "100g frozen peas" (unit=g)
  // where the informal entry was inserted before the measured one so the fallback couldn't fire.
  for (const [key, entry] of [...mergedMap.entries()]) {
    if (entry.item.amount !== null || entry.groupKey !== 'none') continue;
    const normName = key.split('|')[0];
    const measuredKey = [...mergedMap.keys()].find(
      k => k !== key && k.startsWith(`${normName}|`)
    );
    if (measuredKey) {
      const target = mergedMap.get(measuredKey)!;
      target.item.raw_items.push(...entry.item.raw_items);
      target.recipeSources.push(...entry.recipeSources);
      mergedMap.delete(key);
    }
  }

  // Format amounts back to display units with culinary rounding
  const formatted: Array<MergeEntry & { formattedAmount: number | null; formattedUnit: string | null }> = [];
  for (const entry of mergedMap.values()) {
    let fAmount = entry.item.amount;
    let fUnit = entry.item.unit;
    if (fAmount !== null) {
      const f = formatAmountAndUnit(fAmount, entry.groupKey);
      fAmount = f.amount;
      fUnit = f.unit;
    }
    entry.item.amount = fAmount;
    entry.item.unit = fUnit;
    formatted.push({ ...entry, formattedAmount: fAmount, formattedUnit: fUnit });
  }

  // ---- Chicken grouping pass ----
  const chickenEntries = formatted.filter(e => isChickenVariant(normalizeName(e.item.name)));
  const nonChickenEntries = formatted.filter(e => !isChickenVariant(normalizeName(e.item.name)));

  const resultEntries: MergedIngredient[] = nonChickenEntries.map(e => e.item);

  if (chickenEntries.length > 0) {
    // Separate leftovers
    const leftovers = chickenEntries.filter(e => isLeftoverIngredient(e.item.raw_items));
    const toBuy = chickenEntries.filter(e => !isLeftoverIngredient(e.item.raw_items));

    // Add leftover entries (flagged, no shopping needed)
    for (const entry of leftovers) {
      const recipeNames = [...new Set(entry.recipeSources.map(s => s.recipeName))].join(', ');
      resultEntries.push({
        ...entry.item,
        amount: null,
        isLeftover: true,
        leftoverNote: `Use leftovers from: ${recipeNames}`,
      });
    }

    // Group all non-leftover chicken into one entry
    if (toBuy.length > 0) {
      // Only sum as weight if at least one entry has a real weight unit (g/kg).
      // Countable entries (e.g. "6 chicken thighs", unit=null) must NOT be
      // treated as grams — they stay as counts.
      const weightEntries = toBuy.filter(e => e.groupKey === 'g' || e.groupKey === 'kg');
      const countableEntries = toBuy.filter(e => e.groupKey === 'none');
      const otherEntries = toBuy.filter(e => e.groupKey !== 'g' && e.groupKey !== 'kg' && e.groupKey !== 'none');

      // If ALL entries are countable (no weights at all), don't group — pass
      // them through as individual ingredients so the count stays meaningful.
      if (weightEntries.length === 0 && otherEntries.length === 0) {
        for (const entry of countableEntries) {
          resultEntries.push(entry.item);
        }
      } else {
        // At least some weight-based chicken: build a group with a gram total.
        let totalBaseG = 0;
        let hasWeight = false;
        const subItems: ChickenSubItem[] = [];

        for (const entry of toBuy) {
          const normN = normalizeName(entry.item.name);
          const variant = extractChickenVariant(normN) || 'chicken';

          for (const src of entry.recipeSources) {
            // Only add to gram total for weight-unit entries
            if (src.amount != null && (entry.groupKey === 'g' || entry.groupKey === 'kg')) {
              totalBaseG += src.amount; // already in base grams after toBaseAmount()
              hasWeight = true;
            }
            subItems.push({
              recipeName: src.recipeName,
              amount: src.amount != null ? roundCulinary(src.amount, entry.groupKey) : null,
              unit: entry.groupKey === 'none' ? null : entry.item.unit,
              variant,
            });
          }
        }

        const formattedTotal = hasWeight
          ? formatAmountAndUnit(totalBaseG, 'g')
          : { amount: null, unit: null };

        resultEntries.push({
          name: 'Chicken',
          amount: formattedTotal.amount,
          unit: formattedTotal.unit,
          category: 'protein',
          ah_search_term: null,
          raw_items: toBuy.flatMap(e => e.item.raw_items),
          isGroup: true,
          subItems,
        });
      }
    }
  }

  // Sort by category then name
  resultEntries.sort((a, b) => {
    const catA = a.category || 'z_other';
    const catB = b.category || 'z_other';
    if (catA !== catB) return catA.localeCompare(catB);
    return a.name.localeCompare(b.name);
  });

  // ---- Pantry split ----
  const groceryList: MergedIngredient[] = [];
  const pantryMatched: MergedIngredient[] = [];

  for (const item of resultEntries) {
    if (item.isLeftover) {
      // Leftovers always go in groceryList (for display in their own section)
      groceryList.push(item);
    } else if (normalizedPantryNames.length > 0 && matchesPantry(item.name, normalizedPantryNames)) {
      pantryMatched.push(item);
    } else {
      groceryList.push(item);
    }
  }

  return { groceryList, pantryMatched };
}
