import { useState, useEffect } from "react";
import { Pencil, Trash2, Save, X, Tag } from "lucide-react";
import Markdown from "./Markdown";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";

export default function KnowledgePanel() {
  const { currentCard, isEditingCard, setEditingCard, saveCard, deleteCard } = useStore();

  if (!currentCard) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">지식 카드를 선택하세요</p>
          <p className="mt-1 text-sm">왼쪽 목록에서 카드를 클릭하거나 새로 만드세요</p>
        </div>
      </div>
    );
  }

  if (isEditingCard) {
    return <CardEditor card={currentCard} onSave={saveCard} onCancel={() => setEditingCard(false)} />;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-gray-900">
      <div className="mx-auto w-full max-w-3xl px-6 py-8 space-y-6">
        {/* Card header */}
        <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {currentCard.title}
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditingCard(true)} className="btn-ghost" title="편집">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => {
                  if (confirm("삭제할까요?")) deleteCard(currentCard.id);
                }}
                className="btn-ghost text-red-500 hover:text-red-600"
                title="삭제"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Tags */}
          {currentCard.tags && (
            <div className="flex items-center gap-1.5">
              <Tag size={12} className="text-gray-400" />
              {currentCard.tags.split(",").map((tag, i) => (
                <span
                  key={i}
                  className="rounded-full bg-primary-100 dark:bg-primary-900/40 px-2.5 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300"
                >
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300">
          <Markdown>{currentCard.content || "*아직 내용이 없습니다. 편집 버튼을 눌러 작성하세요.*"}</Markdown>
        </div>

        {/* Footer */}
        <div className="text-xs text-gray-400">
          {currentCard.topic_name && <span className="mr-3">{currentCard.topic_name}</span>}
          마지막 수정: {new Date(currentCard.updated_at).toLocaleString("ko")}
        </div>
      </div>
    </div>
  );
}

function CardEditor({
  card,
  onSave,
  onCancel,
}: {
  card: { id: number; title: string; content: string; tags: string };
  onSave: (id: number, updates: { title?: string; content?: string; tags?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);
  const [tags, setTags] = useState(card.tags);

  useEffect(() => {
    setTitle(card.title);
    setContent(card.content);
    setTags(card.tags);
  }, [card.id]);

  const handleSave = async () => {
    await onSave(card.id, { title, content, tags });
  };

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-transparent text-lg font-semibold text-gray-900 dark:text-gray-100 focus:outline-none"
          placeholder="제목"
        />
        <div className="flex items-center gap-1 ml-2">
          <button onClick={handleSave} className="btn-primary">
            <Save size={14} />
            저장
          </button>
          <button onClick={onCancel} className="btn-ghost">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 px-4 py-2">
        <Tag size={12} className="text-gray-400 shrink-0" />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="flex-1 bg-transparent text-sm text-gray-600 dark:text-gray-300 focus:outline-none"
          placeholder="태그 (쉼표로 구분)"
        />
      </div>

      {/* Content editor */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={cn(
          "flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed focus:outline-none",
          "text-gray-800 dark:text-gray-200 placeholder-gray-400",
          "font-mono",
        )}
        placeholder="마크다운으로 작성하세요..."
      />
    </div>
  );
}
