import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useStore } from "../stores/store";

/**
 * 중앙 패널에서 텍스트를 드래그 선택하면 "맥락 추가" 버튼이 뜹니다.
 * containerRef가 가리키는 요소 안에서만 동작합니다.
 */
export default function SelectionPopup({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const addChatSnippet = useStore((s) => s.addChatSnippet);
  const [popup, setPopup] = useState<{ x: number; y: number; text: string } | null>(null);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setPopup(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text || text.length < 2) {
      setPopup(null);
      return;
    }

    // Check if selection is inside our container
    const range = sel.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      setPopup(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setPopup({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 4,
      text,
    });
  }, [containerRef]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    // Close popup when clicking outside it
    if (popup && !(e.target as HTMLElement).closest("[data-selection-popup]")) {
      setPopup(null);
    }
  }, [popup]);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [handleMouseUp, handleMouseDown]);

  if (!popup) return null;

  const label = popup.text.length > 30 ? popup.text.slice(0, 30) + "..." : popup.text;
  const isCode = popup.text.includes("\n") || /^[a-zA-Z_$]/.test(popup.text);

  return (
    <div
      data-selection-popup
      className="absolute z-50 -translate-x-1/2 -translate-y-full"
      style={{ left: popup.x, top: popup.y }}
    >
      <button
        onClick={() => {
          addChatSnippet({
            label,
            content: popup.text,
            type: isCode ? "code" : "selection",
          });
          setPopup(null);
          window.getSelection()?.removeAllRanges();
        }}
        className="flex items-center gap-1 rounded-lg bg-gray-800 dark:bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
      >
        <Plus size={12} />
        채팅 맥락에 추가
      </button>
    </div>
  );
}
