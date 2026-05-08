"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { 
  Activity, Droplets, Moon, Sun, Flame, 
  Brain, Plus, Calculator, ArrowRight, TrendingUp, Sparkles, AlertCircle
} from "lucide-react";
import { clsx } from "clsx";

export default function HealthCenterPage() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // BMI States
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  
  // Calories State
  const [mealInput, setMealInput] = useState("");
  const [isEstimating, setIsEstimating] = useState(false);
  
  // Insights
  const [insights, setInsights] = useState("");
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  useEffect(() => {
    fetchData();
    fetchInsights();
  }, []);

  const fetchData = async () => {
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      
      const [profRes, logRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/profile`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/today`, { headers })
      ]);
      
      if (profRes.ok) {
        const p = await profRes.json();
        setProfile(p);
        if (p.height_cm) setHeight(p.height_cm.toString());
        if (p.weight_kg) setWeight(p.weight_kg.toString());
      }
      if (logRes.ok) setTodayLog(await logRes.json());
      
    } catch (err) {
      console.error("Failed to fetch health data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/weekly-insights`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const updateLog = async (updates: any) => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/log`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setTodayLog(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveProfile = async (updates: any) => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/profile`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        setProfile(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBmiSave = () => {
    const h = parseInt(height);
    const w = parseInt(weight);
    if (h && w) {
      saveProfile({ height_cm: h, weight_kg: w });
    }
  };

  const calculateBmi = () => {
    if (!profile?.height_cm || !profile?.weight_kg) return { value: 0, category: "Enter Data" };
    const m = profile.height_cm / 100;
    const bmi = profile.weight_kg / (m * m);
    let category = "Normal";
    if (bmi < 18.5) category = "Underweight";
    else if (bmi >= 25 && bmi < 30) category = "Overweight";
    else if (bmi >= 30) category = "Obese";
    
    return { value: bmi.toFixed(1), category };
  };

  const handleCalorieEstimate = async () => {
    if (!mealInput) return;
    setIsEstimating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/health/estimate-calories`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ meal_description: mealInput })
      });
      if (res.ok) {
        const data = await res.json();
        const newTotal = (todayLog?.calories_consumed || 0) + data.calories;
        updateLog({ calories_consumed: newTotal });
        setMealInput("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsEstimating(false);
    }
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin text-primary"><Activity size={32} /></div></div>;
  }

  const bmiData = calculateBmi();

  return (
    <div className="h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Activity className="text-primary" size={32} /> Health Center
          </h1>
          <p className="text-muted mt-1">Track your wellness and get AI-powered insights.</p>
        </div>
        {/* Weekly Insights Widget */}
        <div className="bg-surface-elevated border border-primary/20 rounded-2xl p-4 max-w-sm relative overflow-hidden group shadow-sm hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
            <Sparkles className="text-primary" size={24} />
          </div>
          <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
            <Brain size={14} /> AI Health Insight
          </h3>
          <p className="text-sm font-medium text-foreground/80 leading-snug">
            {isLoadingInsights ? "Analyzing your week..." : insights || "Start tracking to get personalized insights."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column */}
        <div className="space-y-6">
          {/* BMI Calculator */}
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-surface border border-border rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><Calculator size={20} className="text-blue-500"/> Body Mass Index</h2>
            
            <div className="flex items-center justify-between mb-6">
              <div className="text-center">
                <span className="text-4xl font-black">{bmiData.value || "-"}</span>
                <p className={clsx("text-xs font-bold uppercase tracking-wider mt-1", 
                  bmiData.category === "Normal" ? "text-emerald-500" : 
                  bmiData.category === "Enter Data" ? "text-muted" : "text-amber-500"
                )}>{bmiData.category}</p>
              </div>
              <div className="w-px h-12 bg-border mx-4" />
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Height (cm)" value={height} onChange={e=>setHeight(e.target.value)} className="w-full bg-surface-elevated text-sm px-3 py-2 rounded-xl border border-border focus:border-blue-500 outline-none" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" placeholder="Weight (kg)" value={weight} onChange={e=>setWeight(e.target.value)} className="w-full bg-surface-elevated text-sm px-3 py-2 rounded-xl border border-border focus:border-blue-500 outline-none" />
                </div>
              </div>
            </div>
            <button onClick={handleBmiSave} className="w-full py-3 bg-blue-500/10 text-blue-600 font-bold rounded-xl hover:bg-blue-500/20 transition-all text-sm">Save Profile</button>
          </motion.div>

          {/* Sleep & Mood */}
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="bg-surface border border-border rounded-[2rem] p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><Moon size={20} className="text-indigo-500"/> Sleep & Mood</h2>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-3">
                  <span className="text-sm font-bold text-muted uppercase">Hours Slept</span>
                  <span className="text-2xl font-black text-indigo-500">{todayLog?.sleep_hours || 0}h</span>
                </div>
                <input 
                  type="range" min="0" max="14" step="0.5" 
                  value={todayLog?.sleep_hours || 0} 
                  onChange={(e) => updateLog({sleep_hours: parseFloat(e.target.value)})}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="pt-4 border-t border-border">
                <span className="text-sm font-bold text-muted uppercase mb-3 block">Today's Mood</span>
                <div className="flex justify-between gap-2">
                  {[
                    {id: 'great', icon: '😄'}, {id: 'good', icon: '🙂'}, 
                    {id: 'neutral', icon: '😐'}, {id: 'bad', icon: '😔'}
                  ].map(m => (
                    <button 
                      key={m.id}
                      onClick={() => updateLog({mood: m.id})}
                      className={clsx(
                        "flex-1 py-3 text-2xl rounded-xl transition-all border-2",
                        todayLog?.mood === m.id ? "bg-indigo-500/10 border-indigo-500" : "bg-surface-elevated border-transparent opacity-50 hover:opacity-100"
                      )}
                    >
                      {m.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Middle Column */}
        <div className="space-y-6">
          {/* Water Tracker */}
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="bg-surface border border-border rounded-[2rem] p-6 shadow-sm relative overflow-hidden h-full flex flex-col">
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mb-10 pointer-events-none" />
            <div className="flex justify-between items-start mb-8">
              <h2 className="text-lg font-bold flex items-center gap-2"><Droplets size={20} className="text-cyan-500"/> Hydration</h2>
              <div className="text-right">
                <span className="text-3xl font-black text-cyan-500">{todayLog?.water_glasses || 0}</span>
                <span className="text-sm font-bold text-muted ml-1">/ {profile?.daily_water_goal || 8} glasses</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center gap-6">
              <div className="flex flex-wrap justify-center gap-3">
                {Array.from({ length: Math.max(profile?.daily_water_goal || 8, todayLog?.water_glasses || 0) }).map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => updateLog({ water_glasses: (todayLog?.water_glasses === i + 1) ? i : i + 1 })}
                    className={clsx(
                      "w-12 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 border-2",
                      (todayLog?.water_glasses || 0) > i 
                        ? "bg-cyan-500 text-white border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]" 
                        : "bg-surface-elevated text-cyan-500/30 border-cyan-500/10 hover:border-cyan-500/40"
                    )}
                  >
                    <Droplets size={24} fill={(todayLog?.water_glasses || 0) > i ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-muted font-medium">Tap a glass to log your intake</p>
            </div>
          </motion.div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Calorie Tracker */}
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.3}} className="bg-surface border border-border rounded-[2rem] p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><Flame size={20} className="text-orange-500"/> Nutrition</h2>
            
            <div className="flex items-center gap-4 mb-6 p-4 bg-orange-500/5 rounded-2xl border border-orange-500/20">
              <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center border-4 border-orange-500/30">
                <Flame className="text-orange-500" size={24} />
              </div>
              <div>
                <span className="block text-3xl font-black text-orange-600">{todayLog?.calories_consumed || 0}</span>
                <span className="text-xs font-bold uppercase text-orange-600/70 tracking-wider">Kcal Consumed</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-muted uppercase">Log a meal (AI Estimator)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={mealInput}
                  onChange={(e) => setMealInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCalorieEstimate()}
                  placeholder="e.g. 2 eggs and toast" 
                  disabled={isEstimating}
                  className="w-full bg-surface-elevated border border-border rounded-xl pl-4 pr-12 py-3 text-sm focus:border-orange-500 outline-none transition-all disabled:opacity-50"
                />
                <button 
                  onClick={handleCalorieEstimate}
                  disabled={isEstimating || !mealInput}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                >
                  {isEstimating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Plus size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-muted flex items-center gap-1"><Sparkles size={10} className="text-orange-500"/> Gemini estimates calories instantly</p>
            </div>
          </motion.div>

          {/* Steps Tracker */}
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.4}} className="bg-surface border border-border rounded-[2rem] p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-emerald-500"/> Daily Steps</h2>
            
            <div className="flex justify-between items-end mb-4">
              <span className="text-4xl font-black text-emerald-500">{todayLog?.steps || 0}</span>
              <span className="text-sm font-bold text-muted mb-1">/ {profile?.daily_step_goal || 10000}</span>
            </div>
            
            <div className="h-2 bg-surface-elevated rounded-full overflow-hidden mb-6">
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000" 
                style={{width: `${Math.min(((todayLog?.steps || 0) / (profile?.daily_step_goal || 10000)) * 100, 100)}%`}}
              />
            </div>

            <div className="flex gap-2">
              {[500, 1000, 2000].map(amt => (
                <button 
                  key={amt}
                  onClick={() => updateLog({ steps: (todayLog?.steps || 0) + amt })}
                  className="flex-1 py-2 text-xs font-bold text-emerald-600 bg-emerald-500/10 rounded-xl hover:bg-emerald-500/20 transition-colors"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
