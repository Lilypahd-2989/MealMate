# MealMate UI/UX Audit Brief

## What is MealMate?
A self-hosted meal planning app that helps users plan weekly dinners and auto-generate smart grocery lists from recipes scraped off the web (BBC Good Food, Bon Appétit, Allrecipes, etc.). Core flow: import recipes → add to weekly meal plan → view merged grocery list organized by category.

## Key Recent Changes (Last 2 Commits)

### 5 Bug Fixes
- Unicode fraction parsing (½, ¼, ¾) now works correctly in ingredient quantities
- Prep notes ("to taste", "chopped", "minced") stripped from ingredient names
- Size descriptors ("large", "medium", "small") no longer treated as units
- Serving counts now consistently read from the same database field
- Image URLs now logged during recipe import for visibility

### 4 New Features
1. **Pantry Filter** — grocery list hides common staples (salt, olive oil, garlic, etc.) by default; user can toggle to show them; Settings page to manage pantry list
2. **Imperial→Metric** — recipes from US sites auto-convert oz→g, cups→ml, °F→°C at import time
3. **Smart Ingredient Merging** — same ingredients under different names ("chicken breast" + "chicken thighs") now merge into one "Chicken" entry with per-recipe prep notes; "leftover" items flagged instead of summed
4. **Editable Servings** — recipe detail page now has ✏️ button to adjust serving count; nutrition rescales automatically

## Previous Problems Addressed
- Ingredient parser failed on unicode fractions (showed "to taste" as fallback)
- Grocery list cluttered with basic pantry items users already own
- Unit conversion confusing (oz/lb/cups mixed in same list as metric)
- Merged grocery list showed redundant items (e.g., "chicken breast" and "chicken thighs" as separate lines)
- Recipe yield (15 meatballs) couldn't be adjusted to realistic serving (4 meatballs) for accurate nutrition info

---

**Current State:** Fully functional with all 4 features live. Ready for UX/UI feedback on flow, visual clarity, and usability.
