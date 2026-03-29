interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    image_url: string | null;
    cuisine: string | null;
    total_time_min: number | null;
    servings: number;
    tags: string[];
    nutrition: {
      calories?: number | null;
      protein_g?: number | null;
    } | null;
    leftover_friendly: boolean;
  };
  onClick: () => void;
}

const cuisineEmojis: Record<string, string> = {
  'Mediterranean': '🫒',
  'Middle Eastern': '🧆',
  'Italian': '🍝',
  'Japanese': '🍱',
  'Thai': '🌶️',
  'Greek': '🫓',
  'Indian': '🍛',
  'French': '🥐',
  'British': '🇬🇧',
  'American': '🇺🇸',
  'North African': '🌍',
  'Scandinavian': '🐟',
};

export default function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  const emoji = recipe.cuisine ? cuisineEmojis[recipe.cuisine] || '🍽️' : '🍽️';

  return (
    <div className="card recipe-card" onClick={onClick}>
      {recipe.image_url ? (
        <img
          className="recipe-card-image"
          src={recipe.image_url}
          alt={recipe.title}
          loading="lazy"
        />
      ) : (
        <div className="recipe-card-image-placeholder">{emoji}</div>
      )}

      <div className="recipe-card-body">
        <h3 className="recipe-card-title">{recipe.title}</h3>

        <div className="recipe-card-meta">
          <span className="recipe-card-meta-item">
            ⏱️ {recipe.total_time_min ?? '—'} min
          </span>
          <span className="recipe-card-meta-item">
            👤 {recipe.servings} servings
          </span>
          <span className="recipe-card-meta-item">
            💪 {recipe.nutrition?.protein_g ?? '—'}g protein
          </span>
        </div>

        <div className="recipe-card-tags">
          {recipe.cuisine && (
            <span className="tag tag-cuisine">{recipe.cuisine}</span>
          )}
          {recipe.total_time_min && recipe.total_time_min <= 30 && (
            <span className="tag tag-time">Quick</span>
          )}
          {recipe.nutrition?.protein_g && recipe.nutrition.protein_g >= 35 && (
            <span className="tag tag-protein">High Protein</span>
          )}
          {recipe.leftover_friendly && (
            <span className="tag tag-leftover">Leftover-friendly</span>
          )}
        </div>
      </div>
    </div>
  );
}
