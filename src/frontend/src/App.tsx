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
import { cn } from "./lib/cn";
import type { ViewType } from "./components/IconNav";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const resetContext = useStore((s) => s.resetContext);
  const currentCurriculumId = useStore((s) => s.currentCurriculumId);
  const setGlobalDockActive = useStore((s) => s.setGlobalDockActive);

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
        {/* Sketch 는 언제나 마운트 상태로 유지한다 — 탭을 떠났다 돌아와도
            per-sketch 터미널 (TerminalPanel 내부 xterm + WebSocket) 과 편집 중인
            노트 상태가 살아있어야 한다. 백엔드의 tmux 래핑 (sketch 세션 detach-client)
            은 이 프론트 지속성과 짝을 이뤄야 비로소 "탭 전환해도 claude 가 살아있다" 가
            사용자 눈에 보인다. */}
        <div className={cn("h-full", currentView !== "sketch" && "hidden")}>
          <Sketch className="h-full" isActive={currentView === "sketch"} />
        </div>
        {currentView === "home" && (
          <Home className="h-full" onSelectTopic={switchToLearn} onNavigate={(v) => switchView(v as ViewType)} />
        )}
        {currentView === "learn" && <Learn className="h-full" />}
        {currentView === "subjects" && <Subjects className="h-full" onNavigateToLearn={switchToLearn} />}
        {currentView === "explore" && <Explore className="h-full" />}
        {currentView === "guide" && <Guide className="h-full" />}
      </main>

      {/* Global persistent terminal dock — 조건부 렌더링을 쓰면 Learn ↔ Home 같은
          전환마다 언마운트돼서 WS/claude 세션이 사라진다. 항상 마운트해두고
          CSS 로만 visibility 를 토글해서 Learn/Subjects/Explore 에서 돌린 claude
          세션이 다른 탭을 다녀와도 그대로 살아있게 한다.
          curriculumId 를 넘겨서 selected curriculum 이 바뀔 때마다 백엔드에서
          dojang-curriculum-<id> tmux 세션으로 전환되도록 한다. */}
      <div
        className={cn(
          "w-[420px] shrink-0 border-l border-gray-200 dark:border-gray-800",
          !showTerminalDock && "hidden",
        )}
      >
        <TerminalPanel
          className="h-full"
          curriculumId={currentCurriculumId}
          onActiveChange={setGlobalDockActive}
        />
      </div>
    </div>
  );
}
