import type { LifeEvent, Project, Task } from "../types";

const keys = {
  projects: "lifeos.demo.projects.v1",
  tasks: "lifeos.demo.tasks.v1",
  events: "lifeos.demo.events.v1"
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

const today = new Date();
const day = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${date}`;
};
const stamp = () => new Date().toISOString();

const initialProjects: Project[] = [
  { id: "p1", name: "تطوير LifeOS", description: "بناء مساحة شخصية لإدارة الحياة", color: "#4f8b83", created_at: stamp() },
  { id: "p2", name: "التطور المهني", description: "المذاكرة والتقدم المهني", color: "#6c7fb2", created_at: stamp() }
];
const initialTasks: Task[] = [
  { id: "t1", project_id: "p1", title: "تحديد أولويات الأسبوع", description: "اختيار أهم ثلاث نتائج", status: "todo", priority: "high", due_date: day(0), created_at: stamp() },
  { id: "t2", project_id: "p2", title: "جلسة مذاكرة مركزة", description: "جلسة قصيرة قابلة للتنفيذ", status: "in_progress", priority: "medium", due_date: day(1), created_at: stamp() },
  { id: "t3", project_id: null, title: "مراجعة جدول المواعيد", description: "", status: "done", priority: "low", due_date: day(0), created_at: stamp() }
];
const initialEvents: LifeEvent[] = [
  { id: "e1", title: "مراجعة أسبوعية", description: "راجع ما تم وما يحتاج تعديلًا", starts_at: `${day(0)}T19:00:00`, ends_at: null, all_day: false, created_at: stamp() },
  { id: "e2", title: "وقت شخصي", description: "وقت للراحة وإعادة الشحن", starts_at: `${day(2)}T17:00:00`, ends_at: null, all_day: false, created_at: stamp() }
];

export const demoStore = {
  getProjects: () => read<Project[]>(keys.projects, initialProjects),
  saveProjects: (value: Project[]) => write(keys.projects, value),
  getTasks: () => read<Task[]>(keys.tasks, initialTasks),
  saveTasks: (value: Task[]) => write(keys.tasks, value),
  getEvents: () => read<LifeEvent[]>(keys.events, initialEvents),
  saveEvents: (value: LifeEvent[]) => write(keys.events, value)
};
