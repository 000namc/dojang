import { useState, useRef, useCallback, useEffect } from "react";
import { MessageSquare, X, Lightbulb } from "lucide-react";
import ChatPanel from "./ChatPanel";
import { cn } from "../lib/cn";

const TIPS = [
  "공부하면서 노트나 실습을 바로 수정할 수 있어요 — 채팅으로 요청하세요",
  "실습 문제가 어렵다면 채팅으로 힌트를 요청해보세요",
  "커리큘럼에 새 토픽을 추가하고 싶으면 채팅으로 말해보세요",
  "개념이 이해가 안 되면 채팅으로 질문해보세요",
  "실습 코드를 채팅으로 보내면 AI가 피드백을 줄 수 있어요",
  "노트에 예시를 더 추가하고 싶으면 채팅으로 말해보세요",
  "학습 진도를 확인하고 싶으면 채팅으로 물어보세요",
  "커리큘럼이 마음에 들면 Explore에 공유하고 크레딧을 받으세요",
  "채팅으로 실시간 커리큘럼 수정이 가능해요 — 문서, 실습 모두요",
];

export default function ChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [isFocused, setIsFocused] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
    setIsOpen(true);
  }, []);

  // 닫힐 때마다 다음 팁으로
  useEffect(() => {
    if (!isOpen) setTipIndex((i) => (i + 1) % TIPS.length);
  }, [isOpen]);

  const scheduleClose = useCallback(() => {
    if (isFocused) return;
    closeTimeout.current = setTimeout(() => setIsOpen(false), 500);
  }, [isFocused]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const onIn = () => setIsFocused(true);
    const onOut = (e: FocusEvent) => { if (!el.contains(e.relatedTarget as Node)) setIsFocused(false); };
    el.addEventListener("focusin", onIn);
    el.addEventListener("focusout", onOut);
    return () => { el.removeEventListener("focusin", onIn); el.removeEventListener("focusout", onOut); };
  }, []);

  useEffect(() => () => { if (closeTimeout.current) clearTimeout(closeTimeout.current); }, []);

  return (
    <>
      {/* Floating panel */}
      <div
        ref={panelRef}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2 z-50",
          "w-[66%] max-w-2xl",
          "flex flex-col rounded-2xl overflow-hidden",
          "bg-white dark:bg-[#1e1f2e]",
          "border border-gray-200 dark:border-gray-700",
          "shadow-2xl",
          "transition-all duration-200 ease-out",
          isOpen ? "h-[420px] opacity-100" : "h-11 opacity-90 hover:opacity-100",
        )}
      >
        {/* Header with rotating tips */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none shrink-0"
        >
          {isOpen ? (
            <MessageSquare size={14} className="text-primary-500" />
          ) : (
            <Lightbulb size={14} className="text-amber-400" />
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {isOpen ? "AI 튜터" : `💡 ${TIPS[tipIndex]}`}
          </span>
          <div className="flex-1" />
          {isOpen && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Chat */}
        {isOpen && (
          <ChatPanel className="flex-1 min-h-0 border-t border-gray-100 dark:border-gray-700" hideHeader />
        )}
      </div>
    </>
  );
}
