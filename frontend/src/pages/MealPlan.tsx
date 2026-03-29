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
  
  // For recipe picker
  const [libraryRecipes, setLibraryRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch or create current week plan
  useEffect(() => {
    fetchMealPlan();
    fetchLibrary();
  }, []);

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
        <h2 className="panel-title">🛒 Auto-Generated Grocery List</h2>
        
        {plan.generated_grocery_list.length === 0 ? (
          <p className="empty-list-text">Add recipes to your plan to generate a shopping list.</p>
        ) : (
          <div className="grocery-departments-grid">
            {Object.entries(
              plan.generated_grocery_list.reduce((acc, item) => {
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
                    <li key={idx} className="ingredient-item">
                      <div className="ingredient-dot"></div>
                      <div className="ingredient-amount">
                        {item.amount !== null && item.amount > 0
                          ? `${item.amount} ${item.unit || ''}`.trim()
                          : 'to taste'}
                      </div>
                      <div className="ingredient-name">{item.name}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

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
