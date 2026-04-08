export interface Topic {
  id: number;
  name: string;
  description: string | null;
  container_name: string;
  cluster_id: number | null;
  default_curriculum_id: number | null;
}

export interface ExerciseSummary {
  id: number;
  title: string;
  difficulty: number;
  is_completed: boolean;
}

export interface KnowledgeSummary {
  id: number;
  title: string;
  tags: string;
}

export interface TopicItem {
  id: number;
  title: string;
  type: "exercise" | "knowledge";
  difficulty?: number;
  is_completed?: boolean;
  tags?: string;
  order_num?: number;
}

export interface Subject {
  id: number;
  topic_id: number;
  name: string;
  description: string | null;
  order_num: number;
  parent_id: number | null;
  children: Subject[];
  exercises: ExerciseSummary[];
  knowledge: KnowledgeSummary[];
  items: TopicItem[];
  progress: number;
}

export interface CurriculumTree {
  curriculum: { id: number; topic_id: number; name: string; description: string; topic_name: string; container_name: string };
  subjects: Subject[];
}

export type UiType = "auto" | "terminal" | "code" | "text";

export interface Exercise {
  id: number;
  subject_id: number;
  title: string;
  description: string | null;
  initial_code: string;
  check_type: string;
  check_value: string | null;
  difficulty: number;
  ui_type: UiType;
  topic_name: string;
  created_by: string;
}

export interface ExecuteResult {
  output: string;
  error: string | null;
  result_type: "table" | "terminal" | "error";
  columns: string[] | null;
  rows: string[][] | null;
}

export interface AttemptResult {
  id: number;
  is_correct: boolean;
  result: string;
  feedback: string | null;
}

export interface SharedCurriculum {
  id: number;
  user_id: number;
  curriculum_id: number | null;
  title: string;
  description: string;
  subject: string;
  tags: string;
  upvotes: number;
  downloads: number;
  shared_at: string;
}
