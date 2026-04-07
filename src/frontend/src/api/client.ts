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

// Topic CRUD
export async function createTopic(name: string, description?: string): Promise<{ id: number }> {
  const { data } = await api.post("/api/topics", { name, description: description || "", container_name: `dojang-${name.toLowerCase()}` });
  return data;
}
export async function updateTopic(id: number, updates: { name?: string; description?: string }): Promise<void> {
  await api.put(`/api/topics/${id}`, updates);
}
export async function deleteTopic(id: number): Promise<void> {
  await api.delete(`/api/topics/${id}`);
}
export async function getTopicStats(id: number): Promise<{ curriculum_count: number; subject_count: number; exercise_count: number }> {
  const { data } = await api.get(`/api/topics/${id}/stats`);
  return data;
}

// Community
export async function shareCurriculum(req: { curriculum_id: number; title: string; description?: string; subject?: string; tags?: string }): Promise<{ id: number }> {
  const { data } = await api.post("/api/community/share", req);
  return data;
}
export async function listCommunity(params: { sort?: string; q?: string; page?: number }): Promise<{ items: any[]; total: number; page: number }> {
  const { data } = await api.get("/api/community", { params });
  return data;
}
export async function upvoteCommunity(id: number, voterId?: string): Promise<{ upvoted: boolean; upvotes: number }> {
  const vid = voterId || getVoterId();
  const { data } = await api.post(`/api/community/${id}/upvote`, { voter_id: vid });
  return data;
}
export async function forkCommunity(id: number, topicId: number): Promise<{ curriculum_id: number }> {
  const { data } = await api.post(`/api/community/${id}/fork`, { topic_id: topicId });
  return data;
}

function getVoterId(): string {
  let id = localStorage.getItem("dojang_voter_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("dojang_voter_id", id); }
  return id;
}
