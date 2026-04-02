import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  BookOpen,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import type { Topic } from "../types";

export default function CurriculumSidebar({ className }: { className?: string }) {
  const {
    domains,
    currentDomain,
    curriculum,
    selectedExerciseId,
    loadDomains,
    selectDomain,
    selectExercise,
  } = useStore();

  useEffect(() => {
    loadDomains();
  }, []);

  return (
    <div className={cn("flex flex-col bg-gray-50 dark:bg-gray-800 overflow-hidden", className)}>
      {/* Domain selector */}
      <div className="border-b dark:border-gray-700 p-3">
        <select
          value={currentDomain?.id ?? ""}
          onChange={(e) => selectDomain(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm font-medium focus:border-primary-500 focus:outline-none"
        >
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Topic tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {curriculum?.topics.map((topic) => (
          <TopicNode
            key={topic.id}
            topic={topic}
            selectedExerciseId={selectedExerciseId}
            onSelectExercise={selectExercise}
            depth={0}
          />
        ))}
        {!curriculum && (
          <p className="p-4 text-sm text-gray-400">로딩 중...</p>
        )}
      </div>
    </div>
  );
}

function TopicNode({
  topic,
  selectedExerciseId,
  onSelectExercise,
  depth,
}: {
  topic: Topic;
  selectedExerciseId: number | null;
  onSelectExercise: (id: number) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = topic.children.length > 0 || topic.exercises.length > 0;

  return (
    <div style={{ paddingLeft: depth * 8 }}>
      {/* Topic header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={14} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-gray-400 shrink-0" />
          )
        ) : (
          <BookOpen size={14} className="text-gray-400 shrink-0" />
        )}
        <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{topic.name}</span>
        {topic.progress > 0 && (
          <span className="ml-auto text-xs text-primary-600 shrink-0">
            {Math.round(topic.progress * 100)}%
          </span>
        )}
      </button>

      {/* Exercises */}
      {expanded && (
        <div className="ml-2">
          {topic.exercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => onSelectExercise(ex.id)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
                selectedExerciseId === ex.id
                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700",
              )}
            >
              {ex.is_completed ? (
                <CheckCircle2 size={13} className="text-green-500 shrink-0" />
              ) : (
                <Circle size={13} className="text-gray-300 shrink-0" />
              )}
              <span className="truncate">{ex.title}</span>
              <span className="ml-auto text-xs text-gray-400 shrink-0">
                Lv.{ex.difficulty}
              </span>
            </button>
          ))}
          {topic.children.map((child) => (
            <TopicNode
              key={child.id}
              topic={child}
              selectedExerciseId={selectedExerciseId}
              onSelectExercise={onSelectExercise}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
