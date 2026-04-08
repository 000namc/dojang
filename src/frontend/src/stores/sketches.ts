import { create } from "zustand";
import * as api from "../api/client";
import type { Sketch, SketchSummary } from "../api/client";

interface SketchesState {
  list: SketchSummary[];
  current: Sketch | null;
  isLoading: boolean;

  loadList: () => Promise<void>;
  open: (id: number) => Promise<void>;
  create: (payload?: { title?: string; content?: string }) => Promise<Sketch>;
  updateContent: (content: string) => void;
  updateTitle: (title: string) => void;
  flush: () => Promise<void>;
  remove: (id: number) => Promise<void>;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useSketches = create<SketchesState>((set, get) => ({
  list: [],
  current: null,
  isLoading: false,

  loadList: async () => {
    set({ isLoading: true });
    try {
      const list = await api.listSketches();
      set({ list });
    } finally {
      set({ isLoading: false });
    }
  },

  open: async (id) => {
    const sketch = await api.getSketch(id);
    set({ current: sketch });
  },

  create: async (payload = {}) => {
    const sketch = await api.createSketch({
      title: payload.title ?? "",
      content: payload.content ?? "",
    });
    set((s) => ({
      list: [{ ...sketch, preview: sketch.content.slice(0, 200) }, ...s.list],
      current: sketch,
    }));
    return sketch;
  },

  updateContent: (content) => {
    const cur = get().current;
    if (!cur) return;
    set({ current: { ...cur, content } });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => get().flush(), 500);
  },

  updateTitle: (title) => {
    const cur = get().current;
    if (!cur) return;
    set({ current: { ...cur, title } });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => get().flush(), 500);
  },

  flush: async () => {
    const cur = get().current;
    if (!cur) return;
    await api.updateSketch(cur.id, { title: cur.title, content: cur.content });
    // 목록 프리뷰 갱신
    set((s) => ({
      list: s.list.map((it) =>
        it.id === cur.id
          ? { ...it, title: cur.title, preview: cur.content.slice(0, 200), updated_at: new Date().toISOString() }
          : it,
      ),
    }));
  },

  remove: async (id) => {
    await api.deleteSketch(id);
    set((s) => ({
      list: s.list.filter((it) => it.id !== id),
      current: s.current?.id === id ? null : s.current,
    }));
  },
}));
