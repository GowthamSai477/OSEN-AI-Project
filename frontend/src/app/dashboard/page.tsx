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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Good {timeOfDay}, {user?.firstName || "User"} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tasks.length > 0
              ? `${tasks.length} task${tasks.length > 1 ? 's' : ''} scheduled for today`
              : "No tasks today — add some!"}
          </p>
        </div>
        <p className="text-sm text-gray-400 hidden md:block">
          {todayDate}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1 — Current Goal */}
        <div className="relative overflow-hidden rounded-xl p-4 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-xl"/>
          <div className="flex flex-col h-full">
            <span className="text-[10px] font-semibold tracking-widest text-gray-400 dark:text-gray-500 uppercase mb-1">CURRENT GOAL</span>
            <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
              {goalStats?.goal?.title || "No Goal Set"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {goalStats?.goal?.target || "Talk to AI to set a goal"}
            </p>
          </div>
        </div>

        {/* Card 2 — Today's Progress */}
        <div className="relative overflow-hidden rounded-xl p-4 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400 rounded-l-xl"/>
          <div className="flex flex-col h-full">
            <span className="text-[10px] font-semibold tracking-widest text-emerald-400 uppercase mb-1">TODAY</span>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {completedCount}/{tasks.length}
              <span className="text-xs font-normal text-gray-400 ml-1.5">tasks</span>
            </p>
            <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5 mt-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {Math.round(progressPercent)}% complete
            </p>
          </div>
        </div>

        {/* Card 3 — Active Streak */}
        <div className="relative overflow-hidden rounded-xl p-4 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400 rounded-l-xl"/>
          <div className="flex flex-col h-full">
            <span className="text-[10px] font-semibold tracking-widest text-orange-400 uppercase mb-1">STREAK</span>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {goalStats?.streak > 0 && "🔥 "}{goalStats?.streak || 0}
              <span className="text-xs font-normal text-gray-400 ml-1.5">days</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {goalStats?.streak > 0 ? "You're on fire!" : "Start today"}
            </p>
          </div>
        </div>

        {/* Card 4 — Weekly Summary */}
        <div className="relative overflow-hidden rounded-xl p-4 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-200 ease-out hover:-translate-y-0.5 group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-xl"/>
          <Link
            href="/dashboard/progress"
            className="text-[11px] text-blue-400 hover:text-blue-500 absolute top-4 right-4 transition-colors font-medium"
          >
            View →
          </Link>
          <div className="flex flex-col h-full">
            <span className="text-[10px] font-semibold tracking-widest text-blue-400 uppercase mb-1">THIS WEEK</span>
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {weekReport?.completion_rate || 0}%
                <span className="text-xs font-normal text-gray-400 ml-1.5">done</span>
              </p>
              {weekReport?.on_track_status === "on_track" && (
                <span className="text-[11px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  On track ✓
                </span>
              )}
              {weekReport?.on_track_status === "at_risk" && (
                <span className="text-[11px] bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                  At risk ⚠
                </span>
              )}
              {weekReport?.on_track_status === "behind" && (
                <span className="text-[11px] bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 px-2 py-0.5 rounded-full">
                  Behind ✗
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Weekly focus overview
            </p>
          </div>
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Today's Schedule
          </h2>
          <button suppressHydrationWarning
            onClick={() => window.location.href = "/dashboard/schedule"}
            className="text-xs text-violet-500 hover:text-violet-600 font-medium transition-colors"
          >
            View all →
          </button>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#111118] border border-dashed border-gray-200 dark:border-white/10 rounded-2xl shadow-sm">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              No tasks scheduled today
            </p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              Get started with a template
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <button suppressHydrationWarning
                onClick={() => window.location.href = "/dashboard/templates"}
                className="text-xs px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors"
              >
                Browse Templates
              </button>
              <button suppressHydrationWarning
                onClick={() => window.location.href = "/dashboard/ai-assistant"}
                className="text-xs px-4 py-2 border border-violet-200 dark:border-violet-500/30 text-violet-500 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
              >
                Ask AI
              </button>
            </div>
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
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#111118] border border-gray-100 dark:border-white/10 rounded-xl mb-2 shadow-sm hover:border-violet-300 dark:hover:border-violet-500/30 hover:shadow-md transition-all duration-150 group">
      <div
        onClick={onClick}
        className="flex items-center gap-4 cursor-pointer flex-1"
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
            <p className={`text-sm font-bold truncate ${completed ? 'line-through text-muted' : 'text-gray-900 dark:text-white'}`}>
              {task}
            </p>
            {subtasks.length > 0 && (
              <span className="text-[9px] font-black bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 uppercase tracking-tighter">
                {completedSubtasks}/{subtasks.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] font-semibold bg-violet-50 dark:bg-violet-500/10 text-violet-500 px-2 py-0.5 rounded-md">
              {time}
            </span>
            <span className="text-[10px] text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded-md uppercase tracking-wide">
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
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all ${isExpanded ? 'rotate-180 text-violet-500' : 'text-gray-400'}`}
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

