import { useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ExercisePanel from "../components/ExercisePanel";
import KnowledgePanel from "../components/KnowledgePanel";
import HelpBanner from "../components/HelpBanner";
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
        <div className="px-4 pt-3">
          <HelpBanner storageKey="learn">
            <strong>직접 공부하는 자리.</strong> 지금 보고 있는 노트 · 실습은 Claude 가 자동으로 인지합니다.{" "}
            <span className="text-gray-500 dark:text-gray-500">
              Tip: "이 실습 쉬운 버전 하나 만들어줘" (<code>create_exercise</code>), "해설 노트 추가" (<code>save_knowledge</code>), "내 진척도" (<code>get_progress</code>) 처럼 대화 한 줄로 커리큘럼을 직접 진화시킬 수 있어요.
            </span>
          </HelpBanner>
        </div>
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
