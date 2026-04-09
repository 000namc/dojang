import axios from "axios";
import type {
  Topic,
  CurriculumTree,
  Exercise,
  ExecuteResult,
  AttemptResult,
} from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

export async function getTopics(): Promise<Topic[]> {
  const { data } = await api.get("/api/topics");
  return data;
}

// Curricula
export interface Curriculum {
  id: number;
  topic_id: number;
  name: string;
  description: string;
  is_default: number;
  session_id: number | null;
}

export async function listCurricula(topicId: number): Promise<Curriculum[]> {
  const { data } = await api.get(`/api/topics/${topicId}/curricula`);
  return data;
}

export async function createCurriculum(topicId: number, name: string, description = ""): Promise<{ id: number }> {
  const { data } = await api.post(`/api/topics/${topicId}/curricula`, { name, description });
  return data;
}

export async function deleteCurriculum(curriculumId: number): Promise<void> {
  await api.delete(`/api/curricula/${curriculumId}`);
}

export async function getCurriculumTree(curriculumId: number): Promise<CurriculumTree> {
  const { data } = await api.get(`/api/curricula/${curriculumId}/tree`);
  return data;
}

export async function deleteSubject(subjectId: number): Promise<void> {
  await api.delete(`/api/subjects/${subjectId}`);
}

// Checkpoints
export interface Checkpoint {
  id: number;
  curriculum_id: number;
  name: string;
  created_at: string;
}

export async function listCheckpoints(curriculumId: number): Promise<Checkpoint[]> {
  const { data } = await api.get(`/api/curricula/${curriculumId}/checkpoints`);
  return data;
}

export async function createCheckpoint(curriculumId: number, name?: string): Promise<{ id: number; name: string }> {
  const { data } = await api.post(`/api/curricula/${curriculumId}/checkpoints`, { name: name || "" });
  return data;
}

export async function restoreCheckpoint(checkpointId: number): Promise<void> {
  await api.post(`/api/checkpoints/${checkpointId}/restore`);
}

export async function deleteCheckpoint(checkpointId: number): Promise<void> {
  await api.delete(`/api/checkpoints/${checkpointId}`);
}

export async function getExercise(exerciseId: number): Promise<Exercise> {
  const { data } = await api.get(`/api/exercises/${exerciseId}`);
  return data;
}

export async function deleteExercise(exerciseId: number): Promise<void> {
  await api.delete(`/api/exercises/${exerciseId}`);
}

export async function executeCode(
  topicId: number,
  code: string,
): Promise<ExecuteResult> {
  const { data } = await api.post("/api/execute", {
    topic_id: topicId,
    code,
  });
  return data;
}

export async function submitAttempt(
  exerciseId: number,
  userCode: string,
): Promise<AttemptResult> {
  const { data } = await api.post(`/api/exercises/${exerciseId}/attempt`, {
    user_code: userCode,
  });
  return data;
}

export async function checkNotify(since: number): Promise<{ event: string | null; ts: number }> {
  const { data } = await api.get("/api/notify", { params: { since } });
  return data;
}

// Notebooks
export interface Notebook {
  id: number;
  topic_id: number;
  name: string;
  description: string;
  is_default: number;
}

export async function listNotebooks(topicId: number): Promise<Notebook[]> {
  const { data } = await api.get(`/api/topics/${topicId}/notebooks`);
  return data;
}

export async function createNotebook(topicId: number, name: string): Promise<{ id: number }> {
  const { data } = await api.post(`/api/topics/${topicId}/notebooks`, { name });
  return data;
}

export async function deleteNotebook(notebookId: number): Promise<void> {
  await api.delete(`/api/notebooks/${notebookId}`);
}

