import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowUpLeft, Bell, CalendarDays, Check, CheckCircle2,
  ChevronLeft, CircleHelp, Clock3, FolderKanban, Heart, LayoutDashboard, LogOut,
  Menu, Plus, Search, Settings2, ShieldCheck, Sparkles, Target, X
} from "lucide-react";
import { hasSupabaseConfig, supabase } from "./lib/supabase";
import { demoStore } from "./lib/storage";
import type { LifeEvent, Project, Task, TaskPriority, TaskStatus } from "./types";

type Page = "home" | "tasks" | "projects" | "calendar";
type AuthMode = "loading" | "signedOut" | "signedIn" | "demo";

const nav: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "home", label: "الرئيسية", icon: LayoutDashboard },
  { id: "tasks", label: "المهام", icon: CheckCircle2 },
  { id: "projects", label: "المشاريع", icon: FolderKanban },
  { id: "calendar", label: "التقويم", icon: CalendarDays }
];

const statusLabels: Record<TaskStatus, string> = {
  todo: "لم تبدأ", in_progress: "قيد التنفيذ", done: "مكتملة"
};
const priorityLabels: Record<TaskPriority, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية" };

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatDate(value: string | null | undefined) {
  if (!value) return "بدون موعد";
  const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "short" }).format(d);
}
function dateHeading() {
  return new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>(hasSupabaseConfig ? "loading" : "demo");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [page, setPage] = useState<Page>("home");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [modal, setModal] = useState<"task" | "project" | "event" | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) {
      setProjects(demoStore.getProjects());
      setTasks(demoStore.getTasks());
      setEvents(demoStore.getEvents());
      setAuthMode("demo");
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        setAuthMode("signedIn");
        void loadCloudData();
      } else setAuthMode("signedOut");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) {
        setAuthMode("signedIn");
        window.setTimeout(() => void loadCloudData(), 0);
      } else setAuthMode("signedOut");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function loadCloudData() {
    if (!supabase) return;
    const [p, t, e] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("starts_at", { ascending: true })
    ]);
    if (p.error || t.error || e.error) {
      setNotice("تعذر تحميل بعض البيانات. راجع إعدادات قاعدة البيانات وسياسات الوصول.");
      return;
    }
    setProjects((p.data ?? []) as Project[]);
    setTasks((t.data ?? []) as Task[]);
    setEvents((e.data ?? []) as LifeEvent[]);
  }

  function persistDemoTasks(next: Task[]) {
    setTasks(next);
    if (authMode === "demo") demoStore.saveTasks(next);
  }
  function persistDemoProjects(next: Project[]) {
    setProjects(next);
    if (authMode === "demo") demoStore.saveProjects(next);
  }
  function persistDemoEvents(next: LifeEvent[]) {
    setEvents(next);
    if (authMode === "demo") demoStore.saveEvents(next);
  }

  async function addTask(input: { title: string; due_date: string; priority: TaskPriority; project_id: string }) {
    const item: Task = {
      id: uid(), title: input.title.trim(), description: "", status: "todo",
      priority: input.priority, due_date: input.due_date || null,
      project_id: input.project_id || null, created_at: new Date().toISOString()
    };
    if (authMode === "signedIn" && supabase) {
      const { data, error } = await supabase.from("tasks").insert({
        title: item.title, status: item.status, priority: item.priority,
        due_date: item.due_date, project_id: item.project_id, description: ""
      }).select().single();
      if (error) { setNotice(`تعذر حفظ المهمة: ${error.message}`); return; }
      persistDemoTasks([data as Task, ...tasks]);
    } else persistDemoTasks([item, ...tasks]);
    setModal(null);
    setNotice("تمت إضافة المهمة");
  }

  async function toggleTask(task: Task) {
    const nextStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    if (authMode === "signedIn" && supabase) {
      const { error } = await supabase.from("tasks").update({ status: nextStatus }).eq("id", task.id);
      if (error) { setNotice(`تعذر تحديث المهمة: ${error.message}`); return; }
    }
    persistDemoTasks(tasks.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
  }

  async function addProject(input: { name: string; description: string; color: string }) {
    const item: Project = { id: uid(), name: input.name.trim(), description: input.description.trim(), color: input.color, created_at: new Date().toISOString() };
    if (authMode === "signedIn" && supabase) {
      const { data, error } = await supabase.from("projects").insert({
        name: item.name, description: item.description, color: item.color
      }).select().single();
      if (error) { setNotice(`تعذر حفظ المشروع: ${error.message}`); return; }
      persistDemoProjects([data as Project, ...projects]);
    } else persistDemoProjects([item, ...projects]);
    setModal(null);
    setNotice("تم إنشاء المشروع");
  }

  async function addEvent(input: { title: string; date: string; time: string }) {
    const item: LifeEvent = {
      id: uid(), title: input.title.trim(), description: "",
      starts_at: new Date(`${input.date}T${input.time || "09:00"}:00`).toISOString(),
      ends_at: null, all_day: false, created_at: new Date().toISOString()
    };
    if (authMode === "signedIn" && supabase) {
      const { data, error } = await supabase.from("events").insert({
        title: item.title, description: "", starts_at: item.starts_at,
        all_day: false
      }).select().single();
      if (error) { setNotice(`تعذر حفظ الموعد: ${error.message}`); return; }
      persistDemoEvents([...events, data as LifeEvent]);
    } else persistDemoEvents([...events, item]);
    setModal(null);
    setNotice("تمت إضافة الموعد");
  }

  async function signIn() {
    if (!supabase) return;
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  const filteredTasks = useMemo(() => tasks.filter(t =>
    `${t.title} ${t.description}`.toLowerCase().includes(query.toLowerCase())
  ), [tasks, query]);
  const openTasks = tasks.filter(t => t.status !== "done");
  const doneTasks = tasks.filter(t => t.status === "done");
  const dueToday = tasks.filter(t => t.due_date === todayKey() && t.status !== "done");
  const upcomingEvents = [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 4);

  if (authMode === "loading") return <div className="auth-screen"><div className="spinner" /><p>جاري التحقق من الجلسة…</p></div>;
  if (authMode === "signedOut") {
    return <div className="auth-screen">
      <div className="auth-card">
        <div className="brand-mark"><Activity size={25} /></div>
        <p className="eyebrow">مساحتك الشخصية</p>
        <h1>أهلًا بك في LifeOS</h1>
        <p className="muted">سجّل الدخول للوصول إلى بياناتك الشخصية المحفوظة بأمان.</p>
        <label>البريد الإلكتروني<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
        <label>كلمة المرور<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {authError && <p className="error-text">{authError}</p>}
        <button className="primary-btn full" onClick={() => void signIn()}>تسجيل الدخول</button>
        <p className="tiny muted">أنشئ المستخدم من لوحة Supabase أولًا. لا يوجد تسجيل عام في هذه النسخة.</p>
      </div>
    </div>;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={23} /></div>
          <div><strong>LifeOS</strong><span>إدارة حياتك</span></div>
          <button className="icon-btn close-menu" aria-label="إغلاق القائمة" onClick={() => setMobileMenu(false)}><X size={18} /></button>
        </div>
        <div className="workspace-label">مساحتي الشخصية</div>
        <nav>
          {nav.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); setMobileMenu(false); }}>
              <Icon size={19} /><span>{item.label}</span>{page === item.id && <ChevronLeft className="nav-chevron" size={16} />}
            </button>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="focus-card">
            <div className="focus-icon"><Sparkles size={17} /></div>
            <strong>خطوة واحدة تكفي</strong>
            <p>مش مطلوب تنجز كل شيء اليوم. ابدأ بالأهم.</p>
          </div>
          <button className="nav-item muted-nav" onClick={() => setNotice("إعدادات الحساب والنسخ الاحتياطي ستُضاف في مرحلة لاحقة.")}><Settings2 size={19} /><span>الإعدادات</span></button>
          {authMode === "signedIn" && <button className="nav-item muted-nav" onClick={() => void signOut()}><LogOut size={19} /><span>تسجيل الخروج</span></button>}
          <div className="profile-row"><div className="avatar">ع</div><div><strong>مساحتي</strong><span>{authMode === "demo" ? "وضع تجريبي محلي" : "حساب شخصي"}</span></div><ShieldCheck size={17} className="profile-shield" /></div>
        </div>
      </aside>

      {mobileMenu && <button className="scrim" aria-label="إغلاق القائمة" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-start">
            <button className="icon-btn mobile-menu-btn" aria-label="فتح القائمة" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
            <div><p className="eyebrow">{dateHeading()}</p><h1>{page === "home" ? "خلّينا نرتّب يومك" : nav.find(n => n.id === page)?.label}</h1></div>
          </div>
          <div className="top-actions">
            <label className="search-box"><Search size={17} /><input placeholder="ابحث في مهامك…" value={query} onChange={e => setQuery(e.target.value)} /></label>
            <button className="icon-btn notification-btn" aria-label="التنبيهات" onClick={() => setNotice("التنبيهات الذكية ستُضاف في مرحلة لاحقة.")}><Bell size={19} /></button>
            <button className="primary-btn add-top" onClick={() => setModal(page === "projects" ? "project" : page === "calendar" ? "event" : "task")}><Plus size={17} /><span>إضافة جديدة</span></button>
          </div>
        </header>

        {authMode === "demo" && <div className="demo-banner"><Sparkles size={16} /><span><strong>وضع المعاينة:</strong> البيانات محفوظة على هذا المتصفح فقط. اربط Supabase لتفعيل الحساب والمزامنة.</span></div>}
        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="إغلاق"><X size={16} /></button></div>}

        {page === "home" && <section className="page-content">
          <div className="welcome-row"><div><h2>يومك، على مهل</h2><p>نظرة سريعة تساعدك تبدأ من المكان الصح.</p></div><div className="date-pill"><CalendarDays size={16} /> {formatDate(todayKey())}</div></div>
          <div className="stats-grid">
            <StatCard icon={<Target size={19} />} label="مهام مفتوحة" value={String(openTasks.length)} note="تنتظر خطوتك القادمة" tone="teal" />
            <StatCard icon={<Clock3 size={19} />} label="مواعيد اليوم" value={String(events.filter(e => e.starts_at.slice(0, 10) === todayKey()).length)} note="ضمن جدولك" tone="blue" />
            <StatCard icon={<CheckCircle2 size={19} />} label="مهام مكتملة" value={String(doneTasks.length)} note="إنجازاتك حتى الآن" tone="green" />
            <StatCard icon={<FolderKanban size={19} />} label="مشاريع نشطة" value={String(projects.length)} note="مساحات عملك الحالية" tone="sand" />
          </div>
          <div className="home-grid">
            <section className="panel tasks-panel">
              <div className="panel-heading"><div><h3>أهم المهام</h3><p>اختار خطوة واحدة وابدأ بها</p></div><button className="text-btn" onClick={() => setPage("tasks")}>كل المهام <ArrowUpLeft size={15} /></button></div>
              {dueToday.length > 0 && <div className="today-callout"><Clock3 size={16} /><span>عندك {dueToday.length} {dueToday.length === 1 ? "مهمة" : "مهام"} مستحقة اليوم</span></div>}
              <TaskList tasks={filteredTasks.filter(t => t.status !== "done").slice(0, 5)} projects={projects} onToggle={toggleTask} />
              {openTasks.length === 0 && <EmptyState title="قائمة خفيفة!" body="لا توجد مهام مفتوحة. يمكنك إضافة مهمة جديدة متى احتجت." />}
              <button className="subtle-btn full" onClick={() => setModal("task")}><Plus size={16} /> إضافة مهمة</button>
            </section>
            <section className="panel side-panel">
              <div className="panel-heading"><div><h3>المواعيد القادمة</h3><p>خليك قريب من اللي جاي</p></div><button className="icon-btn small" onClick={() => setPage("calendar")} aria-label="عرض التقويم"><ArrowUpLeft size={16} /></button></div>
              {upcomingEvents.length ? <div className="event-list">{upcomingEvents.map(event => <EventRow key={event.id} event={event} />)}</div> : <EmptyState title="التقويم فاضي" body="أضف موعدًا لتبدأ تنظيم وقتك." />}
              <button className="subtle-btn full" onClick={() => setModal("event")}><Plus size={16} /> إضافة موعد</button>
              <div className="gentle-note"><Heart size={17} /><p>الراحة جزء من الخطة، مش مكافأة بعد ما تخلص كل حاجة.</p></div>
            </section>
          </div>
          <div className="bottom-note"><CircleHelp size={17} /><span>هذه النسخة تركز على الأساسيات. الأقسام المالية والصحية والمهنية ستُضاف على مراحل.</span></div>
        </section>}

        {page === "tasks" && <section className="page-content">
          <div className="section-intro"><div><h2>مساحة المهام</h2><p>حوّل اللي في بالك لخطوات واضحة وقابلة للإنجاز.</p></div><button className="primary-btn" onClick={() => setModal("task")}><Plus size={17} /> مهمة جديدة</button></div>
          <div className="task-filter-row"><span className="filter-chip"><Activity size={14} /> {filteredTasks.length} مهمة</span><span className="muted">{filteredTasks.filter(t => t.status !== "done").length} مفتوحة · {filteredTasks.filter(t => t.status === "done").length} مكتملة</span></div>
          <div className="panel"><TaskList tasks={filteredTasks} projects={projects} onToggle={toggleTask} showDescription /></div>
          {filteredTasks.length === 0 && <EmptyState title="لا توجد نتائج" body="جرّب كلمة بحث أخرى أو أضف مهمة جديدة." />}
        </section>}

        {page === "projects" && <section className="page-content">
          <div className="section-intro"><div><h2>مشاريعك</h2><p>اجمع المهام التي تخدم هدفًا واحدًا في مكان واضح.</p></div><button className="primary-btn" onClick={() => setModal("project")}><Plus size={17} /> مشروع جديد</button></div>
          <div className="projects-grid">
            {projects.filter(p => `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase())).map(project => {
              const related = tasks.filter(t => t.project_id === project.id);
              const completed = related.filter(t => t.status === "done").length;
              const progress = related.length ? Math.round(completed / related.length * 100) : 0;
              return <article className="project-card" key={project.id}>
                <div className="project-top"><div className="project-symbol" style={{ background: `${project.color}1a`, color: project.color }}><FolderKanban size={21} /></div><span className="project-task-count">{related.length} مهام</span></div>
                <h3>{project.name}</h3><p className="project-description">{project.description || "لا يوجد وصف لهذا المشروع بعد."}</p>
                <div className="progress-label"><span>التقدم</span><strong>{progress}%</strong></div><div className="progress-track"><div style={{ width: `${progress}%`, background: project.color }} /></div>
                <div className="project-footer"><span>{completed} من {related.length} مكتملة</span><button className="text-btn" onClick={() => { setPage("tasks"); setQuery(project.name); }}>عرض المهام <ArrowUpLeft size={14} /></button></div>
              </article>;
            })}
          </div>
          {projects.length === 0 && <EmptyState title="ابدأ بأول مشروع" body="أنشئ مشروعًا لتجمع مهامه وتتابع تقدمه." />}
        </section>}

        {page === "calendar" && <section className="page-content">
          <div className="section-intro"><div><h2>تقويمك</h2><p>المواعيد والأحداث المسجلة في مساحتك الشخصية.</p></div><button className="primary-btn" onClick={() => setModal("event")}><Plus size={17} /> موعد جديد</button></div>
          <div className="calendar-layout">
            <div className="panel calendar-main">
              <div className="panel-heading"><div><h3>الأحداث القادمة</h3><p>مرتبة حسب تاريخ البداية</p></div><CalendarDays size={20} className="muted" /></div>
              {[...events].sort((a,b) => a.starts_at.localeCompare(b.starts_at)).map(event => <EventRow key={event.id} event={event} large />)}
              {events.length === 0 && <EmptyState title="لا توجد مواعيد بعد" body="أضف أول موعد وسيظهر هنا." />}
            </div>
            <div className="panel calendar-aside"><div className="mini-calendar-icon"><CalendarDays size={25} /></div><h3>خطط بواقعية</h3><p>سيعرض التقويم الشهري الكامل وتعارض المواعيد في تحديث لاحق. ابدأ هنا بتسجيل الأحداث الأساسية.</p><button className="subtle-btn full" onClick={() => setModal("event")}><Plus size={16} /> إضافة موعد</button></div>
          </div>
        </section>}

        <footer className="app-footer"><span>LifeOS <span className="footer-dot">·</span> إصدار أولي</span><span>بياناتك، وإيقاعك، واختياراتك.</span></footer>
      </main>

      {modal && <Modal title={modal === "task" ? "إضافة مهمة" : modal === "project" ? "إنشاء مشروع" : "إضافة موعد"} onClose={() => setModal(null)}>
        {modal === "task" && <TaskForm projects={projects} onSubmit={addTask} />}
        {modal === "project" && <ProjectForm onSubmit={addProject} />}
        {modal === "event" && <EventForm onSubmit={addEvent} />}
      </Modal>}
    </div>
  );
}

function StatCard({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>;
}

function TaskList({ tasks, projects, onToggle, showDescription = false }: { tasks: Task[]; projects: Project[]; onToggle: (task: Task) => void; showDescription?: boolean }) {
  if (!tasks.length) return <EmptyState title="لا توجد مهام هنا" body="أضف مهمة صغيرة تساعدك على التقدم." />;
  return <div className="task-list">{tasks.map(task => {
    const project = projects.find(p => p.id === task.project_id);
    return <div className={`task-row ${task.status === "done" ? "task-done" : ""}`} key={task.id}>
      <button className={`task-check ${task.status === "done" ? "checked" : ""}`} onClick={() => onToggle(task)} aria-label={task.status === "done" ? "إعادة فتح المهمة" : "إنجاز المهمة"}>{task.status === "done" && <Check size={14} />}</button>
      <div className="task-body"><div className="task-title-line"><strong>{task.title}</strong><span className={`priority-dot ${task.priority}`} title={`الأولوية ${priorityLabels[task.priority]}`} /></div>
        {showDescription && task.description && <p className="task-description">{task.description}</p>}
        <div className="task-meta">{project && <span className="project-tag"><span style={{ background: project.color }} />{project.name}</span>}<span><CalendarDays size={12} />{formatDate(task.due_date)}</span>{showDescription && <span className={`status-tag ${task.status}`}>{statusLabels[task.status]}</span>}</div>
      </div>
    </div>;
  })}</div>;
}

function EventRow({ event, large = false }: { event: LifeEvent; large?: boolean }) {
  const d = new Date(event.starts_at);
  return <div className={`event-row ${large ? "event-row-large" : ""}`}><div className="event-date"><strong>{new Intl.DateTimeFormat("ar-EG", { day: "numeric" }).format(d)}</strong><span>{new Intl.DateTimeFormat("ar-EG", { month: "short" }).format(d)}</span></div><div className="event-detail"><strong>{event.title}</strong><span><Clock3 size={13} />{event.all_day ? "طوال اليوم" : new Intl.DateTimeFormat("ar-EG", { hour: "numeric", minute: "2-digit" }).format(d)}</span>{large && event.description && <p>{event.description}</p>}</div></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><div className="empty-icon"><Sparkles size={19} /></div><strong>{title}</strong><p>{body}</p></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><h2 id="modal-title">{title}</h2><button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button></div>{children}</section></div>;
}

function TaskForm({ projects, onSubmit }: { projects: Project[]; onSubmit: (v: { title: string; due_date: string; priority: TaskPriority; project_id: string }) => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [projectId, setProjectId] = useState("");
  return <form className="form-stack" onSubmit={e => { e.preventDefault(); if (title.trim()) onSubmit({ title, due_date: dueDate, priority, project_id: projectId }); }}>
    <label>عنوان المهمة<input autoFocus required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="مثلًا: مراجعة خطة الأسبوع" /></label>
    <div className="form-row"><label>موعد الاستحقاق<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label><label>الأولوية<select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option></select></label></div>
    <label>المشروع (اختياري)<select value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">بدون مشروع</option>{projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
    <button className="primary-btn full" type="submit"><Plus size={16} /> حفظ المهمة</button>
  </form>;
}
function ProjectForm({ onSubmit }: { onSubmit: (v: { name: string; description: string; color: string }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4f8b83");
  return <form className="form-stack" onSubmit={e => { e.preventDefault(); if (name.trim()) onSubmit({ name, description, color }); }}>
    <label>اسم المشروع<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="ما الهدف الذي تعمل عليه؟" /></label>
    <label>وصف مختصر<textarea rows={3} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="ما الذي تريد تحقيقه؟" /></label>
    <label>لون المشروع<div className="color-picker-row"><input type="color" value={color} onChange={e => setColor(e.target.value)} /><span>{color}</span></div></label>
    <button className="primary-btn full" type="submit"><Plus size={16} /> إنشاء المشروع</button>
  </form>;
}
function EventForm({ onSubmit }: { onSubmit: (v: { title: string; date: string; time: string }) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey());
  const [time, setTime] = useState("09:00");
  return <form className="form-stack" onSubmit={e => { e.preventDefault(); if (title.trim() && date) onSubmit({ title, date, time }); }}>
    <label>اسم الموعد<input autoFocus required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="مثلًا: مراجعة أسبوعية" /></label>
    <div className="form-row"><label>التاريخ<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label><label>الوقت<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div>
    <button className="primary-btn full" type="submit"><Plus size={16} /> حفظ الموعد</button>
  </form>;
}
