import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Recipe {
  id: string;
  title: string;
  cuisine: string | null;
  total_time_min: number | null;
  nutrition: { calories?: number | null; protein_g?: number | null } | null;
  tags: string[];
}

export default function Dashboard() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [count, setCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [recipesRes, metaRes] = await Promise.all([
          fetch('/api/recipes'),
          fetch('/api/recipes/meta'),
        ]);
        const recipesData = await recipesRes.json();
        const metaData = await metaRes.json();
        setRecipes(recipesData.recipes.slice(0, 5));
        setCount(metaData.count);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const avgProtein = recipes.length > 0
    ? Math.round(recipes.reduce((sum, r) => sum + (r.nutrition?.protein_g || 0), 0) / recipes.length)
    : 0;

  const avgTime = recipes.length > 0
    ? Math.round(recipes.reduce((sum, r) => sum + (r.total_time_min || 0), 0) / recipes.length)
    : 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Welcome back, Lee 👋</h1>
        <p className="page-subtitle">Here's your MealMate overview.</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div className="card" style={{ padding: 'var(--space-6)', cursor: 'default' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>Total Recipes</div>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-accent)' }}>{count}</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-6)', cursor: 'default' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>Avg Protein</div>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-green)' }}>{avgProtein}g</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-6)', cursor: 'default' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>Avg Cook Time</div>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-blue)' }}>{avgTime}m</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-6)', cursor: 'pointer' }} onClick={() => navigate('/meal-plan')}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>Meal Plans</div>
          <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 800, color: 'var(--color-accent)' }}>Ready</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', marginTop: 'var(--space-1)' }}>Click to view planning &rarr;</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('/import')}>
          ➕ Import Recipe
        </button>
        <button className="btn btn-secondary btn-lg" onClick={() => navigate('/recipes')}>
          📖 Browse Library
        </button>
      </div>

      {/* Recent Recipes */}
      {recipes.length > 0 && (
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
            Recent Recipes
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {recipes.map(r => (
              <div
                key={r.id}
                className="card"
                style={{ padding: 'var(--space-4) var(--space-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => navigate(`/recipes/${r.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <span style={{ fontSize: '1.5rem' }}>🍽️</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {r.cuisine} · {r.total_time_min} min · {r.nutrition?.protein_g}g protein
                    </div>
                  </div>
                </div>
                <span style={{ color: 'var(--color-text-tertiary)' }}>→</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
