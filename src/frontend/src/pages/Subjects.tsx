import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Folder,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import * as api from "../api/client";
import type { Cluster } from "../api/client";
import HelpBanner from "../components/HelpBanner";

interface SubjectsProps {
  className?: string;
  onNavigateToLearn?: () => void;
}

const COLLAPSE_KEY = "dojang.cluster.collapsed";

const loadCollapsed = (): Record<number, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveCollapsed = (state: Record<number, boolean>) => {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
  } catch {}
};

// 컴포넌트 이름은 Subjects(파일명 호환) — 페이지 제목은 Topics
export default function Subjects({ className, onNavigateToLearn }: SubjectsProps) {
  const { topics, loadTopics, selectTopic, createTopic, updateTopic, deleteTopic } = useStore();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(() => loadCollapsed());

  // topic 편집
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [editTopicDesc, setEditTopicDesc] = useState("");

  // cluster 이름 편집
  const [editingClusterId, setEditingClusterId] = useState<number | null>(null);
  const [editClusterName, setEditClusterName] = useState("");

  // cluster 새로 추가 (페이지 하단)
  const [creatingCluster, setCreatingCluster] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");

  // cluster 안 새 토픽 추가
  const [creatingTopicInCluster, setCreatingTopicInCluster] = useState<number | null>(null);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDesc, setNewTopicDesc] = useState("");

  // dnd state — topic 카드를 cluster body 로 이동
  const [dragTopicId, setDragTopicId] = useState<number | null>(null);
  const [dragOverClusterId, setDragOverClusterId] = useState<number | null>(null);

  // dnd state — cluster section 자체 reorder
  const [dragClusterId, setDragClusterId] = useState<number | null>(null);
  const [dragOverReorderId, setDragOverReorderId] = useState<number | null>(null);

  const reloadClusters = async () => {
    const list = await api.listClusters();
    setClusters(list);
  };

  useEffect(() => {
    loadTopics();
    reloadClusters();
  }, []);

  const toggleCollapse = (clusterId: number) => {
    setCollapsed((prev) => {
      const next = { ...prev, [clusterId]: !prev[clusterId] };
      saveCollapsed(next);
      return next;
    });
  };

  // ── topic CRUD ─────────────────────────────────────────
  const handleSubmitNewTopic = async (clusterId: number) => {
    if (!newTopicName.trim()) return;
    await createTopic(newTopicName.trim(), newTopicDesc.trim() || undefined, clusterId);
    setNewTopicName("");
    setNewTopicDesc("");
    setCreatingTopicInCluster(null);
    await reloadClusters();
  };

  const handleSaveTopicEdit = async (id: number) => {
    await updateTopic(id, {
      name: editTopicName.trim() || undefined,
      description: editTopicDesc.trim() || undefined,
    });
    setEditingTopicId(null);
  };

  const handleDeleteTopic = async (id: number, name: string) => {
    if (!confirm(`"${name}" 삭제?`)) return;
    await deleteTopic(id);
    await reloadClusters();
  };

  const handleEnter = async (id: number) => {
    await selectTopic(id);
    onNavigateToLearn?.();
  };

  // ── cluster CRUD ───────────────────────────────────────
  const handleCreateCluster = async () => {
    if (!newClusterName.trim()) return;
    await api.createCluster({ name: newClusterName.trim() });
    setNewClusterName("");
    setCreatingCluster(false);
    await reloadClusters();
  };

  const handleSaveClusterRename = async (id: number) => {
    if (!editClusterName.trim()) {
      setEditingClusterId(null);
      return;
    }
    await api.updateCluster(id, { name: editClusterName.trim() });
    setEditingClusterId(null);
    await reloadClusters();
  };

  const handleDeleteCluster = async (cluster: Cluster) => {
    if (cluster.is_default) {
      alert("기본 cluster는 삭제할 수 없습니다");
      return;
    }
    if (!confirm(`Cluster "${cluster.name}" 삭제? (속한 토픽은 기본 cluster로 이동)`)) return;
    await api.deleteCluster(cluster.id);
    await reloadClusters();
    await loadTopics();
  };

  // ── DnD: topic → cluster body ──────────────────────────
  const handleTopicDragStart = (e: React.DragEvent, topicId: number) => {
    e.dataTransfer.setData("dojang/topic-id", String(topicId));
    e.dataTransfer.effectAllowed = "move";
    setDragTopicId(topicId);
  };
  const handleTopicDragEnd = () => {
    setDragTopicId(null);
    setDragOverClusterId(null);
  };
  const handleClusterBodyDragOver = (e: React.DragEvent, clusterId: number) => {
    if (dragTopicId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverClusterId !== clusterId) setDragOverClusterId(clusterId);
  };
  const handleClusterBodyDragLeave = (e: React.DragEvent) => {
    // 자식 노드 hover 로 인한 false leave 방지: relatedTarget 이 currentTarget 의 자식이면 무시
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setDragOverClusterId(null);
  };
  const handleClusterBodyDrop = async (e: React.DragEvent, clusterId: number) => {
    e.preventDefault();
    const tid = Number(e.dataTransfer.getData("dojang/topic-id"));
    setDragTopicId(null);
    setDragOverClusterId(null);
    if (!tid) return;
    const topic = topics.find((t) => t.id === tid);
    if (!topic || topic.cluster_id === clusterId) return;
    await updateTopic(tid, { cluster_id: clusterId });
    await reloadClusters();
  };

  // ── DnD: cluster reorder (헤더 잡고 다른 cluster 위로) ──
  const handleClusterHeaderDragStart = (e: React.DragEvent, clusterId: number) => {
    e.dataTransfer.setData("dojang/cluster-id", String(clusterId));
    e.dataTransfer.effectAllowed = "move";
    setDragClusterId(clusterId);
  };
  const handleClusterHeaderDragEnd = () => {
    setDragClusterId(null);
    setDragOverReorderId(null);
  };
  const handleSectionDragOver = (e: React.DragEvent, clusterId: number) => {
    if (dragClusterId === null || dragClusterId === clusterId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverReorderId !== clusterId) setDragOverReorderId(clusterId);
  };
  const handleSectionDrop = async (e: React.DragEvent, targetClusterId: number) => {
    if (dragClusterId === null) return;
    e.preventDefault();
    const sourceId = dragClusterId;
    setDragClusterId(null);
    setDragOverReorderId(null);
    if (!sourceId || sourceId === targetClusterId) return;
    // source 를 target 위치 *앞* 에 끼워넣기
    const ids = clusters.map((c) => c.id).filter((id) => id !== sourceId);
    const targetIdx = ids.indexOf(targetClusterId);
    if (targetIdx === -1) return;
    ids.splice(targetIdx, 0, sourceId);
    // 낙관 업데이트
    setClusters((prev) => {
      const map = new Map(prev.map((c) => [c.id, c]));
      return ids.map((id) => map.get(id)!).filter(Boolean);
    });
    await api.reorderClusters(ids);
    await reloadClusters();
  };

  return (
    <div className={cn("h-full overflow-y-auto bg-white dark:bg-gray-900", className)}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">Topics</h1>
        <HelpBanner storageKey="topics" className="mb-6">
          Cluster 헤더를 잡고 드래그해서 순서를 바꾸고, 토픽 카드를 다른 cluster 본문으로 끌어서 이동하세요. 맨 아래 <strong>Cluster 추가</strong> 로 새 그룹을 만들 수 있고, 각 cluster 의 ▸ 로 접을 수 있습니다.
        </HelpBanner>

        <div className="space-y-4">
          {clusters.map((c) => {
            const sectionTopics = topics.filter((t) => t.cluster_id === c.id);
            const isCollapsed = !!collapsed[c.id];
            const isTopicDropTarget = dragOverClusterId === c.id;
            const isReorderTarget = dragOverReorderId === c.id;
            const isDragging = dragClusterId === c.id;
            const isHeaderDraggable = editingClusterId !== c.id;

            return (
              <section
                key={c.id}
                onDragOver={(e) => handleSectionDragOver(e, c.id)}
                onDrop={(e) => handleSectionDrop(e, c.id)}
                className={cn(
                  "rounded-2xl border transition-all",
                  isReorderTarget
                    ? "border-primary-400 dark:border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900"
                    : "border-gray-200 dark:border-gray-800",
                  isDragging && "opacity-40",
                )}
              >
                {/* ── Header ── */}
                <div
                  draggable={isHeaderDraggable}
                  onDragStart={(e) => isHeaderDraggable && handleClusterHeaderDragStart(e, c.id)}
                  onDragEnd={handleClusterHeaderDragEnd}
                  className={cn(
                    "group flex items-center gap-2 px-4 py-3",
                    isHeaderDraggable && "cursor-grab active:cursor-grabbing",
                  )}
                >
                  <GripVertical
                    size={14}
                    className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 shrink-0"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(c.id);
                    }}
                    className="rounded p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <Folder size={14} className="text-gray-400 shrink-0" />
                  {editingClusterId === c.id ? (
                    <input
                      value={editClusterName}
                      onChange={(e) => setEditClusterName(e.target.value)}
                      onBlur={() => handleSaveClusterRename(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveClusterRename(c.id);
                        if (e.key === "Escape") setEditingClusterId(null);
                      }}
                      autoFocus
                      className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-0.5 text-sm font-semibold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  ) : (
                    <h2
                      className="text-sm font-semibold text-gray-800 dark:text-gray-200"
                      onDoubleClick={() => {
                        setEditingClusterId(c.id);
                        setEditClusterName(c.name);
                      }}
                    >
                      {c.name}
                    </h2>
                  )}
                  <span className="text-xs text-gray-400">({sectionTopics.length})</span>
                  {c.is_default ? (
                    <span className="text-[10px] uppercase tracking-wider text-gray-400">기본</span>
                  ) : null}
                  <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClusterId(c.id);
                        setEditClusterName(c.name);
                      }}
                      className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="이름 변경"
                    >
                      <Pencil size={13} />
                    </button>
                    {!c.is_default && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCluster(c);
                        }}
                        className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Body ── */}
                {!isCollapsed && (
                  <div
                    onDragOver={(e) => handleClusterBodyDragOver(e, c.id)}
                    onDragLeave={handleClusterBodyDragLeave}
                    onDrop={(e) => handleClusterBodyDrop(e, c.id)}
                    className={cn(
                      "px-4 pb-4 transition-colors rounded-b-2xl",
                      isTopicDropTarget && "bg-primary-50/60 dark:bg-primary-900/20",
                    )}
                  >
                    {sectionTopics.length === 0 && creatingTopicInCluster !== c.id ? (
                      <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl py-10 flex flex-col items-center justify-center gap-2 text-gray-400">
                        <p className="text-xs">이 클러스터에 토픽이 없습니다</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          여기로 토픽을 드래그하거나
                        </p>
                        <button
                          onClick={() => setCreatingTopicInCluster(c.id)}
                          className="text-xs text-primary-500 hover:text-primary-600 inline-flex items-center gap-1"
                        >
                          <Plus size={12} /> 토픽 추가
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sectionTopics.map((d) => (
                          <div
                            key={d.id}
                            draggable={editingTopicId !== d.id}
                            onDragStart={(e) => {
                              e.stopPropagation();
                              handleTopicDragStart(e, d.id);
                            }}
                            onDragEnd={handleTopicDragEnd}
                            className={cn(
                              "rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-primary-300 dark:hover:border-primary-700 transition group",
                              dragTopicId === d.id && "opacity-40",
                              editingTopicId !== d.id && "cursor-grab active:cursor-grabbing",
                            )}
                          >
                            {editingTopicId === d.id ? (
                              <div className="space-y-2">
                                <input
                                  value={editTopicName}
                                  onChange={(e) => setEditTopicName(e.target.value)}
                                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  placeholder="Name"
                                  autoFocus
                                />
                                <input
                                  value={editTopicDesc}
                                  onChange={(e) => setEditTopicDesc(e.target.value)}
                                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                                  placeholder="Description"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveTopicEdit(d.id)}
                                    className="rounded-lg px-3 py-1 text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setEditingTopicId(null)}
                                    className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between mb-2">
                                  <h3 className="font-bold text-gray-900 dark:text-gray-100">{d.name}</h3>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingTopicId(d.id);
                                        setEditTopicName(d.name);
                                        setEditTopicDesc(d.description || "");
                                      }}
                                      className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTopic(d.id, d.name);
                                      }}
                                      className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                                  {d.description || "No description"}
                                </p>
                                <button
                                  onClick={() => handleEnter(d.id)}
                                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                                >
                                  Enter
                                  <ArrowRight size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        ))}

                        {/* Create topic in this cluster */}
                        {creatingTopicInCluster === c.id ? (
                          <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-5 space-y-2">
                            <input
                              value={newTopicName}
                              onChange={(e) => setNewTopicName(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              placeholder="Topic name"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSubmitNewTopic(c.id);
                                if (e.key === "Escape") {
                                  setCreatingTopicInCluster(null);
                                  setNewTopicName("");
                                  setNewTopicDesc("");
                                }
                              }}
                            />
                            <input
                              value={newTopicDesc}
                              onChange={(e) => setNewTopicDesc(e.target.value)}
                              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                              placeholder="Description (optional)"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSubmitNewTopic(c.id);
                              }}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSubmitNewTopic(c.id)}
                                disabled={!newTopicName.trim()}
                                className={cn(
                                  "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                                  newTopicName.trim()
                                    ? "bg-primary-500 text-white hover:bg-primary-600"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed",
                                )}
                              >
                                Create
                              </button>
                              <button
                                onClick={() => {
                                  setCreatingTopicInCluster(null);
                                  setNewTopicName("");
                                  setNewTopicDesc("");
                                }}
                                className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          sectionTopics.length > 0 && (
                            <button
                              onClick={() => setCreatingTopicInCluster(c.id)}
                              className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-5 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-500 transition-colors min-h-[140px]"
                            >
                              <Plus size={20} />
                              <span className="text-xs font-medium">Create Topic</span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {/* ── Add cluster row ── */}
          {creatingCluster ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 px-4 py-4">
              <input
                value={newClusterName}
                onChange={(e) => setNewClusterName(e.target.value)}
                onBlur={() => {
                  if (newClusterName.trim()) handleCreateCluster();
                  else setCreatingCluster(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCluster();
                  if (e.key === "Escape") {
                    setCreatingCluster(false);
                    setNewClusterName("");
                  }
                }}
                autoFocus
                placeholder="새 클러스터 이름"
                className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          ) : (
            <button
              onClick={() => setCreatingCluster(true)}
              className="w-full rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 px-4 py-4 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-500 transition-colors"
            >
              <Plus size={16} />
              <span className="text-sm font-medium">Cluster 추가</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
