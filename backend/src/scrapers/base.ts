import * as cheerio from 'cheerio';

export interface ScrapedRecipe {
  title: string;
  source_url: string;
  source: string;
  image_url: string | null;
  servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  total_time_min: number | null;
  cuisine: string | null;
  tags: string[];
  ingredients: ScrapedIngredient[];
  instructions: string[];
  nutrition: NutritionInfo | null;
  leftover_friendly: boolean;
  leftover_note: string | null;
}

export interface ScrapedIngredient {
  name: string;
  amount: number | null;
  unit: string | null;
  raw: string;
  category: string | null;
  ah_search_term: string | null;
}

export interface NutritionInfo {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
}

/**
 * Parse ISO 8601 duration (PT30M, PT1H15M, etc.) to minutes
 */
function parseDuration(duration: string | undefined | null): number | null {
  if (!duration) return null;
  const str = String(duration).toLowerCase();
  
  // Try ISO 8601 first (e.g. PT1H15M)
  const isoMatch = str.match(/pt(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (isoMatch && (isoMatch[1] || isoMatch[2] || isoMatch[3])) {
    const hours = parseInt(isoMatch[1] || '0', 10);
    const minutes = parseInt(isoMatch[2] || '0', 10);
    return hours * 60 + minutes;
  }

  // Fallback for human-readable like "1 hour 15 minutes"
  let minutes = 0;
  const hourMatch = str.match(/(\d+)\s*(?:hour|hours|hr|hrs)/);
  if (hourMatch) minutes += parseInt(hourMatch[1], 10) * 60;
  
  const minuteMatch = str.match(/(\d+)\s*(?:minute|minutes|min|mins)/);
  if (minuteMatch) minutes += parseInt(minuteMatch[1], 10);

  return minutes > 0 ? minutes : null;
}

/**
 * Extract a numeric value from a nutrition string like "420 calories" or "38g"
 */
function parseNutritionValue(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const str = String(value);
  const match = str.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract JSON-LD Recipe data from HTML
 */
export function extractJsonLd(html: string): any | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const content = $(scripts[i]).html();
      if (!content) continue;

      let data = JSON.parse(content);

      // Handle @graph arrays (common pattern)
      if (data['@graph']) {
        data = data['@graph'];
      }

      // Handle arrays
      if (Array.isArray(data)) {
        const recipe = data.find((item: any) =>
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
        );
        if (recipe) return recipe;
      }

      // Direct Recipe object
      if (data['@type'] === 'Recipe' ||
          (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
        return data;
      }
    } catch (e) {
      // Invalid JSON, try next script tag
      continue;
    }
  }

  return null;
}

/**
 * Extract image URL from JSON-LD data
 */
function extractImageUrl(imageData: any): string | null {
  if (!imageData) return null;
  if (typeof imageData === 'string') return imageData;
  if (Array.isArray(imageData)) {
    const first = imageData[0];
    if (typeof first === 'string') return first;
    if (first?.url) return first.url;
  }
  if (imageData.url) return imageData.url;
  return null;
}

const VALID_UNITS = new Set([
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons',
  'cup', 'cups',
  'oz', 'ounce', 'ounces',
  'lb', 'lbs', 'pound', 'pounds',
  'g', 'gram', 'grams',
  'kg', 'kilogram', 'kilograms',
  'ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres',
  'l', 'liter', 'liters', 'litre', 'litres',
  'bunch', 'bunches',
  'pinch', 'pinches',
  'piece', 'pieces',
  'clove', 'cloves',
  'can', 'cans',
  'tin', 'tins',
  'whole',
  'slice', 'slices', 'handful', 'handfuls', 'sprig', 'sprigs'
]);

// Size descriptors that should never be treated as units
const SIZE_DESCRIPTORS = new Set(['large', 'medium', 'small']);

// Trailing prep notes and descriptors to strip from ingredient names
// Matches prep phrases that appear after a comma or space at the end
// Runs twice to handle compound phrases like "separated and finely sliced"
const PREP_NOTE_RX = /[,\s]+(and\s+)?(sliced at an angle|white and green parts separated|homemade or store-bought|optional|to serve|to taste|finely chopped|roughly chopped|finely sliced|roughly sliced|peeled|crushed|sliced|chopped|diced|minced|grated|separated|leaves only|finely|roughly)\s*$/i;

function parseIngredientString(raw: string): ScrapedIngredient {
  const originalCleaned = raw.trim();

  // Pre-process: normalize unicode fractions to decimal notation so the
  // main number regex only needs to handle ASCII digits and decimal points.
  const cleaned = originalCleaned
    .replace(/(\d)\s*½/g, (_, d) => String(parseInt(d, 10) + 0.5))
    .replace(/(\d)\s*¼/g, (_, d) => String(parseInt(d, 10) + 0.25))
    .replace(/(\d)\s*¾/g, (_, d) => String(parseInt(d, 10) + 0.75))
    .replace(/(\d)\s*⅓/g, (_, d) => String(parseInt(d, 10) + 0.33))
    .replace(/(\d)\s*⅔/g, (_, d) => String(parseInt(d, 10) + 0.67))
    .replace(/(\d)\s*⅛/g, (_, d) => String(parseInt(d, 10) + 0.125))
    .replace(/½/g, '0.5')
    .replace(/¼/g, '0.25')
    .replace(/¾/g, '0.75')
    .replace(/⅓/g, '0.33')
    .replace(/⅔/g, '0.67')
    .replace(/⅛/g, '0.125');

  // Extract number at the start: "1", "1.5", "0.5", "1/2", "1 1/2", "1-1.5", "1-2"
  // Handle ranges with decimals (e.g. "1-1.5" from converted fractions)
  const numberRegex = /^(\d+\s+\d+[/]\d+|\d+[/.]\d+(?:\s*-\s*\d+[/.]\d+)?|\d+[/-]\d+[/.]\d+|\d+-\d+(?:\.\d+)?|\d+)\s*/;
  const match = cleaned.match(numberRegex);

  let amount: number | null = null;
  let remainingStr = cleaned;

  if (match) {
    const amountStr = match[1];
    remainingStr = cleaned.slice(match[0].length).trim();

    if (amountStr.includes(' ')) {
      // "1 1/2"
      const parts = amountStr.split(' ');
      if (parts[1].includes('/')) {
        const frac = parts[1].split('/');
        amount = parseFloat(parts[0]) + (parseFloat(frac[0]) / parseFloat(frac[1]));
      }
    } else if (amountStr.includes('/')) {
      const frac = amountStr.split('/');
      amount = parseFloat(frac[0]) / parseFloat(frac[1]);
    } else if (amountStr.includes('-')) {
      // Range like "1-2" or "1-1.5": take the first value
      const parts = amountStr.split('-');
      amount = parseFloat(parts[0]);
    } else {
      amount = parseFloat(amountStr);
    }

    if (amount !== null && isNaN(amount)) amount = null;
  }

  // Strip leading size descriptor (large/medium/small) before unit parsing.
  // e.g. "large egg" → "egg"; "large can of tomatoes" → "can of tomatoes"
  {
    const firstWord = remainingStr.split(/\s+/)[0]?.toLowerCase().replace(/[.,]$/, '');
    if (firstWord && SIZE_DESCRIPTORS.has(firstWord)) {
      remainingStr = remainingStr.slice(firstWord.length).trim();
    }
  }

  // Parse unit: consume the first word if it is a known unit
  let unit: string | null = null;
  const firstWordMatch = remainingStr.match(/^([a-zA-Z]+)[.,]?\s+(.*)/);
  if (firstWordMatch) {
    const word = firstWordMatch[1].toLowerCase();
    if (VALID_UNITS.has(word)) {
      unit = word;
      remainingStr = firstWordMatch[2];
    }
  }

  // Strip "of"
  if (remainingStr.toLowerCase().startsWith('of ')) {
    remainingStr = remainingStr.slice(3).trim();
  }

  // Clean up: remove parentheticals, strip everything after first comma
  let name = remainingStr
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/,\s*.*$/, '')
    .trim();

  // Strip trailing prep notes (run twice to handle compound notes like "finely chopped")
  name = name.replace(PREP_NOTE_RX, '').trim();
  name = name.replace(PREP_NOTE_RX, '').trim();

  return {
    name,
    amount,
    unit,
    raw: originalCleaned,
    category: categorizeIngredient(name),
    ah_search_term: null,
  };
}

