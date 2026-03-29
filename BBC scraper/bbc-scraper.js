import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

// Collection URLs to scrape
const collectionUrls = [
  'https://www.bbcgoodfood.com/recipes/collection/quick-recipes',
  'https://www.bbcgoodfood.com/recipes/collection/easy-recipes',
  'https://www.bbcgoodfood.com/recipes/collection/under-20-minutes-recipes',
  'https://www.bbcgoodfood.com/recipes/collection/15-minute-meal-recipes',
  'https://www.bbcgoodfood.com/recipes/collection/quick-chicken-recipes',
  'https://www.bbcgoodfood.com/recipes/collection/quick-and-healthy-recipes',
  'https://www.bbcgoodfood.com/recipes/collection/speedy-suppers-recipes',
  'https://www.bbcgoodfood.com/recipes/collection/quick-meal-two-recipes',
  'https://www.bbcgoodfood.com/recipes/collection/quick-dinner-recipes'
];

async function scrapeCollection(url) {
  try {
    console.log(`\n📥 Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`❌ Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract recipe links - BBC Good Food uses various selectors
    // Try multiple selectors to catch all recipe links
    const recipes = new Set();
    
    // Common selectors for recipe links
    $('a[href*="/recipes/"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      
      // Filter out collection links and keep only individual recipe links
      if (href && 
          href.includes('/recipes/') && 
          !href.includes('/collection/') &&
          !href.includes('/search') &&
          text.length > 0) {
        
        // Ensure it's an absolute URL
        const fullUrl = href.startsWith('http') ? href : `https://www.bbcgoodfood.com${href}`;
        recipes.add(fullUrl);
      }
    });

    console.log(`✅ Found ${recipes.size} recipes`);
    return Array.from(recipes);

  } catch (error) {
    console.error(`❌ Error scraping ${url}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('🔍 BBC Good Food Recipe Scraper\n');
  console.log(`Scraping ${collectionUrls.length} collection pages...\n`);
  
  const allRecipes = new Set();
  
  // Process collections sequentially with delay to avoid rate limiting
  for (const url of collectionUrls) {
    const recipes = await scrapeCollection(url);
    recipes.forEach(recipe => allRecipes.add(recipe));
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Convert to array and sort
  const recipeArray = Array.from(allRecipes).sort();
  
  console.log(`\n\n📊 RESULTS\n`);
  console.log(`Total unique recipes: ${recipeArray.length}\n`);
  console.log('Recipe URLs:');
  console.log('─'.repeat(80));
  
  recipeArray.forEach((recipe, index) => {
    console.log(`${index + 1}. ${recipe}`);
  });

  // Save to file
  const output = {
    timestamp: new Date().toISOString(),
    totalRecipes: recipeArray.length,
    recipes: recipeArray
  };

  fs.writeFileSync('/home/claude/recipes.json', JSON.stringify(output, null, 2));
  console.log(`\n✅ Results saved to recipes.json`);
  
  // Also save as plain text
  fs.writeFileSync('/home/claude/recipes.txt', recipeArray.join('\n'));
  console.log(`✅ Plain text list saved to recipes.txt`);
}

main().catch(console.error);
