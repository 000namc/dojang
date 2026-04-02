import { BookOpen, Lightbulb } from "lucide-react";
import { cn } from "../lib/cn";
import { useStore, type AppMode } from "../stores/store";
import CurriculumSidebar from "./CurriculumSidebar";
import KnowledgeList from "./KnowledgeList";

export default function Sidebar({ className }: { className?: string }) {
  const { mode, setMode } = useStore();

  return (
    <div className={cn("flex flex-col overflow-hidden", className)}>
      {/* Tab bar */}
      <div className="flex border-b dark:border-gray-700">
        <TabButton
          active={mode === "practice"}
          onClick={() => setMode("practice")}
          icon={<BookOpen size={14} />}
          label="실습"
        />
        <TabButton
          active={mode === "explore"}
          onClick={() => setMode("explore")}
          icon={<Lightbulb size={14} />}
          label="탐구"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {mode === "practice" ? (
          <CurriculumSidebar className="h-full" />
        ) : (
          <KnowledgeList />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-b-2 border-primary-500 text-primary-600 dark:text-primary-400"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
