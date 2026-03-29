import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', icon: '📊', label: 'Dashboard' },
  { to: '/recipes', icon: '📖', label: 'Recipe Library' },
  { to: '/import', icon: '➕', label: 'Import Recipe' },
  { to: '/meal-plan', icon: '📅', label: 'Meal Plan' },
];

const futureItems = [
  { to: '/shopping', icon: '🛒', label: 'Shopping List', disabled: true },
  { to: '/prep', icon: '🔪', label: 'Prep Plan', disabled: true },
];

export default function Navbar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">🍽️</div>
        <span className="sidebar-brand-name">MealMate</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
            end={item.to === '/'}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="sidebar-section-label">Coming Soon</div>

        {futureItems.map(item => (
          <span
            key={item.to}
            className="sidebar-link"
            style={{ opacity: 0.4, cursor: 'default' }}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
          </span>
        ))}
      </nav>
    </aside>
  );
}
