import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPantryItems, insertPantryItem, deletePantryItem } from '../db/db.js';

const router = Router();

/** GET /api/pantry — list all pantry staples */
router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(getPantryItems());
  } catch (error) {
    console.error('Error fetching pantry items:', error);
    res.status(500).json({ error: 'Failed to fetch pantry items' });
  }
});

/** POST /api/pantry — add a pantry staple */
router.post('/', (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const id = uuidv4();
    insertPantryItem(id, String(name));
    res.status(201).json({ id, name: String(name).trim().toLowerCase() });
  } catch (error) {
    console.error('Error adding pantry item:', error);
    res.status(500).json({ error: 'Failed to add pantry item' });
  }
});

/** DELETE /api/pantry/:id — remove a pantry staple */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deletePantryItem(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: 'Pantry item not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting pantry item:', error);
    res.status(500).json({ error: 'Failed to delete pantry item' });
  }
});

export default router;
