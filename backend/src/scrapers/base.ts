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
function parseDuration(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  return hours * 60 + minutes;
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

/**
 * Parse ingredient strings from JSON-LD into structured format
 */
function parseIngredientString(raw: string): ScrapedIngredient {
  // Common patterns:
  // "2 large chicken breasts (about 500g)"
  // "1 tablespoon olive oil"
  // "400g tin chopped tomatoes"
  // "Salt and pepper to taste"

  const cleaned = raw.trim();

  // Try to extract amount and unit
  // We use \\b around the unit list to prevent treating the first letter of an ingredient (e.g. 'l' in large) as a unit.
  const amountUnitMatch = cleaned.match(
    /^([\d./½¼¾⅓⅔⅛]+(?:\s*-\s*[\d./½¼¾⅓⅔⅛]+)?)\s*(?:(tbsp|tablespoons?|tsp|teaspoons?|cups?|g|kg|ml|l|litre|liter|oz|lb|pounds?|cloves?|pieces?|large|medium|small|whole|bunch|handful|pinch|slice|slices|can|tin)\b)?\s*(?:of\s+)?(.*)/i
  );

  if (amountUnitMatch) {
    let amountStr = amountUnitMatch[1];
    // Convert unicode fractions
    amountStr = amountStr
      .replace('½', '0.5')
      .replace('¼', '0.25')
      .replace('¾', '0.75')
      .replace('⅓', '0.33')
      .replace('⅔', '0.67')
      .replace('⅛', '0.125');

    // Handle fractions like 1/2
    let amount: number | null = null;
    if (amountStr.includes('/')) {
      const parts = amountStr.split('/');
      amount = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      amount = parseFloat(amountStr);
    }

    const unit = amountUnitMatch[2]?.toLowerCase() || null;
    const name = amountUnitMatch[3]
      .replace(/\s*\(.*?\)\s*/g, '')  // Remove parenthetical notes
      .replace(/,\s*.*$/, '')          // Remove everything after comma
      .trim();

    return {
      name,
      amount: isNaN(amount) ? null : amount,
      unit,
      raw: cleaned,
      category: categorizeIngredient(name),
      ah_search_term: null,
    };
  }

  // No amount pattern found — just return the name
  return {
    name: cleaned,
    amount: null,
    unit: null,
    raw: cleaned,
    category: categorizeIngredient(cleaned),
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
    parsedTags.push(...cats);
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

  return {
    title: decodeEntity(jsonLd.name || 'Untitled Recipe'),
    source_url: url,
    source,
    image_url: extractImageUrl(jsonLd.image),
    servings,
    prep_time_min: prepTime,
    cook_time_min: cookTime,
    total_time_min: totalTime,
    cuisine: decodeEntity(jsonLd.recipeCuisine || ''),
    tags,
    ingredients,
    instructions,
    nutrition,
    leftover_friendly: false,
    leftover_note: null,
  };
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
