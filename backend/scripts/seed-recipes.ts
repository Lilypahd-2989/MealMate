import { getDb, insertRecipe } from '../src/db/db.js';
import { v4 as uuidv4 } from 'uuid';

// Seed recipes matching Lee's preferences: high-protein, 30-45 min, leftover-friendly
const recipes = [
  {
    title: 'Lemon Herb Chicken Thighs with Roasted Cauliflower',
    cuisine: 'Mediterranean', servings: 4, prep_time_min: 15, cook_time_min: 35, total_time_min: 50,
    tags: ['high-protein', 'meal-prep-friendly', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken thighs, bone-in', amount: 800, unit: 'g', raw: '800g chicken thighs', category: 'protein', ah_search_term: 'kippendijen' },
      { name: 'cauliflower', amount: 1, unit: 'whole', raw: '1 cauliflower', category: 'vegetable', ah_search_term: 'bloemkool' },
      { name: 'lemon', amount: 2, unit: 'whole', raw: '2 lemons', category: 'other', ah_search_term: 'citroen' },
      { name: 'fresh thyme', amount: 4, unit: 'sprigs', raw: '4 sprigs thyme', category: 'spice', ah_search_term: 'tijm' },
      { name: 'garlic cloves', amount: 4, unit: 'cloves', raw: '4 garlic cloves', category: 'vegetable', ah_search_term: 'knoflook' },
    ],
    instructions: ['Preheat oven to 200°C.', 'Season chicken with lemon zest, thyme, salt, pepper.', 'Cut cauliflower into florets, toss with olive oil.', 'Arrange chicken and cauliflower on baking tray.', 'Roast 35 minutes until golden and cooked through.', 'Squeeze lemon juice over before serving.'],
    nutrition: { calories: 420, protein_g: 38, carbs_g: 12, fat_g: 22, fibre_g: 4 },
    leftover_friendly: true, leftover_note: 'Shred chicken for next-day salad with spinach and lemon dressing',
  },
  {
    title: 'Chicken Shawarma Bowl',
    cuisine: 'Middle Eastern', servings: 4, prep_time_min: 20, cook_time_min: 15, total_time_min: 35,
    tags: ['high-protein', 'meal-prep-friendly', 'leftover-friendly', 'low-carb'],
    ingredients: [
      { name: 'chicken breast', amount: 600, unit: 'g', raw: '600g chicken breast', category: 'protein', ah_search_term: 'kipfilet' },
      { name: 'Greek yoghurt', amount: 150, unit: 'g', raw: '150g Greek yoghurt', category: 'dairy', ah_search_term: 'Griekse yoghurt' },
      { name: 'cucumber', amount: 1, unit: 'whole', raw: '1 cucumber', category: 'vegetable', ah_search_term: 'komkommer' },
      { name: 'cherry tomatoes', amount: 200, unit: 'g', raw: '200g cherry tomatoes', category: 'vegetable', ah_search_term: 'cherrytomaten' },
      { name: 'red onion', amount: 1, unit: 'whole', raw: '1 red onion', category: 'vegetable', ah_search_term: 'rode ui' },
      { name: 'baby spinach', amount: 100, unit: 'g', raw: '100g baby spinach', category: 'vegetable', ah_search_term: 'babyspinazie' },
    ],
    instructions: ['Mix cumin, paprika, turmeric, cinnamon for shawarma spice.', 'Slice chicken and coat with spice mix and olive oil.', 'Cook chicken in hot pan 6-7 min until charred.', 'Make quick pickled onion with red wine vinegar.', 'Assemble bowls: spinach, chicken, tomatoes, cucumber, pickled onion.', 'Drizzle with yoghurt sauce.'],
    nutrition: { calories: 380, protein_g: 42, carbs_g: 14, fat_g: 16, fibre_g: 3 },
    leftover_friendly: true, leftover_note: 'Perfect cold as next-day lunch salad',
  },
  {
    title: 'One-Pan Chicken with Cherry Tomatoes & Spinach',
    cuisine: 'Italian', servings: 4, prep_time_min: 10, cook_time_min: 25, total_time_min: 35,
    tags: ['high-protein', 'one-pan', 'quick', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken breast', amount: 600, unit: 'g', raw: '600g chicken breast', category: 'protein', ah_search_term: 'kipfilet' },
      { name: 'cherry tomatoes', amount: 400, unit: 'g', raw: '400g cherry tomatoes', category: 'vegetable', ah_search_term: 'cherrytomaten' },
      { name: 'baby spinach', amount: 200, unit: 'g', raw: '200g baby spinach', category: 'vegetable', ah_search_term: 'babyspinazie' },
      { name: 'mozzarella', amount: 125, unit: 'g', raw: '125g mozzarella', category: 'dairy', ah_search_term: 'mozzarella' },
      { name: 'balsamic vinegar', amount: 2, unit: 'tbsp', raw: '2 tbsp balsamic vinegar', category: 'other', ah_search_term: 'balsamico azijn' },
    ],
    instructions: ['Season chicken breasts, sear in hot pan 3 min each side.', 'Add halved cherry tomatoes around chicken.', 'Cook 15 min until chicken is done and tomatoes burst.', 'Wilt spinach into the pan.', 'Tear mozzarella over top, cover 2 min to melt.', 'Drizzle with balsamic.'],
    nutrition: { calories: 360, protein_g: 44, carbs_g: 10, fat_g: 15, fibre_g: 3 },
    leftover_friendly: true, leftover_note: 'Slice chicken over salad greens with the tomato-spinach mix',
  },
  {
    title: 'Teriyaki Chicken Stir-Fry with Cauliflower Rice',
    cuisine: 'Japanese', servings: 4, prep_time_min: 15, cook_time_min: 15, total_time_min: 30,
    tags: ['high-protein', 'low-carb', 'quick', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken thigh fillets', amount: 600, unit: 'g', raw: '600g chicken thigh fillets', category: 'protein', ah_search_term: 'kipfilet dij' },
      { name: 'cauliflower', amount: 1, unit: 'whole', raw: '1 cauliflower (for rice)', category: 'vegetable', ah_search_term: 'bloemkool' },
      { name: 'broccoli', amount: 200, unit: 'g', raw: '200g broccoli', category: 'vegetable', ah_search_term: 'broccoli' },
      { name: 'spring onions', amount: 4, unit: 'whole', raw: '4 spring onions', category: 'vegetable', ah_search_term: 'bosui' },
      { name: 'sesame seeds', amount: 1, unit: 'tbsp', raw: '1 tbsp sesame seeds', category: 'other', ah_search_term: 'sesamzaad' },
    ],
    instructions: ['Grate cauliflower into rice-sized pieces.', 'Mix soy sauce, honey, ginger, garlic for teriyaki.', 'Cook sliced chicken in hot wok 5 min.', 'Add broccoli, cook 3 min.', 'Add cauliflower rice, cook 3 min.', 'Pour teriyaki sauce, toss. Top with spring onions and sesame.'],
    nutrition: { calories: 350, protein_g: 36, carbs_g: 18, fat_g: 14, fibre_g: 5 },
    leftover_friendly: true, leftover_note: 'Serve cold as an Asian-style salad',
  },
  {
    title: 'Baked Salmon with Roasted Vegetables',
    cuisine: 'Scandinavian', servings: 2, prep_time_min: 10, cook_time_min: 25, total_time_min: 35,
    tags: ['high-protein', 'omega-3', 'fish', 'leftover-friendly'],
    ingredients: [
      { name: 'salmon fillets', amount: 300, unit: 'g', raw: '2 salmon fillets (300g)', category: 'protein', ah_search_term: 'zalmfilet' },
      { name: 'courgette', amount: 1, unit: 'whole', raw: '1 courgette', category: 'vegetable', ah_search_term: 'courgette' },
      { name: 'red pepper', amount: 1, unit: 'whole', raw: '1 red pepper', category: 'vegetable', ah_search_term: 'rode paprika' },
      { name: 'asparagus', amount: 200, unit: 'g', raw: '200g asparagus', category: 'vegetable', ah_search_term: 'asperges' },
      { name: 'lemon', amount: 1, unit: 'whole', raw: '1 lemon', category: 'other', ah_search_term: 'citroen' },
    ],
    instructions: ['Preheat oven to 200°C.', 'Chop vegetables, toss with olive oil and seasoning.', 'Spread on baking tray, roast 10 min.', 'Place salmon on top of veg, season with lemon and dill.', 'Bake 15 min until salmon is flaky.', 'Serve with lemon wedges.'],
    nutrition: { calories: 400, protein_g: 35, carbs_g: 12, fat_g: 24, fibre_g: 4 },
    leftover_friendly: true, leftover_note: 'Flake salmon over mixed salad with roasted veg',
  },
  {
    title: 'Chicken Souvlaki with Greek Salad',
    cuisine: 'Greek', servings: 4, prep_time_min: 20, cook_time_min: 12, total_time_min: 32,
    tags: ['high-protein', 'mediterranean', 'meal-prep-friendly', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken breast', amount: 600, unit: 'g', raw: '600g chicken breast', category: 'protein', ah_search_term: 'kipfilet' },
      { name: 'cucumber', amount: 1, unit: 'whole', raw: '1 cucumber', category: 'vegetable', ah_search_term: 'komkommer' },
      { name: 'feta cheese', amount: 100, unit: 'g', raw: '100g feta', category: 'dairy', ah_search_term: 'feta' },
      { name: 'kalamata olives', amount: 50, unit: 'g', raw: '50g kalamata olives', category: 'other', ah_search_term: 'kalamata olijven' },
      { name: 'oregano', amount: 1, unit: 'tbsp', raw: '1 tbsp dried oregano', category: 'spice', ah_search_term: 'oregano' },
    ],
    instructions: ['Cube chicken, marinate with oregano, lemon, olive oil.', 'Thread onto skewers.', 'Grill or pan-fry 10-12 min turning regularly.', 'Dice cucumber, tomato, red onion for salad.', 'Crumble feta, add olives.', 'Dress salad with olive oil and lemon. Serve with chicken.'],
    nutrition: { calories: 370, protein_g: 40, carbs_g: 8, fat_g: 18, fibre_g: 2 },
    leftover_friendly: true, leftover_note: 'Cube chicken, toss with leftover salad for lunch',
  },
  {
    title: 'Spiced Chicken with Roasted Aubergine & Tahini',
    cuisine: 'Middle Eastern', servings: 4, prep_time_min: 15, cook_time_min: 30, total_time_min: 45,
    tags: ['high-protein', 'leftover-friendly', 'meal-prep-friendly'],
    ingredients: [
      { name: 'chicken thigh fillets', amount: 600, unit: 'g', raw: '600g chicken thigh fillets', category: 'protein', ah_search_term: 'kipfilet dij' },
      { name: 'aubergine', amount: 2, unit: 'whole', raw: '2 aubergines', category: 'vegetable', ah_search_term: 'aubergine' },
      { name: 'tahini', amount: 3, unit: 'tbsp', raw: '3 tbsp tahini', category: 'other', ah_search_term: 'tahini' },
      { name: 'pomegranate seeds', amount: 50, unit: 'g', raw: '50g pomegranate seeds', category: 'other', ah_search_term: 'granaatappelpitjes' },
      { name: 'fresh parsley', amount: 1, unit: 'bunch', raw: '1 bunch parsley', category: 'other', ah_search_term: 'peterselie' },
    ],
    instructions: ['Halve aubergines, score flesh, drizzle with oil.', 'Roast aubergine at 200°C for 25 min.', 'Season chicken with cumin, paprika, coriander.', 'Pan-fry chicken 6 min each side.', 'Mix tahini with lemon juice and water for sauce.', 'Serve chicken on aubergine, drizzle tahini, scatter pomegranate and parsley.'],
    nutrition: { calories: 410, protein_g: 36, carbs_g: 15, fat_g: 23, fibre_g: 6 },
    leftover_friendly: true, leftover_note: 'Chop everything into a grain-free salad bowl',
  },
  {
    title: 'Thai Basil Chicken (Pad Kra Pao)',
    cuisine: 'Thai', servings: 4, prep_time_min: 10, cook_time_min: 10, total_time_min: 20,
    tags: ['high-protein', 'quick', 'low-carb', 'spicy'],
    ingredients: [
      { name: 'chicken mince', amount: 500, unit: 'g', raw: '500g chicken mince', category: 'protein', ah_search_term: 'kipgehakt' },
      { name: 'Thai basil', amount: 1, unit: 'bunch', raw: '1 bunch Thai basil', category: 'other', ah_search_term: 'Thaise basilicum' },
      { name: 'bird eye chillies', amount: 3, unit: 'whole', raw: '3 bird eye chillies', category: 'spice', ah_search_term: 'rawit peper' },
      { name: 'green beans', amount: 150, unit: 'g', raw: '150g green beans', category: 'vegetable', ah_search_term: 'sperziebonen' },
      { name: 'fish sauce', amount: 2, unit: 'tbsp', raw: '2 tbsp fish sauce', category: 'other', ah_search_term: 'vissaus' },
    ],
    instructions: ['Heat oil in wok until smoking.', 'Fry garlic and chillies 30 seconds.', 'Add chicken mince, break up, cook 5 min.', 'Add green beans, cook 3 min.', 'Season with fish sauce, soy sauce, sugar.', 'Toss in Thai basil leaves, serve over cauliflower rice.'],
    nutrition: { calories: 320, protein_g: 34, carbs_g: 8, fat_g: 16, fibre_g: 2 },
    leftover_friendly: true, leftover_note: 'Serve cold over salad greens with lime dressing',
  },
  {
    title: 'Chicken Meatballs with Roasted Mediterranean Veg',
    cuisine: 'Mediterranean', servings: 4, prep_time_min: 20, cook_time_min: 25, total_time_min: 45,
    tags: ['high-protein', 'meal-prep-friendly', 'batch-cook', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken mince', amount: 500, unit: 'g', raw: '500g chicken mince', category: 'protein', ah_search_term: 'kipgehakt' },
      { name: 'courgette', amount: 2, unit: 'whole', raw: '2 courgettes', category: 'vegetable', ah_search_term: 'courgette' },
      { name: 'red pepper', amount: 2, unit: 'whole', raw: '2 red peppers', category: 'vegetable', ah_search_term: 'rode paprika' },
      { name: 'red onion', amount: 2, unit: 'whole', raw: '2 red onions', category: 'vegetable', ah_search_term: 'rode ui' },
      { name: 'parmesan', amount: 30, unit: 'g', raw: '30g parmesan', category: 'dairy', ah_search_term: 'parmezaan' },
    ],
    instructions: ['Mix mince with grated parmesan, garlic, oregano, salt, pepper.', 'Roll into meatballs (about 20).', 'Chop vegetables into chunks, toss with oil.', 'Arrange meatballs and veg on baking tray.', 'Roast at 200°C for 25 min.', 'Serve with a squeeze of lemon.'],
    nutrition: { calories: 380, protein_g: 36, carbs_g: 14, fat_g: 18, fibre_g: 4 },
    leftover_friendly: true, leftover_note: 'Slice meatballs over spinach salad with roasted veg',
  },
  {
    title: 'Garlic Butter Chicken with Wilted Spinach',
    cuisine: 'French', servings: 2, prep_time_min: 5, cook_time_min: 20, total_time_min: 25,
    tags: ['high-protein', 'quick', 'keto', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken breast', amount: 400, unit: 'g', raw: '2 chicken breasts (400g)', category: 'protein', ah_search_term: 'kipfilet' },
      { name: 'butter', amount: 30, unit: 'g', raw: '30g butter', category: 'dairy', ah_search_term: 'roomboter' },
      { name: 'garlic cloves', amount: 4, unit: 'cloves', raw: '4 garlic cloves', category: 'vegetable', ah_search_term: 'knoflook' },
      { name: 'baby spinach', amount: 200, unit: 'g', raw: '200g baby spinach', category: 'vegetable', ah_search_term: 'babyspinazie' },
      { name: 'chicken stock', amount: 100, unit: 'ml', raw: '100ml chicken stock', category: 'other', ah_search_term: 'kippenbouillon' },
    ],
    instructions: ['Season chicken, sear in butter 4 min each side.', 'Remove chicken, add garlic, cook 1 min.', 'Add stock, simmer 2 min.', 'Return chicken, cook 8 min until done.', 'Add spinach, wilt 2 min.', 'Spoon garlic butter sauce over chicken.'],
    nutrition: { calories: 390, protein_g: 46, carbs_g: 4, fat_g: 20, fibre_g: 2 },
    leftover_friendly: true, leftover_note: 'Slice over mixed greens with the garlicky pan juices as dressing',
  },
  {
    title: 'Honey Mustard Chicken Traybake',
    cuisine: 'British', servings: 4, prep_time_min: 10, cook_time_min: 35, total_time_min: 45,
    tags: ['high-protein', 'one-pan', 'meal-prep-friendly', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken drumsticks', amount: 8, unit: 'whole', raw: '8 chicken drumsticks', category: 'protein', ah_search_term: 'kippenpoten' },
      { name: 'sweet potato', amount: 2, unit: 'whole', raw: '2 sweet potatoes', category: 'vegetable', ah_search_term: 'zoete aardappel' },
      { name: 'Dijon mustard', amount: 3, unit: 'tbsp', raw: '3 tbsp Dijon mustard', category: 'other', ah_search_term: 'Dijon mosterd' },
      { name: 'honey', amount: 2, unit: 'tbsp', raw: '2 tbsp honey', category: 'other', ah_search_term: 'honing' },
      { name: 'green beans', amount: 200, unit: 'g', raw: '200g green beans', category: 'vegetable', ah_search_term: 'sperziebonen' },
    ],
    instructions: ['Preheat oven to 200°C.', 'Mix mustard, honey, oil, garlic for glaze.', 'Cube sweet potatoes, toss with oil.', 'Coat drumsticks in glaze.', 'Arrange on tray with sweet potatoes, roast 25 min.', 'Add green beans, roast 10 more min.'],
    nutrition: { calories: 440, protein_g: 34, carbs_g: 28, fat_g: 18, fibre_g: 5 },
    leftover_friendly: true, leftover_note: 'Pull chicken from bone, mix with cubed sweet potato for warm salad',
  },
  {
    title: 'Cajun Chicken with Avocado Salsa',
    cuisine: 'American', servings: 2, prep_time_min: 10, cook_time_min: 12, total_time_min: 22,
    tags: ['high-protein', 'quick', 'low-carb', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken breast', amount: 400, unit: 'g', raw: '2 chicken breasts (400g)', category: 'protein', ah_search_term: 'kipfilet' },
      { name: 'avocado', amount: 1, unit: 'whole', raw: '1 ripe avocado', category: 'vegetable', ah_search_term: 'avocado' },
      { name: 'lime', amount: 1, unit: 'whole', raw: '1 lime', category: 'other', ah_search_term: 'limoen' },
      { name: 'cherry tomatoes', amount: 150, unit: 'g', raw: '150g cherry tomatoes', category: 'vegetable', ah_search_term: 'cherrytomaten' },
      { name: 'mixed salad leaves', amount: 100, unit: 'g', raw: '100g mixed salad', category: 'vegetable', ah_search_term: 'gemengde sla' },
    ],
    instructions: ['Mix cajun spice: paprika, garlic powder, onion powder, cayenne, oregano.', 'Coat chicken in spice mix.', 'Grill or pan-fry 6 min each side.', 'Dice avocado and tomatoes, mix with lime juice and coriander.', 'Slice chicken, serve over salad leaves.', 'Top with avocado salsa.'],
    nutrition: { calories: 380, protein_g: 42, carbs_g: 10, fat_g: 18, fibre_g: 6 },
    leftover_friendly: true, leftover_note: 'Slice chicken for a Cajun chicken salad',
  },
  {
    title: 'Chicken & Vegetable Curry (No Cream)',
    cuisine: 'Indian', servings: 4, prep_time_min: 15, cook_time_min: 25, total_time_min: 40,
    tags: ['high-protein', 'dairy-free', 'batch-cook', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken thigh fillets', amount: 600, unit: 'g', raw: '600g chicken thigh fillets', category: 'protein', ah_search_term: 'kipfilet dij' },
      { name: 'tinned tomatoes', amount: 400, unit: 'g', raw: '400g tin chopped tomatoes', category: 'vegetable', ah_search_term: 'gehakte tomaten blik' },
      { name: 'spinach', amount: 150, unit: 'g', raw: '150g spinach', category: 'vegetable', ah_search_term: 'spinazie' },
      { name: 'coconut milk (light)', amount: 200, unit: 'ml', raw: '200ml light coconut milk', category: 'other', ah_search_term: 'kokosmelk light' },
      { name: 'garam masala', amount: 2, unit: 'tbsp', raw: '2 tbsp garam masala', category: 'spice', ah_search_term: 'garam masala' },
    ],
    instructions: ['Cube chicken, season with garam masala, turmeric.', 'Fry onion and garlic 3 min.', 'Brown chicken 5 min.', 'Add tinned tomatoes and coconut milk.', 'Simmer 20 min until thick.', 'Stir in spinach, cook 2 min. Serve.'],
    nutrition: { calories: 370, protein_g: 35, carbs_g: 12, fat_g: 20, fibre_g: 4 },
    leftover_friendly: true, leftover_note: 'Serve cold over rice or with salad greens',
  },
  {
    title: 'Grilled Chicken Caesar (No Croutons)',
    cuisine: 'American', servings: 2, prep_time_min: 10, cook_time_min: 12, total_time_min: 22,
    tags: ['high-protein', 'low-carb', 'quick', 'classic'],
    ingredients: [
      { name: 'chicken breast', amount: 400, unit: 'g', raw: '2 chicken breasts (400g)', category: 'protein', ah_search_term: 'kipfilet' },
      { name: 'romaine lettuce', amount: 2, unit: 'whole', raw: '2 romaine hearts', category: 'vegetable', ah_search_term: 'romaine sla' },
      { name: 'parmesan', amount: 40, unit: 'g', raw: '40g parmesan', category: 'dairy', ah_search_term: 'parmezaan' },
      { name: 'anchovy fillets', amount: 4, unit: 'whole', raw: '4 anchovy fillets', category: 'protein', ah_search_term: 'ansjovis' },
      { name: 'egg yolk', amount: 1, unit: 'whole', raw: '1 egg yolk', category: 'protein', ah_search_term: 'eieren' },
    ],
    instructions: ['Season and grill chicken 6 min each side.', 'Make dressing: blend anchovy, egg yolk, lemon, garlic, olive oil.', 'Chop romaine lettuce.', 'Toss lettuce with dressing.', 'Slice chicken, place on top.', 'Shave parmesan over the top.'],
    nutrition: { calories: 400, protein_g: 48, carbs_g: 4, fat_g: 20, fibre_g: 2 },
    leftover_friendly: true, leftover_note: 'Already a salad — perfect for next-day lunch as-is',
  },
  {
    title: 'Harissa Chicken with Roasted Sweet Potato',
    cuisine: 'North African', servings: 4, prep_time_min: 10, cook_time_min: 35, total_time_min: 45,
    tags: ['high-protein', 'spicy', 'meal-prep-friendly', 'leftover-friendly'],
    ingredients: [
      { name: 'chicken thighs, bone-in', amount: 800, unit: 'g', raw: '800g chicken thighs', category: 'protein', ah_search_term: 'kippendijen' },
      { name: 'harissa paste', amount: 3, unit: 'tbsp', raw: '3 tbsp harissa paste', category: 'spice', ah_search_term: 'harissa' },
      { name: 'sweet potato', amount: 2, unit: 'whole', raw: '2 sweet potatoes', category: 'vegetable', ah_search_term: 'zoete aardappel' },
      { name: 'red onion', amount: 2, unit: 'whole', raw: '2 red onions', category: 'vegetable', ah_search_term: 'rode ui' },
      { name: 'natural yoghurt', amount: 100, unit: 'g', raw: '100g natural yoghurt', category: 'dairy', ah_search_term: 'naturel yoghurt' },
    ],
    instructions: ['Preheat oven to 200°C.', 'Coat chicken in harissa paste.', 'Cube sweet potatoes and quarter onions.', 'Arrange everything on a baking tray.', 'Roast 35 min until chicken is crispy.', 'Serve with a dollop of cooling yoghurt.'],
    nutrition: { calories: 430, protein_g: 36, carbs_g: 26, fat_g: 20, fibre_g: 4 },
    leftover_friendly: true, leftover_note: 'Shred chicken, cube sweet potato for a spiced lunch bowl',
  },
];

async function seed() {
  console.log('🌱 Seeding database with starter recipes...\n');

  const db = getDb();

  for (const recipe of recipes) {
    const id = uuidv4();
    try {
      insertRecipe({
        id,
        title: recipe.title,
        source_url: null,
        source: 'seed',
        image_url: null,
        servings: recipe.servings,
        prep_time_min: recipe.prep_time_min,
        cook_time_min: recipe.cook_time_min,
        total_time_min: recipe.total_time_min,
        cuisine: recipe.cuisine,
        tags: JSON.stringify(recipe.tags),
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        nutrition: JSON.stringify(recipe.nutrition),
        leftover_friendly: recipe.leftover_friendly ? 1 : 0,
        leftover_note: recipe.leftover_note,
      });
      console.log(`  ✅ ${recipe.title}`);
    } catch (err) {
      console.error(`  ❌ ${recipe.title}:`, err);
    }
  }

  console.log(`\n🎉 Seeded ${recipes.length} recipes!`);
}

seed();
