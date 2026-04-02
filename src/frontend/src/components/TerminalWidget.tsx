import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";

interface HistoryEntry {
  command: string;
  output: string;
  isError: boolean;
}

export default function TerminalWidget({ className }: { className?: string }) {
  const { currentDomain, isExecuting, runCodeRaw } = useStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdIndex, setCmdIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const domainName = currentDomain?.name?.toLowerCase() ?? "dojang";
  const prompt = `user@${domainName} /workspace $`;

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  const handleSubmit = useCallback(async () => {
    const cmd = input.trim();
    if (!cmd || isExecuting) return;

    setInput("");
    setCmdHistory((prev) => [cmd, ...prev]);
    setCmdIndex(-1);

    // Optimistically add command to history
    setHistory((prev) => [...prev, { command: cmd, output: "", isError: false }]);

    try {
      const result = await runCodeRaw(cmd);
      setHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          command: cmd,
          output: result.output || result.error || "",
          isError: !!result.error,
        };
        return updated;
      });
    } catch (e: any) {
      setHistory((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          command: cmd,
          output: e.message || "Error",
          isError: true,
        };
        return updated;
      });
    }
  }, [input, isExecuting, runCodeRaw]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const next = Math.min(cmdIndex + 1, cmdHistory.length - 1);
        setCmdIndex(next);
        setInput(cmdHistory[next]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cmdIndex > 0) {
        const next = cmdIndex - 1;
        setCmdIndex(next);
        setInput(cmdHistory[next]);
      } else {
        setCmdIndex(-1);
        setInput("");
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  };

  return (
    <div
      className={cn("flex flex-col rounded-xl overflow-hidden border border-gray-700", className)}
      onClick={() => inputRef.current?.focus()}
    >
      {/* macOS title bar */}
      <div className="flex items-center gap-2 bg-gray-800 dark:bg-gray-750 px-4 py-2.5 border-b border-gray-700">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-2 text-xs text-gray-400 font-mono">Terminal</span>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[#1a1b26] px-4 py-3 font-mono text-sm leading-relaxed"
      >
        {/* History */}
        {history.map((entry, i) => (
          <div key={i} className="mb-2">
            {/* Command line */}
            <div className="flex gap-2">
              <span className="text-green-400 shrink-0">{prompt}</span>
              <span className="text-gray-200">{entry.command}</span>
            </div>
            {/* Output */}
            {entry.output && (
              <pre
                className={cn(
                  "mt-0.5 whitespace-pre-wrap pl-0",
                  entry.isError ? "text-red-400" : "text-gray-400",
                )}
              >
                {entry.output}
              </pre>
            )}
            {/* Loading indicator */}
            {!entry.output && i === history.length - 1 && isExecuting && (
              <span className="text-gray-500 animate-pulse">...</span>
            )}
          </div>
        ))}

        {/* Current input line */}
        <div className="flex gap-2 items-center">
          <span className="text-green-400 shrink-0">{prompt}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-gray-200 outline-none caret-gray-200"
            spellCheck={false}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
