import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  BookOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import type { Topic } from "../types";

export default function CurriculumSidebar({ className }: { className?: string }) {
  const {
    domains,
    currentDomain,
    curricula,
    currentCurriculumId,
    curriculumTree,
    selectedExerciseId,
    loadDomains,
    selectDomain,
    selectCurriculum,
    createCurriculum,
    deleteCurriculum,
    selectExercise,
  } = useStore();

  const [showNewCur, setShowNewCur] = useState(false);
  const [newCurName, setNewCurName] = useState("");

  useEffect(() => { loadDomains(); }, []);

  const handleCreate = async () => {
    if (!newCurName.trim()) return;
    await createCurriculum(newCurName.trim());
    setNewCurName("");
    setShowNewCur(false);
  };

  const currentCur = curricula.find((c) => c.id === currentCurriculumId);

  return (
    <div className={cn("flex flex-col bg-gray-50 dark:bg-gray-800 overflow-hidden", className)}>
      {/* Domain + Curriculum selectors */}
      <div className="border-b dark:border-gray-700 p-3 space-y-2">
        <select
          value={currentDomain?.id ?? ""}
          onChange={(e) => selectDomain(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm font-medium focus:border-primary-500 focus:outline-none"
        >
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {curricula.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={currentCurriculumId ?? ""}
              onChange={(e) => selectCurriculum(Number(e.target.value))}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
            >
              {curricula.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button onClick={() => setShowNewCur(!showNewCur)} className="rounded p-1 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="새 커리큘럼">
              <Plus size={14} />
            </button>
            {currentCur && !currentCur.is_default && (
              <button onClick={() => { if (confirm(`"${currentCur.name}" 삭제?`)) deleteCurriculum(currentCur.id); }} className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="삭제">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {showNewCur && (
          <div className="flex items-center gap-1">
            <input
              value={newCurName}
              onChange={(e) => setNewCurName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="커리큘럼 이름"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              autoFocus
            />
            <button onClick={handleCreate} className="btn-primary text-xs px-2 py-1">만들기</button>
          </div>
        )}
      </div>

      {/* Topic tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {curriculumTree?.topics.map((topic) => (
          <TopicNode key={topic.id} topic={topic} selectedExerciseId={selectedExerciseId} onSelectExercise={selectExercise} depth={0} />
        ))}
        {curriculumTree && curriculumTree.topics.length === 0 && (
          <p className="p-4 text-center text-sm text-gray-400">아직 토픽이 없습니다.<br />Claude Code에서 추가해보세요.</p>
        )}
      </div>
    </div>
  );
}

function TopicNode({ topic, selectedExerciseId, onSelectExercise, depth }: { topic: Topic; selectedExerciseId: number | null; onSelectExercise: (id: number) => void; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = topic.children.length > 0 || topic.exercises.length > 0;

  return (
    <div style={{ paddingLeft: depth * 8 }}>
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
        {hasChildren ? (expanded ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 shrink-0" />) : <BookOpen size={14} className="text-gray-400 shrink-0" />}
        <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{topic.name}</span>
        {topic.progress > 0 && <span className="ml-auto text-xs text-primary-600 shrink-0">{Math.round(topic.progress * 100)}%</span>}
      </button>
      {expanded && (
        <div className="ml-2">
          {topic.exercises.map((ex) => (
            <button key={ex.id} onClick={() => onSelectExercise(ex.id)} className={cn("flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors", selectedExerciseId === ex.id ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700")}>
              {ex.is_completed ? <CheckCircle2 size={13} className="text-green-500 shrink-0" /> : <Circle size={13} className="text-gray-300 shrink-0" />}
              <span className="truncate">{ex.title}</span>
              <span className="ml-auto text-xs text-gray-400 shrink-0">Lv.{ex.difficulty}</span>
            </button>
          ))}
          {topic.children.map((child) => <TopicNode key={child.id} topic={child} selectedExerciseId={selectedExerciseId} onSelectExercise={onSelectExercise} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}
