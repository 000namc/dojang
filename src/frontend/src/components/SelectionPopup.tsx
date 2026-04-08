import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import { useStore } from "../stores/store";

function stripMd(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .trim();
}

/**
 * 중앙 패널에서 텍스트를 드래그 선택하면 "맥락에 추가" 버튼이 뜹니다.
 * Ctrl+Shift+A 단축키로도 추가할 수 있습니다.
 * fixed 포지셔닝으로 코드블럭 등 중첩 요소에서도 정상 동작합니다.
 */
export default function SelectionPopup({
  containerRef,
  sourceText,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  sourceText?: string;
}) {
  const addContextSnippet = useStore((s) => s.addContextSnippet);
  const [popup, setPopup] = useState<{ x: number; y: number; text: string } | null>(null);

  const findLineRange = useCallback(
    (text: string): [number, number] | undefined => {
      if (!sourceText) return undefined;
      const srcLines = sourceText.split("\n");
      const selLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (selLines.length === 0) return undefined;

      const firstSel = stripMd(selLines[0]);
      const lastSel = stripMd(selLines[selLines.length - 1]);

      let start: number | undefined;
      let end: number | undefined;

      for (let i = 0; i < srcLines.length; i++) {
        const stripped = stripMd(srcLines[i]);
        if (!stripped) continue;
        if (start == null && stripped.includes(firstSel)) {
          start = i + 1;
        }
        if (start != null && stripped.includes(lastSel)) {
          end = i + 1;
        }
      }

      // Fuzzy fallback — match by keywords
      if (start == null) {
        const words = firstSel.split(/\s+/).filter((w) => w.length > 1);
        for (let i = 0; i < srcLines.length; i++) {
          const stripped = stripMd(srcLines[i]);
          if (words.length > 0 && words.every((w) => stripped.includes(w))) {
            start = i + 1;
            end = start;
            break;
          }
        }
      }

      // Code block fallback — search raw lines without stripping
      if (start == null) {
        for (let i = 0; i < srcLines.length; i++) {
          if (srcLines[i].includes(selLines[0])) {
            start = i + 1;
            break;
          }
        }
        if (start != null && selLines.length > 1) {
          for (let i = start - 1; i < srcLines.length; i++) {
            if (srcLines[i].includes(selLines[selLines.length - 1])) {
              end = i + 1;
              break;
            }
          }
        }
      }

      if (start != null) return [start, end ?? start];
      return undefined;
    },
    [sourceText],
  );

  const addSelection = useCallback(
    (text: string) => {
      const range = findLineRange(text);
      addContextSnippet(text, range?.[0], range?.[1]);
    },
    [findLineRange, addContextSnippet],
  );

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

    const range = sel.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      setPopup(null);
      return;
    }

    // Use fixed positioning based on viewport
    const rect = range.getBoundingClientRect();
    setPopup({
      x: rect.left + rect.width / 2,
      y: rect.top - 4,
      text,
    });
  }, [containerRef]);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (popup && !(e.target as HTMLElement).closest("[data-selection-popup]")) {
        setPopup(null);
      }
    },
    [popup],
  );

  // Ctrl+Shift+A shortcut
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.preventDefault();
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const text = sel.toString().trim();
        if (!text || text.length < 2) return;

        const range = sel.getRangeAt(0);
        if (!containerRef.current?.contains(range.commonAncestorContainer)) return;

        addSelection(text);
        sel.removeAllRanges();
        setPopup(null);
      }
    },
    [containerRef, addSelection],
  );

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleMouseUp, handleMouseDown, handleKeyDown]);

  if (!popup) return null;

  const range = findLineRange(popup.text);
  const lineLabel = range
    ? range[0] === range[1]
      ? `L${range[0]}`
      : `L${range[0]}:${range[1]}`
    : null;

  return (
    <div
      data-selection-popup
      className="fixed z-[9999] -translate-x-1/2 -translate-y-full"
      style={{ left: popup.x, top: popup.y }}
    >
      <button
        onClick={() => {
          addSelection(popup.text);
          setPopup(null);
          window.getSelection()?.removeAllRanges();
        }}
        className="flex items-center gap-1 rounded-lg bg-gray-800 dark:bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
      >
        <Plus size={12} />
        맥락에 추가{lineLabel ? ` (${lineLabel})` : ""}
        <kbd className="ml-1 text-[10px] text-gray-400">⌃⇧A</kbd>
      </button>
    </div>
  );
}
