import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";

interface SubjectsProps {
  className?: string;
  onNavigateToLearn?: () => void;
}

export default function Subjects({ className, onNavigateToLearn }: SubjectsProps) {
  const { topics, loadTopics, selectTopic, createTopic, updateTopic, deleteTopic } = useStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    loadTopics();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createTopic(newName.trim(), newDesc.trim());
    setNewName("");
    setNewDesc("");
    setIsCreating(false);
  };

  const handleUpdate = async (id: number) => {
    await updateTopic(id, { name: editName.trim() || undefined, description: editDesc.trim() || undefined });
    setEditingId(null);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" 삭제?`)) return;
    await deleteTopic(id);
  };

  const handleEnter = async (topicId: number) => {
    await selectTopic(topicId);
    onNavigateToLearn?.();
  };

  return (
    <div className={cn("overflow-y-auto bg-white dark:bg-gray-900", className)}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Subjects</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map((d) => (
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
                      onClick={() => handleUpdate(d.id)}
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
                      <button
                        onClick={() => { setEditingId(d.id); setEditName(d.name); setEditDesc(d.description || ""); }}
                        className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(d.id, d.name)}
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

          {/* Create Subject card */}
          {isCreating ? (
            <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 p-5 space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Subject name"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Description (optional)"
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
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
                  onClick={() => { setIsCreating(false); setNewName(""); setNewDesc(""); }}
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
              <span className="text-sm font-medium">Create Subject</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
