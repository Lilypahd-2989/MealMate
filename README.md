# 🍽️ MealMate

**A self-hosted HelloFresh alternative.** You choose the recipes, it builds the cart at Albert Heijn, handles delivery, and gives you a daily prep calendar. No subscription, no middleman.

## Quick Start

```bash
# Install dependencies
npm install

# Seed the database with starter recipes
npm run seed

# Start development servers (backend + frontend)
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Tech Stack

- **Backend**: Express.js + TypeScript + SQLite (better-sqlite3)
- **Frontend**: React + Vite + TypeScript
- **Scraping**: Cheerio (JSON-LD extraction)

## Project Structure

```
mealmate/
├── backend/          # Express API server
│   ├── src/
│   │   ├── db/       # Database schema & connection
│   │   ├── routes/   # API endpoints
│   │   ├── scrapers/ # Recipe scrapers (JSON-LD)
│   │   ├── services/ # Business logic
│   │   └── utils/    # Helpers
│   └── data/         # SQLite database (gitignored)
├── frontend/         # React + Vite app
│   └── src/
│       ├── pages/    # Route pages
│       ├── components/
│       └── styles/
└── scripts/          # Seed data, imports
```
