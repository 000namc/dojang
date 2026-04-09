import { useState } from "react";
import IconNav from "./components/IconNav";
import Home from "./pages/Home";
import Sketch from "./pages/Sketch";
import Learn from "./pages/Learn";
import Subjects from "./pages/Subjects";
import Explore from "./pages/Explore";
import Guide from "./pages/Guide";
import TerminalPanel from "./components/TerminalPanel";
import { useStore } from "./stores/store";
import type { ViewType } from "./components/IconNav";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const resetContext = useStore((s) => s.resetContext);

  const switchView = (view: ViewType) => {
    // 탭 이동 시 learn 맥락 리셋 — 각 탭이 자기 context 를 다시 세팅
    resetContext();
    setCurrentView(view);
  };

  const switchToLearn = () => switchView("learn");

  // Sketch는 자체 per-sketch 터미널을 가지므로 글로벌 도크 제외
  // Home은 자체 워크스페이스 플로우가 있으므로 제외
  // Guide는 읽기 전용 문서라 도크 제외
  const showTerminalDock =
    currentView !== "home" && currentView !== "sketch" && currentView !== "guide";

  return (
    <div className="flex h-screen">
      <IconNav activeView={currentView} onViewChange={switchView} />
      <main className="flex-1 min-w-0">
        {currentView === "home" ? (
          <Home className="h-full" onSelectTopic={switchToLearn} onNavigate={(v) => switchView(v as ViewType)} />
        ) : currentView === "sketch" ? (
          <Sketch className="h-full" />
        ) : currentView === "learn" ? (
          <Learn className="h-full" />
        ) : currentView === "subjects" ? (
          <Subjects className="h-full" onNavigateToLearn={switchToLearn} />
        ) : currentView === "explore" ? (
          <Explore className="h-full" />
        ) : currentView === "guide" ? (
          <Guide className="h-full" />
        ) : null}
      </main>

      {/* Global persistent terminal dock — shared session across non-sketch/non-home views */}
      {showTerminalDock && (
        <TerminalPanel className="w-[420px] shrink-0 border-l border-gray-200 dark:border-gray-800" />
      )}
    </div>
  );
}
