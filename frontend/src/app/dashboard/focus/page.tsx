"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Play, Circle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import FocusMode from "@/components/FocusMode";

export default function FocusPage() {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusTask, setFocusTask] = useState<any>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
        const incompleteToday = data.filter((t: any) => 
          t.date.startsWith(todayStr) && !t.completed
        ).sort((a: any, b: any) => a.time.localeCompare(b.time));
        setTasks(incompleteToday);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
          <Timer className="text-accent" size={32} />
          Focus Mode
        </h1>
        <p className="text-muted font-medium">Select a task to enter deep focus.</p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : tasks.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center border-dashed"
        >
          <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-6">
            <Sparkles size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">No tasks scheduled for today.</h3>
          <p className="text-muted max-w-sm mx-auto">
            Add tasks in the Planner to start a focus session and optimize your productivity.
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4"
        >
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              variants={itemVariants}
              onClick={() => setFocusTask(task)}
              className="glass-card p-5 group cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                  <Play size={18} className="translate-x-0.5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground group-hover:text-accent transition-colors">{task.task}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded uppercase tracking-wider">{task.time}</span>
                    <span className="text-xs text-muted font-medium uppercase tracking-widest">{task.category}</span>
                  </div>
                </div>
              </div>
              <div className="text-muted group-hover:text-accent transition-colors">
                <Play size={24} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

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
              setTasks(prev => prev.filter(t => t.id !== id));
              setFocusTask(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

