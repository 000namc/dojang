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
    // Learn 탭에 (재)진입할 때 current_context.md 를 store 상태로부터
    // 재계산해서 쓴다. 탭 전환 시 resetContext 가 contextRef/스니펫을 비우기
    // 때문에, 돌아왔을 때 ambient 커리큘럼 최소 한 줄이라도 claude 에게 보여야
    // "내가 지금 어디 있는지" 를 안다.
    useStore.getState()._syncContextFile();
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
