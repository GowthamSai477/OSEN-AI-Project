"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Play, Pause, SkipForward, CheckCircle2, RotateCcw } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

interface FocusModeProps {
  task: { id: string; title: string; category?: string; duration_minutes?: number; }
  onClose: () => void
  onComplete: (taskId: string) => void
}

export default function FocusMode({ task, onClose, onComplete }: FocusModeProps) {
  const { getToken } = useAuth();
  
  // Timer settings
  const [workDuration, setWorkDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [totalSessions, setTotalSessions] = useState(4);
  const [soundOn, setSoundOn] = useState(true);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [currentSession, setCurrentSession] = useState(1);
  const [timerState, setTimerState] = useState<"idle" | "running" | "paused" | "break" | "complete">("idle");
  const [stats, setStats] = useState<any>({ todaySessions: 0 });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wakeLockRef = useRef<any>(null);

  const playBeep = useCallback(() => {
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const c = new AudioContextClass();
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.frequency.value = 440;
      g.gain.setValueAtTime(0.3, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);
      o.start(); o.stop(c.currentTime + 0.8);
    } catch (e) {}
  }, []);

  const saveStats = useCallback(() => {
    const currentStats = JSON.parse(localStorage.getItem("planora_focus_stats") || "{}");
    const today = new Date().toISOString().split("T")[0];
    
    if (currentStats.lastFocusDate !== today) {
      currentStats.todaySessions = 0;
      currentStats.todayMinutes = 0;
    }
    
    currentStats.todaySessions = (currentStats.todaySessions || 0) + 1;
    currentStats.todayMinutes = (currentStats.todayMinutes || 0) + workDuration;
    currentStats.totalSessions = (currentStats.totalSessions || 0) + 1;
    currentStats.totalMinutes = (currentStats.totalMinutes || 0) + workDuration;
    currentStats.lastFocusDate = today;
    
    localStorage.setItem("planora_focus_stats", JSON.stringify(currentStats));
    setStats(currentStats);
  }, [workDuration]);

  // Load settings and stats
  useEffect(() => {
    const work = parseInt(localStorage.getItem("planora_focus_work") || "25");
    const shortBreak = parseInt(localStorage.getItem("planora_focus_short_break") || "5");
    const longBreak = parseInt(localStorage.getItem("planora_focus_long_break") || "15");
    const sessions = parseInt(localStorage.getItem("planora_focus_sessions") || "4");
    const sound = localStorage.getItem("planora_focus_sound") !== "false";

    setWorkDuration(work);
    setShortBreakDuration(shortBreak);
    setLongBreakDuration(longBreak);
    setTotalSessions(sessions);
    setSoundOn(sound);
    setTimeLeft(work * 60);

    const initialStats = JSON.parse(localStorage.getItem("planora_focus_stats") || "{}");
    const today = new Date().toISOString().split("T")[0];
    if (initialStats.lastFocusDate === today) {
      setStats(initialStats);
    }

    // Wake Lock
    if (navigator.wakeLock) {
      navigator.wakeLock.request("screen").then(lock => {
        wakeLockRef.current = lock;
      }).catch(() => {});
    }

    return () => {
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  const handleTimerComplete = useCallback(() => {
    if (soundOn) playBeep();
    
    if (!isBreak) {
      saveStats();
      if (currentSession >= totalSessions) {
        setTimerState("complete");
        setIsRunning(false);
      } else {
        const nextIsLongBreak = currentSession % totalSessions === 0;
        setIsBreak(true);
        setTimerState("break");
        setTimeLeft((nextIsLongBreak ? longBreakDuration : shortBreakDuration) * 60);
      }
    } else {
      setIsBreak(false);
      setTimerState("running");
      setCurrentSession(prev => prev + 1);
      setTimeLeft(workDuration * 60);
    }
  }, [isBreak, currentSession, totalSessions, soundOn, playBeep, saveStats, longBreakDuration, shortBreakDuration, workDuration]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft, handleTimerComplete]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsRunning(prev => !prev);
        setTimerState(prev => prev === "running" ? "paused" : "running");
      } else if (e.key.toLowerCase() === "s") {
        setTimeLeft(0);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
    setTimerState(!isRunning ? (isBreak ? "break" : "running") : "paused");
  };

  const skipSession = () => {
    setTimeLeft(0);
  };

  const markAsDone = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ completed: true })
      });
      if (res.ok) {
        onComplete(task.id);
        onClose();
      }
    } catch (e) {}
  };

  const resetTimer = () => {
    setCurrentSession(1);
    setIsBreak(false);
    setTimeLeft(workDuration * 60);
    setTimerState("idle");
    setIsRunning(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const circumference = 2 * Math.PI * 80;
  const currentDuration = isBreak 
    ? (currentSession % totalSessions === 0 ? longBreakDuration : shortBreakDuration) 
    : workDuration;
  const progress = timeLeft / (currentDuration * 60);
  const strokeDashoffset = circumference * progress;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0f] flex flex-col items-center justify-center text-white overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.15)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Particles */}
      {[...Array(5)].map((_, i) => (
        <div 
          key={i}
          className="absolute w-2 h-2 bg-purple-500 rounded-full opacity-30 animate-float"
          style={{ 
            left: `${Math.random() * 100}%`, 
            top: `${Math.random() * 100}%`,
            animationDelay: `${i * 2}s`,
            animationDuration: `${10 + i * 2}s`
          }}
        />
      ))}

      {timerState !== "complete" ? (
        <>
          {/* Header */}
          <div className="absolute top-12 text-center">
            <h1 className="text-sm font-black tracking-[0.3em] text-purple-400 mb-2">🎯 FOCUS MODE</h1>
            <p className="text-xs text-muted">Today: {stats.todaySessions || 0} sessions</p>
          </div>

          {/* Task Card */}
          <div className="mb-12 glass-card p-6 border-accent/20 flex flex-col items-center max-w-sm w-full mx-4">
            <h2 className="text-xl font-bold mb-2 text-center">{task.title}</h2>
            {task.category && (
              <span className="text-[10px] uppercase tracking-widest font-bold bg-accent/20 text-accent px-3 py-1 rounded-full border border-accent/30">
                {task.category}
              </span>
            )}
          </div>

          {/* Timer Circle */}
          <div className="relative w-64 h-64 flex items-center justify-center mb-12">
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle
                cx="128" cy="128" r="80"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-white/5"
              />
              <circle
                cx="128" cy="128" r="80"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeDasharray={circumference}
                style={{ strokeDashoffset, transition: "stroke-dashoffset 1s linear" }}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center z-10">
              <div className="font-mono text-8xl font-bold tracking-tighter text-white">
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          {/* Status and Dots */}
          <div className="text-center mb-12">
            <div className="text-sm font-bold uppercase tracking-widest text-purple-400 mb-4">
              {isBreak ? "Break Time" : "Work Session"}
            </div>
            <div className="flex gap-2 justify-center">
              {[...Array(totalSessions)].map((_, i) => (
                <div 
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border ${
                    i + 1 < currentSession || (i + 1 === currentSession && isBreak)
                      ? "bg-purple-500 border-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" 
                      : "bg-white/10 border-white/20"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-6 mb-12">
            <button 
              suppressHydrationWarning
              onClick={toggleTimer}
              className="w-16 h-16 rounded-full bg-accent hover:bg-purple-600 flex items-center justify-center transition-all active:scale-95 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
            >
              {isRunning ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" className="ml-1" />}
            </button>
            <button 
              suppressHydrationWarning
              onClick={skipSession}
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              title="Skip Session (S)"
            >
              <SkipForward size={24} />
            </button>
            <button 
              suppressHydrationWarning
              onClick={onClose}
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              title="End Session"
            >
              <X size={24} />
            </button>
          </div>

          {/* Footer Help */}
          <div className="text-[10px] font-bold text-muted tracking-widest uppercase opacity-50">
            Space: Pause • S: Skip • Esc: Exit
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center text-center px-6 max-w-md">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-3xl font-black mb-4">Focus Session Complete!</h2>
          <p className="text-muted mb-8">
            Excellent work! You focused on <span className="text-white font-bold">{task.title}</span> for {workDuration * totalSessions} minutes.
          </p>
          
          <div className="flex flex-col w-full gap-3">
            <button 
              suppressHydrationWarning
              onClick={markAsDone}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <CheckCircle2 size={20} /> Mark Task Done
            </button>
            <button 
              suppressHydrationWarning
              onClick={resetTimer}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw size={18} /> Continue Working
            </button>
            <button 
              suppressHydrationWarning
              onClick={onClose}
              className="mt-4 text-muted hover:text-white text-sm font-bold transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
