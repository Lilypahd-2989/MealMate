import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import RecipeCard from '../components/RecipeCard';

interface Recipe {
  id: string;
  title: string;
  image_url: string | null;
  cuisine: string | null;
  total_time_min: number | null;
  servings: number;
  tags: string[];
  nutrition: any;
  leftover_friendly: boolean;
}

export default function RecipeLibrary() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [activeCuisine, setActiveCuisine] = useState<string | null>(null);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (activeCuisine) params.set('cuisine', activeCuisine);

      const res = await fetch(`/api/recipes?${params}`);
      const data = await res.json();
      setRecipes(data.recipes);
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
    } finally {
      setLoading(false);
    }
  }, [search, activeCuisine]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
    fetchRecipes();
  };

  const fetchMeta = async () => {
    try {
      const res = await fetch('/api/recipes/meta');
      const data = await res.json();
      setCuisines(data.cuisines);
    } catch (err) {
      console.error('Failed to fetch meta:', err);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchRecipes, 300);
    return () => clearTimeout(timer);
  }, [fetchRecipes]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Recipe Library</h1>
        <p className="page-subtitle">
          {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} in your collection
        </p>
      </div>

      <div className="search-filters-bar">
        <div className="search-input-wrapper">
          <span className="search-input-icon">🔍</span>
          <input
            id="recipe-search"
            type="text"
            className="search-input"
            placeholder="Search recipes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/import')}
        >
          ➕ Import Recipe
        </button>
      </div>

      {cuisines.length > 0 && (
        <div className="filter-chips" style={{ marginBottom: 'var(--space-6)' }}>
          <button
            className={`filter-chip ${!activeCuisine ? 'active' : ''}`}
            onClick={() => setActiveCuisine(null)}
          >
            All
          </button>
          {cuisines.map(c => (
            <button
              key={c}
              className={`filter-chip ${activeCuisine === c ? 'active' : ''}`}
              onClick={() => setActiveCuisine(activeCuisine === c ? null : c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <span>Loading recipes...</span>
        </div>
      ) : recipes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <h2 className="empty-state-title">
            {search || activeCuisine ? 'No recipes found' : 'Your library is empty'}
          </h2>
          <p className="empty-state-text">
            {search || activeCuisine
              ? 'Try adjusting your search or filters.'
              : 'Import your first recipe to get started!'}
          </p>
          {!search && !activeCuisine && (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate('/import')}
            >
              ➕ Import Your First Recipe
            </button>
          )}
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => navigate(`/recipes/${recipe.id}`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
