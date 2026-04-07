import { create } from "zustand";
import * as api from "../api/client";

interface CommunityState {
  items: any[];
  total: number;
  page: number;
  sort: "popular" | "recent" | "downloads";
  query: string;
  isLoading: boolean;
  setSort: (sort: CommunityState["sort"]) => void;
  setQuery: (q: string) => void;
  loadItems: (page?: number) => Promise<void>;
  upvote: (id: number) => Promise<void>;
  fork: (id: number, topicId: number) => Promise<number>;
  share: (req: Parameters<typeof api.shareCurriculum>[0]) => Promise<number>;
}

export const useCommunity = create<CommunityState>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  sort: "popular",
  query: "",
  isLoading: false,

  setSort: (sort) => {
    set({ sort });
    get().loadItems(1);
  },

  setQuery: (q) => {
    set({ query: q });
    get().loadItems(1);
  },

  loadItems: async (page = 1) => {
    set({ isLoading: true });
    const { sort, query } = get();
    try {
      const result = await api.listCommunity({ sort, q: query || undefined, page });
      set({ items: result.items, total: result.total, page: result.page, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  upvote: async (id) => {
    const result = await api.upvoteCommunity(id);
    set({ items: get().items.map((i) => (i.id === id ? { ...i, upvotes: result.upvotes } : i)) });
  },

  fork: async (id, topicId) => {
    const result = await api.forkCommunity(id, topicId);
    set({ items: get().items.map((i) => (i.id === id ? { ...i, downloads: i.downloads + 1 } : i)) });
    return result.curriculum_id;
  },

  share: async (req) => {
    const r = await api.shareCurriculum(req);
    return r.id;
  },
}));
