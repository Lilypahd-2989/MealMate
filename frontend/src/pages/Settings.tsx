import { useState, useEffect } from 'react';

interface PantryItem {
  id: string;
  name: string;
}

export default function Settings() {
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchPantry();
  }, []);

  const fetchPantry = async () => {
    try {
      const res = await fetch('/api/pantry');
      setPantryItems(await res.json());
    } catch (err) {
      console.error('Failed to fetch pantry:', err);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async () => {
    const name = newItem.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const item = await res.json();
        setPantryItems(prev => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
        setNewItem('');
      }
    } catch (err) {
      console.error('Failed to add pantry item:', err);
    } finally {
      setAdding(false);
    }
  };

  const removeItem = async (id: string) => {
    try {
      const res = await fetch(`/api/pantry/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPantryItems(prev => prev.filter(i => i.id !== id));
      }
    } catch (err) {
      console.error('Failed to remove pantry item:', err);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your pantry staples and preferences.</p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <h2 className="panel-title" style={{ marginBottom: 'var(--space-2)' }}>🧂 Pantry Staples</h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
          Items on this list are hidden from your grocery list by default. Toggle them visible on the Meal Plan page.
        </p>

        {/* Add new item */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Add a pantry staple..."
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={addItem}
            disabled={adding || !newItem.trim()}
          >
            Add
          </button>
        </div>

        {/* Pantry list */}
        {loading ? (
          <div className="loading-overlay" style={{ position: 'static', background: 'none', padding: 'var(--space-4)' }}>
            <div className="loading-spinner" />
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {pantryItems.map(item => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', textTransform: 'capitalize' }}>
                  {item.name}
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)', color: 'var(--color-red)' }}
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
            {pantryItems.length === 0 && (
              <li style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-4) 0' }}>
                No pantry staples added yet.
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
