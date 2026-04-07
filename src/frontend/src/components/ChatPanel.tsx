import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2, Loader2, Wrench, ChevronDown, ChevronRight, X, FileText, BookOpen, Code2, Type, Quote, Bot } from "lucide-react";
import Markdown from "./Markdown";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";
import type { ChatSnippet } from "../stores/store";

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  expanded?: boolean;
  logs?: string[];
}

const snippetIcon = (type: ChatSnippet["type"]) => {
  switch (type) {
    case "code": return <Code2 size={11} />;
    case "block": return <Quote size={11} />;
    default: return <Type size={11} />;
  }
};

export default function ChatPanel({ className, hideHeader }: { className?: string; hideHeader?: boolean }) {
  const { currentTopic, curricula, currentCurriculumId, selectedItemType, currentExercise, currentCard, chatSnippets, removeChatSnippet, clearChatSnippets } = useStore();
  const currentCurriculum = curricula.find((c) => c.id === currentCurriculumId);
  const curriculumSessionId = currentCurriculum?.session_id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCall>>(new Map());
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Build page context from current view
  const pageContext = selectedItemType === "exercise" && currentExercise
    ? {
        type: "exercise" as const,
        exercise_id: currentExercise.id,
        exercise_title: currentExercise.title,
        exercise_description: currentExercise.description || "",
      }
    : selectedItemType === "knowledge" && currentCard
    ? {
        type: "knowledge" as const,
        card_id: currentCard.id,
        card_title: currentCard.title,
        card_content: currentCard.content || "",
      }
    : null;

  // Build full context including snippets
  const buildContext = () => {
    const ctx: Record<string, unknown> = {};
    if (pageContext) Object.assign(ctx, pageContext);
    if (chatSnippets.length > 0) {
      ctx.snippets = chatSnippets.map((s) => ({ label: s.label, content: s.content, type: s.type }));
    }
    return Object.keys(ctx).length > 0 ? ctx : null;
  };

  // Load history for current curriculum's session
  useEffect(() => {
    if (!curriculumSessionId) {
      setMessages([]);
      return;
    }
    fetch(`/api/chat/history?session_id=${curriculumSessionId}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.map((m: ChatMessage) => ({ role: m.role, content: m.content })));
      })
      .catch(() => {});
  }, [curriculumSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !currentTopic || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);
    setToolCalls(new Map());

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const context = buildContext();

    // Clear snippets after sending (they're consumed)
    clearChatSnippets();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: curriculumSessionId,
          topic_id: currentTopic.id,
          message: userMessage,
          context,
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            handleSSEEvent(eventType, data);
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          return [...updated.slice(0, -1), { ...last, content: "오류가 발생했습니다. 다시 시도해주세요." }];
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, currentTopic, isStreaming, pageContext, chatSnippets]);

  const handleSSEEvent = (eventType: string, data: Record<string, unknown>) => {
    if (eventType === "text_delta") {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, content: last.content + (data.text as string) };
        }
        return updated;
      });
    } else if (eventType === "tool_use_start") {
      setToolCalls((prev) => {
        const next = new Map(prev);
        next.set(data.id as string, {
          id: data.id as string,
          name: data.name as string,
          input: data.input as Record<string, unknown>,
        });
        return next;
      });
    } else if (eventType === "agent_log") {
      setToolCalls((prev) => {
        const next = new Map(prev);
        const tc = next.get(data.tool_use_id as string);
        if (tc) {
          const logs = [...(tc.logs || []), data.message as string];
          next.set(data.tool_use_id as string, { ...tc, logs, expanded: true });
        }
        return next;
      });
    } else if (eventType === "tool_result") {
      setToolCalls((prev) => {
        const next = new Map(prev);
        const tc = next.get(data.tool_use_id as string);
        if (tc) {
          next.set(data.tool_use_id as string, { ...tc, result: data.content as string });
        }
        return next;
      });
    }
  };

  const clearHistory = async () => {
    if (!currentTopic) return;
    await fetch(`/api/chat/history?topic_id=${currentTopic.id}`, { method: "DELETE" });
    setMessages([]);
    setToolCalls(new Map());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleToolExpand = (id: string) => {
    setToolCalls((prev) => {
      const next = new Map(prev);
      const tc = next.get(id);
      if (tc) next.set(id, { ...tc, expanded: !tc.expanded });
      return next;
    });
  };

  const hasContext = !!pageContext || chatSnippets.length > 0;

  return (
    <div className={cn("flex flex-col bg-white dark:bg-[#1a1b26]", className)}>
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3 py-1.5">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">AI 튜터</span>
          <button
            onClick={clearHistory}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            title="대화 초기화"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            질문을 입력하세요
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "assistant" && i === messages.length - 1 && toolCalls.size > 0 && (
              <div className="mb-2 space-y-1">
                {Array.from(toolCalls.values()).map((tc) => {
                  const isAgent = tc.name === "delegate_to_agent";
                  return (
                    <div key={tc.id} className={cn(
                      "rounded border text-xs",
                      isAgent
                        ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                        : "border-gray-200 dark:border-gray-700",
                    )}>
                      <button
                        onClick={() => toggleToolExpand(tc.id)}
                        className={cn(
                          "flex items-center gap-1.5 w-full px-2 py-1 text-left",
                          isAgent
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
                        )}
                      >
                        {tc.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isAgent ? <Bot size={11} /> : <Wrench size={11} />}
                        <span className="font-mono">{isAgent ? "코딩 에이전트 작업 중" : tc.name}</span>
                        {!tc.result && <Loader2 size={11} className="animate-spin ml-auto" />}
                      </button>
                      {tc.expanded && (tc.logs || tc.result) && (
                        <div className="px-2 py-1 border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                          {tc.logs && tc.logs.map((log, li) => (
                            <div key={li} className="text-[10px] text-gray-500 dark:text-gray-400 py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                              {log}
                            </div>
                          ))}
                          {tc.result && !tc.logs && (
                            <pre className="text-[10px] text-gray-500 dark:text-gray-400 overflow-x-auto">
                              {tc.result}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "bg-primary-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <Markdown>
                      {msg.content || (isStreaming && i === messages.length - 1 ? "..." : "")}
                    </Markdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area with context chips */}
      <div>
        <div className="max-w-2xl mx-auto">
        {/* Context chips — right above textarea */}
        {hasContext && (
          <div className="flex flex-wrap items-center gap-1 px-2 pt-2 pb-0.5">
            {/* Page context (auto) */}
            {pageContext && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 text-[11px] text-blue-600 dark:text-blue-400">
                {pageContext.type === "exercise" ? <FileText size={10} /> : <BookOpen size={10} />}
                <span className="text-blue-400 dark:text-blue-500">@</span>
                {pageContext.type === "exercise" ? pageContext.exercise_title : pageContext.card_title}
              </span>
            )}

            {/* User-added snippets */}
            {chatSnippets.map((s) => (
              <span
                key={s.id}
                className="group inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-400"
                title={s.content}
              >
                {snippetIcon(s.type)}
                <span className="text-gray-400 dark:text-gray-500">@</span>
                <span className="max-w-[120px] truncate">{s.label}</span>
                <button
                  onClick={() => removeChatSnippet(s.id)}
                  className="ml-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Textarea + send */}
        <div className="flex items-end gap-1.5 p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="메시지를 입력하세요..."
            className={cn(
              "flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800",
              "px-3 py-2 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400",
              "focus:outline-none focus:ring-1 focus:ring-primary-500",
            )}
            disabled={isStreaming}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className={cn(
              "rounded-lg p-2 transition-colors",
              input.trim() && !isStreaming
                ? "bg-primary-500 text-white hover:bg-primary-600"
                : "bg-gray-200 dark:bg-gray-700 text-gray-400",
            )}
          >
            {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
