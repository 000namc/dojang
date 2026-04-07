import { useState } from "react";
import { MessageSquare, Terminal } from "lucide-react";
import { cn } from "../lib/cn";
import ChatPanel from "./ChatPanel";
import TerminalPanel from "./TerminalPanel";

type Mode = "chat" | "terminal";

export default function RightPanel({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("chat");

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1b26]">
        <TabButton
          active={mode === "chat"}
          onClick={() => setMode("chat")}
          icon={<MessageSquare size={13} />}
          label="Chat"
        />
        <TabButton
          active={mode === "terminal"}
          onClick={() => setMode("terminal")}
          icon={<Terminal size={13} />}
          label="Terminal"
        />
      </div>

      {/* Panel */}
      {mode === "chat" ? (
        <ChatPanel className="flex-1 min-h-0" />
      ) : (
        <TerminalPanel className="flex-1 min-h-0" />
      )}
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
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "text-primary-600 dark:text-primary-400 border-b-2 border-primary-500"
          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
