import axios from "axios";
import type {
  Domain,
  CurriculumTree,
  Exercise,
  ExecuteResult,
  AttemptResult,
} from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

export async function getDomains(): Promise<Domain[]> {
  const { data } = await api.get("/api/domains");
  return data;
}

// Curricula
export interface Curriculum {
  id: number;
  domain_id: number;
  name: string;
  description: string;
  is_default: number;
}

export async function listCurricula(domainId: number): Promise<Curriculum[]> {
  const { data } = await api.get(`/api/domains/${domainId}/curricula`);
  return data;
}

export async function createCurriculum(domainId: number, name: string, description = ""): Promise<{ id: number }> {
  const { data } = await api.post(`/api/domains/${domainId}/curricula`, { name, description });
  return data;
}

export async function deleteCurriculum(curriculumId: number): Promise<void> {
  await api.delete(`/api/curricula/${curriculumId}`);
}

export async function getCurriculumTree(curriculumId: number): Promise<CurriculumTree> {
  const { data } = await api.get(`/api/curricula/${curriculumId}/tree`);
  return data;
}

export async function getExercise(exerciseId: number): Promise<Exercise> {
  const { data } = await api.get(`/api/exercises/${exerciseId}`);
  return data;
}

export async function executeCode(
  domainId: number,
  code: string,
): Promise<ExecuteResult> {
  const { data } = await api.post("/api/execute", {
    domain_id: domainId,
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
  domain_id: number;
  name: string;
  description: string;
  is_default: number;
}

export async function listNotebooks(domainId: number): Promise<Notebook[]> {
  const { data } = await api.get(`/api/domains/${domainId}/notebooks`);
  return data;
}

export async function createNotebook(domainId: number, name: string): Promise<{ id: number }> {
  const { data } = await api.post(`/api/domains/${domainId}/notebooks`, { name });
  return data;
}

export async function deleteNotebook(notebookId: number): Promise<void> {
  await api.delete(`/api/notebooks/${notebookId}`);
}

// Knowledge
export interface KnowledgeCard {
  id: number;
  notebook_id: number | null;
  domain_id: number | null;
  domain_name: string | null;
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

export async function listKnowledge(domainId?: number, q?: string): Promise<KnowledgeCard[]> {
  const { data } = await api.get("/api/knowledge", { params: { domain_id: domainId, q } });
  return data;
}

export async function getKnowledge(id: number): Promise<KnowledgeCard> {
  const { data } = await api.get(`/api/knowledge/${id}`);
  return data;
}

export async function createKnowledge(card: { notebook_id?: number | null; domain_id?: number; title: string; content?: string; tags?: string }): Promise<{ id: number }> {
  const { data } = await api.post("/api/knowledge", card);
  return data;
}

export async function updateKnowledge(id: number, updates: { title?: string; content?: string; tags?: string }): Promise<void> {
  await api.put(`/api/knowledge/${id}`, updates);
}

export async function deleteKnowledge(id: number): Promise<void> {
  await api.delete(`/api/knowledge/${id}`);
}
