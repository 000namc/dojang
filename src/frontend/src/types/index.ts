export interface Domain {
  id: number;
  name: string;
  description: string | null;
  container_name: string;
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

export interface Topic {
  id: number;
  domain_id: number;
  name: string;
  description: string | null;
  order_num: number;
  parent_id: number | null;
  children: Topic[];
  exercises: ExerciseSummary[];
  knowledge: KnowledgeSummary[];
  items: TopicItem[];
  progress: number;
}

export interface CurriculumTree {
  curriculum: { id: number; domain_id: number; name: string; description: string; domain_name: string; container_name: string };
  topics: Topic[];
}

export interface Exercise {
  id: number;
  topic_id: number;
  title: string;
  description: string | null;
  initial_code: string;
  check_type: string;
  check_value: string | null;
  difficulty: number;
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
