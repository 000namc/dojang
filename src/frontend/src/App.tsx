import { useState } from "react";
import IconNav from "./components/IconNav";
import Home from "./pages/Home";
import Learn from "./pages/Learn";
import Subjects from "./pages/Subjects";
import Community from "./pages/Community";
import type { ViewType } from "./components/IconNav";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>("home");

  const switchToLearn = () => setCurrentView("learn");

  return (
    <div className="flex h-screen">
      <IconNav activeView={currentView} onViewChange={setCurrentView} />
      <main className="flex-1 min-w-0">
        {currentView === "home" ? (
          <Home className="h-full" onSelectTopic={switchToLearn} onNavigate={(v) => setCurrentView(v as ViewType)} />
        ) : currentView === "learn" ? (
          <Learn className="h-full" />
        ) : currentView === "subjects" ? (
          <Subjects className="h-full" onNavigateToLearn={switchToLearn} />
        ) : currentView === "community" ? (
          <Community className="h-full" />
        ) : null}
      </main>

      {/* Auth buttons — home only */}
      {currentView === "home" && (
        <div className="fixed top-3 right-4 z-50 flex items-center gap-2">
          <button className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            Sign in
          </button>
          <button className="rounded-lg px-4 py-1.5 text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors">
            Sign up
          </button>
        </div>
      )}
    </div>
  );
}
