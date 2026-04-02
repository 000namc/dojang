import { useEffect, useState } from "react";
import { Plus, FileText, Search, Trash2 } from "lucide-react";
import { cn } from "../lib/cn";
import { useStore } from "../stores/store";

export default function KnowledgeList() {
  const {
    domains, currentDomain, notebooks, currentNotebookId,
    knowledgeCards, selectedCardId,
    selectDomain, selectNotebook, createNotebook, deleteNotebook,
    selectCard, createCard,
  } = useStore();
  const [search, setSearch] = useState("");
  const [showNewNb, setShowNewNb] = useState(false);
  const [newNbName, setNewNbName] = useState("");

  const handleCreateNb = async () => {
    if (!newNbName.trim()) return;
    await createNotebook(newNbName.trim());
    setNewNbName("");
    setShowNewNb(false);
  };

  const currentNb = notebooks.find((n) => n.id === currentNotebookId);

  const filtered = search
    ? knowledgeCards.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.tags.toLowerCase().includes(search.toLowerCase()),
      )
    : knowledgeCards;

  return (
    <div className="flex flex-col h-full">
      {/* Domain + Notebook selectors */}
      <div className="border-b dark:border-gray-700 p-3 space-y-2">
        <select
          value={currentDomain?.id ?? ""}
          onChange={(e) => selectDomain(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm font-medium focus:border-primary-500 focus:outline-none"
        >
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {notebooks.length > 0 && (
          <div className="flex items-center gap-1">
            <select
              value={currentNotebookId ?? ""}
              onChange={(e) => selectNotebook(Number(e.target.value))}
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none"
            >
              {notebooks.map((n) => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
            <button onClick={() => setShowNewNb(!showNewNb)} className="rounded p-1 text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="새 노트북">
              <Plus size={14} />
            </button>
            {currentNb && !currentNb.is_default && (
              <button onClick={() => { if (confirm(`"${currentNb.name}" 삭제?`)) deleteNotebook(currentNb.id); }} className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700" title="삭제">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {showNewNb && (
          <div className="flex items-center gap-1">
            <input
              value={newNbName}
              onChange={(e) => setNewNbName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateNb()}
              placeholder="노트북 이름"
              className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-gray-100 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none"
              autoFocus
            />
            <button onClick={handleCreateNb} className="btn-primary text-xs px-2 py-1">만들기</button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 pl-8 pr-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none dark:text-gray-100"
          />
        </div>
      </div>

      {/* New card button */}
      <div className="px-2 pb-2">
        <button
          onClick={() => createCard("새 지식 카드")}
          className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <Plus size={14} />
          새 카드
        </button>
      </div>

      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {filtered.map((card) => (
          <button
            key={card.id}
            onClick={() => selectCard(card.id)}
            className={cn(
              "flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors",
              selectedCardId === card.id
                ? "bg-primary-50 dark:bg-primary-900/30"
                : "hover:bg-gray-100 dark:hover:bg-gray-700",
            )}
          >
            <div className="flex w-full items-center gap-1.5">
              <FileText size={13} className="text-gray-400 shrink-0" />
              <span className={cn("text-sm font-medium truncate", selectedCardId === card.id ? "text-primary-700 dark:text-primary-300" : "text-gray-700 dark:text-gray-200")}>
                {card.title}
              </span>
            </div>
            {card.tags && (
              <div className="mt-0.5 ml-5 flex gap-1 flex-wrap">
                {card.tags.split(",").map((tag, i) => (
                  <span key={i} className="text-[10px] rounded bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 text-gray-500 dark:text-gray-300">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-gray-400">
            {search ? "검색 결과 없음" : "아직 저장된 지식이 없어요"}
          </p>
        )}
      </div>
    </div>
  );
}