// Knowledge
export interface KnowledgeCard {
  id: number;
  notebook_id: number | null;
  topic_id: number | null;
  subject_id: number | null;
  topic_name: string | null;
  notebook_name: string | null;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export async function listCardsInNotebook(notebookId: number, q?: string): Promise<KnowledgeCard[]> {
  const { data } = await api.get(`/api/notebooks/${notebookId}/cards`, { params: { q } });
  return data;
}

export async function listKnowledge(topicId?: number, q?: string): Promise<KnowledgeCard[]> {
  const { data } = await api.get("/api/knowledge", { params: { topic_id: topicId, q } });
  return data;
}

export async function getKnowledge(id: number): Promise<KnowledgeCard> {
  const { data } = await api.get(`/api/knowledge/${id}`);
  return data;
}

export async function createKnowledge(card: { notebook_id?: number | null; topic_id?: number; subject_id?: number | null; title: string; content?: string; tags?: string }): Promise<{ id: number }> {
  const { data } = await api.post("/api/knowledge", card);
  return data;
}

export async function updateKnowledge(id: number, updates: { title?: string; content?: string; tags?: string }): Promise<void> {
  await api.put(`/api/knowledge/${id}`, updates);
}

export async function deleteKnowledge(id: number): Promise<void> {
  await api.delete(`/api/knowledge/${id}`);
}

// Context file (synced to data/current_context.md for coding agents)
export async function getContext(): Promise<string> {
  const { data } = await api.get("/api/context");
  return data.content;
}
export async function putContext(content: string): Promise<void> {
  await api.put("/api/context", { content });
}

// Topic CRUD
export async function createTopic(
  name: string,
  description?: string,
  clusterId?: number,
): Promise<{ id: number }> {
  const { data } = await api.post("/api/topics", {
    name,
    description: description || "",
    container_name: `dojang-${name.toLowerCase()}`,
    ...(clusterId !== undefined ? { cluster_id: clusterId } : {}),
  });
  return data;
}
export async function updateTopic(
  id: number,
  updates: {
    name?: string;
    description?: string;
    cluster_id?: number;
    // null 명시 = 기본 커리큘럼 해제 (Explore 별자리에서 토픽이 사라짐)
    default_curriculum_id?: number | null;
  },
): Promise<void> {
  await api.put(`/api/topics/${id}`, updates);
}
export async function deleteTopic(id: number): Promise<void> {
  await api.delete(`/api/topics/${id}`);
}
export async function getTopicStats(id: number): Promise<{ curriculum_count: number; subject_count: number; exercise_count: number }> {
  const { data } = await api.get(`/api/topics/${id}/stats`);
  return data;
}

// Clusters
export interface Cluster {
  id: number;
  name: string;
  description: string;
  order_num: number;
  is_default: number;
  created_at: string;
  topic_count: number;
}
export async function listClusters(): Promise<Cluster[]> {
  const { data } = await api.get("/api/clusters");
  return data;
}
export async function createCluster(payload: { name: string; description?: string }): Promise<{ id: number; name: string }> {
  const { data } = await api.post("/api/clusters", payload);
  return data;
}
export async function updateCluster(id: number, payload: { name?: string; description?: string; order_num?: number }): Promise<void> {
  await api.patch(`/api/clusters/${id}`, payload);
}
export async function deleteCluster(id: number): Promise<void> {
  await api.delete(`/api/clusters/${id}`);
}
export async function reorderClusters(ids: number[]): Promise<void> {
  await api.post("/api/clusters/reorder", { ids });
}

// Sketches
export interface SketchSummary {
  id: number;
  title: string;
  preview: string;
  claude_session_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface Sketch extends SketchSummary {
  content: string;
}
export async function listSketches(): Promise<SketchSummary[]> {
  const { data } = await api.get("/api/sketches");
  return data;
}
export async function getSketch(id: number): Promise<Sketch> {
  const { data } = await api.get(`/api/sketches/${id}`);
  return data;
}
export async function createSketch(payload: { title?: string; content?: string }): Promise<Sketch> {
  const { data } = await api.post("/api/sketches", payload);
  return data;
}
export async function updateSketch(id: number, updates: { title?: string; content?: string }): Promise<void> {
  await api.patch(`/api/sketches/${id}`, updates);
}
export async function deleteSketch(id: number): Promise<void> {
  await api.delete(`/api/sketches/${id}`);
}

// Knowledge graph
export interface KGNode {
  id: string;
  kind: "subject" | "exercise" | "knowledge";
  label: string;
  topic_id: number;
  topic_name: string;
  curriculum_id: number;
  confidence: number;
  attempts: number;
  status: "unknown" | "learning" | "mastered";
  // subject only
  exercise_count?: number;
  knowledge_count?: number;
  // satellite only
  difficulty?: number;
  parent?: string;
}
export interface KGLink {
  source: string;
  target: string;
  kind: "chain" | "satellite";
}
export async function getKnowledgeGraph(): Promise<{ nodes: KGNode[]; links: KGLink[] }> {
  const { data } = await api.get("/api/knowledge-graph");
  return data;
}
