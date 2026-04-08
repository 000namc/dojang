import { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ExercisePanel from "../components/ExercisePanel";
import KnowledgePanel from "../components/KnowledgePanel";
import { useStore } from "../stores/store";
import { cn } from "../lib/cn";

interface LearnProps {
  className?: string;
}

export default function Learn({ className }: LearnProps) {
  const { selectedItemType, startNotifyPolling, stopNotifyPolling } = useStore();

  useEffect(() => {
    startNotifyPolling();
    return () => stopNotifyPolling();
  }, []);

  return (
    <div className={cn("flex h-full", className)}>
      {/* Left: Curriculum sidebar */}
      <Sidebar className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800" />

      {/* Center: Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedItemType === "exercise" ? (
          <ExercisePanel />
        ) : selectedItemType === "knowledge" ? (
          <KnowledgePanel />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <p className="text-lg">학습할 항목을 선택하세요</p>
              <p className="mt-1 text-sm">왼쪽 커리큘럼에서 개념이나 문제를 클릭</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
