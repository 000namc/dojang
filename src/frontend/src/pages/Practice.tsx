import { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ExercisePanel from "../components/ExercisePanel";
import KnowledgePanel from "../components/KnowledgePanel";
import TerminalPanel from "../components/TerminalPanel";
import ThemeToggle from "../components/ThemeToggle";
import { useStore } from "../stores/store";

export default function Practice() {
  const { selectedItemType, startNotifyPolling, stopNotifyPolling } = useStore();

  useEffect(() => {
    startNotifyPolling();
    return () => stopNotifyPolling();
  }, []);

  return (
    <div className="flex h-screen">
      {/* Left: Sidebar */}
      <Sidebar className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-800" />

      {/* Center: changes based on selected item */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedItemType === "exercise" ? (
          <ExercisePanel />
        ) : selectedItemType === "knowledge" ? (
          <KnowledgePanel />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg">학습할 항목을 선택하세요</p>
              <p className="mt-1 text-sm">왼쪽 커리큘럼에서 개념이나 문제를 클릭</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Claude Code terminal */}
      <TerminalPanel className="w-[420px] shrink-0 border-l border-gray-200 dark:border-gray-800" />

      {/* Theme toggle */}
      <div className="fixed top-2 right-2 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}
