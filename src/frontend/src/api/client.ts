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

export async function getCurriculum(domainId: number): Promise<CurriculumTree> {
  const { data } = await api.get(`/api/domains/${domainId}/curriculum`);
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

// Knowledge
export interface KnowledgeCard {
  id: number;
  domain_id: number | null;
  domain_name: string | null;
  title: string;
  content: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export async function listKnowledge(domainId?: number, q?: string): Promise<KnowledgeCard[]> {
  const { data } = await api.get("/api/knowledge", { params: { domain_id: domainId, q } });
  return data;
}

export async function getKnowledge(id: number): Promise<KnowledgeCard> {
  const { data } = await api.get(`/api/knowledge/${id}`);
  return data;
}

export async function createKnowledge(card: { domain_id?: number; title: string; content?: string; tags?: string }): Promise<{ id: number }> {
  const { data } = await api.post("/api/knowledge", card);
  return data;
}

export async function updateKnowledge(id: number, updates: { title?: string; content?: string; tags?: string }): Promise<void> {
  await api.put(`/api/knowledge/${id}`, updates);
}

export async function deleteKnowledge(id: number): Promise<void> {
  await api.delete(`/api/knowledge/${id}`);
}
