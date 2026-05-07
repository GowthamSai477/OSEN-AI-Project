"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, Mic, Volume2, Sparkles, Save, Shield, Cpu, 
  MessageSquare, Zap, Clock, Coffee, BellRing, 
  RotateCcw, Trash2, Download, Settings, Brain
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";

export default function AISettingsPage() {
  const { getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Combined State
  const [settings, setSettings] = useState({
    // Power & Model
    aiPower: true,
    model: "llama-3.3-70b-versatile",
    intelligence: "Standard",
    responseStyle: "Detailed",
    
    // Voice
    wakeWord: false,
    readAloud: false,
    speechRate: 1.0,
    voiceName: "",
    
    // Focus Mode
    workDuration: 25,
    breakDuration: 5,
    focusSessions: 4,
    focusSound: true,
    focusAutoStart: false,
  });

  useEffect(() => {
    setMounted(true);
    
    // Load ALL settings from localStorage
    const saved = {
      aiPower: localStorage.getItem("planora_ai_power") !== "false",
      model: localStorage.getItem("planora_ai_model") || "llama-3.3-70b-versatile",
      intelligence: localStorage.getItem("planora_ai_intelligence") || "Standard",
      responseStyle: localStorage.getItem("planora_ai_response_style") || "Detailed",
      wakeWord: localStorage.getItem("planora_voice_wake_word") === "true",
      readAloud: localStorage.getItem("planora_voice_read_aloud") === "true",
      speechRate: parseFloat(localStorage.getItem("planora_speech_rate") || "1.0"),
      voiceName: localStorage.getItem("planora_voice_name") || "",
      workDuration: parseInt(localStorage.getItem("planora_focus_work") || "25"),
      breakDuration: parseInt(localStorage.getItem("planora_focus_break") || "5"),
      focusSessions: parseInt(localStorage.getItem("planora_focus_sessions") || "4"),
      focusSound: localStorage.getItem("planora_focus_sound") !== "false",
      focusAutoStart: localStorage.getItem("planora_focus_autostart") === "true",
    };
    
    setSettings(saved);

    // Load voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    
    // Persist everything
    localStorage.setItem("planora_ai_power", String(settings.aiPower));
    localStorage.setItem("planora_ai_model", settings.model);
    localStorage.setItem("planora_ai_intelligence", settings.intelligence);
    localStorage.setItem("planora_ai_response_style", settings.responseStyle);
    localStorage.setItem("planora_voice_wake_word", String(settings.wakeWord));
    localStorage.setItem("planora_voice_read_aloud", String(settings.readAloud));
    localStorage.setItem("planora_speech_rate", settings.speechRate.toString());
    localStorage.setItem("planora_voice_name", settings.voiceName);
    localStorage.setItem("planora_focus_work", settings.workDuration.toString());
    localStorage.setItem("planora_focus_break", settings.breakDuration.toString());
    localStorage.setItem("planora_focus_sessions", settings.focusSessions.toString());
    localStorage.setItem("planora_focus_sound", String(settings.focusSound));
    localStorage.setItem("planora_focus_autostart", String(settings.focusAutoStart));
    
    setTimeout(() => {
      setIsSaving(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }, 800);
  };

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear all AI memory? This cannot be undone.")) {
      try {
        const token = await getToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/sessions`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) alert("AI history cleared successfully.");
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!mounted) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
            <Brain className="text-accent" />
            AI Control Center
          </h1>
          <p className="text-muted font-medium">Configure intelligence, voice, and focus parameters.</p>
        </div>
        <button suppressHydrationWarning 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-accent text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-3 shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
        >
          {isSaving ? "Saving..." : isSaved ? "Saved!" : (
            <>Save Settings <Save size={18} /></>
          )}
        </button>
      </header>

      {/* Main Power Switch */}
      <div className="glass-card p-6 border-l-4 border-l-emerald-500 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${settings.aiPower ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
            <Zap size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold">AI Master Power</h3>
            <p className="text-sm text-muted mt-1">When disabled, Planora AI will not process any queries.</p>
          </div>
        </div>
        <button suppressHydrationWarning 
          onClick={() => setSettings({...settings, aiPower: !settings.aiPower})}
          className={`w-14 h-7 rounded-full transition-all relative ${settings.aiPower ? 'bg-emerald-500' : 'bg-secondary'}`}
        >
          <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${settings.aiPower ? 'left-8' : 'left-1'}`} />
        </button>
      </div>

      <div className={`space-y-10 transition-all duration-500 ${settings.aiPower ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Intelligence & Model */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Cpu className="text-accent w-5 h-5" />
              <h2 className="text-lg font-bold">Core Intelligence</h2>
            </div>
            
            <div className="glass-card p-6 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-bold">Inference Model</p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    {id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", desc: "Balanced & Fast"},
                    {id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1", desc: "Advanced Reasoning"}
                  ].map(m => (
                    <button suppressHydrationWarning 
                      key={m.id}
                      onClick={() => setSettings({...settings, model: m.id})}
                      className={`text-left px-4 py-3 rounded-xl border transition-all ${settings.model === m.id ? 'border-accent bg-accent/5 text-accent' : 'border-card-border hover:border-accent/50'}`}
                    >
                      <p className="text-xs font-black">{m.name}</p>
                      <p className="text-[10px] opacity-70">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold">Intelligence Level</p>
                <div className="flex gap-2">
                  {["Basic", "Standard", "Advanced"].map(level => (
                    <button suppressHydrationWarning 
                      key={level}
                      onClick={() => setSettings({...settings, intelligence: level})}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${settings.intelligence === level ? 'bg-accent/10 border-accent text-accent' : 'bg-secondary/30 border-card-border text-muted'}`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold">Response Style</p>
                <div className="flex gap-2">
                  {["Concise", "Detailed"].map(style => (
                    <button suppressHydrationWarning 
                      key={style}
                      onClick={() => setSettings({...settings, responseStyle: style})}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${settings.responseStyle === style ? 'bg-accent/10 border-accent text-accent' : 'bg-secondary/30 border-card-border text-muted'}`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Voice & Accessibility */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Mic className="text-accent w-5 h-5" />
              <h2 className="text-lg font-bold">Voice & Interaction</h2>
            </div>
            
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Wake Word Detection</p>
                  <p className="text-xs text-muted">Listen for "Hey Planora"</p>
                </div>
                <button suppressHydrationWarning 
                  onClick={() => setSettings({...settings, wakeWord: !settings.wakeWord})}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.wakeWord ? 'bg-accent' : 'bg-secondary'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.wakeWord ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">Read Aloud Responses</p>
                  <p className="text-xs text-muted">AI will speak back to you</p>
                </div>
                <button suppressHydrationWarning 
                  onClick={() => setSettings({...settings, readAloud: !settings.readAloud})}
                  className={`w-12 h-6 rounded-full transition-all relative ${settings.readAloud ? 'bg-accent' : 'bg-secondary'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.readAloud ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Speech Rate</span>
                  <span className="text-accent">{settings.speechRate}x</span>
                </div>
                <input suppressHydrationWarning 
                  type="range" min="0.5" max="2" step="0.1" 
                  value={settings.speechRate}
                  onChange={(e) => setSettings({...settings, speechRate: parseFloat(e.target.value)})}
                  className="w-full accent-accent h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold">Assistant Voice</p>
                <select 
                  value={settings.voiceName}
                  onChange={(e) => setSettings({...settings, voiceName: e.target.value})}
                  className="w-full bg-secondary border border-card-border rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-accent"
                >
                  <option value="">System Default</option>
                  {availableVoices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Focus Mode Restored */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Clock className="text-orange-500 w-5 h-5" />
              <h2 className="text-lg font-bold">Focus Mode</h2>
            </div>
            
            <div className="glass-card p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-muted uppercase">Work Duration</p>
                  <div className="flex items-center gap-3 bg-secondary rounded-xl px-3 py-2">
                    <button suppressHydrationWarning onClick={() => setSettings({...settings, workDuration: Math.max(5, settings.workDuration-5)})} className="text-muted hover:text-foreground">-</button>
                    <span className="flex-1 text-center font-bold text-sm">{settings.workDuration}m</span>
                    <button suppressHydrationWarning onClick={() => setSettings({...settings, workDuration: settings.workDuration+5})} className="text-muted hover:text-foreground">+</button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-muted uppercase">Break Duration</p>
                  <div className="flex items-center gap-3 bg-secondary rounded-xl px-3 py-2">
                    <button suppressHydrationWarning onClick={() => setSettings({...settings, breakDuration: Math.max(1, settings.breakDuration-1)})} className="text-muted hover:text-foreground">-</button>
                    <span className="flex-1 text-center font-bold text-sm">{settings.breakDuration}m</span>
                    <button suppressHydrationWarning onClick={() => setSettings({...settings, breakDuration: settings.breakDuration+1})} className="text-muted hover:text-foreground">+</button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold">Sessions Before Long Break</p>
                <div className="flex gap-2">
                  {[2, 4, 6].map(num => (
                    <button suppressHydrationWarning 
                      key={num}
                      onClick={() => setSettings({...settings, focusSessions: num})}
                      className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${settings.focusSessions === num ? 'bg-orange-500/10 border-orange-500 text-orange-500' : 'bg-secondary/30 border-card-border text-muted'}`}
                    >
                      {num} Sessions
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BellRing size={16} className="text-orange-400" />
                    <span className="text-xs font-bold">Sound Notifications</span>
                  </div>
                  <button suppressHydrationWarning 
                    onClick={() => setSettings({...settings, focusSound: !settings.focusSound})}
                    className={`w-10 h-5 rounded-full relative transition-all ${settings.focusSound ? 'bg-orange-500' : 'bg-secondary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings.focusSound ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCcw size={16} className="text-orange-400" />
                    <span className="text-xs font-bold">Auto-start Breaks</span>
                  </div>
                  <button suppressHydrationWarning 
                    onClick={() => setSettings({...settings, focusAutoStart: !settings.focusAutoStart})}
                    className={`w-10 h-5 rounded-full relative transition-all ${settings.focusAutoStart ? 'bg-orange-500' : 'bg-secondary'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings.focusAutoStart ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Data & Privacy */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Shield className="text-emerald-500 w-5 h-5" />
              <h2 className="text-lg font-bold">Data & Memory</h2>
            </div>
            
            <div className="glass-card p-6 space-y-6">
              <p className="text-xs text-muted leading-relaxed">
                Planora remembers your preferences to build better plans. You can export or wipe this data at any time.
              </p>
              
              <div className="flex flex-col gap-3">
                <button suppressHydrationWarning className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary hover:bg-card-border border border-card-border rounded-xl text-xs font-bold transition-all">
                  <Download size={14} /> Export AI History (.JSON)
                </button>
                <button suppressHydrationWarning 
                  onClick={handleClearHistory}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold transition-all"
                >
                  <Trash2 size={14} /> Clear All Memory
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

