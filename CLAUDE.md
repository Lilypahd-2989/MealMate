# MealMate — Claude Code Project Context

## What This Project Is
MealMate is a self-hosted personal meal planning app — a HelloFresh alternative built for one person's specific dietary needs. It generates weekly dinner plans, handles recipe scraping, parses ingredients, and produces a formatted grocery list. The developer has no professional coding background; AI-assisted tooling is the primary development method.

---

## Stack & Architecture
- **IDE**: Antigravity (Gemini handles frontend/UI within it)
- **Bug fixes & backend logic**: Claude Code (you)
- **Strategy & architecture decisions**: Claude (claude.ai chat)
- **Version control**: GitHub — https://github.com/Lilypahd-2989/MealMate
- **Language**: Python (backend), frontend via Antigravity/Gemini
- **Current phase**: Phase 2 complete — bug fixing and feature backlog active

---

## Dietary Profile (Core Logic Context)
This is the single user's dietary profile that drives all meal planning logic:

- **Goal**: Lean/cutting — high protein, moderate-to-low carb
- **Primary protein**: Chicken (primary), other lean proteins acceptable
- **Meal structure**: 4 dinners per week + leftovers as next-day lunches
- **Prep time**: 30–45 minutes max, batch prep on Sundays acceptable
- **Recipe sources** (free, scraping-approved): BBC Good Food, Bon Appétit, Allrecipes, AH Allerhande
- **Location**: Brussels, Belgium — metric units (grams, ml, kg), Dutch/English recipe sources

---

## Known Bugs & Fixed Issues (Do Not Reintroduce)
- **Ingredient parser**: Had issues correctly separating quantity, unit, and ingredient name — check parser logic before touching ingredient handling
- **Grocery list output**: Was not formatting correctly for practical use — output must be clean, grouped, and human-readable
- **Unit conversion**: Metric units required throughout; imperial conversions caused downstream issues

---

## Coding Conventions
- **Always use metric units** — never imperial
- **Prefer simple, readable code** over clever abstractions — the developer needs to understand and debug it
- **Add comments** to non-obvious logic — explain the "why", not just the "what"
- **Error messages should be human-readable** — not just stack traces
- **Don't refactor working code** unless explicitly asked — stability over elegance
- **Test outputs manually** — no automated test suite exists yet; flag when something should be verified by running it

---

## File Structure Notes
*(Update this as the project evolves)*
- Grocery list output should be human-readable and grouped by category (produce, protein, dairy, etc.)
- Recipe scraping logic lives separately from meal planning logic
- Ingredient parser is a known fragile component — treat with care

---

## How to Work With Me
- I will often describe what I want in plain language, not technical terms — infer intent charitably
- If something could break existing working functionality, warn me before proceeding
- When you've fixed a bug, tell me exactly how to test it
- If you're unsure about my intent, ask one clarifying question — don't assume and build the wrong thing
- Prefer incremental changes over large rewrites
- When I ask "why is this broken", explain it simply before jumping to a fix

---

## Feature Backlog (Reference)
*(Add to this as features are scoped)*
- [ ] Improved grocery list grouping by store section
- [ ] Recipe variation / swap suggestions
- [ ] Nutrition estimate per meal
- [ ] Weekly meal plan export (readable format)

---

## External Services
- **Firecrawl API**: Used for recipe scraping — key stored in `.env` as `FIRECRAWL_API_KEY`
- Ensure `.env` is in `.gitignore` — never commit API keys

---

*Last updated: March 2026*
