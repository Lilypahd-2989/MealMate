import { useState, useEffect } from 'react';

// Similar to backend types, but frontend only needs partial
interface Recipe {
  id: string;
  title: string;
  cuisine: string | null;
  total_time_min: number | null;
  nutrition: { calories?: number | null; protein_g?: number | null } | null;
  tags: string[];
  image_url: string | null;
  servings: number;
}

interface PlannedMeal {
  id: string;
  day: string;
  meal_type: string;
  servings: number | null;
  recipe: Recipe;
}

interface GroceryItem {
  name: string;
  amount: number | null;
  unit: string | null;
  category: string | null;
  notes: string[] | null;
  is_leftover: boolean;
  ah_search_term?: string | null;
}

interface AHProduct {
  id: number;
  title: string;
  price: number | null;
  unitSize: string | null;
  imageUrl: string | null;
  productUrl: string;
}

interface AHSearchResult {
  ingredient: GroceryItem;
  products: AHProduct[];
}

interface MealPlanData {
  id: string;
  week_start: string;
  meals: PlannedMeal[];
  generated_grocery_list: GroceryItem[];
}

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function MealPlan() {
  const [plan, setPlan] = useState<MealPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Pantry filter
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [filterPantry, setFilterPantry] = useState(true);

  // AH shopping list
  const [ahSearching, setAhSearching] = useState(false);
  const [ahResults, setAhResults] = useState<AHSearchResult[] | null>(null);
  const [ahSelections, setAhSelections] = useState<Record<number, number>>({}); // resultIdx → productIdx
  const [ahExcluded, setAhExcluded] = useState<Set<number>>(new Set());

  // For recipe picker
  const [libraryRecipes, setLibraryRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch or create current week plan
  useEffect(() => {
    fetchMealPlan();
    fetchLibrary();
    fetchPantry();
  }, []);

  const fetchPantry = async () => {
    try {
      const res = await fetch('/api/pantry');
      const items: Array<{ id: string; name: string }> = await res.json();
      setPantryItems(items.map(i => i.name.toLowerCase()));
    } catch (err) {
      console.error('Failed to fetch pantry items:', err);
    }
  };

  const fetchMealPlan = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/meal-plans');
      const data = await res.json();
      
      let activePlanId;
      if (data.plans && data.plans.length > 0) {
        activePlanId = data.plans[0].id;
      } else {
        // Create a new plan for current week (using today's date placeholder for now)
        function getMonday(d: Date) {
          d = new Date(d);
          var day = d.getDay(),
              diff = d.getDate() - day + (day == 0 ? -6 : 1); 
          return new Date(d.setDate(diff));
        }
        const monday = getMonday(new Date());
        const yyyy = monday.getFullYear();
        const mm = String(monday.getMonth() + 1).padStart(2, '0');
        const dd = String(monday.getDate()).padStart(2, '0');
        
        const createRes = await fetch('/api/meal-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ week_start: `${yyyy}-${mm}-${dd}` })
        });
        const newPlan = await createRes.json();
        activePlanId = newPlan.id;
      }

      // Fetch the full plan details including merged groceries
      const planRes = await fetch(`/api/meal-plans/${activePlanId}`);
      if (planRes.ok) {
        setPlan(await planRes.json());
      }
    } catch (err) {
      console.error('Error fetching/creating meal plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLibrary = async () => {
    try {
      const res = await fetch('/api/recipes');
      const data = await res.json();
      setLibraryRecipes(data.recipes || []);
    } catch (err) {
      console.error('Error fetching recipes for picker:', err);
    }
  };

  const openPicker = (day: string) => {
    setSelectedDay(day);
    setSearchQuery('');
    setModalOpen(true);
  };

  const closePicker = () => {
    setModalOpen(false);
    setSelectedDay(null);
  };

  const assignRecipe = async (recipeId: string) => {
    if (!plan || !selectedDay) return;
    const recipe = libraryRecipes.find(r => r.id === recipeId);
    try {
      await fetch(`/api/meal-plans/${plan.id}/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: recipeId,
          day: selectedDay.toLowerCase(),
          meal_type: 'dinner',
          servings: recipe?.servings ?? null
        })
      });
      // Re-fetch to get updated plan + grocery list
      fetchMealPlan();
      closePicker();
    } catch (err) {
      console.error('Failed to assign recipe', err);
    }
  };

  const removeRecipe = async (mealId: string) => {
    if (!plan) return;
    try {
      await fetch(`/api/meal-plans/${plan.id}/meals/${mealId}`, {
        method: 'DELETE'
      });
      fetchMealPlan();
    } catch (err) {
      console.error('Failed to remove meal', err);
    }
  };

  const updateServings = async (mealId: string, newServings: number) => {
    if (!plan || newServings < 1) return;
    try {
      await fetch(`/api/meal-plans/${plan.id}/meals/${mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servings: newServings })
      });
      fetchMealPlan();
    } catch (err) {
      console.error('Failed to update servings', err);
    }
  };

  const searchAH = async () => {
    if (!plan) return;
    const visibleList = filterPantry
      ? plan.generated_grocery_list.filter(item =>
          !pantryItems.some(p => item.name.toLowerCase().includes(p))
        )
      : plan.generated_grocery_list;

    const shoppableItems = visibleList.filter(i => !i.is_leftover);
    if (shoppableItems.length === 0) return;

    setAhSearching(true);
    setAhResults(null);
    setAhSelections({});
    setAhExcluded(new Set());

    try {
      const res = await fetch('/api/shopping-lists/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: shoppableItems }),
      });
      const data = await res.json();
      setAhResults(data.results);
    } catch (err) {
      console.error('AH search failed', err);
    } finally {
      setAhSearching(false);
    }
  };

  const openAHCart = () => {
    if (!ahResults) return;
    const productIds = ahResults
      .filter((_, idx) => !ahExcluded.has(idx))
      .map((result, idx) => {
        const productIdx = ahSelections[idx] ?? 0;
        return result.products[productIdx];
      })
      .filter(Boolean)
      .map(p => `wi${p!.id}`)
      .join(',');

    if (!productIds) return;

    // AH shopping list URL — opens a pre-populated list on ah.be.
    // User logs in once and all items are ready to add to cart.
    const listUrl = `https://www.ah.be/mijn-producten/lijstje?product=${productIds}`;
    window.open(listUrl, '_blank');
  };

  const filteredRecipes = libraryRecipes.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <p>Loading meal plan...</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="empty-state">
        <p>No meal plan available.</p>
      </div>
    );
  }

  // Helper to find meal for a day
  const getMealForDay = (day: string) => {
    return plan.meals.find(m => m.day.toLowerCase() === day.toLowerCase());
  };

  return (
    <div className="meal-plan-page">
      <div className="page-header">
        <h1 className="page-title">Weekly Meal Plan</h1>
        <p className="page-subtitle">Plan your dinners for the week. Your grocery list will update automatically.</p>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {WEEK_DAYS.map(day => {
          const meal = getMealForDay(day);
          return (
            <div key={day} className="calendar-day-col">
              <div className="calendar-day-header">{day}</div>
              {meal ? (
                <div className="recipe-slot filled">
                  {meal.recipe.image_url ? (
                    <img src={meal.recipe.image_url} alt={meal.recipe.title} className="recipe-slot-image" />
                  ) : (
                    <div className="recipe-slot-image-placeholder">🍽️</div>
                  )}
                  <div className="recipe-slot-content">
                    <h3 className="recipe-slot-title">{meal.recipe.title}</h3>
                    <div className="recipe-slot-meta">
                      <span>{meal.recipe.total_time_min ? `${meal.recipe.total_time_min}m` : '--m'}</span>
                      <span>·</span>
                      <span className="protein-text">{meal.recipe.nutrition?.protein_g ? `${meal.recipe.nutrition.protein_g}g Pro` : '--'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Servings:</span>
                      <button 
                        style={{ width: '24px', height: '24px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }} 
                        onClick={() => updateServings(meal.id, (meal.servings ?? meal.recipe.servings) - 1)}>-</button>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{meal.servings ?? meal.recipe.servings}</span>
                      <button 
                        style={{ width: '24px', height: '24px', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                        onClick={() => updateServings(meal.id, (meal.servings ?? meal.recipe.servings) + 1)}>+</button>
                    </div>
                  </div>
                  <button 
                    className="recipe-slot-remove btn-danger" 
                    onClick={() => removeRecipe(meal.id)}
                    aria-label="Remove recipe"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="recipe-slot empty" onClick={() => openPicker(day)}>
                  <div className="slot-empty-icon">➕</div>
                  <div className="slot-empty-text">Add Recipe</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Shopping List Panel */}
      <div className="shopping-list-panel card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 className="panel-title" style={{ marginBottom: 0 }}>🛒 Auto-Generated Grocery List</h2>
          <button
            className={`btn btn-secondary`}
            style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-2) var(--space-3)' }}
            onClick={() => setFilterPantry(p => !p)}
            title="Toggle pantry staples visibility"
          >
            🧂 Pantry: {filterPantry ? 'Hidden' : 'Shown'}
          </button>
        </div>

        {(() => {
          const visibleList = filterPantry
            ? plan.generated_grocery_list.filter(item =>
                !pantryItems.some(p => item.name.toLowerCase().includes(p))
              )
            : plan.generated_grocery_list;

          return visibleList.length === 0 ? (
            <p className="empty-list-text">
              {plan.generated_grocery_list.length === 0
                ? 'Add recipes to your plan to generate a shopping list.'
                : 'All ingredients are pantry staples. Toggle pantry to show them.'}
            </p>
          ) : (
            <div className="grocery-departments-grid">
              {Object.entries(
                visibleList.reduce((acc, item) => {
                  const dept = item.category || 'Other';
                  if (!acc[dept]) acc[dept] = [];
                  acc[dept].push(item);
                  return acc;
                }, {} as Record<string, GroceryItem[]>)
              ).map(([dept, items]) => (
                <div key={dept} className="grocery-department">
                  <h3 className="grocery-dept-title">{dept}</h3>
                  <ul className="ingredient-list">
                    {items.map((item, idx) => (
                      <li key={idx} className="ingredient-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <div className="ingredient-dot"></div>
                          <div className="ingredient-amount" style={{ opacity: item.is_leftover ? 0.5 : 1 }}>
                            {item.is_leftover
                              ? '—'
                              : item.amount !== null && item.amount > 0
                                ? `${item.amount} ${item.unit || ''}`.trim()
                                : 'to taste'}
                          </div>
                          <div className="ingredient-name">{item.name}</div>
                        </div>
                        {item.is_leftover && item.notes && item.notes.length > 0 && (
                          <div style={{ paddingLeft: 'calc(var(--space-3) + 12px)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                            {item.notes[0]}
                          </div>
                        )}
                        {!item.is_leftover && item.notes && item.notes.length > 0 && (
                          <div style={{ paddingLeft: 'calc(var(--space-3) + 12px)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            {item.notes.join(' · ')}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* AH Submit Button */}
      {plan.generated_grocery_list.some(i => !i.is_leftover) && (
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={ahResults ? () => setAhResults(null) : searchAH}
            disabled={ahSearching}
          >
            {ahSearching ? '⏳ Searching AH...' : ahResults ? '✕ Close AH Review' : '🛒 Submit to Albert Heijn'}
          </button>
        </div>
      )}

      {/* AH Product Review Panel */}
      {ahResults && (
        <div className="card ah-review-panel" style={{ marginTop: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h2 className="panel-title" style={{ marginBottom: 0 }}>🧡 Albert Heijn — Review & Order</h2>
            <button
              className="btn btn-primary"
              onClick={openAHCart}
              style={{ fontSize: 'var(--font-size-sm)' }}
            >
              Open List on AH ({ahResults.filter((_, i) => !ahExcluded.has(i)).length} items) →
            </button>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            All selected items open as a single shopping list on ah.be. Log in and add everything to your cart.
          </p>

          <div className="ah-results-list">
            {ahResults.map((result, idx) => {
              const selectedIdx = ahSelections[idx] ?? 0;
              const selectedProduct = result.products[selectedIdx];
              const excluded = ahExcluded.has(idx);

              return (
                <div
                  key={idx}
                  className={`ah-result-row ${excluded ? 'ah-excluded' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={!excluded}
                    onChange={() => {
                      setAhExcluded(prev => {
                        const next = new Set(prev);
                        excluded ? next.delete(idx) : next.add(idx);
                        return next;
                      });
                    }}
                    className="ah-checkbox"
                  />

                  <div className="ah-ingredient-label">
                    <span className="ah-ingredient-name">{result.ingredient.name}</span>
                    {result.ingredient.amount != null && (
                      <span className="ah-ingredient-amount">
                        {result.ingredient.amount} {result.ingredient.unit || ''}
                      </span>
                    )}
                  </div>

                  {selectedProduct ? (
                    <div className="ah-product-match">
                      {selectedProduct.imageUrl && (
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.title}
                          className="ah-product-image"
                        />
                      )}
                      <div className="ah-product-info">
                        <span className="ah-product-title">{selectedProduct.title}</span>
                        <span className="ah-product-meta">
                          {selectedProduct.unitSize && <span>{selectedProduct.unitSize}</span>}
                          {selectedProduct.price != null && (
                            <span className="ah-product-price">€{selectedProduct.price.toFixed(2)}</span>
                          )}
                        </span>
                      </div>
                      {result.products.length > 1 && (
                        <select
                          className="ah-alt-select"
                          value={selectedIdx}
                          onChange={e => setAhSelections(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                        >
                          {result.products.map((p, pi) => (
                            <option key={p.id} value={pi}>{p.title}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <span className="ah-no-match">No match found</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-lg" onClick={openAHCart}>
              🛒 Open Shopping List on ah.be ({ahResults.filter((_, i) => !ahExcluded.has(i)).length} items)
            </button>
          </div>
        </div>
      )}

      {/* Recipe Picker Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closePicker}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select a Recipe for {selectedDay}</h2>
              <button className="modal-close" onClick={closePicker}>✕</button>
            </div>
            
            <div className="search-input-wrapper" style={{ marginBottom: 'var(--space-6)' }}>
              <span className="search-input-icon">🔍</span>
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search recipes..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="recipe-picker-grid">
              {filteredRecipes.length > 0 ? (
                filteredRecipes.map(r => (
                  <div 
                    key={r.id} 
                    className="card recipe-picker-card"
                    onClick={() => assignRecipe(r.id)}
                  >
                    {r.image_url ? (
                      <img src={r.image_url} alt={r.title} className="rpc-image" />
                    ) : (
                      <div className="rpc-image-placeholder">🍽️</div>
                    )}
                    <div className="rpc-body">
                      <h4 className="rpc-title">{r.title}</h4>
                      <div className="rpc-meta">
                        <span>{r.total_time_min || '--'}m</span>
                        <span>·</span>
                        <span>{r.nutrition?.protein_g ? `${r.nutrition.protein_g}g Pro` : ''}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)' }}>
                  No recipes found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
