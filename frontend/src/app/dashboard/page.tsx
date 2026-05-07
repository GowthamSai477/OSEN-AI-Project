"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FocusMode from "@/components/FocusMode";
import { CheckCircle2, Circle, Clock, Flame, Target, Loader2, Sparkles, BarChart2, ArrowUpRight, Timer, Trophy, LayoutTemplate, ArrowRight, ChevronDown, Globe, Play } from "lucide-react";
import { useUser, useAuth } from "@clerk/nextjs";
import LottieConfetti from "@/components/LottieConfetti";
import SandyLoading from "@/components/SandyLoading";
import { cachedFetch, invalidateTasks } from "@/lib/api-helpers";
import Link from "next/link";

export default function DashboardOverview() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [goalStats, setGoalStats] = useState<any>(null);
  const [weekReport, setWeekReport] = useState<any>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [focusTask, setFocusTask] = useState<any>(null);
  const [focusStats, setFocusStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stats = JSON.parse(localStorage.getItem("planora_focus_stats") || "{}");
    const today = new Date().toISOString().split('T')[0];
    if (stats.lastFocusDate === today && stats.todaySessions > 0) {
      setFocusStats(stats);
    }
    fetchData();
  }, [focusTask]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const lastFetch = localStorage.getItem("planora_last_tasks_fetch");
        const now = Date.now();
        if (!lastFetch || now - parseInt(lastFetch) > 60000) {
          fetchData();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const fetchData = async (force: boolean = false) => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) return;
      const base = process.env.NEXT_PUBLIC_API_URL;
      if (!base) return;
      const userId = user.id;

      const [tasksData, statsData, reportData] = await Promise.all([
        cachedFetch<any[]>(`tasks_${userId}`, `${base}/api/planner/tasks`, token, 60000, force),
        cachedFetch<any>(`goal_stats_${userId}`, `${base}/api/goals/stats`, token, 120000, force),
        cachedFetch<any>(`week_report_${userId}`, `${base}/api/progress/weekly`, token, 600000, force),
      ]);

      if (tasksData) {
        const todayStr = new Date().toLocaleDateString("en-CA");
        setTasks(
          tasksData
            .filter((t: any) => t.date.startsWith(todayStr))
            .sort((a: any, b: any) => a.time.localeCompare(b.time))
        );
      }
      if (statsData) setGoalStats(statsData);
      if (reportData && !reportData.no_data) setWeekReport(reportData);
      
      localStorage.setItem("planora_last_tasks_fetch", Date.now().toString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (id: string, currentStatus: boolean) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, completed: !currentStatus } : t
    ));

    if (!currentStatus) {
      setConfettiTrigger(prev => prev + 1);
    }

    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !currentStatus })
      });
      invalidateTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSubtask = async (taskId: string, subtaskId: string, currentStatus: boolean) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updatedSubtasks = t.subtasks.map((st: any) =>
          st.id === subtaskId ? { ...st, completed: !currentStatus } : st
        );
        const allDone = updatedSubtasks.every((st: any) => st.completed);
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
        }
        invalidateTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const generateSubtasks = async (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isGenerating: true } : t));
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subtasks/generate/${taskId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const newSubtasks = await res.json();
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks: newSubtasks, isGenerating: false } : t));
        setExpandedTasks(prev => ({ ...prev, [taskId]: true }));
        invalidateTasks();
      }
    } catch (e) {
      console.error(e);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isGenerating: false } : t));
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <SandyLoading />
      </div>
    );
  }

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const todayDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Good {timeOfDay}, {user?.firstName || "User"} 👋
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {tasks.length > 0
              ? `${tasks.length} task${tasks.length > 1 ? 's' : ''} scheduled for today`
              : "No tasks scheduled for today"}
          </p>
        </div>
        <div className="text-sm text-muted font-medium">
          {todayDate}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-surface border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Current Goal</span>
          </div>
          <p className="font-semibold text-sm text-foreground truncate">
            {goalStats?.goal?.title || "No Goal Set"}
          </p>
          <p className="text-[11px] text-muted mt-0.5 truncate">
            {goalStats?.goal?.target || "Talk to AI to set a goal"}
          </p>
        </div>

        <div className="bg-surface border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Today</span>
          </div>
          <p className="font-semibold text-foreground text-sm">
            {completedCount}/{tasks.length}
            <span className="text-[11px] text-muted ml-1 font-normal">tasks</span>
          </p>
          <div className="w-full bg-secondary rounded-full h-1.5 mt-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              className="bg-accent rounded-full h-1.5 transition-all duration-1000"
            />
          </div>
        </div>

        <div className="bg-surface border border-card-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Streak</span>
          </div>
          <p className="font-semibold text-foreground text-sm">
            🔥 {goalStats?.streak || 0}
            <span className="text-[11px] text-muted ml-1 font-normal">days</span>
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            {goalStats?.streak > 0 ? "You're on fire!" : "Start today"}
          </p>
        </div>

        <div className="bg-surface border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted uppercase font-bold tracking-wider">This Week</span>
            <Link
              href="/dashboard/progress"
              className="text-[10px] text-accent font-bold hover:underline"
            >
              View →
            </Link>
          </div>
          <p className="font-semibold text-foreground text-sm">
            {weekReport?.completion_rate || 0}%
            <span className="text-[11px] text-muted ml-1 font-normal">done</span>
          </p>
          <p className="text-[11px] mt-0.5 font-medium">
            {!weekReport ? (
              <span className="text-muted">No data</span>
            ) : weekReport.on_track_status === "on_track" ? (
              <span className="text-emerald-500">On track ✓</span>
            ) : weekReport.on_track_status === "at_risk" ? (
              <span className="text-yellow-500">At risk ⚠</span>
            ) : (
              <span className="text-red-400">Behind ✗</span>
            )}
          </p>
        </div>
      </div>

      {focusStats && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <p className="text-xs font-bold text-foreground">
            Focus Today: <span className="text-purple-400">{focusStats.todaySessions} sessions</span> • <span className="text-purple-400">{focusStats.todayMinutes} min</span>
          </p>
        </div>
      )}

      <div className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            📅 Today's Schedule
          </h2>
          <Link
            href="/dashboard/schedule"
            className="text-xs text-accent font-bold hover:underline"
          >
            View all →
          </Link>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-surface border border-card-border border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
              <LayoutTemplate size={24} />
            </div>
            <h3 className="text-lg font-bold mb-1">No tasks today</h3>
            <p className="text-sm text-muted mb-6 max-w-xs">Ask Planora AI to build your schedule!</p>
            <Link href="/dashboard/ai-assistant" className="text-xs font-black text-accent uppercase tracking-widest hover:underline flex items-center gap-2">
              Talk to AI <ArrowRight size={12} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <TaskTimelineItem
                key={task.id}
                {...task}
                isExpanded={expandedTasks[task.id]}
                onToggleExpand={() => toggleExpand(task.id)}
                onClick={() => toggleTask(task.id, task.completed)}
                onToggleSubtask={(subtaskId: string, status: boolean) => toggleSubtask(task.id, subtaskId, status)}
                onGenerateSubtasks={() => generateSubtasks(task.id)}
                onFocus={() => setFocusTask(task)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
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
      </AnimatePresence>

      <LottieConfetti trigger={confettiTrigger} />
    </div>
  );
}

