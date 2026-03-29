# MealMate — Project Specification

> **What**: A self-hosted HelloFresh alternative. You choose the recipes, it builds the cart at Albert Heijn, handles delivery, and gives you a daily prep calendar. No subscription, no middleman.
>
> **Who built this spec**: Claude (Anthropic), based on conversations with Lee in March 2026.
>
> **How to use this doc**: Open this in Antigravity. Use Claude (Sonnet or Opus) for backend work, Gemini Pro for frontend/UI. This is your single source of truth.

---

## 1. The Problem

Cooking is enjoyable. The overhead around cooking is not. Deciding what to eat, checking what's in the fridge, making a shopping list, going to the store or ordering online, figuring out quantities so you don't overbuy — all of that friction means you end up eating toast or ordering takeaway even though you'd rather cook.

HelloFresh and similar services solve part of this, but you lose control: you can't pick your own recipes, you pay a premium, and you're locked into their ingredients and portions.

MealMate keeps you in control. You pick recipes you actually want to cook from sources you trust. It handles the rest.

---

## 2. User Profile (Lee — v1 Target User)

- Lives in Antwerp, Belgium (Albert Heijn BE delivery zone)
- Cooks 4 dinners per week (one night out with friends typically)
- Likes: chicken (primary protein), fish occasionally, most vegetables (aubergine, cauliflower, spinach, etc.)
- Cooking style: 30-45 min meals, often on a call while cooking
- Prep willingness: happy to batch-marinate chicken, chop veg, prep tupperwares on Sunday/Monday
- Diet goals: high protein (supporting gym — Mon/Wed/Fri mornings 8-9am), moderate-to-low carb, lean/cutting slightly
- Already consistent with: protein/creatine/yoghurt/fruit smoothie (made night before), salad lunches using dinner leftovers
- Dinners should produce leftovers suitable for next-day lunch salads
- iPhone user (for notifications)

---

## 3. Core Features (v1 — MVP)

### 3.1 Recipe Discovery & Library

