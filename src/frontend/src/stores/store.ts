import { create } from "zustand";
import type {
  Domain,
  CurriculumTree,
  Exercise,
  ExecuteResult,
  AttemptResult,
} from "../types";
import * as api from "../api/client";
import type { KnowledgeCard } from "../api/client";

export type AppMode = "practice" | "explore";

interface DojangState {
  // Mode
  mode: AppMode;

  // Domain
  domains: Domain[];
  currentDomain: Domain | null;

  // Curriculum
  curriculum: CurriculumTree | null;
  selectedExerciseId: number | null;

  // Exercise + Editor
  currentExercise: Exercise | null;
  editorCode: string;
  isExecuting: boolean;
  lastResult: ExecuteResult | null;
  lastAttempt: AttemptResult | null;

  // Knowledge (explore mode)
  knowledgeCards: KnowledgeCard[];
  selectedCardId: number | null;
  currentCard: KnowledgeCard | null;
  isEditingCard: boolean;

  // Notify polling
  _lastNotifyTs: number;
  _pollInterval: ReturnType<typeof setInterval> | null;

  // Actions — mode
  setMode: (mode: AppMode) => void;

  // Actions — domain
  loadDomains: () => Promise<void>;
  selectDomain: (domainId: number) => Promise<void>;
  refreshCurriculum: () => Promise<void>;

  // Actions — exercise
  selectExercise: (exerciseId: number) => Promise<void>;
  setEditorCode: (code: string) => void;
  runCode: () => Promise<void>;
  submitAttempt: () => Promise<void>;

  // Actions — knowledge
  loadKnowledge: () => Promise<void>;
  selectCard: (id: number) => Promise<void>;
  createCard: (title: string) => Promise<void>;
  saveCard: (id: number, updates: { title?: string; content?: string; tags?: string }) => Promise<void>;
  deleteCard: (id: number) => Promise<void>;
  setEditingCard: (editing: boolean) => void;

  // Polling
  startNotifyPolling: () => void;
  stopNotifyPolling: () => void;
}

export const useStore = create<DojangState>((set, get) => ({
  mode: "practice",
  domains: [],
  currentDomain: null,
  curriculum: null,
  selectedExerciseId: null,
  currentExercise: null,
  editorCode: "",
  isExecuting: false,
  lastResult: null,
  lastAttempt: null,
  knowledgeCards: [],
  selectedCardId: null,
  currentCard: null,
  isEditingCard: false,
  _lastNotifyTs: Date.now() / 1000,
  _pollInterval: null,

  setMode: (mode) => set({ mode }),

  loadDomains: async () => {
    const domains = await api.getDomains();
    set({ domains });
    if (domains.length > 0 && !get().currentDomain) {
      await get().selectDomain(domains[0].id);
    }
  },

  selectDomain: async (domainId: number) => {
    const { domains } = get();
    const domain = domains.find((d) => d.id === domainId) || null;
    set({
      currentDomain: domain,
      selectedExerciseId: null,
      currentExercise: null,
      editorCode: "",
      lastResult: null,
      lastAttempt: null,
    });
    if (domain) {
      const curriculum = await api.getCurriculum(domainId);
      set({ curriculum });
    }
    // Also refresh knowledge for the domain
    await get().loadKnowledge();
  },

  refreshCurriculum: async () => {
    const { currentDomain } = get();
    if (!currentDomain) return;
    const curriculum = await api.getCurriculum(currentDomain.id);
    set({ curriculum });
  },

  selectExercise: async (exerciseId: number) => {
    const exercise = await api.getExercise(exerciseId);
    set({
      mode: "practice",
      selectedExerciseId: exerciseId,
      currentExercise: exercise,
      editorCode: exercise.initial_code || "",
      lastResult: null,
      lastAttempt: null,
    });
  },

  setEditorCode: (code: string) => set({ editorCode: code }),

  runCode: async () => {
    const { currentDomain, editorCode } = get();
    if (!currentDomain || !editorCode.trim()) return;
    set({ isExecuting: true, lastResult: null, lastAttempt: null });
    try {
      const result = await api.executeCode(currentDomain.id, editorCode);
      set({ lastResult: result });
    } catch (e: any) {
      set({
        lastResult: {
          output: "",
          error: e.response?.data?.detail || e.message,
          result_type: "error",
          columns: null,
          rows: null,
        },
      });
    } finally {
      set({ isExecuting: false });
    }
  },

  submitAttempt: async () => {
    const { selectedExerciseId, editorCode } = get();
    if (!selectedExerciseId || !editorCode.trim()) return;
    set({ isExecuting: true, lastAttempt: null });
    try {
      const result = await api.submitAttempt(selectedExerciseId, editorCode);
      let execResult: ExecuteResult | null = null;
      try {
        execResult = JSON.parse(result.result);
      } catch {}
      set({ lastAttempt: result, lastResult: execResult });
      await get().refreshCurriculum();
    } catch (e: any) {
      set({
        lastAttempt: {
          id: 0,
          is_correct: false,
          result: "",
          feedback: e.response?.data?.detail || e.message,
        },
      });
    } finally {
      set({ isExecuting: false });
    }
  },

  // Knowledge
  loadKnowledge: async () => {
    const { currentDomain } = get();
    try {
      const cards = await api.listKnowledge(currentDomain?.id);
      set({ knowledgeCards: cards });
    } catch {
      set({ knowledgeCards: [] });
    }
  },

  selectCard: async (id: number) => {
    try {
      const card = await api.getKnowledge(id);
      set({ selectedCardId: id, currentCard: card, isEditingCard: false, mode: "explore" });
    } catch {}
  },

  createCard: async (title: string) => {
    const { currentDomain } = get();
    try {
      const { id } = await api.createKnowledge({
        domain_id: currentDomain?.id,
        title,
        content: "",
      });
      await get().loadKnowledge();
      await get().selectCard(id);
      set({ isEditingCard: true });
    } catch {}
  },

  saveCard: async (id, updates) => {
    try {
      await api.updateKnowledge(id, updates);
      await get().loadKnowledge();
      // Refresh current card
      const card = await api.getKnowledge(id);
      set({ currentCard: card, isEditingCard: false });
    } catch {}
  },

  deleteCard: async (id) => {
    try {
      await api.deleteKnowledge(id);
      set({ selectedCardId: null, currentCard: null });
      await get().loadKnowledge();
    } catch {}
  },

  setEditingCard: (editing) => set({ isEditingCard: editing }),

  startNotifyPolling: () => {
    const existing = get()._pollInterval;
    if (existing) return;
    const interval = setInterval(async () => {
      const { _lastNotifyTs } = get();
      try {
        const data = await api.checkNotify(_lastNotifyTs);
        if (data.event) {
          set({ _lastNotifyTs: data.ts });
          if (data.event === "curriculum_updated" || data.event === "exercise_created") {
            await get().refreshCurriculum();
          }
          if (data.event === "knowledge_updated") {
            await get().loadKnowledge();
          }
        }
      } catch {}
    }, 2000);
    set({ _pollInterval: interval });
  },

  stopNotifyPolling: () => {
    const { _pollInterval } = get();
    if (_pollInterval) {
      clearInterval(_pollInterval);
      set({ _pollInterval: null });
    }
  },
}));
