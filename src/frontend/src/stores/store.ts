import { create } from "zustand";
import type {
  Topic,
  CurriculumTree,
  Exercise,
  ExecuteResult,
  AttemptResult,
} from "../types";
import * as api from "../api/client";
import type { Curriculum, Notebook, KnowledgeCard, Checkpoint } from "../api/client";

export type SelectedItemType = "exercise" | "knowledge" | null;

export interface ChatSnippet {
  id: string;
  label: string;
  content: string;
  type: "selection" | "code" | "block";
}

interface DojangState {
  selectedItemType: SelectedItemType;

  // Topic
  topics: Topic[];
  currentTopic: Topic | null;

  // Curricula (multiple per topic)
  curricula: Curriculum[];
  currentCurriculumId: number | null;
  curriculumTree: CurriculumTree | null;
  selectedExerciseId: number | null;

  // Exercise + Editor
  currentExercise: Exercise | null;
  editorCode: string;
  isExecuting: boolean;
  lastResult: ExecuteResult | null;
  lastAttempt: AttemptResult | null;

  // Knowledge (notebooks + cards)
  notebooks: Notebook[];
  currentNotebookId: number | null;
  knowledgeCards: KnowledgeCard[];
  selectedCardId: number | null;
  currentCard: KnowledgeCard | null;
  isEditingCard: boolean;

  // Chat context snippets
  chatSnippets: ChatSnippet[];

  // Checkpoints
  checkpoints: Checkpoint[];

  // Polling
  _lastNotifyTs: number;
  _pollInterval: ReturnType<typeof setInterval> | null;

  // Actions
  loadTopics: () => Promise<void>;
  selectTopic: (topicId: number) => Promise<void>;
  loadCurricula: () => Promise<void>;
  selectCurriculum: (curriculumId: number) => Promise<void>;
  createCurriculum: (name: string) => Promise<void>;
  deleteCurriculum: (curriculumId: number) => Promise<void>;
  refreshCurriculumTree: () => Promise<void>;
  deleteSubject: (subjectId: number) => Promise<void>;
  deleteExercise: (exerciseId: number) => Promise<void>;
  deleteKnowledge: (id: number) => Promise<void>;
  selectExercise: (exerciseId: number) => Promise<void>;
  setEditorCode: (code: string) => void;
  runCode: () => Promise<void>;
  runCodeRaw: (code: string) => Promise<ExecuteResult>;
  submitAttempt: () => Promise<void>;
  loadNotebooks: () => Promise<void>;
  selectNotebook: (notebookId: number) => Promise<void>;
  createNotebook: (name: string) => Promise<void>;
  deleteNotebook: (notebookId: number) => Promise<void>;
  loadKnowledge: () => Promise<void>;
  selectCard: (id: number) => Promise<void>;
  createCard: (title: string) => Promise<void>;
  saveCard: (id: number, updates: { title?: string; content?: string; tags?: string }) => Promise<void>;
  deleteCard: (id: number) => Promise<void>;
  setEditingCard: (editing: boolean) => void;
  loadCheckpoints: () => Promise<void>;
  saveCheckpoint: (name?: string) => Promise<void>;
  restoreCheckpoint: (checkpointId: number) => Promise<void>;
  deleteCheckpoint: (checkpointId: number) => Promise<void>;
  createTopic: (name: string, description?: string) => Promise<void>;
  updateTopic: (id: number, updates: { name?: string; description?: string }) => Promise<void>;
  deleteTopic: (id: number) => Promise<void>;
  addChatSnippet: (snippet: Omit<ChatSnippet, "id">) => void;
  removeChatSnippet: (id: string) => void;
  clearChatSnippets: () => void;
  startNotifyPolling: () => void;
  stopNotifyPolling: () => void;
}

