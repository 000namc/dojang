import { Play, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStore } from "../stores/store";
import CodeEditor from "./CodeEditor";
import ResultPanel from "./ResultPanel";

export default function ExercisePanel() {
  const { currentExercise, currentDomain, isExecuting, runCode, submitAttempt } =
    useStore();

  if (!currentExercise) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">연습 문제를 선택하세요</p>
          <p className="mt-1 text-sm">왼쪽 커리큘럼에서 문제를 클릭</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Exercise header */}
      <div className="border-b dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
            Lv.{currentExercise.difficulty}
          </span>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            {currentExercise.title}
          </h2>
        </div>
        {currentExercise.description && (
          <div className="prose prose-sm dark:prose-invert mt-2 max-w-none text-gray-600 dark:text-gray-300">
            <ReactMarkdown>{currentExercise.description}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Editor + Result split */}
      <div className="flex flex-1 min-h-0">
        {/* Editor */}
        <div className="flex flex-1 flex-col border-r dark:border-gray-700">
          <CodeEditor className="flex-1 min-h-0" />
          {/* Action bar */}
          <div className="flex items-center gap-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
            <button
              onClick={runCode}
              disabled={isExecuting}
              className="btn-secondary"
            >
              <Play size={14} />
              실행
            </button>
            <button
              onClick={submitAttempt}
              disabled={isExecuting}
              className="btn-primary"
            >
              <Send size={14} />
              제출
            </button>
            <span className="ml-auto text-xs text-gray-400">
              {currentDomain?.name === "SQL" ? "SQL" : "Shell"} | Ctrl+Enter 실행
            </span>
          </div>
        </div>

        {/* Result */}
        <ResultPanel className="w-1/2" />
      </div>
    </div>
  );
}
