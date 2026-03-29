import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import RecipeLibrary from './pages/RecipeLibrary';
import RecipeDetail from './pages/RecipeDetail';
import ImportRecipe from './pages/ImportRecipe';
import MealPlan from './pages/MealPlan';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/recipes" element={<RecipeLibrary />} />
            <Route path="/recipes/:id" element={<RecipeDetail />} />
            <Route path="/import" element={<ImportRecipe />} />
            <Route path="/meal-plan" element={<MealPlan />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