function TaskTimelineItem({ id, time, task, category, completed = false, subtasks = [], isGenerating = false, isExpanded, onToggleExpand, onClick, onToggleSubtask, onGenerateSubtasks, onFocus, ...rest }: any) {
  const completedSubtasks = subtasks.filter((st: any) => st.completed).length;

  return (
    <div className="glass-card rounded-xl border border-card-border transition-all hover:border-accent/30 overflow-hidden">
      <div
        onClick={onClick}
        className="flex items-center gap-4 p-4 cursor-pointer"
      >
        <div className="flex-shrink-0">
          <AnimatePresence mode="wait">
            {completed ? (
              <motion.div
                key="checked"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </motion.div>
            ) : (
              <motion.div
                key="unchecked"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Circle className="w-6 h-6 text-muted" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-bold truncate ${completed ? 'line-through text-muted' : 'text-foreground'}`}>
              {task}
            </p>
            {subtasks.length > 0 && (
              <span className="text-[9px] font-black bg-secondary px-1.5 py-0.5 rounded text-muted uppercase tracking-tighter">
                {completedSubtasks}/{subtasks.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-bold text-accent">
              {time}
            </span>
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!completed && (
            <button
              suppressHydrationWarning
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className="p-2 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all text-sm"
            >
              🎯
            </button>
          )}

          {rest.url && (
            <a
              href={rest.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all"
            >
              <Globe size={14} />
            </a>
          )}

          <button
            suppressHydrationWarning
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className={`p-2 rounded-lg hover:bg-secondary transition-all ${isExpanded ? 'rotate-180 text-accent' : 'text-muted'}`}
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 pb-4 border-t border-card-border bg-black/5"
          >
            {rest.links && rest.links.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-2">Resources</p>
                <div className="flex flex-wrap gap-2">
                  {rest.links.map((link: any, idx: number) => (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 border border-card-border rounded-lg text-[10px] font-bold text-foreground hover:border-accent/50 transition-all">
                      <Play size={10} className="text-red-500" />
                      {link.title || "Link"}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Subtasks</p>
              {subtasks.length > 0 ? (
                <div className="space-y-2">
                  {subtasks.map((st: any) => (
                    <div key={st.id} className="flex items-center gap-3">
                      <button
                        suppressHydrationWarning
                        onClick={() => onToggleSubtask(st.id, st.completed)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${st.completed ? 'bg-emerald-500 border-emerald-500' : 'border-muted hover:border-accent'}`}
                      >
                        {st.completed && <CheckCircle2 size={10} className="text-white" />}
                      </button>
                      <span className={`text-xs font-medium flex-1 ${st.completed ? 'line-through text-muted' : 'text-foreground'}`}>
                        {st.title}
                      </span>
                      <span className="text-[9px] font-bold text-muted">
                        {st.duration_minutes}m
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  suppressHydrationWarning
                  onClick={onGenerateSubtasks}
                  disabled={isGenerating}
                  className="flex items-center gap-2 text-[10px] font-black text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      Generate Subtasks
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
  );
}

