import { useEffect, useState } from "react";
import { Search, ThumbsUp, Download, Loader2 } from "lucide-react";
import { cn } from "../lib/cn";
import { useCommunity } from "../stores/community";
import { useStore } from "../stores/store";

interface CommunityProps {
  className?: string;
}

const sortTabs: { key: "popular" | "recent" | "downloads"; label: string }[] = [
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
  { key: "downloads", label: "Most Downloaded" },
];

export default function Community({ className }: CommunityProps) {
  const { items, total, sort, query, isLoading, setSort, setQuery, loadItems, upvote, fork } = useCommunity();
  const { topics, currentTopic } = useStore();
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    loadItems(1);
  }, []);

  const handleSearch = () => {
    setQuery(searchInput.trim());
  };

  const handleFork = async (id: number) => {
    const topicId = currentTopic?.id || topics[0]?.id;
    if (!topicId) return;
    await fork(id, topicId);
  };

  return (
    <div className={cn("overflow-y-auto bg-white dark:bg-gray-900", className)}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Community</h1>

        {/* Sort tabs */}
        <div className="flex items-center gap-2 mb-4">
          {sortTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                sort === key
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Search curricula..."
              className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            className="rounded-xl px-4 py-2 text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {/* Cards */}
        {!isLoading && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 hover:border-primary-300 dark:hover:border-primary-700 transition group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 line-clamp-1">{item.title}</h3>
                  {item.subject && (
                    <span className="shrink-0 ml-2 rounded-full bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 text-[11px] font-medium text-primary-600 dark:text-primary-400">
                      {item.subject}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                  {item.description || "No description"}
                </p>
                {item.tags && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.split(",").map((tag: string, i: number) => (
                      <span
                        key={i}
                        className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] text-gray-500 dark:text-gray-400"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3 mt-auto">
                  <button
                    onClick={() => upvote(item.id)}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                      "text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20",
                    )}
                  >
                    <ThumbsUp size={13} />
                    <span>{item.upvotes || 0}</span>
                  </button>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Download size={13} />
                    <span>{item.downloads || 0}</span>
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={() => handleFork(item.id)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                  >
                    <Download size={13} />
                    Fork
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-lg">No shared curricula yet</p>
            <p className="mt-1 text-sm">Share your curriculum from the Learn view to get started</p>
          </div>
        )}

        {/* Total count */}
        {!isLoading && total > 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">
            {total} curricul{total === 1 ? "um" : "a"} shared
          </p>
        )}
      </div>
    </div>
  );
}
