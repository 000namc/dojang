import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Wrench, ChevronDown, ChevronRight, Bot, MessageSquare, GraduationCap, Compass, Sparkles, Layers } from "lucide-react";
import Markdown from "../components/Markdown";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";

interface ChatMessage {
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

interface HomeProps {
  className?: string;
  onSelectTopic?: (topicId: number) => void;
  onNavigate?: (view: string) => void;
}

const GREETINGS = [
  "무엇을 배워볼까요?",
  "오늘은 뭘 공부해볼까요?",
  "어떤 걸 알고 싶으세요?",
  "새로운 걸 배워볼까요?",
  "궁금한 게 있으신가요?",
  "오늘의 학습을 시작해볼까요?",
  "어떤 주제가 끌리세요?",
  "함께 배워봐요!",
];

export default function Home({ className, onSelectTopic, onNavigate }: HomeProps) {
  const { topics, currentTopic, loadTopics, selectTopic } = useStore();
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<Map<string, ToolCall>>(new Map());
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadTopics(); }, []);

  // 토픽이 로드됐는데 선택된 게 없으면 첫 번째 자동 선택
  useEffect(() => {
    if (!currentTopic && topics.length > 0) {
      selectTopic(topics[0].id);
    }
  }, [topics, currentTopic]);

  // Reset session when topic changes
  useEffect(() => {
    setSessionId(null);
    setMessages([]);
    setToolCalls(new Map());
  }, [currentTopic?.id]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolCalls]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

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

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !currentTopic || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);
    setToolCalls(new Map());

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic_id: currentTopic.id,
          session_id: sessionId,
          message: userMessage,
          context: null,
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
            const parsed = JSON.parse(line.slice(6));
            if (eventType === "session" && parsed.session_id) {
              setSessionId(parsed.session_id);
            } else {
              handleSSEEvent(eventType, parsed);
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          return [
            ...updated.slice(0, -1),
            { ...last, content: "오류가 발생했습니다. 다시 시도해주세요." },
          ];
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, currentTopic, isStreaming, sessionId]);

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

  const handleTopicClick = async (topicId: number) => {
    await selectTopic(topicId);
    onSelectTopic?.(topicId);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-gray-900", className)}>
      {/* Messages area - scrollable, grows to fill */}
      {hasMessages ? (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i}>
                {/* Tool calls before the last assistant message */}
                {msg.role === "assistant" && i === messages.length - 1 && toolCalls.size > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {Array.from(toolCalls.values()).map((tc) => {
                      const isAgent = tc.name === "delegate_to_agent";
                      return (
                        <div
                          key={tc.id}
                          className={cn(
                            "rounded-lg border text-xs",
                            isAgent
                              ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
                              : "border-gray-200 dark:border-gray-700",
                          )}
                        >
                          <button
                            onClick={() => toggleToolExpand(tc.id)}
                            className={cn(
                              "flex items-center gap-1.5 w-full px-3 py-1.5 text-left",
                              isAgent
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
                            )}
                          >
                            {tc.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            {isAgent ? <Bot size={12} /> : <Wrench size={12} />}
                            <span className="font-mono">
                              {isAgent ? "코딩 에이전트 작업 중" : tc.name}
                            </span>
                            {!tc.result && <Loader2 size={12} className="animate-spin ml-auto" />}
                          </button>
                          {tc.expanded && (tc.logs || tc.result) && (
                            <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                              {tc.logs?.map((log, li) => (
                                <div
                                  key={li}
                                  className="text-[10px] text-gray-500 dark:text-gray-400 py-0.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
                                >
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
                      "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
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
      ) : (
        /* Empty state: greeting + input + topic chips — all centered */
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
            {greeting}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            AI 튜터와 대화하며 학습을 시작하세요
          </p>

          {/* Input — centered */}
          <div className="w-full max-w-2xl mb-6">
            <div
              className={cn(
                "flex items-end gap-2 rounded-xl border shadow-sm",
                "border-gray-200 dark:border-gray-700",
                "bg-gray-50 dark:bg-gray-800",
                "p-2",
              )}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={
                  currentTopic
                    ? "질문하거나 커리큘럼을 만들어보세요..."
                    : "주제를 선택하고 대화를 시작하세요"
                }
                className={cn(
                  "flex-1 resize-none bg-transparent px-2 py-1.5 text-sm",
                  "text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500",
                  "focus:outline-none",
                )}
                disabled={isStreaming || !currentTopic}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming || !currentTopic}
                className={cn(
                  "shrink-0 rounded-lg p-2 transition-colors",
                  input.trim() && !isStreaming && currentTopic
                    ? "bg-primary-500 text-white hover:bg-primary-600"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400",
                )}
              >
                {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-start justify-center gap-4">
            {/* Tab navigation buttons */}
            {[
              { icon: GraduationCap, label: "학습\n이어하기", color: "text-green-400 bg-green-500/10 border-green-500/30", action: () => onNavigate?.("learn") },
              { icon: Layers, label: "Topic\n관리", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30", action: () => onNavigate?.("subjects") },
              { icon: Compass, label: "탐색하기\n", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", action: () => onNavigate?.("community") },
            ].map(({ icon: Icon, label, color, action }) => (
              <button key={label} onClick={action} className="flex flex-col items-center gap-2 group w-20">
                <div className={cn("w-14 h-14 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110", color)}>
                  <Icon size={22} />
                </div>
                <span className="text-[11px] h-7 flex items-start justify-center text-gray-500 dark:text-gray-400 group-hover:text-gray-300 transition-colors text-center whitespace-pre-line leading-tight">{label.trim()}</span>
              </button>
            ))}

            {/* Separator */}
            <div className="w-px h-20 bg-gray-200 dark:bg-gray-700 mx-1 mt-0" />

            {/* Chat prompt buttons */}
            {[
              { icon: MessageSquare, label: "뭘 모르는지\n알아보기", color: "text-purple-400 bg-purple-500/10 border-purple-500/30", action: () => setInput("내가 뭘 모르는지 같이 알아봐줘") },
              { icon: Sparkles, label: "커리큘럼\n생성", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", action: () => setInput("새로운 커리큘럼을 만들어줘") },
              { icon: Compass, label: "다음 공부\n추천", color: "text-orange-400 bg-orange-500/10 border-orange-500/30", action: () => setInput("내가 지금까지 공부한 내용을 바탕으로, 다음에 뭘 공부하면 좋을지 추천해줘") },
            ].map(({ icon: Icon, label, color, action }) => (
              <button key={label} onClick={action} className="flex flex-col items-center gap-2 group w-20">
                <div className={cn("w-14 h-14 rounded-full border-2 flex items-center justify-center transition-transform group-hover:scale-110", color)}>
                  <Icon size={22} />
                </div>
                <span className="text-[11px] h-7 flex items-start justify-center text-gray-500 dark:text-gray-400 group-hover:text-gray-300 transition-colors text-center whitespace-pre-line leading-tight">{label.trim()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area - only when there are messages (chat mode) */}
      {hasMessages && (
        <div className="shrink-0 px-4 pb-4 pt-2">
          <div className="max-w-2xl mx-auto">
            <div
              className={cn(
                "flex items-end gap-2 rounded-xl border shadow-sm",
                "border-gray-200 dark:border-gray-700",
                "bg-gray-50 dark:bg-gray-800",
                "p-2",
              )}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="질문하거나 커리큘럼을 만들어보세요..."
                className={cn(
                  "flex-1 resize-none bg-transparent px-2 py-1.5 text-sm",
                  "text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500",
                  "focus:outline-none",
                )}
                disabled={isStreaming}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className={cn(
                  "shrink-0 rounded-lg p-2 transition-colors",
                  input.trim() && !isStreaming
                    ? "bg-primary-500 text-white hover:bg-primary-600"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400",
                )}
              >
                {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
