import { useEffect, useState } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
import { cn } from "../lib/cn";
import { useSketches } from "../stores/sketches";
import TerminalPanel from "../components/TerminalPanel";

interface SketchProps {
  className?: string;
}

function deriveTitle(content: string, fallback: string): string {
  const firstLine = content.split("\n").find((l) => l.trim());
  if (!firstLine) return fallback || "Untitled";
  return firstLine.replace(/^#+\s*/, "").trim().slice(0, 60) || fallback || "Untitled";
}

export default function Sketch({ className }: SketchProps) {
  const { list, current, loadList, open, create, updateContent, remove, flush } = useSketches();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadList();
  }, []);

  // Auto-open the most recent sketch on mount
  useEffect(() => {
    if (!current && list.length > 0) {
      open(list[0].id);
    }
  }, [list.length]);

  // Save on unmount
  useEffect(() => {
    return () => {
      flush();
    };
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const s = await create({ content: "" });
      await open(s.id);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`"${title || "Untitled"}" 삭제할까요?`)) return;
    await remove(id);
  };

  return (
    <div className={cn("flex h-full bg-white dark:bg-gray-900", className)}>
      {/* Left: sketch list */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800">
        <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 w-full rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus size={14} />
            New sketch
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {list.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-gray-400">No sketches yet</p>
          )}
          {list.map((it) => {
            const title = deriveTitle(it.preview || "", it.title);
            const isActive = current?.id === it.id;
            return (
              <div
                key={it.id}
                className={cn(
                  "group flex items-start gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors",
                  isActive
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/40",
                )}
                onClick={() => open(it.id)}
              >
                <FileText size={13} className="mt-0.5 shrink-0 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "text-[12px] font-medium truncate",
                    isActive ? "text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-300",
                  )}>
                    {title}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    {it.claude_session_id ? "session linked" : "no session yet"}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(it.id, title); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Center: editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {current ? (
          <>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Sketchpad</span>
              <span className="text-[10px] text-gray-400">
                {current.claude_session_id ? "Claude Code 세션 연결됨" : "Claude Code 세션 시작 시 자동 연결"}
              </span>
            </div>
            <textarea
              value={current.content}
              onChange={(e) => updateContent(e.target.value)}
              className={cn(
                "flex-1 resize-none p-4 text-sm font-mono leading-relaxed",
                "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200",
                "placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none",
              )}
              placeholder="자유롭게 메모하세요... (마크다운 지원)"
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-sm">스케치가 없어요</p>
              <p className="mt-1 text-xs">왼쪽에서 New sketch 를 눌러 시작</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: per-sketch Claude Code terminal (full height) */}
      <TerminalPanel
        className="w-[460px] shrink-0 border-l border-gray-200 dark:border-gray-800"
        sketchId={current?.id ?? null}
      />
    </div>
  );
}
