import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  BookOpen,
  Plus,
  Trash2,
  X,
  Save,
  RotateCcw,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import type { Topic, TopicItem, CurriculumTree } from "../types";

export default function CurriculumSidebar({ className }: { className?: string }) {
  const {
    domains,
    currentDomain,
    curricula,
    currentCurriculumId,
    curriculumTree,
    selectedExerciseId,
    selectedCardId,
    checkpoints,
    loadDomains,
    selectDomain,
    selectCurriculum,
    createCurriculum,
    deleteCurriculum,
    deleteTopic,
    selectExercise,
    selectCard,
    saveCheckpoint,
    restoreCheckpoint,
    deleteCheckpoint,
  } = useStore();

  const [showNewCur, setShowNewCur] = useState(false);
  const [newCurName, setNewCurName] = useState("");
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showSaveCp, setShowSaveCp] = useState(false);
  const [cpName, setCpName] = useState("");

  useEffect(() => { loadDomains(); }, []);

  const handleCreate = async () => {
    if (!newCurName.trim()) return;
    await createCurriculum(newCurName.trim());
    setNewCurName("");
    setShowNewCur(false);
  };

  return (
    <div className={cn("flex flex-col bg-white dark:bg-gray-900 overflow-hidden", className)}>
      {/* Domain selector + actions */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-3 space-y-2">
        <select
          value={currentDomain?.id ?? ""}
          onChange={(e) => selectDomain(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm font-medium focus:border-primary-500 focus:outline-none"
        >
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewCur(!showNewCur)} className="flex items-center gap-1 rounded p-1 text-xs text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Plus size={12} />
            추가
          </button>
          <button
            onClick={() => setShowSaveCp(!showSaveCp)}
            className="flex items-center gap-1 rounded p-1 text-xs text-gray-400 hover:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="체크포인트 저장"
          >
            <Save size={12} />
            저장
          </button>
          <button
            onClick={() => setShowCheckpoints(!showCheckpoints)}
            className="flex items-center gap-1 rounded p-1 text-xs text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="체크포인트 불러오기"
          >
            <RotateCcw size={12} />
            불러오기{checkpoints.length > 0 && ` (${checkpoints.length})`}
          </button>
        </div>

        {showNewCur && (
          <div className="flex items-center gap-1">
            <input
              value={newCurName}
              onChange={(e) => setNewCurName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="커리큘럼 이름"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              autoFocus
            />
            <button onClick={handleCreate} className="btn-primary text-xs px-2 py-1">만들기</button>
          </div>
        )}

        {showSaveCp && (
          <div className="flex items-center gap-1">
            <input
              value={cpName}
              onChange={(e) => setCpName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveCheckpoint(cpName.trim() || undefined);
                  setCpName("");
                  setShowSaveCp(false);
                }
              }}
              placeholder="체크포인트 이름"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => { saveCheckpoint(cpName.trim() || undefined); setCpName(""); setShowSaveCp(false); }}
              className="btn-primary text-xs px-2 py-1"
            >
              저장
            </button>
          </div>
        )}

        {showCheckpoints && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 space-y-1">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">체크포인트</div>
            {checkpoints.length === 0 && (
              <p className="text-xs text-gray-400 px-2 py-1">저장된 체크포인트가 없습니다</p>
            )}
            {checkpoints.map((cp) => (
              <div key={cp.id} className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => { if (confirm(`"${cp.name}"을 불러올까요?`)) { restoreCheckpoint(cp.id); setShowCheckpoints(false); } }}
                  className="flex-1 text-left rounded px-2 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <div className="truncate">{cp.name}</div>
                  <div className="text-[10px] text-gray-400">{new Date(cp.created_at).toLocaleString("ko")}</div>
                </button>
                <button
                  onClick={() => deleteCheckpoint(cp.id)}
                  className="rounded p-0.5 text-gray-400 hover:text-red-500 shrink-0"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Curricula as accordion sections */}
      <div className="flex-1 overflow-y-auto">
        {curricula.map((cur) => (
          <CurriculumSection
            key={cur.id}
            curriculum={cur}
            isActive={cur.id === currentCurriculumId}
            onSelect={() => selectCurriculum(cur.id)}
            onDelete={!cur.is_default ? () => { if (confirm(`"${cur.name}" 삭제?`)) deleteCurriculum(cur.id); } : undefined}
            curriculumTree={cur.id === currentCurriculumId ? curriculumTree : null}
            selectedExerciseId={selectedExerciseId}
            selectedCardId={selectedCardId}
            onSelectExercise={selectExercise}
            onSelectCard={selectCard}
            onDeleteTopic={deleteTopic}
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
  onSelect,
  onDelete,
  curriculumTree,
  selectedExerciseId,
  selectedCardId,
  onSelectExercise,
  onSelectCard,
  onDeleteTopic,
}: {
  curriculum: { id: number; name: string; is_default: number };
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  curriculumTree: CurriculumTree | null;
  selectedExerciseId: number | null;
  selectedCardId: number | null;
  onSelectExercise: (id: number) => void;
  onSelectCard: (id: number) => void;
  onDeleteTopic: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    if (!isActive) {
      onSelect();
    }
    setExpanded(!expanded);
  };

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <div className="group flex items-center">
        <button
          onClick={handleToggle}
          className={cn(
            "flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors",
            isActive
              ? "text-gray-900 dark:text-gray-100"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
          )}
        >
          {expanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
          <span className="truncate">{curriculum.name}</span>
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="mr-2 rounded p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            title="삭제"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {expanded && isActive && curriculumTree && (
        <div className="px-2 pb-2">
          {curriculumTree.topics.map((topic) => (
            <TopicNode
              key={topic.id}
              topic={topic}
              selectedExerciseId={selectedExerciseId}
              selectedCardId={selectedCardId}
              onSelectExercise={onSelectExercise}
              onSelectCard={onSelectCard}
              onDeleteTopic={onDeleteTopic}
              depth={0}
            />
          ))}
          {curriculumTree.topics.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-gray-400">아직 토픽이 없습니다.<br />Claude Code에서 추가해보세요.</p>
          )}
        </div>
      )}
    </div>
  );
}

function TopicNode({
  topic,
  selectedExerciseId,
  selectedCardId,
  onSelectExercise,
  onSelectCard,
  onDeleteTopic,
  depth,
}: {
  topic: Topic;
  selectedExerciseId: number | null;
  selectedCardId: number | null;
  onSelectExercise: (id: number) => void;
  onSelectCard: (id: number) => void;
  onDeleteTopic: (id: number) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = topic.items || [];
  const hasChildren = topic.children.length > 0 || items.length > 0;

  return (
    <div style={{ paddingLeft: depth * 8 }}>
      <div className="group flex items-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800/70"
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={14} className="text-gray-400 dark:text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
          ) : (
            <BookOpen size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
          )}
          <span className="font-medium text-gray-700 dark:text-gray-200 truncate">{topic.name}</span>
          {topic.progress > 0 && (
            <span className="ml-auto text-xs text-primary-600 dark:text-primary-400 shrink-0">{Math.round(topic.progress * 100)}%</span>
          )}
        </button>
        <button
          onClick={() => { if (confirm(`"${topic.name}" 토픽을 삭제할까요?`)) onDeleteTopic(topic.id); }}
          className="mr-1 rounded p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          title="토픽 삭제"
        >
          <X size={12} />
        </button>
      </div>
      {expanded && (
        <div className="ml-2">
          {items.map((item) =>
            item.type === "knowledge" ? (
              <KnowledgeItem
                key={`k-${item.id}`}
                item={item}
                selected={selectedCardId === item.id}
                onSelect={() => onSelectCard(item.id)}
              />
            ) : (
              <ExerciseItem
                key={`e-${item.id}`}
                item={item}
                selected={selectedExerciseId === item.id}
                onSelect={() => onSelectExercise(item.id)}
              />
            ),
          )}
          {topic.children.map((child) => (
            <TopicNode
              key={child.id}
              topic={child}
              selectedExerciseId={selectedExerciseId}
              selectedCardId={selectedCardId}
              onSelectExercise={onSelectExercise}
              onSelectCard={onSelectCard}
              onDeleteTopic={onDeleteTopic}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function KnowledgeItem({ item, selected, onSelect }: { item: TopicItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm transition-colors",
        selected
          ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70",
      )}
    >
      <BookOpen size={13} className="text-amber-500 dark:text-amber-400 shrink-0" />
      <span className="truncate">{item.title}</span>
    </button>
  );
}

function ExerciseItem({ item, selected, onSelect }: { item: TopicItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm transition-colors",
        selected
          ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70",
      )}
    >
      {item.is_completed ? (
        <CheckCircle2 size={13} className="text-green-500 shrink-0" />
      ) : (
        <Circle size={13} className="text-gray-300 dark:text-gray-600 shrink-0" />
      )}
      <span className="truncate">{item.title}</span>
      <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">Lv.{item.difficulty}</span>
    </button>
  );
}
