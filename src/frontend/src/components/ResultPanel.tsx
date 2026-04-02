import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import { Loader2 } from "lucide-react";

export default function ResultPanel({ className }: { className?: string }) {
  const { lastResult, lastAttempt, isExecuting } = useStore();

  if (isExecuting) {
    return (
      <div className={cn("flex items-center justify-center text-gray-400", className)}>
        <Loader2 size={20} className="animate-spin mr-2" />
        실행 중...
      </div>
    );
  }

  if (!lastResult) {
    return (
      <div className={cn("flex items-center justify-center text-gray-400 text-sm", className)}>
        Ctrl+Enter로 실행해보세요
      </div>
    );
  }

  return (
    <div className={cn("overflow-auto p-3 text-sm", className)}>
      {/* Attempt feedback */}
      {lastAttempt && (
        <div
          className={cn(
            "mb-3 rounded-lg px-4 py-2 text-sm font-medium",
            lastAttempt.is_correct
              ? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
              : "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
          )}
        >
          {lastAttempt.is_correct ? "정답입니다!" : "다시 시도해보세요"}
        </div>
      )}

      {/* SQL table */}
      {lastResult.result_type === "table" && lastResult.columns && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                {lastResult.columns.map((col, i) => (
                  <th
                    key={i}
                    className="whitespace-nowrap px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lastResult.rows?.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  {row.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-3 py-1.5 text-gray-800 dark:text-gray-200">
                      {cell === "NULL" ? (
                        <span className="italic text-gray-400">NULL</span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-400">
            {lastResult.rows?.length ?? 0}개 행
          </p>
        </div>
      )}

      {/* Terminal output */}
      {lastResult.result_type === "terminal" && (
        <pre className="whitespace-pre-wrap rounded-lg bg-gray-900 p-4 font-mono text-sm text-green-400">
          {lastResult.output}
          {lastResult.error && (
            <span className="text-red-400">{lastResult.error}</span>
          )}
        </pre>
      )}

      {/* Error */}
      {lastResult.result_type === "error" && (
        <pre className="whitespace-pre-wrap rounded-lg bg-red-50 dark:bg-red-900/20 p-4 font-mono text-sm text-red-600 dark:text-red-400">
          {lastResult.error || lastResult.output}
        </pre>
      )}
    </div>
  );
}
