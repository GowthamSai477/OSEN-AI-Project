"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Loader2, CheckCircle2, Plus, Pencil, Trash2, Download, ChevronDown, Sparkles, Globe, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import { Timer } from "lucide-react";
import FocusMode from "@/components/FocusMode";
import LottieConfetti from "@/components/LottieConfetti";
import SandyLoading from "@/components/SandyLoading";
import { useUser } from "@clerk/nextjs";
import { cachedFetch, invalidateTasks } from "@/lib/api-helpers";

type Task = {
  id: string;
  task: string;
  date: string;
  time: string;
  duration_minutes: number;
  category: string;
  status: string;
  priority: string;
  completed: boolean;
  url?: string;
  links?: any[];
  subtasks?: any[];
};

export default function SchedulePage() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [view, setView] = useState<"month" | "week">("month");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    task: "",
    date: "",
    time: "12:00",
    duration_minutes: 30,
    category: "Task"
  });
  const [isSaving, setIsSaving] = useState(false);
  const [focusTask, setFocusTask] = useState<any>(null);

  useEffect(() => {
    fetchTasks();
  }, [user]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const lastFetch = localStorage.getItem("planora_last_tasks_fetch");
        const now = Date.now();
        if (!lastFetch || now - parseInt(lastFetch) > 60000) {
          fetchTasks();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const fetchTasks = async (force: boolean = false) => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await cachedFetch<Task[]>(
        `tasks_${user.id}`, 
        `${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks`, 
        token, 
        60000,
        force
      );
      if (data) {
        setTasks(data);
        localStorage.setItem("planora_last_tasks_fetch", Date.now().toString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const getTasksForDate = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return tasks.filter(t => t.date.startsWith(dateStr)).sort((a, b) => a.time.localeCompare(b.time));
  };

  const toggleTaskCompletion = async (taskId: string, currentStatus: boolean) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !currentStatus } : t));
    
    if (!currentStatus) {
      setConfettiTrigger(prev => prev + 1);
    }

    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks/${taskId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ completed: !currentStatus })
      });
      
      // Award Gamification XP
      if (!currentStatus) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/gamification/add-xp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ amount: 10, reason: "task_completion_schedule" })
        }).catch(err => console.error("Failed to award XP:", err));
      }
      
      invalidateTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSubtask = async (taskId: string, subtaskId: string, currentStatus: boolean) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updatedSubtasks = (t.subtasks || []).map((st: any) =>
          st.id === subtaskId ? { ...st, completed: !currentStatus } : st
        );
        const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((st: any) => st.completed);
        return { ...t, subtasks: updatedSubtasks, completed: allDone };
      }
      return t;
    }));

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !currentStatus })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task_completed) {
          setConfettiTrigger(prev => prev + 1);
          
          // Award XP since the whole task was completed
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/gamification/add-xp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ amount: 10, reason: "task_completion_subtasks" })
          }).catch(err => console.error("Failed to award XP:", err));
        }
        invalidateTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const generateSubtasks = async (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isGenerating: true } as any : t));
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subtasks/generate/${taskId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const newSubtasks = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: newSubtasks, isGenerating: false } as any : t));
        setExpandedTasks(prev => ({ ...prev, [taskId]: true }));
        invalidateTasks();
      }
    } catch (e) {
      console.error(e);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isGenerating: false } as any : t));
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const openAddModal = () => {
    const defaultDate = selectedDate || new Date();
    const dateStr = `${defaultDate.getFullYear()}-${String(defaultDate.getMonth() + 1).padStart(2, '0')}-${String(defaultDate.getDate()).padStart(2, '0')}`;
    setFormData({ task: "", date: dateStr, time: "12:00", duration_minutes: 30, category: "Task" });
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setFormData({
      task: task.task,
      date: task.date.split("T")[0],
      time: task.time,
      duration_minutes: task.duration_minutes,
      category: task.category
    });
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const token = await getToken();
      if (editingTask) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks/${editingTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const updated = await res.json();
          setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        }
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          const created = await res.json();
          setTasks(prev => [...prev, created]);
        }
      }
      invalidateTasks();
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      invalidateTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExport = async (type: "today" | "week" | "month" | "csv") => {
    try {
      setIsExporting(true);
      setShowExportMenu(false);
      const token = await getToken();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/export/${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      // Get filename from Content-Disposition header if available
      let filename = `planora-export.${type === 'csv' ? 'csv' : 'pdf'}`;
      const disposition = res.headers.get('Content-Disposition');
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = disposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      } else {
        // Fallback names
        const date = new Date().toISOString().split('T')[0];
        if (type === 'today') filename = `planora-today-${date}.pdf`;
        if (type === 'week') filename = `planora-week-${date}.pdf`;
        if (type === 'month') filename = `planora-month-${date.slice(0, 7)}.pdf`;
        if (type === 'csv') filename = `planora-all-tasks-${date}.csv`;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Export error:", e);
      alert("Failed to export timetable. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[60px] md:min-h-[100px] bg-card/20 border border-card-border/50 p-1 md:p-2 rounded-xl"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayTasks = getTasksForDate(date);
      const isToday = new Date().toDateString() === date.toDateString();
      const isSelected = selectedDate?.toDateString() === date.toDateString();

      days.push(
        <div 
          key={d} 
          onClick={() => setSelectedDate(date)}
          className={`min-h-[60px] md:min-h-[100px] rounded-xl p-1 md:p-2 cursor-pointer transition-all duration-300 flex flex-col group relative overflow-hidden ${
            isSelected ? 'bg-accent/10 border-accent/50 shadow-[0_0_15px_var(--color-accent-glow)]' 
            : isToday ? 'bg-secondary border-accent/30' 
            : 'bg-card/40 border border-card-border/50 hover:bg-secondary/80 hover:border-card-border'
          } border`}
        >
          {isToday && <div className="absolute top-0 left-0 right-0 h-1 bg-accent" />}
          
          <div className="flex justify-between items-center mb-2 z-10">
            <span className={`text-sm font-bold flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
              isToday ? 'bg-accent text-white shadow-sm' 
              : isSelected ? 'bg-foreground text-background' 
              : 'text-muted group-hover:text-foreground'
            }`}>
              {d}
            </span>
            {dayTasks.length > 0 && <span className="text-xs font-semibold text-muted bg-surface px-1.5 py-0.5 rounded border border-card-border">{dayTasks.length}</span>}
          </div>
          
          <div className="space-y-1.5 flex-1 z-10 overflow-hidden">
            {dayTasks.slice(0, 3).map((t, i) => (
              <div key={i} className={`text-[10px] md:text-[11px] font-medium truncate px-1 md:px-2 py-0.5 md:py-1 rounded-md transition-colors ${
                t.completed ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 line-through opacity-70' :
                t.category?.toLowerCase() === 'event' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20' :
                'bg-accent/10 text-accent border border-accent/20'
              }`}>
                {t.time} <span className="hidden md:inline opacity-90">{t.task}</span>
              </div>
            ))}
            {dayTasks.length > 3 && <div className="text-[10px] font-semibold text-muted pl-1">+{dayTasks.length - 3} more</div>}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 auto-rows-min gap-3 mt-6">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center py-2 text-xs font-bold text-muted tracking-widest uppercase">
            {day}
          </div>
        ))}
        {days}
      </div>
    );
  };

  return (
    <div className="h-full flex glass-panel overflow-hidden relative border-none bg-background/50">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.02] pointer-events-none" />
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto z-10 pb-20 md:pb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 md:gap-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-accent to-purple-500 text-white rounded-2xl flex items-center justify-center shadow-[0_0_15px_var(--color-accent-glow)]">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Schedule</h1>
              <p className="text-muted text-sm font-medium mt-1">Manage your timetable</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 md:gap-5">
            <div className="relative z-50">
              <button suppressHydrationWarning 
                onClick={() => setShowExportMenu(!showExportMenu)} 
                disabled={isExporting}
                className="flex items-center gap-2 bg-secondary/80 hover:bg-secondary text-foreground border border-card-border/50 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Export <ChevronDown size={14} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              
              {showExportMenu && (
                <div className="absolute top-full mt-2 right-0 min-w-[260px] bg-surface border border-card-border shadow-xl rounded-xl overflow-hidden z-50">
                  <div className="py-1">
                    <button suppressHydrationWarning onClick={() => handleExport("today")} className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/80 transition-colors text-foreground font-medium flex items-center justify-between">
                      Export Today as PDF
                      <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded uppercase font-bold tracking-wider">PDF</span>
                    </button>
                    <button suppressHydrationWarning onClick={() => handleExport("week")} className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/80 transition-colors text-foreground font-medium flex items-center justify-between">
                      Export This Week as PDF
                      <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded uppercase font-bold tracking-wider">PDF</span>
                    </button>
                    <button suppressHydrationWarning onClick={() => handleExport("month")} className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/80 transition-colors text-foreground font-medium flex items-center justify-between">
                      Export This Month as PDF
                      <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded uppercase font-bold tracking-wider">PDF</span>
                    </button>
                    <div className="h-px bg-card-border/50 my-1"></div>
                    <button suppressHydrationWarning onClick={() => handleExport("csv")} className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary/80 transition-colors text-foreground font-medium flex items-center justify-between">
                      Export as CSV
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded uppercase font-bold tracking-wider">CSV</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button suppressHydrationWarning onClick={openAddModal} className="flex items-center gap-2 bg-accent hover:bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg hover:shadow-accent/20">
              <Plus size={16} /> Add Task
            </button>
            <div className="bg-secondary/80 p-1 rounded-xl flex items-center border border-card-border/50">
              <button suppressHydrationWarning onClick={() => setView("month")} className={`px-5 py-1.5 text-xs font-semibold rounded-lg transition-all ${view === "month" ? "bg-surface text-foreground shadow-sm border border-card-border" : "text-muted hover:text-foreground"}`}>Month</button>
              <button suppressHydrationWarning onClick={() => setView("week")} className={`px-5 py-1.5 text-xs font-semibold rounded-lg transition-all ${view === "week" ? "bg-surface text-foreground shadow-sm border border-card-border" : "text-muted hover:text-foreground"}`}>Week</button>
            </div>
            
            <div className="flex items-center gap-2 bg-surface rounded-xl p-1.5 border border-card-border shadow-sm">
              <button suppressHydrationWarning onClick={prevMonth} className="p-2 hover:bg-secondary rounded-lg text-muted hover:text-foreground transition-colors"><ChevronLeft size={18} /></button>
              <span className="font-bold text-sm px-4 min-w-[140px] text-center text-foreground">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button suppressHydrationWarning onClick={nextMonth} className="p-1.5 hover:bg-card-border rounded text-muted transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <SandyLoading />
          </div>
        ) : (
          renderMonthView()
        )}
      </div>

      {/* Side Panel for Day Details */}
      <div className={`absolute right-0 top-0 bottom-0 bg-surface/95 backdrop-blur-2xl border-l border-card-border/50 shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-40 flex flex-col ${selectedDate ? 'w-full md:w-96 translate-x-0' : 'w-full md:w-96 translate-x-full'}`}>
        {selectedDate && (
          <>
            <div className="p-6 border-b border-card-border/50 flex justify-between items-start bg-card/30">
              <div>
                <h3 className="font-extrabold text-2xl text-foreground tracking-tight">{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</h3>
                <p className="text-accent font-medium text-sm mt-1">{selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
              <button suppressHydrationWarning onClick={() => setSelectedDate(null)} className="p-2 hover:bg-secondary rounded-xl text-muted hover:text-foreground transition-all"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {getTasksForDate(selectedDate).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted py-10 opacity-70">
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                    <CalendarIcon size={24} className="text-muted" />
                  </div>
                  <p className="text-sm font-medium">Your day is clear.</p>
                  <button suppressHydrationWarning onClick={openAddModal} className="mt-6 px-5 py-2.5 bg-secondary hover:bg-card-border rounded-xl text-sm font-bold text-foreground transition-colors shadow-sm">
                    + Schedule Task
                  </button>
                </div>
              ) : (
                getTasksForDate(selectedDate).map((task) => (
                  <div key={task.id} className="flex flex-col gap-2">
                    <div className={`p-5 rounded-2xl border transition-all duration-300 ${task.completed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-secondary/50 border-card-border hover:border-accent/50 hover:shadow-md'} group`}>
                      <div className="flex gap-4">
                        <button suppressHydrationWarning 
                          onClick={() => toggleTaskCompletion(task.id, task.completed)}
                          className={`mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            task.completed ? 'bg-emerald-500 border-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-muted text-transparent hover:border-accent hover:text-accent'
                          }`}
                        >
                          <CheckCircle2 size={16} className={task.completed ? "opacity-100" : "opacity-0"} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className={`font-bold text-base leading-tight transition-colors ${task.completed ? 'text-muted line-through' : 'text-foreground'}`}>{task.task}</h4>
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!task.completed && (
                                <button suppressHydrationWarning onClick={() => setFocusTask(task)} 
                                  className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all duration-300 flex items-center justify-center shrink-0"
                                  title="Focus"
                                >
                                  🎯
                                </button>
                              )}
                              <button suppressHydrationWarning 
                                onClick={() => toggleExpand(task.id)}
                                className={`p-1.5 rounded-lg hover:bg-secondary transition-all ${expandedTasks[task.id] ? 'rotate-180 text-accent' : 'text-muted'}`}
                              >
                                <ChevronDown size={16} />
                              </button>
                              <button suppressHydrationWarning onClick={() => openEditModal(task)} className="p-1.5 text-muted hover:text-accent rounded-lg hover:bg-accent/10 transition-colors"><Pencil size={14} /></button>
                              <button suppressHydrationWarning onClick={() => deleteTask(task.id)} className="p-1.5 text-muted hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>
                          
                          {task.url && (
                            <a 
                              href={task.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mb-3 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-bold rounded-lg hover:bg-emerald-500/20 transition-all shadow-sm"
                            >
                              <Globe size={12} /> Open URL
                            </a>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <span className="text-[11px] uppercase tracking-wider font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-md">{task.time} ({task.duration_minutes}m)</span>
                            <span className="text-[11px] uppercase tracking-wider font-bold text-muted bg-surface border border-card-border px-2.5 py-1 rounded-md">{task.category}</span>
                            {task.subtasks && task.subtasks.length > 0 && (
                                <span className="text-[10px] font-black text-muted uppercase bg-secondary px-1.5 py-1 rounded-md">
                                    {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} SUB
                                </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Subtask view in side panel */}
                    <AnimatePresence>
                        {expandedTasks[task.id] && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="ml-10 overflow-hidden border-l-2 border-accent/20 pl-4 space-y-4 mb-4"
                            >
                                {/* Resource Links */}
                                {task.links && task.links.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-[10px] font-black text-accent uppercase tracking-widest">Resources</div>
                                    <div className="flex flex-wrap gap-2">
                                      {task.links.map((link: any, idx: number) => (
                                        <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2.5 py-1.5 bg-surface border border-card-border rounded-lg text-[10px] font-bold text-foreground hover:border-accent/50 transition-all">
                                          <Play size={10} className="text-red-500" />
                                          {link.title || "Link"}
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Subtasks */}
                                <div className="space-y-2">
                                  <div className="text-[10px] font-black text-muted uppercase tracking-widest">Subtasks</div>
                                  {task.subtasks && task.subtasks.length > 0 ? (
                                      task.subtasks.map((st: any) => (
                                          <div key={st.id} className="flex items-center gap-3">
                                              <button suppressHydrationWarning 
                                                  onClick={() => toggleSubtask(task.id, st.id, st.completed)}
                                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${st.completed ? 'bg-emerald-500 border-emerald-500' : 'border-muted'}`}
                                              >
                                                  {st.completed && <CheckCircle2 size={10} className="text-white" />}
                                              </button>
                                              <span className={`text-xs font-medium ${st.completed ? 'line-through text-muted' : 'text-foreground'}`}>
                                                  {st.title} ({st.duration_minutes}m)
                                              </span>
                                          </div>
                                      ))
                                  ) : (
                                      <button suppressHydrationWarning onClick={() => generateSubtasks(task.id)}
                                          className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2 py-1 hover:underline"
                                      >
                                          {(task as any).isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                          Generate Subtasks
                                      </button>
                                  )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Task Add/Edit Modal */}
      {isModalOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingTask ? "Edit Task" : "Add New Task"}</h3>
              <button suppressHydrationWarning onClick={() => setIsModalOpen(false)} className="text-muted hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={saveTask} className="space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1">Task Name</label>
                <input suppressHydrationWarning required type="text" value={formData.task} onChange={e => setFormData({...formData, task: e.target.value})} className="w-full bg-secondary border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Date</label>
                  <input suppressHydrationWarning required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-secondary border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Time</label>
                  <input suppressHydrationWarning required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full bg-secondary border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Duration (mins)</label>
                  <input suppressHydrationWarning required type="number" min="5" value={formData.duration_minutes} onChange={e => setFormData({...formData, duration_minutes: parseInt(e.target.value)})} className="w-full bg-secondary border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Category</label>
                  <input suppressHydrationWarning required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-secondary border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button suppressHydrationWarning type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-secondary hover:bg-card-border rounded-lg text-sm transition-colors">Cancel</button>
                <button suppressHydrationWarning type="submit" disabled={isSaving} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {editingTask ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Focus Mode Overlay */}
      {focusTask && (
        <FocusMode 
          task={{
            id: focusTask.id,
            title: focusTask.task,
            category: focusTask.category,
            duration_minutes: focusTask.duration_minutes
          }}
          onClose={() => setFocusTask(null)}
          onComplete={(id) => {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true } : t));
            setConfettiTrigger(prev => prev + 1);
          }}
        />
      )}
      <LottieConfetti trigger={confettiTrigger} />
    </div>
  );
}

