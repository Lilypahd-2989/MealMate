import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ImportRecipe() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleImport = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Import failed');
      }

      const recipe = await res.json();
      navigate(`/recipes/${recipe.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleImport();
  };

  const supportedSites = [
    { name: 'BBC Good Food', url: 'bbcgoodfood.com' },
    { name: 'Bon Appétit', url: 'bonappetit.com' },
    { name: 'Allrecipes', url: 'allrecipes.com' },
    { name: 'AH Allerhande', url: 'ah.nl/allerhande' },
  ];

  return (
    <div className="import-container">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Import a Recipe</h1>
        <p className="page-subtitle">
          Paste a recipe URL and we'll extract all the details for you.
        </p>
      </div>

      <div className="import-url-box">
        <div className="import-icon">🔗</div>
        <div className="import-label">Paste a recipe URL</div>
        <div className="import-hint">
          We'll extract the title, ingredients, instructions, and nutrition automatically.
        </div>

        <input
          id="import-url-input"
          type="url"
          className="import-url-input"
          placeholder="https://bbcgoodfood.com/recipes/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        {error && (
          <p style={{ color: 'var(--color-red)', marginTop: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
            {error}
          </p>
        )}

        <button
          className="btn btn-primary btn-lg"
          style={{ marginTop: 'var(--space-6)', width: '100%', justifyContent: 'center' }}
          onClick={handleImport}
          disabled={loading || !url.trim()}
        >
          {loading ? (
            <>
              <span className="loading-spinner" />
              Scraping recipe...
            </>
          ) : (
            '🍽️ Import Recipe'
          )}
        </button>
      </div>

      <div style={{ marginTop: 'var(--space-8)' }}>
        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
          Supported sites
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          {supportedSites.map(site => (
            <span key={site.url} className="tag tag-default" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
              {site.name}
            </span>
          ))}
          <span className="tag tag-default" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
            + any site with Recipe schema
          </span>
        </div>
      </div>
    </div>
  );
}
