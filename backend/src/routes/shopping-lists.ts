import express from 'express';
import { searchAHProduct } from '../services/ah-api.js';

const router = express.Router();

interface GroceryItemInput {
  name: string;
  amount: number | null;
  unit: string | null;
  ah_search_term?: string | null;
}

/**
 * POST /api/shopping-lists/search
 * Body: { items: GroceryItemInput[] }
 * Searches AH for each non-leftover ingredient, returns product matches.
 */
router.post('/search', async (req, res) => {
  const { items } = req.body as { items: GroceryItemInput[] };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items array required' });
    return;
  }

  const results = await Promise.all(
    items.map(async item => {
      const query = item.ah_search_term?.trim() || item.name.trim();
      try {
        const products = await searchAHProduct(query, 3);
        return { ingredient: item, products };
      } catch {
        return { ingredient: item, products: [] };
      }
    })
  );

  res.json({ results });
});

export default router;
