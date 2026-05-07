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
      if (!base) {
        console.error("NEXT_PUBLIC_API_URL is not defined in .env.local");
        return;
      }
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
    // Optimistic UI
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <SandyLoading />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <h1 className="text-5xl font-extrabold tracking-tight mb-3">
          Good morning, <span className="text-gradient">{user?.firstName || "User"}</span>
        </h1>
        <p className="text-muted text-lg font-medium">
          {tasks.length > 0
            ? `You have ${tasks.length} task${tasks.length > 1 ? 's' : ''} scheduled for today.`
            : "Your day is clear. Ask Planora to schedule some tasks!"}
        </p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <motion.div variants={itemVariants} className="glass-card p-7 flex flex-col gap-5 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl group-hover:bg-accent/20 transition-all duration-500" />
          <div className="flex items-center gap-3 text-accent font-semibold">
            <div className="p-2 bg-accent/10 rounded-lg"><Target className="w-5 h-5" /></div>
            Current Goal
          </div>
          <div className="z-10 mt-2">
            <h3 className="text-3xl font-bold tracking-tight text-foreground">{goalStats?.goal?.title || "No Goal Set"}</h3>
            <p className="text-sm text-muted mt-2 font-medium">{goalStats?.goal ? goalStats.goal.target : "Talk to the AI to set a goal"}</p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card p-7 flex flex-col gap-5 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-500" />
          <div className="flex items-center gap-3 text-orange-500 font-semibold">
            <div className="p-2 bg-orange-500/10 rounded-lg"><Flame className="w-5 h-5" /></div>
            Active Streak
          </div>
          <div className="z-10 mt-2 flex items-baseline gap-2">
            <h3 className="text-5xl font-extrabold tracking-tight text-foreground">{goalStats?.streak || 0}</h3>
            <span className="text-lg font-bold text-muted">Days</span>
          </div>
          <p className="text-sm text-muted font-medium z-10">{goalStats?.streak > 0 ? "You're on fire! Keep it up." : "Complete tasks to ignite your streak."}</p>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-card p-7 flex flex-col gap-5 relative overflow-hidden group">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />
          <div className="flex items-center gap-3 text-emerald-500 font-semibold">
            <div className="p-2 bg-emerald-500/10 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
            Today's Progress
          </div>
          <div className="z-10 mt-2">
            <h3 className="text-3xl font-bold tracking-tight text-foreground">{completedCount} / {tasks.length}</h3>
            <div className="w-full bg-secondary h-3 mt-4 rounded-full overflow-hidden shadow-inner">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="bg-gradient-to-r from-emerald-500 to-green-400 h-full rounded-full transition-all duration-1000 ease-out"
              />
            </div>
          </div>
        </motion.div>

        {/* Focus Stats Card */}
        {focusStats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-4 border border-purple-500/30 bg-purple-500/5 flex items-center justify-between overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🎯</span>
              <div className="text-sm font-bold text-foreground">
                Focus Today: <span className="text-purple-400">{focusStats.todaySessions} sessions</span> • <span className="text-purple-400">{focusStats.todayMinutes} min</span>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Weekly Report Card — always shown if report exists */}
      {weekReport && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 border border-accent/20 relative overflow-hidden"
        >
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-accent/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-accent" />
              <h2 className="font-bold text-foreground">📊 Weekly Report</h2>
              <span className="text-xs text-muted">
                {new Date(weekReport.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                {new Date(weekReport.week_end).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
            <Link href="/dashboard/progress" className="flex items-center gap-1 text-xs font-bold text-accent hover:underline">
              View Full <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Rate + comparison */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div>
              <div className="text-5xl font-black text-gradient">{weekReport.completion_rate}%</div>
              {weekReport.completion_rate !== weekReport.prev_completion_rate && (
                <div className={`text-sm font-bold mt-0.5 ${weekReport.completion_rate >= weekReport.prev_completion_rate ? "text-emerald-400" : "text-red-400"
                  }`}>
                  {weekReport.completion_rate >= weekReport.prev_completion_rate ? "↑" : "↓"}{" "}
                  {Math.abs(weekReport.completion_rate - weekReport.prev_completion_rate)}% vs last week
                </div>
              )}
            </div>
            {/* Stat pills */}
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 bg-emerald-400/10 border border-emerald-400/25 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full">
                ✅ {weekReport.total_completed} Completed
              </span>
              <span className="flex items-center gap-1.5 bg-orange-400/10 border border-orange-400/25 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full">
                🔥 {weekReport.streak} Day Streak
              </span>
              <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${weekReport.on_track_status === "on_track" ? "bg-emerald-400/10 border-emerald-400/25 text-emerald-400"
                  : weekReport.on_track_status === "at_risk" ? "bg-yellow-400/10 border-yellow-400/25 text-yellow-400"
                    : "bg-red-400/10 border-red-400/25 text-red-400"
                }`}>
                📈 {weekReport.on_track_status === "on_track" ? "On Track" : weekReport.on_track_status === "at_risk" ? "At Risk" : "Behind"}
              </span>
            </div>
          </div>

          {/* Best / Worst */}
          {(weekReport.best_category || weekReport.worst_category) && (
            <div className="flex flex-wrap gap-3 mb-4">
              {weekReport.best_category && (
                <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-emerald-400 font-bold">🏆 Best:</span>
                  <span className="text-sm font-semibold text-foreground">{weekReport.best_category}</span>
                </div>
              )}
              {weekReport.worst_category && (
                <div className="flex items-center gap-2 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-red-400 font-bold">⚠️ Needs Work:</span>
                  <span className="text-sm font-semibold text-foreground">{weekReport.worst_category}</span>
                </div>
              )}
            </div>
          )}

          {/* AI Recommendation */}
          {weekReport.ai_recommendation && (
            <div className="bg-accent/8 border border-accent/20 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-4 h-4 text-accent" />
                <span className="text-xs font-bold text-accent uppercase tracking-wide">AI Tip</span>
              </div>
              <p className="text-sm text-muted leading-relaxed">{weekReport.ai_recommendation}</p>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Timeline Schedule */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-foreground tracking-tight">
            <Clock className="w-6 h-6 text-accent" />
            Today's Schedule
          </h2>

          <div className="relative pl-6">
            {/* The Timeline Line */}
            <div className="absolute left-0 top-3 bottom-3 w-px bg-gradient-to-b from-accent/50 via-accent/20 to-transparent" />

            {tasks.length === 0 ? (
              <div className="glass-card p-10 flex flex-col items-center justify-center text-center border-dashed">
                <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-6">
                  <LayoutTemplate size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">No tasks yet today</h3>
                <p className="text-sm text-muted mb-8 max-w-xs mx-auto">Get started with a template or ask the AI to build your schedule.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg">
                  <Link href="/dashboard/templates" className="p-3 rounded-xl border border-card-border bg-secondary/50 hover:border-red-500/50 hover:bg-red-500/5 transition-all text-sm font-bold flex items-center gap-2 justify-center">
                    🔥 Weight Loss
                  </Link>
                  <Link href="/dashboard/templates" className="p-3 rounded-xl border border-card-border bg-secondary/50 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-sm font-bold flex items-center gap-2 justify-center">
                    📚 Exam Prep
                  </Link>
                  <Link href="/dashboard/templates" className="p-3 rounded-xl border border-card-border bg-secondary/50 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-sm font-bold flex items-center gap-2 justify-center">
                    💡 Learn a Skill
                  </Link>
                </div>
                
                <Link href="/dashboard/templates" className="mt-6 text-xs font-black text-accent uppercase tracking-widest hover:underline flex items-center gap-2">
                  View all templates <ArrowRight size={12} />
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
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
        </div>

        {/* AI Insights Panel */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-foreground tracking-tight">
            <Sparkles className="w-6 h-6 text-accent" />
            AI Insights
          </h2>
          <div className="glass-panel p-1 rounded-2xl bg-gradient-to-br from-accent/20 via-transparent to-transparent">
            <div className="bg-card rounded-[15px] p-6 h-full flex flex-col justify-center text-center">
              {weekReport?.ai_recommendation ? (
                <>
                  <div className="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-foreground">This Week's Tip</h3>
                  <p className="text-sm text-muted leading-relaxed">{weekReport.ai_recommendation}</p>
                  <Link href="/dashboard/progress" className="mt-4 text-xs font-bold text-accent hover:underline">
                    View full report →
                  </Link>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-foreground">Awaiting Data</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    As you complete tasks and log progress, Planora AI will analyze your habits and inject intelligent recommendations here to optimize your routine.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
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

function TaskTimelineItem({ id, time, task, category, completed = false, subtasks = [], isGenerating = false, isExpanded, onToggleExpand, onClick, onToggleSubtask, onGenerateSubtasks, onFocus }: any) {
  const completedSubtasks = subtasks.filter((st: any) => st.completed).length;
  
  return (
    <div className="relative group">
      {/* Timeline Node */}
      <div className={`absolute -left-[29px] top-5 w-[11px] h-[11px] rounded-full border-2 transition-all duration-300 ${completed ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-background border-accent group-hover:bg-accent'}`} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            onClick={onClick}
            className="flex-1 text-left p-5 glass-card rounded-2xl flex items-center gap-5 transition-all outline-none focus:ring-2 focus:ring-accent/50 group-hover:translate-x-1 cursor-pointer"
          >
            <div className="flex-shrink-0">
              <AnimatePresence mode="wait">
                {completed ? (
                  <motion.div
                    key="checked"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 45 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="unchecked"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Circle className="w-7 h-7 text-muted group-hover:text-accent/50 transition-colors" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`text-lg font-bold truncate transition-all duration-300 ${completed ? 'line-through text-muted' : 'text-foreground'}`}>
                  {task}
                </p>
                {subtasks.length > 0 && (
                  <span className="text-[10px] font-black bg-secondary px-1.5 py-0.5 rounded text-muted uppercase tracking-tighter">
                    {completedSubtasks}/{subtasks.length} SUBTASKS
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-sm font-semibold tracking-wide text-accent bg-accent/10 px-2 py-0.5 rounded-md">
                  {task.time}
                </span>
                <span className="text-xs font-medium text-muted uppercase tracking-wider">
                  {task.category}
                </span>
              </div>
              
              {task.url && (
                <a 
                  href={task.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold rounded-lg hover:bg-emerald-500/20 transition-all shadow-sm"
                >
                  <Globe size={12} /> Open URL
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!completed && (
                <button suppressHydrationWarning onClick={(e) => {
                    e.stopPropagation();
                    onFocus();
                  }}
                  className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all duration-300 text-lg flex items-center justify-center shrink-0"
                  title="Start Focus Session"
                >
                  🎯
                </button>
              )}
              
              <button suppressHydrationWarning onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className={`p-1.5 rounded-lg hover:bg-secondary transition-all ${isExpanded ? 'rotate-180 text-accent' : 'text-muted'}`}
              >
                <ChevronDown size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Subtask List */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="ml-12 overflow-hidden border-l-2 border-accent/20 pl-6 space-y-4"
            >
              {/* Resource Links */}
              {task.links && task.links.length > 0 && (
                <div className="space-y-2 mt-2">
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
                {subtasks.length > 0 ? (
                  subtasks.map((st: any) => (
                    <div key={st.id} className="flex items-center gap-3 group/st">
                      <button suppressHydrationWarning 
                        onClick={() => onToggleSubtask(st.id, st.completed)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${st.completed ? 'bg-emerald-500 border-emerald-500' : 'border-muted group-hover/st:border-accent'}`}
                      >
                        {st.completed && <CheckCircle2 size={12} className="text-white" />}
                      </button>
                      <span className={`text-sm font-medium flex-1 ${st.completed ? 'line-through text-muted' : 'text-foreground'}`}>
                        {st.title}
                      </span>
                      <span className="text-[10px] font-bold text-muted bg-secondary px-1.5 py-0.5 rounded">
                        {st.duration_minutes}m
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-2">
                    <button suppressHydrationWarning onClick={onGenerateSubtasks}
                      disabled={isGenerating}
                      className="flex items-center gap-2 text-xs font-black text-accent uppercase tracking-widest hover:underline disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Analyzing Task...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          Generate Subtasks
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

