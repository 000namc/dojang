import { Plus, Clock, Search } from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import type { ViewType } from "./IconNav";

interface SidePanelProps {
  activeView: ViewType;
  isOpen: boolean;
  className?: string;
}

export default function SidePanel({ activeView, isOpen, className }: SidePanelProps) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "w-64 shrink-0 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 overflow-hidden",
        "transition-all duration-200",
        className,
      )}
    >
      {activeView === "home" && <ChatSessions />}
      {/* Learn은 자체 CurriculumSidebar 사용 */}
      {activeView === "subjects" && <SubjectsList />}
      {activeView === "community" && <CommunityFilters />}
    </div>
  );
}

function ChatSessions() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 dark:border-gray-800">
        <button className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Plus size={16} />
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="px-2 py-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Recent</div>
        <p className="px-3 py-4 text-xs text-gray-400 text-center">No recent chats</p>
      </div>
    </div>
  );
}

function LearnSidebar() {
  const { topics, currentTopic, selectTopic } = useStore();
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 dark:border-gray-800">
        <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">Subjects</div>
        <div className="flex flex-wrap gap-1">
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTopic(t.id)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                currentTopic?.id === t.id
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-3 py-4 text-xs text-gray-400 text-center">Select a subject above</p>
      </div>
    </div>
  );
}

function SubjectsList() {
  const { topics } = useStore();
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search subjects..."
            className="w-full rounded-lg bg-gray-50 dark:bg-gray-800 border-0 pl-8 pr-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {topics.map((t) => (
          <button
            key={t.id}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <span className="truncate">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CommunityFilters() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100 dark:border-gray-800">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search community..."
            className="w-full rounded-lg bg-gray-50 dark:bg-gray-800 border-0 pl-8 pr-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div className="px-2 py-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Categories</div>
        {["All", "CLI", "Git", "Docker", "SQL", "ML"].map((cat) => (
          <button
            key={cat}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
