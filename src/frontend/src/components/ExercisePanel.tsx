import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useStore } from "../stores/store";
import TerminalWidget from "./TerminalWidget";
import CodeEditor from "./CodeEditor";
import ResultPanel from "./ResultPanel";
import { Play } from "lucide-react";

export default function ExercisePanel() {
  const {
    currentExercise,
    currentDomain,
    curriculumTree,
    isExecuting,
    lastAttempt,
    runCode,
    submitAttempt,
  } = useStore();

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

  const isTerminalDomain = currentDomain?.name !== "SQL";

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-gray-900">
      <div className="mx-auto w-full max-w-3xl px-6 py-8 space-y-6">
        {/* Exercise card */}
        <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="rounded-full bg-primary-100 dark:bg-primary-900/40 px-2.5 py-0.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
              Lv.{currentExercise.difficulty}
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {currentExercise.title}
            </h2>
          </div>
          {currentExercise.description && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
              <ReactMarkdown>{currentExercise.description}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Attempt feedback */}
        {lastAttempt && (
          <div
            className={
              lastAttempt.is_correct
                ? "rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-green-700 dark:text-green-400 font-medium"
                : "rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400 font-medium"
            }
          >
            {lastAttempt.is_correct ? "정답입니다!" : "다시 시도해보세요"}
          </div>
        )}

        {/* Terminal widget (for CLI/Git/Docker) or Code editor (for SQL) */}
        {isTerminalDomain ? (
          <TerminalWidget className="h-80" />
        ) : (
          <div className="space-y-3">
            {/* SQL: Monaco editor + result */}
            <div className="rounded-xl overflow-hidden border border-gray-700 h-48">
              <CodeEditor className="h-full" />
            </div>
            <ResultPanel className="rounded-xl bg-gray-100 dark:bg-gray-800 min-h-[4rem]" />
          </div>
        )}

        {/* Submit bar */}
        <div className="flex items-center gap-3">
          {!isTerminalDomain && (
            <button onClick={runCode} disabled={isExecuting} className="btn-secondary">
              <Play size={14} />
              실행
            </button>
          )}
          <button onClick={submitAttempt} disabled={isExecuting} className="btn-primary">
            <Send size={14} />
            제출
          </button>
          <span className="ml-auto text-xs text-gray-400">
            {isTerminalDomain ? "터미널에서 명령어를 실행해보세요" : "Ctrl+Enter 실행"}
          </span>
        </div>
      </div>
    </div>
  );
}
