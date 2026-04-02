import { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ExercisePanel from "../components/ExercisePanel";
import KnowledgePanel from "../components/KnowledgePanel";
import TerminalPanel from "../components/TerminalPanel";
import ThemeToggle from "../components/ThemeToggle";
import { useStore } from "../stores/store";

export default function Practice() {
  const { mode, startNotifyPolling, stopNotifyPolling } = useStore();

  useEffect(() => {
    startNotifyPolling();
    return () => stopNotifyPolling();
  }, []);

  return (
    <div className="flex h-screen">
      {/* Left: Sidebar with tabs */}
      <Sidebar className="w-72 shrink-0 border-r dark:border-gray-700" />

      {/* Center: changes based on mode */}
      <div className="flex-1 flex flex-col min-w-0">
        {mode === "practice" ? <ExercisePanel /> : <KnowledgePanel />}
      </div>

      {/* Right: Claude Code terminal */}
      <TerminalPanel className="w-[420px] shrink-0 border-l dark:border-gray-700" />

      {/* Theme toggle */}
      <div className="fixed top-2 right-2 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}