export const useStore = create<DojangState>((set, get) => ({
  selectedItemType: null,
  topics: [],
  currentTopic: null,
  curricula: [],
  currentCurriculumId: null,
  curriculumTree: null,
  selectedExerciseId: null,
  currentExercise: null,
  editorCode: "",
  isExecuting: false,
  lastResult: null,
  lastAttempt: null,
  notebooks: [],
  currentNotebookId: null,
  knowledgeCards: [],
  selectedCardId: null,
  currentCard: null,
  isEditingCard: false,
  chatSnippets: [],
  checkpoints: [],
  _lastNotifyTs: Date.now() / 1000,
  _pollInterval: null,

  loadTopics: async () => {
    const topics = await api.getTopics();
    set({ topics });
    if (topics.length > 0 && !get().currentTopic) {
      await get().selectTopic(topics[0].id);
    }
  },

  selectTopic: async (topicId: number) => {
    const { topics } = get();
    const topic = topics.find((t) => t.id === topicId) || null;
    set({
      currentTopic: topic,
      curricula: [],
      currentCurriculumId: null,
      curriculumTree: null,
      selectedExerciseId: null,
      currentExercise: null,
      editorCode: "",
      lastResult: null,
      lastAttempt: null,
      notebooks: [],
      currentNotebookId: null,
      knowledgeCards: [],
      selectedCardId: null,
      currentCard: null,
      selectedItemType: null,
    });
    if (topic) {
      await get().loadCurricula();
      await get().loadNotebooks();
    }
  },

  loadCurricula: async () => {
    const { currentTopic } = get();
    if (!currentTopic) return;
    const curricula = await api.listCurricula(currentTopic.id);
    set({ curricula });
    if (curricula.length > 0) {
      const def = curricula.find((c) => c.is_default) || curricula[0];
      await get().selectCurriculum(def.id);
    }
  },

  selectCurriculum: async (curriculumId: number) => {
    set({ currentCurriculumId: curriculumId, selectedExerciseId: null, currentExercise: null, selectedCardId: null, currentCard: null, selectedItemType: null });
    const tree = await api.getCurriculumTree(curriculumId);
    set({ curriculumTree: tree });
    await get().loadCheckpoints();
  },

  createCurriculum: async (name: string) => {
    const { currentTopic } = get();
    if (!currentTopic) return;
    const { id } = await api.createCurriculum(currentTopic.id, name);
    await get().loadCurricula();
    await get().selectCurriculum(id);
  },

  deleteCurriculum: async (curriculumId: number) => {
    await api.deleteCurriculum(curriculumId);
    await get().loadCurricula();
  },

  refreshCurriculumTree: async () => {
    const { currentCurriculumId } = get();
    if (!currentCurriculumId) return;
    const tree = await api.getCurriculumTree(currentCurriculumId);
    set({ curriculumTree: tree });
  },

  deleteSubject: async (subjectId: number) => {
    await api.deleteSubject(subjectId);
    set({ selectedExerciseId: null, currentExercise: null, selectedCardId: null, currentCard: null, selectedItemType: null });
    await get().refreshCurriculumTree();
  },

  deleteExercise: async (exerciseId: number) => {
    await api.deleteExercise(exerciseId);
    set({ selectedExerciseId: null, currentExercise: null, selectedItemType: null });
    await get().refreshCurriculumTree();
  },

  deleteKnowledge: async (id: number) => {
    await api.deleteKnowledge(id);
    set({ selectedCardId: null, currentCard: null, selectedItemType: null });
    await get().refreshCurriculumTree();
    await get().loadKnowledge();
  },

  selectExercise: async (exerciseId: number) => {
    const exercise = await api.getExercise(exerciseId);
    set({
      selectedItemType: "exercise",
      selectedExerciseId: exerciseId,
      currentExercise: exercise,
      editorCode: exercise.initial_code || "",
      lastResult: null,
      lastAttempt: null,
      selectedCardId: null,
      currentCard: null,
    });
  },

  setEditorCode: (code) => set({ editorCode: code }),

  runCode: async () => {
    const { currentTopic, editorCode } = get();
    if (!currentTopic || !editorCode.trim()) return;
    set({ isExecuting: true, lastResult: null, lastAttempt: null });
    try {
      const result = await api.executeCode(currentTopic.id, editorCode);
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

  runCodeRaw: async (code: string): Promise<ExecuteResult> => {
    const { currentTopic } = get();
    if (!currentTopic) throw new Error("No topic selected");
    set({ isExecuting: true });
    try {
      const result = await api.executeCode(currentTopic.id, code);
      set({ lastResult: result });
      return result;
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
      try { execResult = JSON.parse(result.result); } catch {}
      set({ lastAttempt: result, lastResult: execResult });
      await get().refreshCurriculumTree();
    } catch (e: any) {
      set({
        lastAttempt: { id: 0, is_correct: false, result: "", feedback: e.response?.data?.detail || e.message },
      });
    } finally {
      set({ isExecuting: false });
    }
  },

  loadNotebooks: async () => {
    const { currentTopic } = get();
    if (!currentTopic) return;
    try {
      const notebooks = await api.listNotebooks(currentTopic.id);
      set({ notebooks });
      if (notebooks.length > 0 && !get().currentNotebookId) {
        const def = notebooks.find((n) => n.is_default) || notebooks[0];
        await get().selectNotebook(def.id);
      }
    } catch { set({ notebooks: [], knowledgeCards: [] }); }
  },

  selectNotebook: async (notebookId: number) => {
    set({ currentNotebookId: notebookId, selectedCardId: null, currentCard: null });
    await get().loadKnowledge();
  },

  createNotebook: async (name: string) => {
    const { currentTopic } = get();
    if (!currentTopic) return;
    const { id } = await api.createNotebook(currentTopic.id, name);
    await get().loadNotebooks();
    await get().selectNotebook(id);
  },

  deleteNotebook: async (notebookId: number) => {
    await api.deleteNotebook(notebookId);
    set({ currentNotebookId: null });
    await get().loadNotebooks();
  },

  loadKnowledge: async () => {
    const { currentNotebookId } = get();
    if (!currentNotebookId) { set({ knowledgeCards: [] }); return; }
    try {
      const cards = await api.listCardsInNotebook(currentNotebookId);
      set({ knowledgeCards: cards });
    } catch { set({ knowledgeCards: [] }); }
  },

  selectCard: async (id) => {
    try {
      const card = await api.getKnowledge(id);
      set({
        selectedItemType: "knowledge",
        selectedCardId: id,
        currentCard: card,
        isEditingCard: false,
        selectedExerciseId: null,
        currentExercise: null,
      });
    } catch {}
  },

  createCard: async (title) => {
    const { currentTopic, currentNotebookId } = get();
    try {
      const { id } = await api.createKnowledge({ notebook_id: currentNotebookId, topic_id: currentTopic?.id, title, content: "" });
      await get().loadKnowledge();
      await get().selectCard(id);
      set({ isEditingCard: true });
    } catch {}
  },

  saveCard: async (id, updates) => {
    try {
      await api.updateKnowledge(id, updates);
      await get().loadKnowledge();
      const card = await api.getKnowledge(id);
      set({ currentCard: card, isEditingCard: false });
    } catch {}
  },

  deleteCard: async (id) => {
    try {
      await api.deleteKnowledge(id);
      set({ selectedCardId: null, currentCard: null, selectedItemType: null });
      await get().loadKnowledge();
    } catch {}
  },

  setEditingCard: (editing) => set({ isEditingCard: editing }),

  loadCheckpoints: async () => {
    const { currentCurriculumId } = get();
    if (!currentCurriculumId) return;
    const checkpoints = await api.listCheckpoints(currentCurriculumId);
    set({ checkpoints });
  },

  saveCheckpoint: async (name?: string) => {
    const { currentCurriculumId } = get();
    if (!currentCurriculumId) return;
    await api.createCheckpoint(currentCurriculumId, name);
    await get().loadCheckpoints();
  },

  restoreCheckpoint: async (checkpointId: number) => {
    await api.restoreCheckpoint(checkpointId);
    set({ selectedExerciseId: null, currentExercise: null, selectedCardId: null, currentCard: null, selectedItemType: null });
    await get().refreshCurriculumTree();
  },

  deleteCheckpoint: async (checkpointId: number) => {
    await api.deleteCheckpoint(checkpointId);
    await get().loadCheckpoints();
  },

  createTopic: async (name, description) => {
    await api.createTopic(name, description);
    await get().loadTopics();
  },

  updateTopic: async (id, updates) => {
    await api.updateTopic(id, updates);
    await get().loadTopics();
  },

  deleteTopic: async (id) => {
    await api.deleteTopic(id);
    const { currentTopic } = get();
    if (currentTopic?.id === id) {
      set({ currentTopic: null, curricula: [], currentCurriculumId: null, curriculumTree: null });
    }
    await get().loadTopics();
  },

  addChatSnippet: (snippet) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    set({ chatSnippets: [...get().chatSnippets, { ...snippet, id }] });
  },

  removeChatSnippet: (id) => {
    set({ chatSnippets: get().chatSnippets.filter((s) => s.id !== id) });
  },

  clearChatSnippets: () => set({ chatSnippets: [] }),

  startNotifyPolling: () => {
    if (get()._pollInterval) return;
    const interval = setInterval(async () => {
      const { _lastNotifyTs } = get();
      try {
        const data = await api.checkNotify(_lastNotifyTs);
        if (data.event) {
          set({ _lastNotifyTs: data.ts });
          if (data.event === "curriculum_updated" || data.event === "exercise_created") {
            await get().refreshCurriculumTree();
          }
          if (data.event === "knowledge_updated") {
            await get().loadKnowledge();
            await get().refreshCurriculumTree();
          }
        }
      } catch {}
    }, 2000);
    set({ _pollInterval: interval });
  },

  stopNotifyPolling: () => {
    const { _pollInterval } = get();
    if (_pollInterval) { clearInterval(_pollInterval); set({ _pollInterval: null }); }
  },
}));
