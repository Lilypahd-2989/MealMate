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
          {recipe.total_time_min && (
            <div className="recipe-detail-meta-item">
              <span className="recipe-detail-meta-value">{recipe.total_time_min}</span>
              <span className="recipe-detail-meta-label">Minutes</span>
            </div>
          )}
          <div className="recipe-detail-meta-item">
            <span className="recipe-detail-meta-value">{recipe.servings}</span>
            <span className="recipe-detail-meta-label">Servings</span>
          </div>
          {n?.calories && (
            <div className="recipe-detail-meta-item">
              <span className="recipe-detail-meta-value">{n.calories}</span>
              <span className="recipe-detail-meta-label">Calories</span>
            </div>
          )}
          {n?.protein_g && (
            <div className="recipe-detail-meta-item">
              <span className="recipe-detail-meta-value">{n.protein_g}g</span>
              <span className="recipe-detail-meta-label">Protein</span>
            </div>
          )}
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
                    {ing.amount ? `${ing.amount}${ing.unit ? ` ${ing.unit}` : ''}` : ''}
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
