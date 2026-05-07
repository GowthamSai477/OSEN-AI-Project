"use client";

import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { SignInButton, useUser } from "@clerk/nextjs";
import { 
  Brain, RefreshCw, MessageSquareText, Target, BarChart3, 
  ShieldCheck, Play, Sun, Moon, ArrowRight, CheckCircle2, 
  Sparkles, Zap, Smartphone, Globe, Layers, Rocket
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

// ──────────────────────────────────────────────────────────────────────────────
// PREMIUM COMPONENTS
// ──────────────────────────────────────────────────────────────────────────────

const FadeInWhenVisible = ({ children, delay = 0, className = "" }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Underwater Caustics Effect
 * Simulates moving light through water using layered gradients and SVG filters
 */
const UnderwaterEffect = ({ isDark }: { isDark: boolean }) => {
  if (!isDark) return null;
  
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
      <motion.div 
        animate={{ 
          rotate: [0, 360],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_50%)]"
      />
      <motion.div 
        animate={{ 
          x: [-10, 10, -10],
          y: [-10, 10, -10],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"
      />
      {/* Caustics SVG Filter Layer */}
      <svg className="absolute inset-0 w-full h-full">
        <filter id="caustics">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="20" />
        </filter>
        <rect width="100%" height="100%" fill="rgba(8, 11, 20, 0.5)" filter="url(#caustics)" className="opacity-20" />
      </svg>
    </div>
  );
};

const CursorOrb = ({ isDark }: { isDark: boolean }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 200 };
  const sx = useSpring(mouseX, springConfig);
  const sy = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      style={{
        left: sx,
        top: sy,
        x: "-50%",
        y: "-50%",
      }}
      className={`fixed pointer-events-none z-[1] w-[500px] h-[500px] rounded-full blur-[120px] opacity-25 transition-colors duration-1000 ${
        isDark 
          ? "bg-[radial-gradient(circle,rgba(59,130,246,0.4)_0%,transparent_70%)]" 
          : "bg-[radial-gradient(circle,rgba(124,111,247,0.2)_0%,transparent_70%)]"
      }`}
    />
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const toggleTheme = () => setIsDark(!isDark);

  const demoTabs = [
    { name: "Chat AI", description: "Talk to Planora like a human. Ask it to schedule tasks, get diet plans, or review your week.", video: "/videos/chat-demo.mp4" },
    { name: "Planner", description: "See your full week/month at a glance with color-coded tasks and completion status.", video: "/videos/planner-demo.mp4" },
    { name: "Automation", description: "Watch Planora intelligently slot new tasks into your schedule without conflicts.", video: "/videos/automation-demo.mp4" },
    { name: "Analytics", description: "Planora analyses your week and gives specific recommendations for improvement.", video: "/videos/reports-demo.mp4" }
  ];

  const futureFeatures = [
    { icon: <Smartphone />, title: "WhatsApp Integration", desc: "Interact with Planora directly from your favorite chat app." },
    { icon: <Zap />, title: "Wearable Sync", desc: "Connect Apple Watch & Garmin to sync health data automatically." },
    { icon: <Globe />, title: "Group Planning", desc: "Collaborate on goals with friends or teammates in real-time." },
    { icon: <Rocket />, title: "Smart Gamification", desc: "Earn rewards and level up as you complete your daily plans." }
  ];

  // Theme Variables
  const theme = {
    bg: isDark ? "bg-[#04060E]" : "bg-[#F8FAFC]",
    text: isDark ? "text-[#F0F4FF]" : "text-[#1E293B]",
    textMuted: isDark ? "text-[#8B95A1]" : "text-[#64748B]",
    border: isDark ? "border-white/10" : "border-slate-200",
    navBg: isDark ? "bg-[#04060E]/80" : "bg-white/80",
    cardBg: isDark ? "bg-[#0D1117]" : "bg-white",
    heroGradient: isDark ? "from-[#7C6FF7] via-[#3B82F6] to-[#04060E]" : "from-[#7C6FF7] via-[#3B82F6] to-[#F8FAFC]",
  };

  return (
    <div className={`${theme.bg} ${theme.text} min-h-screen selection:bg-[#3B82F6]/30 transition-colors duration-700 font-outfit overflow-x-hidden`}>
      
      {/* Interactive Backgrounds */}
      <UnderwaterEffect isDark={isDark} />
      <CursorOrb isDark={isDark} />

      {/* NAVBAR */}
      <nav 
        className={`fixed top-0 left-0 right-0 h-20 z-50 flex items-center justify-between px-8 transition-all duration-500 ${
          isScrolled 
            ? `${theme.navBg} backdrop-blur-2xl border-b ${theme.border} shadow-2xl` 
            : "bg-transparent"
        }`}
      >
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-10 h-10 bg-gradient-to-br from-[#3B82F6] to-[#7C6FF7] rounded-xl flex items-center justify-center shadow-lg shadow-[#3B82F6]/20 group-hover:rotate-12 transition-transform">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <span className={`font-bold text-2xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Planora</span>
        </div>

        <div className={`hidden lg:flex items-center gap-10 text-[14px] font-bold tracking-widest uppercase ${theme.textMuted}`}>
          {["how-it-works", "features", "demo", "roadmap"].map((id) => (
            <a 
              key={id} 
              href={`#${id}`} 
              onClick={(e) => handleNavClick(e, id)}
              className="hover:text-[#3B82F6] transition-colors relative group"
            >
              {id.replace(/-/g, ' ')}
              <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-[#3B82F6] transition-all group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border ${theme.border} ${theme.cardBg} transition-all hover:scale-110 active:scale-95 shadow-sm`}
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>

          <div className="flex items-center gap-3">
            {!isLoaded ? (
              <div className="w-24 h-10 bg-slate-200/20 animate-pulse rounded-xl" />
            ) : !isSignedIn ? (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="bg-gradient-to-r from-[#3B82F6] to-[#7C6FF7] text-white text-[14px] font-bold px-7 py-3 rounded-xl hover:shadow-xl hover:shadow-[#3B82F6]/30 transition-all active:scale-95">
                  Get Started
                </button>
              </SignInButton>
            ) : (
              <Link href="/dashboard">
                <button className="bg-gradient-to-r from-[#3B82F6] to-[#7C6FF7] text-white text-[14px] font-bold px-7 py-3 rounded-xl hover:shadow-xl hover:shadow-[#3B82F6]/30 transition-all active:scale-95">
                  Dashboard →
                </button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative w-full min-h-screen pt-20 flex flex-col items-center justify-center text-center px-6">
        <div className="relative z-10 flex flex-col items-center max-w-6xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-3 px-6 py-2.5 rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/5 text-[#3B82F6] text-sm font-black uppercase tracking-[0.2em] mb-10`}
          >
            <Sparkles className="w-4 h-4" />
            Experience the future of planning
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`text-6xl md:text-[100px] font-black leading-[0.95] tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}
          >
            PLAN. ADAPT. <br />
            <span className="bg-gradient-to-r from-[#3B82F6] via-[#7C6FF7] to-[#9489f9] text-transparent bg-clip-text italic">
              CONQUER.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`${theme.textMuted} text-xl md:text-2xl leading-relaxed max-w-3xl mt-12 font-medium`}
          >
            The world's most advanced AI life execution engine. 
            Stop staring at empty calendars—let Planora architect your success.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center gap-8 mt-16"
          >
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="bg-white text-[#04060E] px-12 py-5 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-2xl shadow-[#3B82F6]/40 group flex items-center">
                Join Planora <ArrowRight className="ml-3 group-hover:translate-x-2 transition-transform" />
              </button>
            </SignInButton>
            <a 
              href="#demo"
              onClick={(e) => handleNavClick(e, "demo")}
              className={`px-12 py-5 rounded-2xl border-2 ${theme.border} ${theme.cardBg} font-black text-xl hover:bg-[#3B82F6]/10 transition-all flex items-center`}
            >
              <Play className="mr-3 w-5 h-5" fill="currentColor" /> Watch Demo
            </a>
          </motion.div>
        </div>

        {/* Floating elements */}
        <motion.div 
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-[10%] top-[30%] w-24 h-24 bg-gradient-to-br from-[#3B82F6] to-transparent rounded-3xl blur-2xl opacity-20"
        />
      </section>

      {/* RE-IMPLEMENTED MEDIA SECTION */}
      <section id="demo" className="py-32 max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <span className="text-[#3B82F6] font-black text-sm tracking-widest uppercase">The Experience</span>
          <h2 className={`text-4xl md:text-6xl font-black mt-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>See it in Motion.</h2>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-4 flex flex-col gap-4">
            {demoTabs.map((tab, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`text-left p-6 rounded-3xl transition-all duration-300 border-2 ${
                  activeTab === idx 
                    ? 'bg-[#3B82F6] border-[#3B82F6] text-white shadow-xl shadow-[#3B82F6]/20 translate-x-4' 
                    : `bg-transparent ${theme.textMuted} border-transparent hover:border-[#3B82F6]/20 hover:text-white`
                }`}
              >
                <h4 className="font-black text-lg mb-1">{tab.name}</h4>
                <p className={`text-sm font-medium ${activeTab === idx ? 'text-white/80' : 'text-inherit'}`}>
                  {tab.description}
                </p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 group">
            <div className={`relative rounded-[40px] border-4 ${theme.border} overflow-hidden aspect-video bg-[#0D1117] shadow-3xl`}>
               {/* Video Placeholder with premium overlay */}
               <div className="absolute inset-0 bg-gradient-to-t from-[#04060E] to-transparent opacity-40 z-10" />
               <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                  <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                  </div>
                  <p className="text-white font-black text-2xl mt-6 tracking-tight">{demoTabs[activeTab].name} Walkthrough</p>
               </div>
               <div className="absolute top-6 right-6 z-20 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-white text-xs font-black uppercase tracking-widest">
                  Live Preview
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROADMAP SECTION */}
      <section id="roadmap" className="py-32 max-w-7xl mx-auto px-6">
        <FadeInWhenVisible className="text-center mb-20">
          <span className="text-[#3B82F6] font-black text-sm tracking-widest uppercase">The Roadmap</span>
          <h2 className={`text-4xl md:text-6xl font-black mt-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>What's Coming Next.</h2>
        </FadeInWhenVisible>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {futureFeatures.map((f, i) => (
            <div key={i} className={`p-10 rounded-[32px] border-2 ${theme.border} ${theme.cardBg} hover:border-[#3B82F6]/40 transition-all hover:-translate-y-2 group`}>
               <div className="w-14 h-14 rounded-2xl bg-[#3B82F6]/10 flex items-center justify-center text-[#3B82F6] mb-8 group-hover:scale-110 transition-transform">
                 {f.icon}
               </div>
               <h4 className={`text-xl font-black mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>{f.title}</h4>
               <p className={`${theme.textMuted} text-sm font-medium leading-relaxed`}>{f.desc}</p>
               <div className="mt-8 flex items-center text-[#3B82F6] text-xs font-black uppercase tracking-widest">
                 Q3 2025 · Future
               </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className={`py-20 border-t ${theme.border} relative overflow-hidden`}>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#3B82F6] rounded-full blur-[180px] opacity-10" />
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#3B82F6] to-[#7C6FF7] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Planora</span>
          </div>
          <p className={`${theme.textMuted} text-sm font-bold`}>© 2025 Planora AI · Forge Your Legacy</p>
          <div className="flex gap-10 text-xs font-black uppercase tracking-[0.2em]">
            <a href="#" className={`hover:text-[#3B82F6] transition-colors ${theme.textMuted}`}>Privacy</a>
            <a href="#" className={`hover:text-[#3B82F6] transition-colors ${theme.textMuted}`}>Terms</a>
            <a href="#" className={`hover:text-[#3B82F6] transition-colors ${theme.textMuted}`}>OSS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChatBubble({ role, text, delay, isDark }: { role: "ai" | "user", text: string, delay: number, isDark: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className={`rounded-2xl px-6 py-3.5 text-sm font-bold max-w-[85%] shadow-xl ${
        role === "ai" 
          ? (isDark ? "bg-[#1C2333] text-white border border-white/5 mr-auto" : "bg-slate-100 text-slate-800 border border-slate-200 mr-auto") 
          : "bg-gradient-to-r from-[#3B82F6] to-[#7C6FF7] text-white ml-auto"
      }`}
    >
      {text}
    </motion.div>
  );
}
