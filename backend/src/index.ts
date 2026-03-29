import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/db.js';
import recipesRouter from './routes/recipes.js';
import mealPlansRouter from './routes/meal-plans.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT_BACKEND || '3001', 10);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Initialize database
getDb();

// Routes
app.use('/api/recipes', recipesRouter);
app.use('/api/meal-plans', mealPlansRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('  🍽️  MealMate API Server');
  console.log(`  ➜  http://localhost:${PORT}`);
  console.log(`  ➜  Health: http://localhost:${PORT}/api/health`);
  console.log('');
});

export default app;
