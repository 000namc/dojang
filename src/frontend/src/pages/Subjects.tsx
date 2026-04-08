import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ArrowRight, FolderPlus, Folder, MoreHorizontal } from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import * as api from "../api/client";
import type { Cluster } from "../api/client";

interface SubjectsProps {
  className?: string;
  onNavigateToLearn?: () => void;
}

// 컴포넌트 이름은 Subjects(파일명 호환) — 페이지 제목은 Topics
export default function Subjects({ className, onNavigateToLearn }: SubjectsProps) {
  const { topics, loadTopics, selectTopic, createTopic, updateTopic, deleteTopic } = useStore();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<number | "all">("all");

  // 토픽 생성/편집 상태
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Cluster 생성/편집
  const [creatingCluster, setCreatingCluster] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [editingClusterId, setEditingClusterId] = useState<number | null>(null);
  const [editClusterName, setEditClusterName] = useState("");

  const reloadClusters = async () => {
    const list = await api.listClusters();
    setClusters(list);
  };

  useEffect(() => {
    loadTopics();
    reloadClusters();
  }, []);

  const handleCreateTopic = async () => {
    if (!newName.trim()) return;
    await createTopic(newName.trim(), newDesc.trim());
    await reloadClusters(); // topic_count 업데이트
    setNewName("");
    setNewDesc("");
    setIsCreating(false);
  };

  const handleUpdateTopic = async (id: number) => {
    await updateTopic(id, {
      name: editName.trim() || undefined,
      description: editDesc.trim() || undefined,
    });
    setEditingId(null);
  };

  const handleDeleteTopic = async (id: number, name: string) => {
    if (!confirm(`"${name}" 삭제?`)) return;
    await deleteTopic(id);
    await reloadClusters();
  };

  const handleEnter = async (topicId: number) => {
    await selectTopic(topicId);
    onNavigateToLearn?.();
  };

  const handleCreateCluster = async () => {
    if (!newClusterName.trim()) return;
    await api.createCluster({ name: newClusterName.trim() });
    setNewClusterName("");
    setCreatingCluster(false);
    await reloadClusters();
  };

  const handleUpdateCluster = async (id: number) => {
    await api.updateCluster(id, { name: editClusterName.trim() });
    setEditingClusterId(null);
    await reloadClusters();
  };

  const handleDeleteCluster = async (cluster: Cluster) => {
    if (cluster.is_default) return;
    if (!confirm(`Cluster "${cluster.name}" 삭제? (속한 토픽은 기본 cluster로 이동)`)) return;
    await api.deleteCluster(cluster.id);
    if (activeClusterId === cluster.id) setActiveClusterId("all");
    await reloadClusters();
    await loadTopics();
  };

  const handleAssignTopicToCluster = async (topicId: number, clusterId: number) => {
    await api.updateTopic(topicId, { cluster_id: clusterId });
    await loadTopics();
    await reloadClusters();
  };

  const visibleTopics = topics.filter((t) => {
    if (activeClusterId === "all") return true;
    return t.cluster_id === activeClusterId;
  });

  return (
    <div className={cn("flex h-full bg-white dark:bg-gray-900", className)}>
      {/* Left: Cluster sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Clusters
          </span>
          <button
            onClick={() => setCreatingCluster(true)}
            className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="새 클러스터"
          >
            <FolderPlus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <button
            onClick={() => setActiveClusterId("all")}
            className={cn(
              "w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              activeClusterId === "all"
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50",
            )}
          >
            <span>전체</span>
            <span className="text-xs text-gray-400">{topics.length}</span>
          </button>
          {clusters.map((c) => (
            <div key={c.id} className="group relative">
              {editingClusterId === c.id ? (
                <div className="px-2 py-1.5">
                  <input
                    value={editClusterName}
                    onChange={(e) => setEditClusterName(e.target.value)}
                    onBlur={() => handleUpdateCluster(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdateCluster(c.id);
                      if (e.key === "Escape") setEditingClusterId(null);
                    }}
                    autoFocus
                    className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setActiveClusterId(c.id)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    activeClusterId === c.id
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Folder size={13} className="shrink-0 text-gray-400" />
                    <span className="truncate">{c.name}</span>
                    {c.is_default ? (
                      <span className="text-[9px] text-gray-400 shrink-0">기본</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">{c.topic_count}</span>
                </button>
              )}
              {!c.is_default && editingClusterId !== c.id && (
                <div className="absolute right-1 top-1 hidden group-hover:flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingClusterId(c.id);
                      setEditClusterName(c.name);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCluster(c);
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {creatingCluster && (
            <div className="px-2 py-1.5">
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
                className="w-full rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          )}
        </div>
      </aside>

      {/* Right: Topics grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Topics</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTopics.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-primary-300 dark:hover:border-primary-700 transition group"
              >
                {editingId === d.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Name"
                      autoFocus
                    />
                    <input
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateTopic(d.id)}
                        className="rounded-lg px-3 py-1 text-xs font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
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
                        <ClusterAssignDropdown
                          topicId={d.id}
                          currentClusterId={d.cluster_id}
                          clusters={clusters}
                          onAssign={(cid) => handleAssignTopicToCluster(d.id, cid)}
                        />
                        <button
                          onClick={() => {
                            setEditingId(d.id);
                            setEditName(d.name);
                            setEditDesc(d.description || "");
                          }}
                          className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteTopic(d.id, d.name)}
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

            {/* Create Topic card */}
            {isCreating ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-5 space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Topic name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTopic();
                  }}
                />
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Description (optional)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTopic();
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateTopic}
                    disabled={!newName.trim()}
                    className={cn(
                      "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                      newName.trim()
                        ? "bg-primary-500 text-white hover:bg-primary-600"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed",
                    )}
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setNewName("");
                      setNewDesc("");
                    }}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-5 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-500 transition-colors"
              >
                <Plus size={24} />
                <span className="text-sm font-medium">Create Topic</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Topic의 cluster 변경 드롭다운 ──
function ClusterAssignDropdown({
  topicId,
  currentClusterId,
  clusters,
  onAssign,
}: {
  topicId: number;
  currentClusterId: number | null;
  clusters: Cluster[];
  onAssign: (clusterId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        title="클러스터 변경"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
            <div className="px-3 py-1 text-[10px] uppercase text-gray-400">클러스터로 이동</div>
            {clusters.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onAssign(c.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs transition-colors",
                  currentClusterId === c.id
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
