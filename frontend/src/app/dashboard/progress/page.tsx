"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@clerk/nextjs";
import {
  TrendingUp, CheckCircle2, Flame, Target, Sparkles,
  BarChart2, Loader2, AlertTriangle, Trophy
} from "lucide-react";
import { cachedFetch } from "@/lib/api-helpers";
import SandyLoading from "@/components/SandyLoading";
import Link from "next/link";

type Report = {
  id: string;
  week_start: string;
  week_end: string;
  completion_rate: number;
  prev_completion_rate: number;
  best_category: string | null;
  worst_category: string | null;
  total_completed: number;
  total_tasks: number;
  streak: number;
  on_track_status: "on_track" | "at_risk" | "behind";
  ai_recommendation: string | null;
  created_at: string;
};

const STATUS_CONFIG = {
  on_track: { label: "On Track",  color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" },
  at_risk:  { label: "At Risk",   color: "text-yellow-400",  bg: "bg-yellow-400/10  border-yellow-400/30"  },
  behind:   { label: "Behind",    color: "text-red-400",     bg: "bg-red-400/10     border-red-400/30"     },
};

function fmtWeek(ws: string, we: string) {
  const s = new Date(ws).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(we).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

export default function ProgressPage() {
  const { getToken } = useAuth();
  const [report,  setReport]  = useState<Report | null>(null);
  const [history, setHistory] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [noData,  setNoData]  = useState(false);

  useEffect(() => {
    fetchProgressData();
  }, [getToken]);

  const fetchProgressData = async (force: boolean = false) => {
    try {
      const token = await getToken();
      if (!token) return;
      const base = process.env.NEXT_PUBLIC_API_URL;

      const [weeklyData, histData] = await Promise.all([
        cachedFetch<any>(`weekly_report_full`, `${base}/api/progress/weekly`, token, 600000, force),
        cachedFetch<Report[]>(`progress_history`, `${base}/api/progress/history`, token, 1200000, force),
      ]);

      if (weeklyData) {
        if (weeklyData.no_data) setNoData(true);
        else setReport(weeklyData);
      }
      if (histData) {
        setHistory(histData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-1 items-center justify-center min-h-[60vh]">
      <SandyLoading />
    </div>
  );

  if (noData || !report) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-center gap-4">
      <BarChart2 className="w-16 h-16 text-muted opacity-30" />
      <h2 className="text-2xl font-bold text-foreground">No Report Yet</h2>
      <p className="text-muted max-w-xs">Complete some tasks this week and come back on Sunday for your first weekly report!</p>
      <Link href="/dashboard/ai-assistant" className="mt-2 px-6 py-2.5 bg-accent text-white rounded-xl font-bold hover:bg-purple-600 transition-colors">
        Start Planning
      </Link>
    </div>
  );

  const diff = report.completion_rate - report.prev_completion_rate;
  const statusCfg = STATUS_CONFIG[report.on_track_status] ?? STATUS_CONFIG.behind;

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl font-extrabold tracking-tight mb-1">
          Progress <span className="text-gradient">Report</span>
        </h1>
        <p className="text-muted font-medium">
          Week of {fmtWeek(report.week_start, report.week_end)}
        </p>
      </motion.div>

      {/* Hero Rate Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card p-8 relative overflow-hidden"
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-accent/15 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          {/* Big number */}
          <div className="shrink-0">
            <div className="text-7xl font-black text-gradient leading-none">{report.completion_rate}%</div>
            <div className="text-sm font-bold text-muted mt-1">Completion Rate</div>
            {diff !== 0 && (
              <div className={`text-sm font-bold mt-1 ${diff > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {diff > 0 ? "↑" : "↓"} {Math.abs(diff)}% vs last week
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex-1 w-full">
            <div className="w-full h-4 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${report.completion_rate}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-accent to-purple-400 rounded-full"
              />
            </div>
            <div className="flex justify-between text-xs text-muted mt-1.5 font-medium">
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stat Pills */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />, value: `${report.total_completed}/${report.total_tasks}`, label: "Completed" },
          { icon: <Flame        className="w-5 h-5 text-orange-400"  />, value: `${report.streak} days`,                           label: "Streak"    },
          {
            icon:  <Target className={`w-5 h-5 ${statusCfg.color}`} />,
            value: statusCfg.label,
            label: "Status",
            extra: `border ${statusCfg.bg}`,
          },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i + 0.1 }}
            className={`glass-card p-5 flex flex-col gap-2 ${s.extra ?? ""}`}
          >
            {s.icon}
            <div className="text-2xl font-black text-foreground">{s.value}</div>
            <div className="text-xs font-bold text-muted uppercase tracking-wide">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Category Breakdown */}
      {(report.best_category || report.worst_category) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="glass-card p-6"
        >
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" /> Category Highlights
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            {report.best_category && (
              <div className="flex-1 bg-emerald-400/10 border border-emerald-400/25 rounded-xl p-4">
                <div className="text-xs text-emerald-400 font-bold uppercase tracking-wide mb-1">🏆 Best Category</div>
                <div className="text-xl font-extrabold text-foreground">{report.best_category}</div>
              </div>
            )}
            {report.worst_category && (
              <div className="flex-1 bg-red-400/10 border border-red-400/25 rounded-xl p-4">
                <div className="text-xs text-red-400 font-bold uppercase tracking-wide mb-1">
                  <AlertTriangle className="inline w-3 h-3 mr-1" />Needs Attention
                </div>
                <div className="text-xl font-extrabold text-foreground">{report.worst_category}</div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* AI Recommendation */}
      {report.ai_recommendation && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 border-l-4 border-accent bg-accent/5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="font-bold text-accent text-sm uppercase tracking-wide">AI Recommendation</span>
          </div>
          <p className="text-foreground leading-relaxed">{report.ai_recommendation}</p>
        </motion.div>
      )}

      {/* 4-Week Bar Chart */}
      {history.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="glass-card p-6"
        >
          <h2 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent" /> Last 4 Weeks
          </h2>
          <div className="flex items-end gap-4 h-36">
            {[...history].reverse().map((r, i) => {
              const h = Math.max(6, r.completion_rate);
              const isLatest = i === history.length - 1;
              return (
                <div key={r.id} className="flex-1 flex flex-col items-center gap-2">
                  <span className={`text-xs font-bold ${isLatest ? "text-accent" : "text-muted"}`}>
                    {r.completion_rate}%
                  </span>
                  <div className="w-full flex flex-col justify-end" style={{ height: "6rem" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.8, delay: 0.05 * i }}
                      className={`w-full rounded-t-lg ${isLatest ? "bg-accent" : "bg-secondary"}`}
                      style={{ minHeight: "6px" }}
                    />
                  </div>
                  <span className="text-[10px] text-muted text-center leading-tight">
                    {new Date(r.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

