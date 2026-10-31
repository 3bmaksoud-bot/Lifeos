export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Project {
  id: string;
  user_id?: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id?: string;
  project_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
}

export interface LifeEvent {
  id: string;
  user_id?: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  created_at: string;
}