**Sources (all free, no paywall):**
- BBC Good Food (bbcgoodfood.com)
- Bon Appétit (bonappetit.com — free articles)
- Allrecipes (allrecipes.com)
- AH Allerhande (ah.nl/allerhande — Albert Heijn's own recipe platform)

**How it works:**
- User can browse/search recipes filtered by: protein type, cook time, cuisine, calorie range
- AI-powered recommendation engine suggests recipes based on user preferences learned over time
- Each recipe is normalised into a standard schema (see Data Model below)
- User saves recipes to their personal library
- Recipes can also be added manually (paste a URL from any site, or enter freeform)

**Recipe Schema:**
```json
{
  "id": "uuid",
  "title": "Lemon Herb Chicken Thighs",
  "source_url": "https://bbcgoodfood.com/...",
  "source": "bbc_good_food",
  "servings": 4,
  "prep_time_min": 15,
  "cook_time_min": 35,
  "total_time_min": 50,
  "cuisine": "Mediterranean",
  "tags": ["high-protein", "meal-prep-friendly", "leftover-friendly"],
  "ingredients": [
    {
      "name": "chicken thighs, bone-in skin-on",
      "amount": 800,
      "unit": "g",
      "category": "protein",
      "ah_search_term": "kipfilet dij",
      "ah_product_id": null
    }
  ],
  "instructions": ["Step 1...", "Step 2..."],
  "nutrition_per_serving": {
    "calories": 420,
    "protein_g": 38,
    "carbs_g": 12,
    "fat_g": 22,
    "fibre_g": 4
  },
  "leftover_friendly": true,
  "leftover_suggestion": "Shred chicken for next-day salad with spinach, cherry tomatoes, and a lemon dressing"
}
```

### 3.2 Weekly Meal Planning

**Flow:**
1. User opens MealMate on Sunday (or whenever)
2. Sees a calendar view for the upcoming week (Mon-Fri)
3. Selects 4 dinner slots (one left empty for eating out)
4. For each slot, either:
   - Pick from their saved library
   - Get AI-suggested recipes based on preferences + what they haven't had recently
   - Search/browse new recipes
5. System auto-generates:
   - A **combined shopping list** with merged quantities (e.g., if two recipes need chicken thighs, combine into one line)
   - A **prep plan** for Sunday/Monday batch session
   - A **daily cooking schedule** showing what to cook each evening and what to prep for tomorrow's lunch

**Smart quantity merging:**
- Ingredients across recipes are matched and combined
- Quantities are rounded up to standard pack sizes available at AH (e.g., don't order 350g chicken if AH sells 500g packs)
- Pantry staples (olive oil, salt, pepper, garlic, common spices) can be marked as "always in stock" and excluded from the list

### 3.3 Albert Heijn Cart Building

**Automation level:** Agent builds the cart, Lee reviews and pays manually.

**Technical approach:**
- Use the AH product search API (`https://api.ah.nl/mobile-services/product/search/v2?query=QUERY&sortOn=RELEVANCE`) to find products
- For each ingredient on the shopping list, search AH and find the best match
- Match on: product name similarity, correct quantity/weight, prefer AH own-brand for basics
- Present a review screen showing: each ingredient → matched AH product → price → quantity
- User can swap products, adjust quantities, remove items
- Generate a deep link or direct API call to add items to AH cart (requires auth — see Auth section)
- Fallback: generate a formatted shopping list the user can manually add to AH app

**AH Authentication (stretch goal, not MVP):**
- AH uses OAuth-style auth via `https://login.ah.nl` (or `login.ah.be` for Belgium)
- Requires intercepting a redirect to get an auth code, then exchanging for access/refresh tokens
- For MVP: skip direct cart building, instead generate an optimised list with AH product links
- For v1.1: implement browser-based auth flow so the agent can add to cart directly

**Belgium consideration:**
- Lee is in Brussels — need to check if AH Belgium (ah.be) uses the same API endpoints or different ones
- AH Belgium login endpoint: `https://login.ah.be/login/nl-BE?client_id=appie-be-ios&redirect_uri=appie://login-exit&response_type=code`

### 3.4 Prep Calendar & Daily View

**Sunday/Monday Prep Session:**
- Shows all batch prep tasks: marinating chicken variants, chopping veg, making dressings
- Organised by sequence (what can happen in parallel, what needs to go first)
- Estimated total prep time
- Produces tupperwares labelled by day/meal

**Daily View (Mon-Fri):**
- What's for dinner tonight (recipe card with instructions)
- What to pull from fridge / what's already prepped
- Estimated cooking time
- What to set aside for tomorrow's lunch
- Timer integration (stretch)

### 3.5 Nutrition Dashboard (Nice to Have)

- Auto-calculated from recipe nutrition data
- Daily/weekly view of: calories, protein, carbs, fat
- Visual: simple bar charts or rings, not overwhelming
- Tracks consistency over time
- Adjusted for gym days (Mon/Wed/Fri) vs rest days

---

## 4. Tech Stack (Recommended)

### Backend
- **Runtime**: Node.js (or Python — Claude Code is strong with both)
- **Framework**: Express.js or Fastify (Node) / FastAPI (Python)
- **Database**: SQLite for v1 (simple, file-based, no setup). Migrate to Postgres later if needed.
- **Recipe scraping**: Cheerio (Node) or BeautifulSoup (Python) for parsing recipe pages
- **AI layer**: Anthropic API (Claude Sonnet) for recipe recommendations, ingredient matching, and meal planning intelligence
- **Agent for AH cart**: Puppeteer or Playwright for browser automation (v1.1)

### Frontend
- **Framework**: React (with Vite for dev server)
- **Styling**: Tailwind CSS
- **State management**: Zustand or React Context (keep it simple)
- **Calendar**: Custom component or a lightweight lib like react-big-calendar
- **Charts** (nutrition): Recharts or Chart.js

### Infrastructure (v1 — local)
- Runs on `localhost:3000` (frontend) and `localhost:3001` (API)
- SQLite database stored locally
- No deployment needed yet
- Data persists between sessions

### Future (v2 — if productised)
- Deploy to Vercel (frontend) + Railway or Fly.io (backend)
- Auth with Clerk or NextAuth
- Multi-user support
- Mobile PWA

---

## 5. Data Model

### Users (v1: single user, but structure for multi-user)
```
users
  id          TEXT PRIMARY KEY
  name        TEXT
  preferences JSON  -- dietary prefs, pantry staples, etc.
  created_at  DATETIME
```

### Recipes
```
recipes
  id                TEXT PRIMARY KEY
  title             TEXT
  source_url        TEXT
  source            TEXT  -- 'bbc_good_food', 'allrecipes', etc.
  servings          INTEGER
  prep_time_min     INTEGER
  cook_time_min     INTEGER
  cuisine           TEXT
  tags              JSON
  ingredients       JSON  -- array of ingredient objects
  instructions      JSON  -- array of step strings
  nutrition         JSON  -- per-serving macros
  leftover_friendly BOOLEAN
  leftover_note     TEXT
  created_at        DATETIME
```

### Meal Plans
```
meal_plans
  id          TEXT PRIMARY KEY
  week_start  DATE  -- Monday of the week
  created_at  DATETIME
```

### Planned Meals
```
planned_meals
  id           TEXT PRIMARY KEY
  plan_id      TEXT REFERENCES meal_plans(id)
  recipe_id    TEXT REFERENCES recipes(id)
  day          TEXT  -- 'monday', 'tuesday', etc.
  meal_type    TEXT  -- 'dinner' (v1), later 'lunch', 'breakfast'
  servings     INTEGER  -- can override recipe default
  created_at   DATETIME
```

### Shopping Lists
```
shopping_lists
  id          TEXT PRIMARY KEY
  plan_id     TEXT REFERENCES meal_plans(id)
  items       JSON  -- merged ingredient list with AH product matches
  status      TEXT  -- 'draft', 'reviewed', 'ordered'
  created_at  DATETIME
```

### Pantry (staples to exclude from shopping)
```
pantry_items
  id    TEXT PRIMARY KEY
  name  TEXT  -- 'olive oil', 'salt', 'black pepper', 'garlic'
```

---

## 6. Recipe Scraping Strategy

Each source needs a dedicated parser. Fortunately, most recipe sites use structured data (JSON-LD with schema.org/Recipe).

### Priority approach:
1. **Check for JSON-LD** first — most sites embed `<script type="application/ld+json">` with Recipe schema. This gives you title, ingredients, instructions, nutrition, times, servings in a standardised format.
2. **Fall back to HTML parsing** if no structured data exists.
3. **URL-based import**: user pastes a URL, system auto-detects source and scrapes.

### Source-specific notes:

**BBC Good Food** (`bbcgoodfood.com`)
- Has JSON-LD Recipe schema
- Good nutrition data
- Free access, no paywall

**Bon Appétit** (`bonappetit.com`)
- Has JSON-LD Recipe schema
- Some articles are free, some gated
- Focus on free recipe pages

**Allrecipes** (`allrecipes.com`)
- Has JSON-LD Recipe schema
- Community-sourced, good variety
- Free access

**AH Allerhande** (`ah.nl/allerhande`)
- This is the golden source — recipes are designed around AH products
- Ingredients may already map directly to AH product IDs
- Check if their recipe pages have structured data or if API endpoints exist

### Ingredient Normalisation:
After scraping, ingredients need to be normalised:
- Parse "2 large chicken breasts (about 500g)" → `{name: "chicken breast", amount: 500, unit: "g"}`
- Map to AH search terms (English ingredient names → Dutch product search terms)
- Build a translation/mapping table over time

---

## 7. Albert Heijn Integration — Detailed

### Product Search (MVP)
```
GET https://api.ah.nl/mobile-services/product/search/v2?query={term}&sortOn=RELEVANCE
Headers:
  User-Agent: Appie/8.22.3
  Content-Type: application/json
```

Returns product list with: name, price, unit size, image, product ID.

### Ingredient → Product Matching Algorithm:
1. For each ingredient, generate an AH search query (translate if needed: "chicken thighs" → "kippendijen")
2. Search AH API
3. Score results by:
   - Name similarity (fuzzy match)
   - Quantity match (closest to needed amount without being under)
   - Price (prefer AH own brand for commodity items)
   - Previous selections (learn from user choices)
4. Present top match + alternatives

### Belgium vs Netherlands:
- Test both `api.ah.nl` and `api.ah.be`
- Login endpoints differ: `login.ah.nl` vs `login.ah.be`
- Product catalogue may differ slightly

### Shopping List Output (MVP):
```json
{
  "items": [
    {
      "ingredient": "chicken thighs",
      "needed": "1.2 kg",
      "ah_product": "AH Kippendijen",
      "ah_quantity": 2,
      "ah_unit": "600g pack",
      "ah_price": 5.49,
      "ah_url": "https://www.ah.nl/producten/product/wi12345",
      "matched_confidence": 0.92
    }
  ],
  "total_estimated": 42.50,
  "pantry_excluded": ["olive oil", "salt", "garlic"]
}
```

---

## 8. Bedtime Shutdown Routine (Separate Feature)

This is a lightweight companion feature — not part of the meal system, but built alongside it.

### Concept:
A "shutdown ritual" that signals to your brain the day is done. Not tracking, just a sequence. The key insight: Lee stays up late not because he's busy, but because he feels the day was incomplete. The ritual provides closure regardless of what got done.

### The Sequence (customisable, starting point):
1. **Set a trigger time** — e.g., 22:00 on weeknights
2. **iPhone notification**: "Shutdown time. Start your sequence."
3. **Step 1 — Close loops (3 min)**: Quick voice note or text dump of anything still on your mind. Gets it out of your head and into a system. Could be a simple text input in the app.
4. **Step 2 — Tomorrow's one thing (1 min)**: What's the single most important thing for tomorrow? Just one. Write it down.
5. **Step 3 — Gratitude/win (1 min)**: One thing that went well today, no matter how small. This directly counters the "I didn't do enough" feeling.
6. **Step 4 — Shutdown phrase**: A specific phrase you say (out loud or mentally) that signals done. Examples: "Shutdown complete." / "The day is done." This sounds silly but it works — Cal Newport popularised this.
7. **Phone goes to Do Not Disturb** — ideally triggered automatically via iOS Shortcuts

### Technical implementation:
- **Trigger**: iOS Shortcut that fires at set time, sends notification
- **Sequence UI**: Simple full-screen view in the web app (dark mode, large text, calming)
- **Data stored**: Just the text dumps and tomorrow's priority (useful for morning review)
- **Integration with Sleep Cycle**: Once Lee exports his data, we can correlate shutdown ritual consistency with sleep quality

### iOS Shortcut:
- Shortcut triggers at 22:00
- Opens Safari to `localhost:3000/shutdown` (or sends a notification with a deep link)
- After completing sequence, triggers Do Not Disturb via Shortcuts automation

---

## 9. Project Structure

```
mealmate/
├── README.md
├── package.json
├── .env                    # AH API config, Anthropic API key
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts             # Express/Fastify server entry
│   │   ├── db/
│   │   │   ├── schema.sql       # SQLite schema
│   │   │   └── db.ts            # Database connection & queries
│   │   ├── routes/
│   │   │   ├── recipes.ts       # CRUD + search + import
│   │   │   ├── meal-plans.ts    # Weekly plan management
│   │   │   ├── shopping.ts      # List generation + AH matching
│   │   │   └── shutdown.ts      # Bedtime routine data
│   │   ├── scrapers/
│   │   │   ├── base.ts          # JSON-LD extractor
│   │   │   ├── bbc-good-food.ts
│   │   │   ├── bon-appetit.ts
│   │   │   ├── allrecipes.ts
│   │   │   └── ah-allerhande.ts
│   │   ├── services/
│   │   │   ├── ah-product.ts    # AH product search & matching
│   │   │   ├── ingredient-merge.ts  # Combine ingredients across recipes
│   │   │   ├── nutrition.ts     # Macro calculations
│   │   │   └── ai-recommend.ts  # Claude-powered suggestions
│   │   └── utils/
│   │       ├── ingredient-parser.ts   # "2 large chicken breasts" → structured
│   │       └── dutch-translate.ts     # Ingredient name translation map
│   └── data/
│       └── mealmate.db         # SQLite database file
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx         # Weekly overview
│   │   │   ├── RecipeLibrary.tsx      # Browse/search/save recipes
│   │   │   ├── RecipeDetail.tsx       # Single recipe view
│   │   │   ├── MealPlan.tsx           # Weekly planner (calendar)
│   │   │   ├── ShoppingList.tsx       # Generated list with AH matches
│   │   │   ├── PrepPlan.tsx           # Batch prep instructions
│   │   │   ├── DailyView.tsx          # Today's cooking plan
│   │   │   ├── Nutrition.tsx          # Macro dashboard
│   │   │   └── Shutdown.tsx           # Bedtime routine (full screen, dark)
│   │   ├── components/
│   │   │   ├── RecipeCard.tsx
│   │   │   ├── IngredientList.tsx
│   │   │   ├── WeekCalendar.tsx
│   │   │   ├── ShoppingItem.tsx
│   │   │   ├── NutritionRing.tsx
│   │   │   └── ShutdownStep.tsx
│   │   ├── hooks/
│   │   ├── stores/
│   │   └── styles/
│   └── public/
│
└── scripts/
    ├── seed-recipes.ts         # Pre-load some starter recipes
    └── import-sleep-data.ts    # Parse Sleep Cycle CSV export
```

---

## 10. Build Order (Phases)

### Phase 1 — Recipe Engine (Week 1)
- [ ] Set up project scaffolding (monorepo, backend + frontend)
- [ ] SQLite database with schema
- [ ] JSON-LD recipe scraper (works for all 4 sources)
- [ ] Recipe import via URL (paste URL → get structured recipe)
- [ ] Recipe library UI (browse, search, save)
- [ ] Seed with 20-30 recipes matching Lee's preferences

### Phase 2 — Meal Planning (Week 2)
- [ ] Weekly calendar UI
- [ ] Drag recipes onto days
- [ ] Ingredient merger (combine across recipes, round to pack sizes)
- [ ] Shopping list generation
- [ ] Pantry staples management (exclude from list)
- [ ] Prep plan generation (batch prep instructions for Sunday)

### Phase 3 — Albert Heijn Integration (Week 3)
- [ ] AH product search API integration
- [ ] Ingredient → product matching algorithm
- [ ] Shopping list review UI (show matches, allow swaps)
- [ ] Generate AH product links (clickable to ah.nl/ah.be)
- [ ] Price estimation

### Phase 4 — Daily Experience + Shutdown (Week 4)
- [ ] Daily cooking view (tonight's recipe, what's prepped, what to save for lunch)
- [ ] Bedtime shutdown routine UI (full-screen dark mode)
- [ ] iOS Shortcut for shutdown trigger
- [ ] Brain dump text input + tomorrow's priority

### Phase 5 — Intelligence + Nutrition (Week 5+)
- [ ] AI recipe recommendations (Claude API)
- [ ] Nutrition dashboard (daily/weekly macros)
- [ ] Gym day adjustments (more protein/carbs on Mon/Wed/Fri)
- [ ] Sleep data import and analysis (Sleep Cycle CSV)
- [ ] Correlation: shutdown consistency vs sleep quality

---

## 11. Antigravity Workflow Recommendation

**Use Claude (Sonnet 4.6 or Opus 4.6) for:**
- Backend architecture and API design
- Database schema and queries
- Recipe scraping logic and parsing
- AH product matching algorithm
- Ingredient parsing and normalisation
- AI recommendation logic
- Business logic and data pipelines

**Use Gemini Pro for:**
- Frontend UI components and pages
- Tailwind styling and responsive design
- Animation and micro-interactions
- Calendar and dashboard layouts
- Chart/data visualisation components
- Dark mode shutdown routine UI

**Manager View agents (parallel work):**
- Agent 1: Backend API + database (Claude)
- Agent 2: Recipe scrapers (Claude)
- Agent 3: Frontend pages + components (Gemini)
- Agent 4: AH integration (Claude)

---

## 12. Environment Variables

```env
# .env
ANTHROPIC_API_KEY=sk-ant-...          # For AI recommendations
AH_API_BASE=https://api.ah.nl        # or api.ah.be for Belgium
AH_USER_AGENT=Appie/8.22.3
PORT_BACKEND=3001
PORT_FRONTEND=3000
DATABASE_PATH=./data/mealmate.db
```

---

## 13. Starter Recipes (Seed Data)

Pre-load these types of recipes that match Lee's profile:
- Lemon herb chicken thighs with roasted cauliflower
- Chicken shawarma bowl with spinach and pickled onion
- Air fryer chicken tenders with aubergine
- One-pan chicken with cherry tomatoes and spinach
- Teriyaki chicken with stir-fried veg (low-carb: serve on cauliflower rice)
- Baked salmon with roasted vegetables
- Chicken souvlaki with Greek salad
- Spiced chicken with roasted aubergine and tahini
- Thai basil chicken (pad kra pao) — no rice or with cauliflower rice
- Chicken meatballs with roasted veg

All should be:
- 30-45 min total time
- High protein (30g+ per serving)
- Produce leftovers good for next-day salad
- Use ingredients commonly available at Albert Heijn

---

## 14. Future Product Vision

If this works well for Lee, the product potential is:

**MealMate** — "HelloFresh without the middleman"
- You choose recipes from anywhere on the internet
- We build the cart at YOUR grocery store
- No subscription, no markup on ingredients
- You're in control of what you eat

**Expansion:**
- Support multiple grocery chains (Colruyt, Delhaize, Jumbo, etc.)
- Multi-user / family plans
- Community recipe sharing
- Macro-optimised meal plans for fitness goals
- Integration with fitness trackers
- Mobile app (React Native or PWA)

---

## 15. Notes for the Developer (Lee)

- You're not a dev, and that's fine. Antigravity + Claude Code will do the heavy lifting.
- Start with Phase 1. Get recipes importing and displaying before worrying about AH integration.
- The AH API is unofficial — it may break. Always have the fallback of a formatted shopping list.
- Don't try to build everything at once. Get the core loop working first: pick recipes → generate list → cook.
- The shutdown routine is separate and simple. Build it whenever you need a break from the meal system.
- Keep this spec open as your reference. Update it as you learn what works and what doesn't.

---

*Last updated: 29 March 2026*
