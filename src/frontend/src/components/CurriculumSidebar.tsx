import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  BookOpen,
  Trash2,
  X,
  Star,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import type { Subject, TopicItem, CurriculumTree } from "../types";

export default function CurriculumSidebar({ className }: { className?: string }) {
  const {
    topics,
    currentTopic,
    curricula,
    currentCurriculumId,
    curriculumTree,
    selectedExerciseId,
    selectedCardId,
    loadTopics,
    selectTopic,
    selectCurriculum,
    deleteCurriculum,
    deleteSubject,
    deleteExercise,
    deleteKnowledge,
    selectExercise,
    selectCard,
    updateTopic,
  } = useStore();

  useEffect(() => { loadTopics(); }, []);

  return (
    <div className={cn("flex flex-col bg-white dark:bg-gray-900 overflow-hidden", className)}>
      {/* Topic selector */}
      <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <select
            value={currentTopic?.id ?? ""}
            onChange={(e) => selectTopic(Number(e.target.value))}
            className="w-full rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 appearance-none cursor-pointer pr-8"
          >
            {topics.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Curricula list */}
      <div className="flex-1 overflow-y-auto">
        {curricula.map((cur) => (
          <CurriculumSection
            key={cur.id}
            curriculum={cur}
            isActive={cur.id === currentCurriculumId}
            isDefault={currentTopic?.default_curriculum_id === cur.id}
            onToggleDefault={
              currentTopic
                ? () =>
                    updateTopic(currentTopic.id, {
                      // 노란 별 다시 클릭 → 해제 (null) → Explore 별자리에서 토픽이 사라짐
                      default_curriculum_id:
                        currentTopic.default_curriculum_id === cur.id ? null : cur.id,
                    })
                : undefined
            }
            onSelect={() => selectCurriculum(cur.id)}
            onDelete={!cur.is_default ? () => { if (confirm(`"${cur.name}" 삭제?`)) deleteCurriculum(cur.id); } : undefined}
            curriculumTree={cur.id === currentCurriculumId ? curriculumTree : null}
            selectedExerciseId={selectedExerciseId}
            selectedCardId={selectedCardId}
            onSelectExercise={selectExercise}
            onSelectCard={selectCard}
            onDeleteSubject={deleteSubject}
            onDeleteExercise={deleteExercise}
            onDeleteKnowledge={deleteKnowledge}
          />
        ))}
        {curricula.length === 0 && (
          <p className="p-4 text-center text-sm text-gray-400">커리큘럼이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function CurriculumSection({
  curriculum,
  isActive,
  isDefault,
  onSelect,
  onToggleDefault,
  onDelete,
  curriculumTree,
  selectedExerciseId,
  selectedCardId,
  onSelectExercise,
  onSelectCard,
  onDeleteSubject,
  onDeleteExercise,
  onDeleteKnowledge,
}: {
  curriculum: { id: number; name: string; is_default: number };
  isActive: boolean;
  isDefault: boolean;
  onSelect: () => void;
  onToggleDefault?: () => void;
  onDelete?: () => void;
  curriculumTree: CurriculumTree | null;
  selectedExerciseId: number | null;
  selectedCardId: number | null;
  onSelectExercise: (id: number) => void;
  onSelectCard: (id: number) => void;
  onDeleteSubject: (id: number) => void;
  onDeleteExercise: (id: number) => void;
  onDeleteKnowledge: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    if (!isActive) onSelect();
    setExpanded(!expanded);
  };

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  return (
    <div className="last:border-b-0">
      <div className="group flex items-center mx-2 mt-1">
        <button
          onClick={handleToggle}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
            isActive
              ? "font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800/50"
              : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/30",
          )}
        >
          {expanded ? <ChevronDown size={13} className="shrink-0 text-gray-400" /> : <ChevronRight size={13} className="shrink-0 text-gray-400" />}
          <span className="truncate">{curriculum.name}</span>
        </button>
        {onToggleDefault && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleDefault();
            }}
            title={
              isDefault
                ? "기본 커리큘럼 해제 (별자리에서 숨김)"
                : "기본 커리큘럼으로 설정"
            }
            className="mr-1 rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Star
              size={13}
              className={cn(
                "transition-colors",
                isDefault
                  ? "fill-yellow-400 text-yellow-400 hover:fill-yellow-300 hover:text-yellow-300"
                  : "text-gray-300 dark:text-gray-600 hover:text-yellow-400",
              )}
            />
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="mr-2 rounded p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {expanded && isActive && curriculumTree && (
        // 하위 문서 느낌: 왼쪽 margin + 수직 guide line + 내부 padding.
        // ml-[22px] 는 curriculum header 의 chevron 중심과 border-l 을 대략 맞춤.
        <div className="ml-[22px] mr-2 mb-2 mt-0.5 pl-2 pr-0 pb-1 pt-0.5 border-l border-gray-200 dark:border-gray-800/70">
          {curriculumTree.subjects.map((subject) => (
            <SubjectNode
              key={subject.id}
              subject={subject}
              selectedExerciseId={selectedExerciseId}
              selectedCardId={selectedCardId}
              onSelectExercise={onSelectExercise}
              onSelectCard={onSelectCard}
              onDeleteSubject={onDeleteSubject}
              onDeleteExercise={onDeleteExercise}
              onDeleteKnowledge={onDeleteKnowledge}
              depth={0}
            />
          ))}
          {curriculumTree.subjects.length === 0 && (
            <p className="px-3 py-3 text-center text-xs text-gray-400">아직 토픽이 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}

function SubjectNode({
  subject,
  selectedExerciseId,
  selectedCardId,
  onSelectExercise,
  onSelectCard,
  onDeleteSubject,
  onDeleteExercise,
  onDeleteKnowledge,
  depth,
}: {
  subject: Subject;
  selectedExerciseId: number | null;
  selectedCardId: number | null;
  onSelectExercise: (id: number) => void;
  onSelectCard: (id: number) => void;
  onDeleteSubject: (id: number) => void;
  onDeleteExercise: (id: number) => void;
  onDeleteKnowledge: (id: number) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = subject.items || [];
  const hasChildren = subject.children.length > 0 || items.length > 0;

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div className="group flex items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-400 shrink-0" />
          ) : (
            <span className="w-[13px] shrink-0" />
          )}
          <span className="font-medium text-gray-700 dark:text-gray-300 truncate">{subject.name}</span>
          {subject.progress > 0 && (
            <span className="ml-auto text-[11px] text-primary-500 shrink-0">{Math.round(subject.progress * 100)}%</span>
          )}
        </button>
        <button
          onClick={() => { if (confirm(`"${subject.name}" 토픽을 삭제할까요?`)) onDeleteSubject(subject.id); }}
          className="mr-1 rounded p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="삭제"
        >
          <X size={12} />
        </button>
      </div>
      {expanded && (
        <div className="ml-1">
          {items.map((item) =>
            item.type === "knowledge" ? (
              <KnowledgeItem key={`k-${item.id}`} item={item} selected={selectedCardId === item.id} onSelect={() => onSelectCard(item.id)} onDelete={() => { if (confirm(`"${item.title}" 삭제?`)) onDeleteKnowledge(item.id); }} />
            ) : (
              <ExerciseItem key={`e-${item.id}`} item={item} selected={selectedExerciseId === item.id} onSelect={() => onSelectExercise(item.id)} onDelete={() => { if (confirm(`"${item.title}" 삭제?`)) onDeleteExercise(item.id); }} />
            ),
          )}
          {subject.children.map((child) => (
            <SubjectNode
              key={child.id}
              subject={child}
              selectedExerciseId={selectedExerciseId}
              selectedCardId={selectedCardId}
              onSelectExercise={onSelectExercise}
              onSelectCard={onSelectCard}
              onDeleteSubject={onDeleteSubject}
              onDeleteExercise={onDeleteExercise}
              onDeleteKnowledge={onDeleteKnowledge}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeItem({ item, selected, onSelect, onDelete }: { item: TopicItem; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center">
      <button
        onClick={onSelect}
        className={cn(
          "flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-[13px] transition-colors",
          selected
            ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
            : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50",
        )}
      >
        <BookOpen size={12} className="text-amber-500 dark:text-amber-400 shrink-0" />
        <span className="truncate">{item.title}</span>
      </button>
      <button
        onClick={onDelete}
        className="mr-1 rounded p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="삭제"
      >
        <X size={10} />
      </button>
    </div>
  );
}

function ExerciseItem({ item, selected, onSelect, onDelete }: { item: TopicItem; selected: boolean; onSelect: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center">
      <button
        onClick={onSelect}
        className={cn(
          "flex flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1 text-left text-[13px] transition-colors",
          selected
            ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
            : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50",
        )}
      >
        {item.is_completed ? (
          <CheckCircle2 size={12} className="text-green-500 shrink-0" />
        ) : (
          <Circle size={12} className="text-gray-300 dark:text-gray-600 shrink-0" />
        )}
        <span className="truncate">{item.title}</span>
        <span className="ml-auto text-[10px] text-gray-400 shrink-0">Lv.{item.difficulty}</span>
      </button>
      <button
        onClick={onDelete}
        className="mr-1 rounded p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="삭제"
      >
        <X size={10} />
      </button>
    </div>
  );
}