/**
 * Auto-categorize an ingredient by name
 */
function categorizeIngredient(name: string): string {
  const lower = name.toLowerCase();

  const proteinKeywords = ['chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'turkey', 'tofu', 'egg'];
  const veggieKeywords = ['spinach', 'tomato', 'onion', 'garlic', 'pepper', 'aubergine', 'eggplant', 'cauliflower', 'broccoli', 'carrot', 'courgette', 'zucchini', 'mushroom', 'lettuce', 'cucumber', 'avocado', 'kale', 'cabbage', 'corn', 'pea', 'bean', 'lentil', 'potato', 'sweet potato'];
  const dairyKeywords = ['cheese', 'milk', 'cream', 'yoghurt', 'yogurt', 'butter', 'mozzarella', 'parmesan', 'feta'];
  const grainKeywords = ['rice', 'pasta', 'bread', 'flour', 'couscous', 'quinoa', 'noodle', 'wrap', 'tortilla', 'pita'];
  const spiceKeywords = ['salt', 'pepper', 'paprika', 'cumin', 'oregano', 'thyme', 'basil', 'cinnamon', 'turmeric', 'chili', 'cayenne', 'coriander'];

  if (proteinKeywords.some(k => lower.includes(k))) return 'protein';
  if (veggieKeywords.some(k => lower.includes(k))) return 'vegetable';
  if (dairyKeywords.some(k => lower.includes(k))) return 'dairy';
  if (grainKeywords.some(k => lower.includes(k))) return 'grain';
  if (spiceKeywords.some(k => lower.includes(k))) return 'spice';

  return 'other';
}

/**
 * Parse a JSON-LD Recipe object into our normalized format
 */
export function parseJsonLdRecipe(jsonLd: any, url: string, source: string): ScrapedRecipe {
  // Parse nutrition
  let nutrition: NutritionInfo | null = null;
  if (jsonLd.nutrition) {
    nutrition = {
      calories: parseNutritionValue(jsonLd.nutrition.calories),
      protein_g: parseNutritionValue(jsonLd.nutrition.proteinContent),
      carbs_g: parseNutritionValue(jsonLd.nutrition.carbohydrateContent),
      fat_g: parseNutritionValue(jsonLd.nutrition.fatContent),
      fibre_g: parseNutritionValue(jsonLd.nutrition.fiberContent),
    };
  }

  // Parse instructions
  let instructions: string[] = [];
  if (jsonLd.recipeInstructions) {
    if (Array.isArray(jsonLd.recipeInstructions)) {
      instructions = jsonLd.recipeInstructions.map((step: any) => {
        if (typeof step === 'string') return step;
        if (step.text) return step.text;
        if (step.itemListElement) {
          // HowToSection with sub-steps
          return step.itemListElement.map((sub: any) =>
            typeof sub === 'string' ? sub : sub.text
          ).join(' ');
        }
        return String(step);
      });
    } else if (typeof jsonLd.recipeInstructions === 'string') {
      instructions = jsonLd.recipeInstructions.split('\n').filter((s: string) => s.trim());
    }
  }

  // Parse ingredients
  let ingredients: ScrapedIngredient[] = [];
  if (jsonLd.recipeIngredient && Array.isArray(jsonLd.recipeIngredient)) {
    ingredients = jsonLd.recipeIngredient.map((ing: string) => parseIngredientString(ing));
    // Convert imperial units to metric for US recipe sources
    if (US_SOURCES.has(source)) {
      ingredients = ingredients.map(convertIngredientToMetric);
    }
  }

  // Convert Fahrenheit temperatures in instructions for US sources
  if (US_SOURCES.has(source)) {
    instructions = fahrenheitToCelsius(instructions);
  }

  // Determine tags
  const parsedTags: string[] = [];
  if (jsonLd.keywords) {
    const keywords = typeof jsonLd.keywords === 'string'
      ? jsonLd.keywords.split(',').map((k: string) => k.trim())
      : Array.isArray(jsonLd.keywords) ? jsonLd.keywords : [];
    parsedTags.push(...keywords);
  }
  if (jsonLd.recipeCategory) {
    const cats = Array.isArray(jsonLd.recipeCategory) ? jsonLd.recipeCategory : [jsonLd.recipeCategory];
    // Some sites store multiple categories as a single comma-separated string
    for (const cat of cats) {
      if (typeof cat === 'string' && cat.includes(',')) {
        parsedTags.push(...cat.split(',').map((c: string) => c.trim()).filter(Boolean));
      } else if (cat) {
        parsedTags.push(cat);
      }
    }
  }

  // Helper to decode entities
  const $ = cheerio.load('');
  const decodeEntity = (str: string) => $('<div/>').html(str).text().trim();

  // Filter out authors from tags
  let authorNames: string[] = [];
  if (jsonLd.author) {
    const authors = Array.isArray(jsonLd.author) ? jsonLd.author : [jsonLd.author];
    authorNames = authors.map((a: any) => typeof a === 'string' ? a : a.name).filter(Boolean).map((n: string) => n.toLowerCase());
  }

  const tags = [...new Set(parsedTags)]
    .map(decodeEntity)
    .filter(t => t && !authorNames.includes(t.toLowerCase()))
    .slice(0, 10);

  // Parse servings
  let servings = 4;
  const yieldData = jsonLd.recipeYield || jsonLd.yield;
  if (yieldData) {
    const yieldStr = Array.isArray(yieldData) ? yieldData[0] : yieldData;
    const yieldMatch = String(yieldStr).match(/(\d+)/);
    if (yieldMatch) servings = parseInt(yieldMatch[1], 10);
  }

  const prepTime = parseDuration(jsonLd.prepTime);
  let cookTime = parseDuration(jsonLd.cookTime);
  const totalTime = parseDuration(jsonLd.totalTime) || (prepTime && cookTime ? prepTime + cookTime : null);

  // If totalTime is available but cookTime isn't, estimate cookTime
  if (!cookTime && totalTime && prepTime) {
    cookTime = totalTime - prepTime;
  }
  // Bon Appetit sometimes only gives totalTime
  if (!cookTime && totalTime && !prepTime) {
    cookTime = totalTime; 
  }

  const imageUrl = extractImageUrl(jsonLd.image);
  console.log(`🖼️  Image field (${typeof jsonLd.image}): ${JSON.stringify(jsonLd.image)?.slice(0, 150)} → ${imageUrl}`);

  return {
    title: decodeEntity(jsonLd.name || 'Untitled Recipe'),
    source_url: url,
    source,
    image_url: imageUrl,
    servings,
    prep_time_min: prepTime,
    cook_time_min: cookTime,
    total_time_min: totalTime,
    cuisine: decodeEntity(jsonLd.recipeCuisine || '') || null,
    tags,
    ingredients,
    instructions,
    nutrition,
    leftover_friendly: false,
    leftover_note: null,
  };
}

// Sources that use imperial units and need metric conversion on import
const US_SOURCES = new Set(['bon_appetit', 'allrecipes', 'other']);

/**
 * Convert a single ingredient's imperial unit to metric.
 * oz/lb → g (upgrading to kg at ≥1000g); cup → ml (upgrading to l at ≥1000ml).
 * tsp/tbsp are kept as-is.
 */
function convertIngredientToMetric(ing: ScrapedIngredient): ScrapedIngredient {
  if (!ing.unit || ing.amount == null) return ing;
  const unit = ing.unit.toLowerCase();

  if (['oz', 'ounce', 'ounces'].includes(unit)) {
    const grams = Math.round(ing.amount * 28);
    if (grams >= 1000) return { ...ing, amount: Math.round(grams / 100) / 10, unit: 'kg' };
    return { ...ing, amount: grams, unit: 'g' };
  }
  if (['lb', 'lbs', 'pound', 'pounds'].includes(unit)) {
    const grams = Math.round(ing.amount * 454);
    if (grams >= 1000) return { ...ing, amount: Math.round(grams / 100) / 10, unit: 'kg' };
    return { ...ing, amount: grams, unit: 'g' };
  }
  if (['cup', 'cups'].includes(unit)) {
    const ml = Math.round(ing.amount * 237);
    if (ml >= 1000) return { ...ing, amount: Math.round(ml / 100) / 10, unit: 'l' };
    return { ...ing, amount: ml, unit: 'ml' };
  }
  return ing;
}

/**
 * Replace Fahrenheit temperatures in instruction strings with Celsius,
 * rounded to the nearest 5°C for clean values.
 */
function fahrenheitToCelsius(instructions: string[]): string[] {
  return instructions.map(step =>
    step.replace(/(\d+(?:\.\d+)?)\s*°?\s*F\b/g, (_, f) => {
      const c = (parseFloat(f) - 32) * 5 / 9;
      return `${Math.round(c / 5) * 5}°C`;
    })
  );
}

/**
 * Detect which source a URL belongs to
 */
export function detectSource(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.includes('bbcgoodfood.com')) return 'bbc_good_food';
  if (hostname.includes('bonappetit.com')) return 'bon_appetit';
  if (hostname.includes('allrecipes.com')) return 'allrecipes';
  if (hostname.includes('ah.nl') || hostname.includes('ah.be')) return 'ah_allerhande';
  return 'other';
}

/**
 * Fetch and scrape a recipe from any supported URL
 */
export async function scrapeRecipeFromUrl(url: string): Promise<ScrapedRecipe> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const source = detectSource(url);

  // Try JSON-LD first (works for most recipe sites)
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    return parseJsonLdRecipe(jsonLd, url, source);
  }

  // Fallback: basic HTML parsing
  return fallbackHtmlParse(html, url, source);
}

/**
 * Fallback HTML parser when JSON-LD is not available
 */
function fallbackHtmlParse(html: string, url: string, source: string): ScrapedRecipe {
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim() || $('title').text().trim() || 'Untitled Recipe';
  const image = $('meta[property="og:image"]').attr('content') || $('img').first().attr('src') || null;

  return {
    title,
    source_url: url,
    source,
    image_url: image,
    servings: 4,
    prep_time_min: null,
    cook_time_min: null,
    total_time_min: null,
    cuisine: null,
    tags: [],
    ingredients: [],
    instructions: [],
    nutrition: null,
    leftover_friendly: false,
    leftover_note: null,
  };
}
