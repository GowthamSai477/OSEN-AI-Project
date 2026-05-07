"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, Loader2, Zap, CheckCircle2, MessageSquare, Plus, Menu, X, Trash2, Target, Database, Mic, Volume2, Activity, Play, Globe, CreditCard, List, ExternalLink, Book, Award, Calendar, Pencil } from "lucide-react";
import { useAuth, useUser } from "@clerk/nextjs";
import { cachedFetch, invalidateChat } from "@/lib/api-helpers";
import SandyLoading from "@/components/SandyLoading";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: any[];
  status?: string;
  type?: string;
  message_type?: string;
};

type Session = {
  id: string;
  title: string;
  created_at: string;
};

export default function AIAssistant() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm Planora, your AI planning agent. I can help you build your schedule, track your goals, or adjust your tasks if life gets in the way. What would you like to plan today?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "planner" | "study">("chat");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState<string | null>(null);
  const [deleteStatuses, setDeleteStatuses] = useState<Record<string, "pending" | "deleted" | "cancelled">>({});
  const [quickActions, setQuickActions] = useState({
    chat: ["What are my plans today?", "What are my important tasks?", "Summarize my week"],
    planner: ["Weight Loss Goal", "Study Plan", "Add Recurring Task"],
    study: ["I want to learn Cyber Security", "Teach me Python from scratch", "Learn UI Design", "Master React.js"]
  });
  const [showResources, setShowResources] = useState(false);
  const [currentStudyResources, setCurrentStudyResources] = useState<any>(null);
  const [showSyncConfirmation, setShowSyncConfirmation] = useState(false);
  const [syncData, setSyncData] = useState<{ topic: string, path: any[], availableLinks: any[] } | null>(null);
  const [selectedLinks, setSelectedLinks] = useState<{ [weekIndex: number]: string[] }>({});

  // Voice Assistant States
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false); // mirrors localStorage, drives the toggle effect
  const [transcript, setTranscript] = useState("");
  const recognitionRef      = useRef<any>(null);
  const wakeRecognizerRef   = useRef<any>(null);        // current wake word recognizer instance
  const wakeWordEnabledRef  = useRef(false);            // stable ref — avoids stale closure in onend
  const wakeWordDetectedRef = useRef(false);            // prevents onend from restarting after intentional stop
  const isVoiceSupported = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const voiceStateRef = useRef<"idle" | "listening" | "processing" | "speaking">("idle");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const savedMode = localStorage.getItem("planora_ai_mode") as "chat" | "planner" | "study";
    if (savedMode === "chat" || savedMode === "planner" || savedMode === "study") {
      setMode(savedMode);
    }

    const savedActions = localStorage.getItem("planora_quick_actions");
    if (savedActions) {
      try {
        setQuickActions(JSON.parse(savedActions));
      } catch (e) {
        console.error("Failed to parse quick actions", e);
      }
    }

    // Check for template prompt
    const templatePrompt = sessionStorage.getItem("planora_template_prompt");
    const templateMode = sessionStorage.getItem("planora_template_mode");
    if (templatePrompt) {
      sessionStorage.removeItem("planora_template_prompt");
      sessionStorage.removeItem("planora_template_mode");
      if (templateMode === "planner") setMode("planner");
      setTimeout(() => sendMessage(undefined, templatePrompt), 800);
    }

    // Voice Initialization — command recognizer only (wake word handled separately below)
    if (isVoiceSupported) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous     = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognitionRef.current.onend = () => {
        setVoiceState(prev => {
          if (prev === "listening") return "processing";
          return prev;
        });
      };
    }

    // Seed wakeWordEnabled state from localStorage on mount
    const wakeEnabled = localStorage.getItem("planora_voice_wake_word") === "true";
    wakeWordEnabledRef.current = wakeEnabled;
    if (wakeEnabled) setWakeWordEnabled(true);

    return () => {
      if (recognitionRef.current)  recognitionRef.current.abort();
      if (wakeRecognizerRef.current) {
        try { wakeRecognizerRef.current.stop(); } catch (e) {}
        wakeRecognizerRef.current = null;
      }
      wakeWordEnabledRef.current = false;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user]);

  // ─── Keep wakeWordEnabledRef in sync with wakeWordEnabled state ───────────
  useEffect(() => {
    wakeWordEnabledRef.current = wakeWordEnabled;
  }, [wakeWordEnabled]);

  // ─── React to wakeWordEnabled toggle: start or stop detection ────────────
  useEffect(() => {
    if (!isVoiceSupported) return;

    if (wakeWordEnabled) {
      startWakeWordDetection();
    } else {
      wakeWordEnabledRef.current = false;
      if (wakeRecognizerRef.current) {
        try { wakeRecognizerRef.current.stop(); } catch (e) {}
        wakeRecognizerRef.current = null;
      }
      setWakeWordActive(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeWordEnabled]);

  // Keep voiceStateRef in sync with voiceState
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);

  useEffect(() => {
    if (voiceState === "processing" && transcript) {
      sendMessage(undefined, transcript);
      setTranscript("");
    }
  }, [voiceState]);

  // ─── Wake Word Detection Function ─────────────────────────────────────────
  // Creates a FRESH recognizer instance each call so there's no stale state.
  const startWakeWordDetection = () => {
    if (!isVoiceSupported) {
      console.log("[WakeWord] SpeechRecognition not supported");
      return;
    }
    // Don't start a second instance if one is already running
    if (wakeRecognizerRef.current) {
      console.log("[WakeWord] Already running — skip");
      return;
    }

    console.log("[WakeWord] Starting wake word detection...");
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const wakeRecognizer = new SpeechRecognition();
    wakeRecognizer.continuous      = true;
    wakeRecognizer.interimResults  = true;
    wakeRecognizer.maxAlternatives = 3;
    wakeRecognizer.lang            = "en-US";

    wakeRecognizer.onstart = () => {
      console.log("[WakeWord] Recognizer started — listening for wake word");
      setWakeWordActive(true);
    };

    wakeRecognizer.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        for (let alt = 0; alt < event.results[i].length; alt++) {
          const text = event.results[i][alt].transcript.toLowerCase().trim();
          console.log("[WakeWord] Heard:", text);

          if (
            text.includes("hey planora") ||
            text.includes("planora")     ||
            text.includes("hey flora")   ||
            text.includes("hey planner") ||
            text.includes("hi planora")
          ) {
            console.log("[WakeWord] Wake word detected! Activating...");
            wakeWordDetectedRef.current = true;
            wakeRecognizer.stop();
            setTimeout(() => activateVoiceListening(), 500);
            return;
          }
        }
      }
    };

    wakeRecognizer.onerror = (event: any) => {
      console.log("[WakeWord] Error:", event.error);
      if (event.error === "not-allowed") {
        console.log("[WakeWord] Microphone permission denied");
        wakeWordEnabledRef.current = false;
        setWakeWordEnabled(false);
        setWakeWordActive(false);
      }
      // no-speech / audio-capture are normal — onend will restart
    };

    wakeRecognizer.onend = () => {
      console.log("[WakeWord] Recognizer ended. enabled:", wakeWordEnabledRef.current, "detected:", wakeWordDetectedRef.current);
      wakeRecognizerRef.current = null; // clear so startWakeWordDetection() can create a fresh one
      wakeWordDetectedRef.current = false;

      if (wakeWordEnabledRef.current) {
        console.log("[WakeWord] Restarting wake word detection in 1s...");
        setTimeout(() => {
          // Only restart when the command recognizer is idle too
          if (wakeWordEnabledRef.current && voiceStateRef.current === "idle") {
            startWakeWordDetection();
          } else {
            console.log("[WakeWord] Command recognizer still active — will resume after it ends");
          }
        }, 1000);
      } else {
        console.log("[WakeWord] Wake word disabled — not restarting");
        setWakeWordActive(false);
      }
    };

    try {
      wakeRecognizer.start();
      wakeRecognizerRef.current = wakeRecognizer;
    } catch (e) {
      console.log("[WakeWord] Failed to start:", e);
      wakeRecognizerRef.current = null;
    }
  };

  const activateVoiceListening = () => {
    if (!isVoiceSupported) return;
    setTranscript("");

    // Kill any running wake word recognizer
    if (wakeRecognizerRef.current) {
      try { wakeRecognizerRef.current.stop(); } catch (e) { /* ignore */ }
      wakeRecognizerRef.current = null;
    }

    // Stop command recognizer if somehow already running
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }

    setVoiceState("listening");
    voiceStateRef.current = "listening";

    // 200ms delay to let both recognizers fully stop before restarting
    setTimeout(() => {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("[Voice] Could not start recognition:", e);
        setVoiceState("idle");
        voiceStateRef.current = "idle";
        // If wake word is enabled, resume it
        if (wakeWordEnabledRef.current) startWakeWordDetection();
      }
    }, 200);
  };

  const stopVoiceListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setVoiceState("idle");
    voiceStateRef.current = "idle";
    // Resume wake word detection after command session ends
    if (wakeWordEnabledRef.current) {
      console.log("[WakeWord] Command ended — resuming wake word detection");
      setTimeout(() => startWakeWordDetection(), 500);
    }
  };

  const speakResponse = (text: string) => {
    if (!window.speechSynthesis || localStorage.getItem("planora_voice_read_aloud") !== "true") {
      setVoiceState("idle");
      voiceStateRef.current = "idle";
      if (wakeWordEnabledRef.current) setTimeout(() => startWakeWordDetection(), 500);
      return;
    }

    // Clean markdown formatting before speaking
    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/`/g, "")
      .replace(/\n/g, ". ");

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);

    const savedRate = localStorage.getItem("planora_speech_rate") || localStorage.getItem("planora_voice_rate");
    if (savedRate) utterance.rate = parseFloat(savedRate);

    const savedVoice = localStorage.getItem("planora_voice_name") || localStorage.getItem("planora_voice_selection");
    if (savedVoice) {
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.name === savedVoice);
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => { setVoiceState("speaking"); voiceStateRef.current = "speaking"; };
    utterance.onend   = () => {
      setVoiceState("idle");
      voiceStateRef.current = "idle";
      if (wakeWordEnabledRef.current) {
        console.log("[WakeWord] TTS ended — resuming wake word detection");
        setTimeout(() => startWakeWordDetection(), 500);
      }
    };

    setVoiceState("speaking");
    window.speechSynthesis.speak(utterance);
  };

  const fetchSessions = async (force: boolean = false) => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await cachedFetch<Session[]>(
        `sessions_${user.id}`, 
        `${process.env.NEXT_PUBLIC_API_URL}/api/ai/sessions`, 
        token, 
        60000, // Reduce cache to 1 minute for better responsiveness
        force
      );
      if (data) setSessions(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/sessions/${sessionId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setMessages(data);
          
          // Smart Mode Detection: If session has study-specific actions, switch to study mode
          const hasStudyActions = data.some((m: any) => m.actions?.some((a: any) => a.function.name === "display_study_resources"));
          if (hasStudyActions) {
            setMode("study");
            const lastStudyActionMsg = data.slice().reverse().find((m: any) => m.actions?.some((a: any) => a.function.name === "display_study_resources"));
            const action = lastStudyActionMsg.actions.find((a: any) => a.function.name === "display_study_resources");
            const args = typeof action.function.arguments === "string" ? JSON.parse(action.function.arguments) : action.function.arguments;
            setCurrentStudyResources(args);
          } else {
            // Default to chat if no study markers found
            // This prevents switching back to study-welcome text incorrectly
            if (mode === "study") setMode("chat");
            setCurrentStudyResources(null);
          }
        } else {
          startNewChat();
        }
        setActiveSessionId(sessionId);
        sessionStorage.setItem("planora_active_session", sessionId);
      }
    } catch (e) {
      console.error("Failed to load session", e);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    sessionStorage.removeItem("planora_active_session");
    setCurrentStudyResources(null); // Clear resources from previous session
    setShowResources(false);
    
    let welcomeContent = "Hello! I'm Planora, your AI planning agent. I can help you build your schedule, track your goals, or adjust your tasks if life gets in the way. What would you like to plan today?";
    let welcomeId = "welcome";

    if (mode === "study") {
      welcomeContent = "Welcome to Study Mode! 📚 I can help you find the best resources to learn any skill. Just tell me what you want to learn, and I'll find YouTube playlists, free courses, and build a 4-week roadmap for you.";
      welcomeId = "study-welcome";
    } else if (mode === "planner") {
      welcomeContent = "Welcome to Planner Mode! ⚡ I'm ready to help you organize your life. Whether it's a new fitness goal, a project deadline, or a daily habit, let's build a plan that works for you.";
      welcomeId = "planner-welcome";
    }

    setMessages([
      {
        id: welcomeId,
        role: "assistant",
        content: welcomeContent,
      }
    ]);
  };

  const toggleMode = (newMode: "chat" | "planner" | "study") => {
    const prevMode = mode;
    setMode(newMode);
    localStorage.setItem("planora_ai_mode", newMode);
    
    // If we are at the very beginning (only welcome message), update it to match new mode
    if (messages.length === 1 && messages[0].role === "assistant" && (messages[0].id.includes("welcome") || messages[0].id === "welcome")) {
      let content = "Hello! I'm Planora, your AI planning agent. I can help you build your schedule, track your goals, or adjust your tasks if life gets in the way. What would you like to plan today?";
      if (newMode === "study") {
        content = "Welcome to Study Mode! 📚 I can help you find the best resources to learn any skill. Just tell me what you want to learn, and I'll find YouTube playlists, free courses, and build a 4-week roadmap for you.";
      } else if (newMode === "planner") {
        content = "Welcome to Planner Mode! ⚡ I'm ready to help you organize your life. Whether it's a new fitness goal, a project deadline, or a daily habit, let's build a plan that works for you.";
      }
      
      setMessages([{
        id: `${newMode}-welcome`,
        role: "assistant",
        content: content
      }]);
    }
  };

  const addStudyPathToPlanner = (topic: string, path: any[]) => {
    // Collect all links from currentStudyResources
    const links: any[] = [];
    if (currentStudyResources?.resources) {
      const res = currentStudyResources.resources;
      if (res.youtube) res.youtube.forEach((l: any) => links.push({ ...l, type: 'youtube' }));
      if (res.free) res.free.forEach((l: any) => links.push({ ...l, type: 'free' }));
      if (res.premium) res.premium.forEach((l: any) => links.push({ ...l, type: 'premium' }));
      if (res.labs) res.labs.forEach((l: any) => links.push({ ...l, type: 'labs' }));
    }
    
    setSyncData({ topic, path, availableLinks: links });
    setShowSyncConfirmation(true);
    
    // Initialize selected links (none by default)
    const initialSelected: { [key: number]: string[] } = {};
    path.forEach((_, i) => initialSelected[i] = []);
    setSelectedLinks(initialSelected);
  };

  const handleFinalSync = async () => {
    if (!syncData) return;
    try {
      const token = await getToken();
      if (!token) return;
      setIsLoading(true);
      setShowSyncConfirmation(false);

      const tasks = syncData.path.map((week, weekIdx) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + (weekIdx * 7) + 1);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        // Get selected links for this week
        const weekLinks = selectedLinks[weekIdx] || [];
        const primaryUrl = weekLinks.length > 0 ? weekLinks[0] : null;

        return {
          title: `Study ${syncData.topic}: ${week.focus}`,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          time: "18:00",
          durationMinutes: 60,
          category: "Study",
          taskType: "recurring",
          priority: "medium",
          url: primaryUrl,
          links: weekLinks.map(url => ({ url, title: syncData.availableLinks.find(l => l.url === url)?.title || "Resource" }))
        };
      });

      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
      if (!baseUrl) {
        throw new Error("NEXT_PUBLIC_API_URL is missing");
      }

      // Direct Sync via new high-speed endpoint
      const syncRes = await fetch(`${baseUrl}/api/planner/tasks/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(tasks.map(t => ({
          task: t.title,
          date: t.startDate,
          time: t.time,
          duration_minutes: t.durationMinutes,
          category: t.category,
          task_type: t.taskType,
          priority: t.priority,
          url: t.url,
          links: t.links
        })))
      });

      if (!syncRes.ok) {
        const errText = await syncRes.text();
        console.error(`[Sync Failed] Status: ${syncRes.status}, Body:`, errText);
        throw new Error(`Sync failed: ${errText}`);
      }
      
      setSyncData(null);
      setSelectedLinks({});

      // Now tell the AI it's done so it can give a quick summary/congrats
      const aiRes = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: `I've successfully added my ${syncData.topic} study roadmap to my planner! Give me a quick high-five and one tip to stay consistent with this new schedule.`,
          mode: "chat",
          intelligence_level: "Standard",
          response_style: "Concise",
          session_id: activeSessionId
        })
      });

      if (aiRes.ok) {
        const data = await aiRes.json();
        const assistantMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: data.message,
          actions: data.parsed_actions,
          status: data.status,
          type: data.type
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
      
      invalidateChat();
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync roadmap. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModifyPlan = () => {
    if (!syncData) return;
    setShowSyncConfirmation(false);
    const modMsg = `I want to modify the study plan for ${syncData.topic}. Can you adjust the focus or duration?`;
    setInput(modMsg);
    // Optionally focus the input or send immediately
  };

  const confirmDeleteRange = async (actionId: string, startDate: string, endDate: string, messageId?: string) => {
    console.log("Delete confirmed, calling endpoint...", { actionId, startDate, endDate, messageId });
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks/delete-range`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ startDate, endDate, messageId })
      });
      if (res.ok) {
        setDeleteStatuses(prev => ({ ...prev, [actionId]: "deleted" }));
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: "I have successfully deleted those tasks for you."
        }]);
      } else {
        const errorText = await res.text();
        console.error("Backend returned error:", res.status, errorText);
        alert(`Failed to delete tasks: ${errorText}`);
      }
    } catch (e: any) {
      console.error(e);
      alert(`An error occurred while deleting tasks: ${e.message || e}`);
    }
  };

  const cancelDeleteRange = (actionId: string) => {
    setDeleteStatuses(prev => ({ ...prev, [actionId]: "cancelled" }));
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: "assistant",
      content: "Okay, I've cancelled the deletion."
    }]);
  };

  const resolveConflict = async (actionId: string, resolutionAction: string, taskData: any, messageId?: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/planner/tasks/resolve-conflict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: resolutionAction, task_data: taskData, messageId })
      });
      if (res.ok) {
        // Optimistically update the UI to show it's resolved
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, status: "resolved" } : m
        ));
        
        let reply = "I've resolved the conflict.";
        if (resolutionAction === "replace") reply = "I've replaced the old task with the new one.";
        if (resolutionAction === "find_next_free_slot") reply = "I've found the next available time slot and scheduled it there.";
        if (resolutionAction === "keep_both") reply = "I've scheduled the new task alongside the existing one.";
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: reply
        }]);
      }
    } catch (e) {
      console.error("Failed to resolve conflict", e);
    }
  };

  const sendMessage = async (e?: React.FormEvent, customMsg?: string) => {
    if (e) e.preventDefault();

    const messageToSend = customMsg || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: messageToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const token = await getToken();

      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10) // Only send the last 10 messages to keep the prompt small and fast
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const aiPower = localStorage.getItem("planora_ai_power");
      if (aiPower === "false") {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant",
          content: "AI processing is currently disabled in your Settings."
        }]);
        setIsLoading(false);
        return;
      }

      const payload: any = {
        message: userMsg.content,
        history: history,
        mode: mode,
        intelligence_level: localStorage.getItem("planora_ai_intelligence") || "Standard",
        response_style: localStorage.getItem("planora_ai_response_style") || "Concise"
      };

      if (activeSessionId) {
        payload.session_id = activeSessionId;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // Even if AI part fails, backend might have created a session
      if (data.session_id && data.session_id !== activeSessionId) {
        setActiveSessionId(data.session_id);
        localStorage.setItem("planora_active_session", data.session_id);
        fetchSessions(true); // Force refresh history to show new session
      }

      if (!res.ok) {
        throw new Error(data.message || "Failed to communicate with AI");
      }

      const assistantMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.message || "",
        actions: data.parsed_actions,
        status: data.status
      };
      setMessages(prev => [...prev, assistantMsg]);
      
      // Auto-open resources if provided
      const studyAction = data.parsed_actions?.find((a: any) => a.function.name === "display_study_resources");
      if (studyAction) {
        const args = typeof studyAction.function.arguments === "string" ? JSON.parse(studyAction.function.arguments) : studyAction.function.arguments;
        setCurrentStudyResources(args);
        setTimeout(() => setShowResources(true), 1000);
      }

      // Speak plain-text responses (not action cards, not errors)
      if (data.message && !data.parsed_actions?.length) {
        speakResponse(data.message);
      }

    } catch (error: any) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: error.message || "Sorry, I ran into an error trying to process that."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderActionCard = (action: any, messageId?: string, messageStatus?: string, msgType?: string) => {
    try {
      const args = typeof action.function.arguments === "string"
        ? JSON.parse(action.function.arguments)
        : action.function.arguments;

      if (action.function.name === "execute_planner_plan") {
        return (
          <div className="bg-card p-5 rounded-xl border border-primary/30 mt-3 shadow-lg shadow-primary/5 text-left w-full max-w-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CheckCircle2 className="w-5 h-5" />
                <span>Goal Plan Generated</span>
              </div>
              <div className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase tracking-wider rounded border border-green-500/20 flex items-center gap-1">
                <Zap className="w-3 h-3" /> High Confidence
              </div>
            </div>
            <h4 className="font-bold text-lg text-foreground">{args.goal?.title || "Your New Plan"}</h4>
            <p className="text-sm text-muted mt-2 leading-relaxed">{args.summary}</p>
            <div className="mt-5 flex gap-3">
              <Link href="/dashboard/schedule" className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors inline-block">
                View Plan in Timetable
              </Link>
            </div>
          </div>
        );
      }
      
      if (action.function.name === "display_study_resources") {
        const { topic, resources } = args;
        return (
          <div className="bg-card/80 backdrop-blur-xl p-6 rounded-2xl border border-primary/20 mt-4 shadow-2xl shadow-primary/5 text-left w-full max-w-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Book className="w-24 h-24 text-primary" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Learning: {topic}</h3>
                <p className="text-xs text-muted">AI-Curated Resources & Path</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-10">
              {/* YouTube Section */}
              <div className="bg-surface/50 border border-card-border/50 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-red-500 font-bold text-sm mb-3">
                  <Play className="w-4 h-4" /> YouTube Playlists
                </div>
                <div className="space-y-3">
                  {resources.youtube?.map((item: any, i: number) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{item.title}</div>
                      <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                        {item.channel} • <ExternalLink className="w-2.5 h-2.5" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Free Resources */}
              <div className="bg-surface/50 border border-card-border/50 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-sm mb-3">
                  <Globe className="w-4 h-4" /> Free Resources
                </div>
                <div className="space-y-3">
                  {resources.free?.map((item: any, i: number) => (
                    <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                      <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{item.title}</div>
                      <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                        {item.provider} • <ExternalLink className="w-2.5 h-2.5" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Labs Section */}
              {resources.labs && resources.labs.length > 0 && (
                <div className="bg-surface/50 border border-card-border/50 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm mb-3">
                    <Activity className="w-4 h-4" /> Practical Labs
                  </div>
                  <div className="space-y-3">
                    {resources.labs.map((item: any, i: number) => (
                      <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                        <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{item.title}</div>
                        <div className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                          {item.description?.substring(0, 40)}... • <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Premium Resources */}
            <div className="bg-gradient-to-r from-amber-500/5 to-purple-500/5 border border-amber-500/20 p-4 rounded-xl mb-6">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm mb-3">
                <Award className="w-4 h-4" /> Premium Courses
              </div>
              <div className="flex flex-wrap gap-3">
                {resources.premium?.map((item: any, i: number) => (
                  <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 bg-background/50 border border-amber-500/20 rounded-lg group hover:border-amber-500/50 transition-all">
                    <div className="text-xs font-medium text-foreground group-hover:text-amber-500">{item.title}</div>
                    <div className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded font-bold uppercase">{item.price}</div>
                  </a>
                ))}
              </div>
            </div>

            {/* Structured Path */}
            <div className="bg-accent/5 border border-accent/20 p-5 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-accent font-bold text-sm">
                  <List className="w-4 h-4" /> 4-Week Roadmap
                </div>
                <button suppressHydrationWarning
                  onClick={() => addStudyPathToPlanner(topic, resources.path)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-accent text-white text-[10px] font-bold rounded-full hover:bg-accent/90 transition-all shadow-sm"
                >
                  <Calendar className="w-3 h-3" /> Sync to Planner
                </button>
              </div>
              <div className="space-y-4">
                {resources.path?.map((week: any, i: number) => (
                  <div key={i} className="relative pl-4 border-l border-accent/30">
                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-accent" />
                    <div className="text-xs font-bold text-accent mb-1">{week.week}: {week.focus}</div>
                    <div className="flex flex-wrap gap-2">
                      {week.tasks?.map((task: string, j: number) => (
                        <span key={j} className="text-[10px] bg-accent/10 text-accent/80 px-2 py-0.5 rounded border border-accent/10">{task}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }

      if (action.function.name === "execute_task_range") {
        if (messageStatus === "conflict" && action.conflict_data) {
          const conflict = action.conflict_data;
          return (
            <div className="bg-red-500/10 p-5 rounded-xl border border-red-500/30 mt-3 shadow-lg shadow-red-500/5 text-left w-full max-w-sm">
              <div className="flex items-center gap-2 text-red-500 font-bold mb-2">
                <Zap className="w-5 h-5" />
                <span>Time Conflict Detected</span>
              </div>
              <p className="text-sm text-foreground mt-2 leading-relaxed">
                You already have <span className="font-bold text-red-400">{conflict.existing_task}</span> scheduled at <span className="font-bold text-red-400">{conflict.time}</span> on {conflict.date}. What would you like to do with the new task "{conflict.requested_task}"?
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button suppressHydrationWarning
                  onClick={() => resolveConflict(action.id || JSON.stringify(args), "replace", conflict.task_data, messageId)}
                  className="w-full px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors shadow-md shadow-red-500/20"
                >
                  Replace Old Task
                </button>
                <button suppressHydrationWarning
                  onClick={() => resolveConflict(action.id || JSON.stringify(args), "find_next_free_slot", conflict.task_data, messageId)}
                  className="w-full px-4 py-2 bg-accent/20 text-accent text-sm font-bold rounded-lg hover:bg-accent/30 transition-colors"
                >
                  Find Next Free Slot
                </button>
                <button suppressHydrationWarning
                  onClick={() => resolveConflict(action.id || JSON.stringify(args), "keep_both", conflict.task_data, messageId)}
                  className="w-full px-4 py-2 bg-secondary text-foreground text-sm font-bold rounded-lg hover:bg-card-border border border-card-border transition-colors"
                >
                  Keep Both
                </button>
              </div>
            </div>
          );
        }

        if (messageStatus === "resolved") {
          return (
            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 mt-3 text-left w-full max-w-sm">
              <p className="text-emerald-500 font-medium text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Conflict Resolved Successfully
              </p>
            </div>
          );
        }

        return (
          <div className="bg-card p-5 rounded-xl border border-accent/30 mt-3 shadow-lg shadow-accent/5 text-left w-full max-w-sm">
            <div className="flex items-center gap-2 text-accent font-semibold mb-2">
              <Zap className="w-5 h-5" />
              <span>Tasks Scheduled</span>
            </div>
            <p className="text-sm text-muted leading-relaxed">{args.summary}</p>
            <div className="mt-5 flex gap-3">
              <Link href="/dashboard/schedule" className="px-4 py-2 bg-accent/20 text-accent text-sm font-medium rounded-lg hover:bg-accent/30 transition-colors inline-block">
                View Schedule
              </Link>
            </div>
          </div>
        );
      }

      if (action.function.name === "delete_task_range" || msgType === "delete_pending" || msgType === "delete_confirmed") {
        const actionId = action.id || JSON.stringify(args);
        const status = (messageStatus === "confirmed" || msgType === "delete_confirmed") ? "deleted" : (deleteStatuses[actionId] || "pending");

        if (status === "deleted") {
          return (
            <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 mt-3 text-left w-full max-w-sm">
              <p className="text-emerald-500 font-medium text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Tasks Deleted Successfully
              </p>
            </div>
          );
        }

        if (status === "cancelled") {
          return (
            <div className="bg-secondary p-4 rounded-xl border border-card-border mt-3 text-left w-full max-w-sm">
              <p className="text-muted font-medium text-sm flex items-center gap-2">
                <X className="w-4 h-4" /> Deletion Cancelled
              </p>
            </div>
          );
        }

        return (
          <div className="bg-red-500/10 p-5 rounded-xl border border-red-500/30 mt-3 shadow-lg shadow-red-500/5 text-left w-full max-w-sm">
            <div className="flex items-center gap-2 text-red-500 font-bold mb-2">
              <Trash2 className="w-5 h-5" />
              <span>Confirm Deletion</span>
            </div>
            <p className="text-sm text-foreground mt-2 leading-relaxed">
              Are you sure you want to delete tasks from <span className="font-bold text-red-400">{args.startDate}</span> to <span className="font-bold text-red-400">{args.endDate}</span>?
            </p>
            <div className="mt-5 flex gap-3">
              <button suppressHydrationWarning
                onClick={() => confirmDeleteRange(actionId, args.startDate, args.endDate, messageId)}
                className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-colors shadow-md shadow-red-500/20"
              >
                Yes, Delete
              </button>
              <button suppressHydrationWarning
                onClick={() => cancelDeleteRange(actionId)}
                className="px-4 py-2 bg-secondary text-foreground text-sm font-bold rounded-lg hover:bg-card-border border border-card-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="bg-secondary p-3 rounded-xl border border-card-border text-xs mt-3 text-left w-full max-w-sm">
          <p className="text-muted font-medium mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-500" /> Action Executed: {action.function.name}
          </p>
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  const deleteSession = async (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent loading the session
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/sessions/${sessionIdToDelete}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      invalidateChat();
      setSessions(prev => prev.filter(s => s.id !== sessionIdToDelete));
        if (activeSessionId === sessionIdToDelete) {
          setActiveSessionId(null);
          setMessages([]);
        }
    } catch (e) {
      console.error("Failed to delete session", e);
    }
  };

  if (!mounted) return (
    <div className="flex h-screen items-center justify-center">
      <SandyLoading />
    </div>
  );

  return (
    <div suppressHydrationWarning className="h-full flex glass-panel overflow-hidden">

      {/* Mobile Sidebar Overlay */}
      <div className={`md:hidden absolute inset-0 bg-black/50 z-40 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)} />

      {/* Sessions Sidebar */}
      <div className={`absolute md:relative left-0 top-0 bottom-0 border-r border-card-border bg-card/90 md:bg-card/60 backdrop-blur-2xl flex flex-col transition-all duration-300 ease-in-out z-50 ${sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72 md:w-0 md:translate-x-0 md:opacity-0'}`}>
        <div className="h-16 border-b border-card-border/50 flex justify-between items-center px-4">
          <span className="font-semibold text-foreground tracking-tight">Chat History</span>
          <button suppressHydrationWarning onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-md hover:bg-secondary text-muted hover:text-foreground transition-colors md:hidden">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {sessions.map(session => (
            <div key={session.id} className="relative group">
              <button suppressHydrationWarning
                onClick={() => loadSession(session.id)}
                className={`w-full text-left px-3 py-3 rounded-xl text-sm truncate transition-all duration-300 flex items-center gap-3 pr-8 relative overflow-hidden ${activeSessionId === session.id
                    ? "bg-accent/10 text-accent font-medium shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-secondary/50"
                  }`}
              >
                {activeSessionId === session.id && (
                  <motion.div layoutId="activeChatIndicator" className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                )}
                <MessageSquare size={14} className={`shrink-0 ${activeSessionId === session.id ? 'text-accent' : ''}`} />
                <span className="truncate z-10">{session.title}</span>
              </button>
              <button suppressHydrationWarning
                onClick={(e) => deleteSession(session.id, e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-secondary shadow-sm"
                title="Delete chat"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.02] pointer-events-none" />

        {/* Floating VOICE ACTIVE badge removed — status shown as dot on mic icon instead */}

        <div className="border-b border-card-border/50 bg-card/40 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between px-4 py-2 md:h-16 z-10 gap-3 md:gap-0">
          <div className="flex items-center gap-3">
            <button suppressHydrationWarning
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted hover:text-foreground transition-colors mr-1 md:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-accent to-purple-500 flex items-center justify-center shrink-0 shadow-[0_0_10px_var(--color-accent-glow)]">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground tracking-tight flex items-center gap-2">
                Planora Agent
                {messages.length > 1 && (
                  <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted hidden sm:flex items-center gap-1 font-medium border border-card-border">
                    <Database className="w-3 h-3" />
                    Remembering {messages.length - 1} messages
                  </span>
                )}
              </h2>
              <p className="text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Online & Ready
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
            {/* Speaking stop button — only appears during TTS, stays compact */}
            {voiceState === "speaking" && (
              <button suppressHydrationWarning
                onClick={() => { window.speechSynthesis?.cancel(); setVoiceState("idle"); voiceStateRef.current = "idle"; }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-pink-500/15 border border-pink-500/30 text-pink-400 text-xs font-bold rounded-full hover:bg-pink-500/25 transition-colors"
              >
                🔊 Stop
              </button>
            )}

            {mounted && isVoiceSupported && (
              <div className="relative hidden md:flex">
                <button suppressHydrationWarning
                  onClick={voiceState === "idle" ? activateVoiceListening : stopVoiceListening}
                  className={`p-2.5 rounded-xl transition-all ${
                    voiceState !== "idle"
                      ? "bg-pink-500 text-white shadow-[0_0_15px_#ec4899] animate-pulse"
                      : "bg-surface border border-card-border text-foreground hover:border-pink-500 hover:text-pink-500"
                  }`}
                  title="Hey Planora Voice Assistant"
                >
                  <Mic size={20} />
                </button>
                {/* Tiny status dot on mic icon — visible only when wake word is active and idle */}
                {wakeWordActive && voiceState === "idle" && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-background animate-pulse pointer-events-none" />
                )}
              </div>
            )}

            {/* Mode Toggle - Segmented Control */}
            <div className="bg-secondary/80 p-1 rounded-xl flex items-center border border-card-border/50 relative mx-auto md:mx-0">
              <button suppressHydrationWarning
                onClick={() => toggleMode("chat")}
                className={`relative px-4 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all z-10 ${mode === "chat" ? "text-foreground" : "text-muted hover:text-foreground"
                  }`}
              >
                {mode === "chat" && (
                  <motion.div layoutId="modeToggle" className="absolute inset-0 bg-surface border border-card-border shadow-sm rounded-lg -z-10" />
                )}
                Chat
              </button>
              <button suppressHydrationWarning
                onClick={() => toggleMode("planner")}
                className={`relative px-4 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 z-10 ${mode === "planner" ? "text-foreground" : "text-muted hover:text-foreground"
                  }`}
              >
                {mode === "planner" && (
                  <motion.div layoutId="modeToggle" className="absolute inset-0 bg-gradient-to-r from-accent to-purple-500 shadow-sm rounded-lg -z-10 opacity-90" />
                )}
                <Zap size={10} className={mode === "planner" ? "text-yellow-300" : ""} /> Planner
              </button>
              <button suppressHydrationWarning
                onClick={() => toggleMode("study")}
                className={`relative px-4 py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 z-10 ${mode === "study" ? "text-foreground" : "text-muted hover:text-foreground"
                  }`}
              >
                {mode === "study" && (
                  <motion.div layoutId="modeToggle" className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 shadow-sm rounded-lg -z-10 opacity-90" />
                )}
                <Book size={10} className={mode === "study" ? "text-emerald-200" : ""} /> Study
              </button>
            </div>
            
            {currentStudyResources && (
              <button suppressHydrationWarning
                onClick={() => setShowResources(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] font-bold rounded-lg hover:bg-emerald-500/20 transition-all shadow-sm"
              >
                <Book size={14} /> Resources
              </button>
            )}

            <button suppressHydrationWarning
              onClick={startNewChat}
              className="flex items-center justify-center gap-1.5 px-3 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:py-1.5 text-xs font-semibold bg-accent/10 hover:bg-accent/20 text-accent rounded-lg transition-colors border border-accent/20 shadow-sm"
            >
              <Plus size={14} /> <span className="hidden sm:inline">New</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 z-10 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-4 max-w-[85%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === "user" ? "bg-accent/10 text-accent" : "bg-surface border border-card-border text-primary"
                  }`}>
                  {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                </div>

                <div className={`flex flex-col w-full ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  {msg.content && (
                    <div className={`px-5 py-3.5 inline-block text-left shadow-sm ${msg.role === "user"
                        ? "bg-gradient-to-br from-accent to-purple-600 text-white rounded-[24px] rounded-tr-[4px]"
                        : "bg-surface border border-card-border/60 text-foreground rounded-[24px] rounded-tl-[4px]"
                      }`}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  )}

                  {/* Render any tools called by AI */}
                  {msg.actions && msg.actions.length > 0 && renderActionCard(msg.actions[0], msg.id, msg.status, msg.type || msg.message_type)}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-4 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-surface border border-card-border flex items-center justify-center text-primary shadow-sm">
                  <Bot size={16} />
                </div>
                <div className="bg-surface border border-card-border/60 px-5 py-3.5 rounded-[24px] rounded-tl-[4px] shadow-sm flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" />
                  <span className="text-sm text-muted font-medium tracking-wide">Planora is thinking...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-background/80 backdrop-blur-xl border-t border-card-border shrink-0 flex flex-col gap-3 z-10">
          {/* Quick Action Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mask-linear-fade">
            {mode === "chat" ? (
              <>
                {quickActions.chat.map((action, i) => (
                  <Chip key={i} onClick={() => sendMessage(undefined, action)}>{action}</Chip>
                ))}
              </>
            ) : mode === "planner" ? (
              <>
                {quickActions.planner.map((action, i) => (
                  <Chip key={i} onClick={() => {
                    if (action.includes("Goal") || action.includes("Plan") || action.includes("Habit")) {
                      setShowGoalForm(action);
                    } else {
                      sendMessage(undefined, action);
                    }
                  }}>{action}</Chip>
                ))}
              </>
            ) : (
              <>
                {quickActions.study.map((action, i) => (
                  <Chip key={i} onClick={() => sendMessage(undefined, action)}>{action}</Chip>
                ))}
              </>
            )}
          </div>

          {/* Structured Goal Form */}
          <AnimatePresence>
            {showGoalForm && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: 10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: 10 }}
                className="bg-surface/80 border border-accent/20 rounded-2xl p-5 overflow-hidden shadow-lg backdrop-blur-md"
              >
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Target size={16} className="text-accent" />
                    Goal Setup Helper
                  </h4>
                  <button suppressHydrationWarning onClick={() => setShowGoalForm(null)} className="p-1 rounded-md text-muted hover:bg-secondary hover:text-foreground transition-colors"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input suppressHydrationWarning type="text" placeholder="Target (e.g. 5kg, 3 chapters)" className="bg-background text-sm p-2.5 rounded-lg border border-card-border outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-foreground" id="goal_target" />
                  <input suppressHydrationWarning type="text" placeholder="Timeline (e.g. 4 weeks)" className="bg-background text-sm p-2.5 rounded-lg border border-card-border outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-foreground" id="goal_timeline" />
                  <input suppressHydrationWarning type="text" placeholder="Current Baseline" className="bg-background text-sm p-2.5 rounded-lg border border-card-border outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-foreground" id="goal_baseline" />
                  <input suppressHydrationWarning type="text" placeholder="Constraints (Diet, Work)" className="bg-background text-sm p-2.5 rounded-lg border border-card-border outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all text-foreground" id="goal_constraints" />
                </div>
                <button suppressHydrationWarning
                  onClick={() => {
                    const t = (document.getElementById('goal_target') as HTMLInputElement)?.value;
                    const l = (document.getElementById('goal_timeline') as HTMLInputElement)?.value;
                    const b = (document.getElementById('goal_baseline') as HTMLInputElement)?.value;
                    const c = (document.getElementById('goal_constraints') as HTMLInputElement)?.value;
                    const text = `I want to set a ${showGoalForm} goal.\nTarget: ${t || 'Not set'}\nTimeline: ${l || 'Not set'}\nCurrent Level: ${b || 'Not set'}\nConstraints: ${c || 'None'}`;
                    setInput(text);
                    setShowGoalForm(null);
                  }}
                  className="w-full py-2.5 bg-accent hover:bg-purple-600 text-white rounded-xl text-sm font-bold transition-colors shadow-md shadow-accent/20"
                >
                  Apply & Send
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {voiceState !== "idle" ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full bg-surface border border-pink-500/50 rounded-2xl p-6 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.15)] relative overflow-hidden"
              >
                {voiceState === "listening" && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                      <div className="w-32 h-32 rounded-full border-[10px] border-pink-500 animate-ping"></div>
                    </div>
                    <Mic className="text-pink-500 mb-4 animate-pulse relative z-10" size={40} />
                    <h3 className="text-xl font-bold text-foreground mb-2 relative z-10">Listening...</h3>
                    <p className="text-muted text-center max-w-md min-h-[48px] relative z-10">{transcript || "Speak now..."}</p>

                    <div className="flex gap-1 mt-6 h-12 items-end justify-center w-full max-w-sm relative z-10">
                      {[...Array(20)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: ["10%", `${Math.random() * 80 + 20}%`, "10%"] }}
                          transition={{ repeat: Infinity, duration: Math.random() * 0.5 + 0.5, ease: "easeInOut" }}
                          className="w-2 bg-pink-500/80 rounded-full"
                        />
                      ))}
                    </div>

                    <button suppressHydrationWarning onClick={stopVoiceListening} className="mt-6 px-6 py-2 bg-secondary hover:bg-card-border text-foreground font-medium rounded-full transition-colors relative z-10">
                      Cancel
                    </button>
                  </>
                )}

                {voiceState === "processing" && (
                  <>
                    <Loader2 className="text-pink-500 mb-4 animate-spin" size={40} />
                    <h3 className="text-xl font-bold text-foreground mb-2">Processing...</h3>
                  </>
                )}

                {voiceState === "speaking" && (
                  <>
                    <Volume2 className="text-pink-500 mb-4 animate-pulse" size={40} />
                    <h3 className="text-xl font-bold text-foreground mb-2">Planora is speaking...</h3>
                    <div className="flex gap-1 mt-6 h-12 items-center justify-center w-full max-w-sm">
                      {[...Array(15)].map((_, i) => (
                        <motion.div
                          key={i}
                          animate={{ height: ["20%", "100%", "20%"] }}
                          transition={{ repeat: Infinity, duration: 1, delay: i * 0.1, ease: "easeInOut" }}
                          className="w-3 bg-pink-500 rounded-full"
                        />
                      ))}
                    </div>
                    <button suppressHydrationWarning onClick={() => {
                      if (window.speechSynthesis) window.speechSynthesis.cancel();
                      setVoiceState("idle");
                      voiceStateRef.current = "idle";
                      if (wakeWordEnabledRef.current) setTimeout(() => startWakeWordDetection(), 500);
                    }} className="mt-6 px-6 py-2 bg-secondary hover:bg-card-border text-foreground font-medium rounded-full transition-colors">
                      Stop Speaking
                    </button>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={sendMessage}
                className="relative flex items-center group gap-2"
              >
                {mounted && isVoiceSupported && (
                  <button suppressHydrationWarning
                    type="button"
                    onClick={voiceState === "idle" ? activateVoiceListening : stopVoiceListening}
                    className={`md:hidden flex-shrink-0 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-all ${voiceState !== "idle"
                        ? "bg-pink-500 text-white shadow-[0_0_15px_#ec4899] animate-pulse"
                        : "bg-surface border border-card-border text-muted hover:text-pink-500"
                      }`}
                  >
                    <Mic size={18} />
                  </button>
                )}
                <div className="relative flex-1">
                  <input suppressHydrationWarning
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={mode === "planner" ? "Tell me your goal or ask to schedule something..." : "Chat with Planora..."}
                    className="w-full bg-surface border border-card-border rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/10 shadow-sm transition-all text-foreground placeholder:text-muted min-h-[44px]"
                    disabled={isLoading}
                  />
                  <button suppressHydrationWarning
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-accent text-white hover:bg-purple-600 disabled:opacity-50 disabled:hover:bg-accent transition-all shadow-md group-focus-within:shadow-[0_0_15px_var(--color-accent-glow)]"
                  >
                    <Send size={18} className={input.trim() && !isLoading ? "ml-0.5" : ""} />
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Resources Overlay Sidebar */}
      <AnimatePresence>
        {showResources && currentStudyResources && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResources(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-card border-l border-card-border shadow-2xl z-[70] flex flex-col"
            >
              <div className="h-16 border-b border-card-border/50 flex justify-between items-center px-6">
                <div className="flex items-center gap-2 text-emerald-500 font-bold">
                  <Book size={18} />
                  <span>Study Resources</span>
                </div>
                <button suppressHydrationWarning onClick={() => setShowResources(false)} className="p-2 rounded-xl hover:bg-secondary text-muted hover:text-foreground transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <h3 className="text-sm font-bold text-foreground mb-1">Topic: {currentStudyResources.topic}</h3>
                  <p className="text-xs text-muted">AI-Curated roadmap and materials</p>
                </div>

                <div className="space-y-6">
                  {/* YouTube */}
                  {currentStudyResources.resources.youtube?.length > 0 && (
                    <section>
                      <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Play size={14} /> YouTube Playlists
                      </h4>
                      <div className="space-y-3">
                        {currentStudyResources.resources.youtube.map((item: any, i: number) => (
                          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-surface border border-card-border rounded-xl hover:border-red-500/50 transition-all group">
                            <div className="text-sm font-semibold text-foreground group-hover:text-red-400 transition-colors">{item.title}</div>
                            <div className="text-xs text-muted mt-1 flex justify-between">
                              <span>{item.channel}</span>
                              <ExternalLink size={12} />
                            </div>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Labs */}
                  {currentStudyResources.resources.labs?.length > 0 && (
                    <section>
                      <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Activity size={14} /> Practical Labs
                      </h4>
                      <div className="space-y-3">
                        {currentStudyResources.resources.labs.map((item: any, i: number) => (
                          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-surface border border-card-border rounded-xl hover:border-indigo-500/50 transition-all group">
                            <div className="text-sm font-semibold text-foreground group-hover:text-indigo-400 transition-colors">{item.title}</div>
                            <p className="text-[11px] text-muted mt-1 line-clamp-1">{item.description}</p>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Free */}
                  {currentStudyResources.resources.free?.length > 0 && (
                    <section>
                      <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Globe size={14} /> Free Materials
                      </h4>
                      <div className="space-y-3">
                        {currentStudyResources.resources.free.map((item: any, i: number) => (
                          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-3 bg-surface border border-card-border rounded-xl hover:border-emerald-500/50 transition-all group">
                            <div className="text-sm font-semibold text-foreground group-hover:text-emerald-400 transition-colors">{item.title}</div>
                            <div className="text-[11px] text-muted mt-1">{item.provider}</div>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Premium */}
                  {currentStudyResources.resources.premium?.length > 0 && (
                    <section>
                      <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Award size={14} /> Premium Courses
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {currentStudyResources.resources.premium.map((item: any, i: number) => (
                          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[120px] p-3 bg-surface border border-card-border rounded-xl hover:border-amber-500/50 transition-all group">
                            <div className="text-xs font-bold text-foreground group-hover:text-amber-400 transition-colors">{item.title}</div>
                            <div className="text-[10px] text-amber-500 font-bold mt-1 uppercase">{item.price}</div>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Roadmap */}
                  {currentStudyResources.resources.path?.length > 0 && (
                    <section className="bg-secondary/30 p-5 rounded-2xl border border-card-border">
                      <h4 className="text-xs font-bold text-accent uppercase tracking-widest mb-4 flex items-center gap-2">
                        <List size={14} /> Learning Roadmap
                      </h4>
                      <div className="space-y-6">
                        {currentStudyResources.resources.path.map((week: any, i: number) => (
                          <div key={i} className="relative pl-6 border-l-2 border-accent/20">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-card border-2 border-accent flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                            </div>
                            <div className="text-xs font-bold text-foreground mb-1">{week.week}: {week.focus}</div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {week.tasks?.map((t: string, j: number) => (
                                <span key={j} className="text-[9px] bg-accent/5 text-accent border border-accent/10 px-2 py-0.5 rounded-md font-medium">{t}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button suppressHydrationWarning
                        onClick={() => addStudyPathToPlanner(currentStudyResources.topic, currentStudyResources.resources.path)}
                        className="w-full mt-6 py-3 bg-accent text-white text-xs font-bold rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                      >
                        <Calendar size={14} /> Sync this path to Planner
                      </button>
                    </section>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Study Sync Confirmation Modal */}
      <AnimatePresence>
        {showSyncConfirmation && syncData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card border border-card-border rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-card-border/50 flex justify-between items-center bg-secondary/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center shadow-sm">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Sync Study Path</h3>
                    <p className="text-xs text-muted">Topic: {syncData.topic}</p>
                  </div>
                </div>
                <button suppressHydrationWarning onClick={() => setShowSyncConfirmation(false)} className="p-2 hover:bg-secondary rounded-xl text-muted hover:text-foreground transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Path Preview */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                      <List size={16} className="text-accent" />
                      Roadmap Preview
                    </h4>
                    <div className="space-y-4">
                      {syncData.path.map((week: any, idx: number) => (
                        <div key={idx} className="relative pl-6 border-l-2 border-accent/20 py-1">
                          <div className="absolute -left-[9px] top-2 w-4 h-4 rounded-full bg-card border-2 border-accent" />
                          <div className="text-xs font-bold text-foreground">{week.week}: {week.focus}</div>
                          <div className="text-[10px] text-muted mt-1">{week.tasks.join(', ')}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right: Link Selection */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                      <Globe size={16} className="text-emerald-500" />
                      Select Resources to Include
                    </h4>
                    <p className="text-[10px] text-muted italic">Select links to attach to each week's tasks</p>
                    
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                      {syncData.path.map((week: any, weekIdx: number) => (
                        <div key={weekIdx} className="bg-secondary/20 p-4 rounded-2xl border border-card-border/50">
                          <div className="text-xs font-bold text-foreground mb-3">{week.week} Resources</div>
                          <div className="space-y-2">
                            {syncData.availableLinks.map((link: any, linkIdx: number) => (
                              <label key={linkIdx} className="flex items-center gap-3 p-2 bg-surface border border-card-border/50 rounded-lg cursor-pointer hover:border-accent/30 transition-all group">
                                <input suppressHydrationWarning
                                  type="checkbox"
                                  checked={selectedLinks[weekIdx]?.includes(link.url)}
                                  onChange={(e) => {
                                    const current = [...(selectedLinks[weekIdx] || [])];
                                    if (e.target.checked) {
                                      current.push(link.url);
                                    } else {
                                      const i = current.indexOf(link.url);
                                      if (i > -1) current.splice(i, 1);
                                    }
                                    setSelectedLinks({ ...selectedLinks, [weekIdx]: current });
                                  }}
                                  className="w-4 h-4 rounded border-card-border text-accent focus:ring-accent accent-accent"
                                />
                                <div className="min-w-0">
                                  <div className="text-[11px] font-semibold truncate group-hover:text-accent transition-colors">{link.title}</div>
                                  <div className="text-[9px] text-muted truncate flex items-center gap-1">
                                    {link.type === 'youtube' ? <Play size={10} className="text-red-500" /> : <Globe size={10} className="text-emerald-500" />}
                                    {link.channel || link.provider || 'Web'}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-card-border/50 bg-secondary/30 flex flex-col sm:flex-row gap-3">
                <button suppressHydrationWarning
                  onClick={handleFinalSync}
                  className="flex-1 py-3 bg-accent text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 hover:bg-purple-600 transition-all flex items-center justify-center gap-2"
                >
                  <Calendar size={16} /> Add to Planner
                </button>
                <button suppressHydrationWarning
                  onClick={handleModifyPlan}
                  className="flex-1 py-3 bg-secondary border border-card-border text-foreground rounded-xl text-sm font-bold hover:bg-card-border transition-all flex items-center justify-center gap-2"
                >
                  <Pencil size={16} /> Modify Plan
                </button>
                <button suppressHydrationWarning
                  onClick={() => setShowSyncConfirmation(false)}
                  className="px-6 py-3 text-muted hover:text-foreground text-sm font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode, onClick: () => void }) {
  return (
    <button suppressHydrationWarning
      onClick={onClick}
      className="whitespace-nowrap px-4 py-2 bg-surface hover:bg-secondary border border-card-border hover:border-accent/30 rounded-full text-xs font-medium text-muted hover:text-foreground transition-all duration-300 hover:shadow-[0_0_10px_var(--color-accent-glow)]"
    >
      {children}
    </button>
  );
}

