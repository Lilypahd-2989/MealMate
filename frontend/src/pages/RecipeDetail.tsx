import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface Ingredient {
  name: string;
  amount: number | null;
  unit: string | null;
  raw: string;
  category: string | null;
}

interface Recipe {
  id: string;
  title: string;
  source_url: string | null;
  source: string | null;
  image_url: string | null;
  servings: number;
  prep_time_min: number | null;
  cook_time_min: number | null;
  total_time_min: number | null;
  cuisine: string | null;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  nutrition: {
    calories?: number | null;
    protein_g?: number | null;
    carbs_g?: number | null;
    fat_g?: number | null;
    fibre_g?: number | null;
  } | null;
  leftover_friendly: boolean;
  leftover_note: string | null;
}

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [editingServings, setEditingServings] = useState(false);
  const [servingsInput, setServingsInput] = useState('');
  const [savingServings, setSavingServings] = useState(false);

  useEffect(() => {
    const fetchRecipe = async () => {
      try {
        const res = await fetch(`/api/recipes/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setRecipe(data);
      } catch {
        navigate('/recipes');
      } finally {
        setLoading(false);
      }
    };
    fetchRecipe();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!confirm('Delete this recipe?')) return;
    setDeleting(true);
    try {
      await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      navigate('/recipes');
    } catch {
      setDeleting(false);
    }
  };

  const startEditServings = () => {
    if (!recipe) return;
    setServingsInput(String(recipe.servings));
    setEditingServings(true);
  };

  const saveServings = async () => {
    if (!recipe) return;
    const newServings = Math.max(1, parseInt(servingsInput, 10) || 1);
    if (newServings === recipe.servings) { setEditingServings(false); return; }

    setSavingServings(true);
    try {
      const ratio = recipe.servings / newServings;
      const n = recipe.nutrition;
      const newNutrition = n ? {
        calories:  n.calories  != null ? Math.round(n.calories  * ratio)           : null,
        protein_g: n.protein_g != null ? Math.round(n.protein_g * ratio * 10) / 10 : null,
        carbs_g:   n.carbs_g   != null ? Math.round(n.carbs_g   * ratio * 10) / 10 : null,
        fat_g:     n.fat_g     != null ? Math.round(n.fat_g     * ratio * 10) / 10 : null,
        fibre_g:   n.fibre_g   != null ? Math.round(n.fibre_g   * ratio * 10) / 10 : null,
      } : null;

      await fetch(`/api/recipes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servings: newServings, nutrition: newNutrition }),
      });

      // Refresh recipe data from server
      const res = await fetch(`/api/recipes/${id}`);
      if (res.ok) setRecipe(await res.json());
      setEditingServings(false);
    } catch (err) {
      console.error('Failed to save servings:', err);
    } finally {
      setSavingServings(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <span>Loading recipe...</span>
      </div>
    );
  }

  if (!recipe) return null;

  const n = recipe.nutrition;

  return (
    <div className="recipe-detail">
      <div className="recipe-detail-header">
        <button className="recipe-detail-back" onClick={() => navigate('/recipes')}>
          ← Back to Library
        </button>

        <h1 className="recipe-detail-title">{recipe.title}</h1>

        <div className="recipe-detail-meta">
          <div className="recipe-detail-meta-item">
            <span className="recipe-detail-meta-value">{recipe.total_time_min ?? '—'}</span>
            <span className="recipe-detail-meta-label">Minutes</span>
          </div>
          <div className="recipe-detail-meta-item">
            {editingServings ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="number"
                  min="1"
                  value={servingsInput}
                  onChange={e => setServingsInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveServings(); if (e.key === 'Escape') setEditingServings(false); }}
                  style={{ width: '56px', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-accent)', fontSize: 'var(--font-size-lg)', fontWeight: 700, textAlign: 'center' }}
                  autoFocus
                />
                <button className="btn btn-primary" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)' }} onClick={saveServings} disabled={savingServings}>
                  {savingServings ? '…' : '✓'}
                </button>
                <button className="btn btn-ghost" style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)' }} onClick={() => setEditingServings(false)}>
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="recipe-detail-meta-value">{recipe.servings}</span>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '2px var(--space-2)', fontSize: 'var(--font-size-xs)', opacity: 0.6 }}
                  onClick={startEditServings}
                  title="Edit serving count"
                >
                  ✏️
                </button>
              </div>
            )}
            <span className="recipe-detail-meta-label">Servings</span>
          </div>
          <div className="recipe-detail-meta-item">
            <span className="recipe-detail-meta-value">{n?.calories ?? '—'}</span>
            <span className="recipe-detail-meta-label">Calories</span>
          </div>
          <div className="recipe-detail-meta-item">
            <span className="recipe-detail-meta-value">{n?.protein_g != null ? `${n.protein_g}g` : '—'}</span>
            <span className="recipe-detail-meta-label">Protein</span>
          </div>
        </div>

        <div className="recipe-card-tags" style={{ marginBottom: 'var(--space-4)' }}>
          {recipe.cuisine && <span className="tag tag-cuisine">{recipe.cuisine}</span>}
          {recipe.tags.map(tag => (
            <span key={tag} className="tag tag-default">{tag}</span>
          ))}
        </div>

        <div className="actions-bar">
          {recipe.source_url && (
            <a href={recipe.source_url} target="_blank" rel="noopener" className="btn btn-secondary">
              🔗 View Original
            </a>
          )}
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            🗑️ Delete
          </button>
        </div>
      </div>

      {recipe.image_url ? (
        <img className="recipe-detail-image" src={recipe.image_url} alt={recipe.title} />
      ) : (
        <div className="recipe-detail-image-placeholder">🍽️</div>
      )}

      <div className="recipe-detail-grid">
        <div>
          <div className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Ingredients</h2>
            <ul className="ingredient-list">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="ingredient-item">
                  <span className="ingredient-dot" />
                  <span className="ingredient-amount">
                    {ing.amount ? `${ing.amount}${ing.unit ? ` ${ing.unit}` : ''}` : 'to taste'}
                  </span>
                  <span className="ingredient-name">{ing.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {n && (
            <div className="recipe-detail-section">
              <h2 className="recipe-detail-section-title">Nutrition (per serving)</h2>
              <div className="nutrition-grid">
                {n.calories && (
                  <div className="nutrition-item">
                    <div className="nutrition-value">{n.calories}</div>
                    <div className="nutrition-label">Calories</div>
                  </div>
                )}
                {n.protein_g && (
                  <div className="nutrition-item">
                    <div className="nutrition-value">{n.protein_g}g</div>
                    <div className="nutrition-label">Protein</div>
                  </div>
                )}
                {n.carbs_g && (
                  <div className="nutrition-item">
                    <div className="nutrition-value">{n.carbs_g}g</div>
                    <div className="nutrition-label">Carbs</div>
                  </div>
                )}
                {n.fat_g && (
                  <div className="nutrition-item">
                    <div className="nutrition-value">{n.fat_g}g</div>
                    <div className="nutrition-label">Fat</div>
                  </div>
                )}
                {n.fibre_g && (
                  <div className="nutrition-item">
                    <div className="nutrition-value">{n.fibre_g}g</div>
                    <div className="nutrition-label">Fibre</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="recipe-detail-section">
            <h2 className="recipe-detail-section-title">Instructions</h2>
            <ol className="instruction-list">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="instruction-item">
                  <span className="instruction-number">{i + 1}</span>
                  <span className="instruction-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {recipe.leftover_friendly && recipe.leftover_note && (
            <div className="leftover-badge">
              <span className="leftover-badge-icon">🥗</span>
              <div>
                <strong>Leftover tip:</strong> {recipe.leftover_note}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
