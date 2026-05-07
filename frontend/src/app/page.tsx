"use client";

import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Brain, RefreshCw, MessageSquareText, Target, BarChart3, ShieldCheck, Play, Sun, Moon, ArrowRight, CheckCircle2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ──────────────────────────────────────────────────────────────────────────────
// COMPONENTS & UTILS
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
      className={`fixed pointer-events-none z-[1] w-[600px] h-[600px] rounded-full blur-[100px] opacity-30 transition-colors duration-1000 ${
        isDark 
          ? "bg-[radial-gradient(circle,rgba(124,111,247,0.3)_0%,transparent_70%)]" 
          : "bg-[radial-gradient(circle,rgba(124,111,247,0.15)_0%,transparent_70%)]"
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

  const tabs = [
    { name: "Chat Assistant", description: "Talk to Planora like a human. Ask it to schedule tasks, get diet plans, or review your week." },
    { name: "Planner View", description: "See your full week/month at a glance with color-coded tasks and completion status." },
    { name: "Adding Tasks", description: "Watch Planora intelligently slot new tasks into your schedule without conflicts." },
    { name: "Weekly Report", description: "Planora analyses your week and gives specific recommendations for improvement." },
    { name: "Goal Setup", description: "From goal to 7-day plan in under 2 minutes through the AI interview process." }
  ];

  // Theme Variables
  const theme = {
    bg: isDark ? "bg-[#080B14]" : "bg-[#F8FAFC]",
    text: isDark ? "text-[#F0F4FF]" : "text-[#1E293B]",
    textMuted: isDark ? "text-[#8B95A1]" : "text-[#64748B]",
    border: isDark ? "border-white/10" : "border-slate-200",
    navBg: isDark ? "bg-[#080B14]/80" : "bg-white/80",
    cardBg: isDark ? "bg-[#0D1117]" : "bg-white",
    btnSecondary: isDark ? "bg-white/5 border-white/20 text-white" : "bg-slate-100 border-slate-200 text-slate-900",
  };

  return (
    <div className={`${theme.bg} ${theme.text} min-h-screen selection:bg-[#7C6FF7]/30 transition-colors duration-700 font-outfit overflow-x-hidden`}>
      
      {/* Background Interactivity */}
      <CursorOrb isDark={isDark} />
      <div className={`fixed inset-0 pointer-events-none opacity-[0.03] transition-opacity ${isDark ? 'block' : 'hidden'}`} style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/stardust.png')" }} />

      {/* NAVBAR */}
      <nav 
        className={`fixed top-0 left-0 right-0 h-20 z-50 flex items-center justify-between px-8 transition-all duration-500 ${
          isScrolled 
            ? `${theme.navBg} backdrop-blur-xl border-b ${theme.border} shadow-lg` 
            : "bg-transparent"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-[#7C6FF7] to-[#3B82F6] rounded-xl flex items-center justify-center shadow-lg shadow-[#7C6FF7]/20">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <span className={`font-bold text-2xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Planora</span>
        </div>

        <div className={`hidden lg:flex items-center gap-10 text-[15px] font-medium ${theme.textMuted}`}>
          {["how-it-works", "features", "demo"].map((id) => (
            <a 
              key={id} 
              href={`#${id}`} 
              onClick={(e) => handleNavClick(e, id)}
              className="hover:text-[#7C6FF7] transition-colors capitalize relative group"
            >
              {id.replace(/-/g, ' ')}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#7C6FF7] transition-all group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border ${theme.border} ${theme.cardBg} transition-all hover:scale-110 active:scale-95`}
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>

          <div className="flex items-center gap-3">
            {!isLoaded ? (
              <div className="w-24 h-10 bg-slate-200/20 animate-pulse rounded-xl" />
            ) : !isSignedIn ? (
              <>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className={`hidden sm:block text-[14px] font-semibold ${theme.text} hover:opacity-80 transition-opacity`}>
                    Log in
                  </button>
                </SignInButton>
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="bg-[#7C6FF7] text-white text-[14px] font-bold px-6 py-2.5 rounded-xl hover:bg-[#6B5FE6] transition-all hover:shadow-lg hover:shadow-[#7C6FF7]/30">
                    Get Started
                  </button>
                </SignInButton>
              </>
            ) : (
              <Link href="/dashboard">
                <button className="bg-[#7C6FF7] text-white text-[14px] font-bold px-6 py-2.5 rounded-xl hover:bg-[#6B5FE6] transition-all hover:shadow-lg hover:shadow-[#7C6FF7]/30">
                  Dashboard →
                </button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative w-full min-h-screen pt-20 flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Animated Orbs */}
        <div className={`absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#7C6FF7] rounded-full blur-[140px] opacity-10 animate-pulse`} />
        <div className={`absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#3B82F6] rounded-full blur-[140px] opacity-10 animate-pulse`} />

        <div className="relative z-10 flex flex-col items-center max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center gap-2 px-5 py-2 rounded-full border border-[#7C6FF7]/30 bg-[#7C6FF7]/5 text-[#7C6FF7] text-sm font-semibold mb-8`}
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C6FF7] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C6FF7]"></span>
            </span>
            Next-Gen AI Life Execution System
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`text-5xl md:text-8xl font-black leading-[1.05] tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
          >
            Don't just plan. <br />
            <span className="bg-gradient-to-r from-[#7C6FF7] via-[#9489f9] to-[#3B82F6] text-transparent bg-clip-text">
              Execute with AI.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`${theme.textMuted} text-xl md:text-2xl leading-relaxed max-w-3xl mt-10 font-medium`}
          >
            The first planning platform that doesn't just list tasks—it learns your life, builds your roadmap, and adapts automatically when things change.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center gap-6 mt-14"
          >
            {!isLoaded ? (
              <div className="w-56 h-14 bg-slate-200/20 animate-pulse rounded-2xl" />
            ) : !isSignedIn ? (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="bg-[#7C6FF7] text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-[#6B5FE6] hover:scale-105 transition-all shadow-xl shadow-[#7C6FF7]/30 group">
                  Start Your Journey <ArrowRight className="inline ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </SignInButton>
            ) : (
              <Link href="/dashboard">
                <button className="bg-[#7C6FF7] text-white px-10 py-4 rounded-2xl font-bold text-lg hover:bg-[#6B5FE6] hover:scale-105 transition-all shadow-xl shadow-[#7C6FF7]/30 group">
                  Open Dashboard <ArrowRight className="inline ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            )}
            <a 
              href="#how-it-works"
              onClick={(e) => handleNavClick(e, "how-it-works")}
              className={`px-10 py-4 rounded-2xl border ${theme.border} ${theme.cardBg} font-bold text-lg hover:scale-105 transition-all`}
            >
              How it works
            </a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className={`mt-16 flex items-center justify-center gap-8 ${theme.textMuted} text-sm font-bold tracking-widest uppercase`}
          >
            <span>10k+ Goals</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF7]" />
            <span>95% Success</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span>AI Driven</span>
          </motion.div>
        </div>
      </section>

      {/* INTERACTIVE DEMO / FEATURES */}
      <section id="how-it-works" className="py-32 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <FadeInWhenVisible>
            <span className="text-[#7C6FF7] font-black text-sm tracking-widest uppercase">The Planora Method</span>
            <h2 className={`text-4xl md:text-5xl font-black mt-4 mb-8 leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Beyond Simple To-Do Lists.
            </h2>
            <div className={`space-y-8 ${theme.textMuted} text-lg leading-relaxed`}>
              <p>
                Standard apps are static. Planora is dynamic. It conducts a short intake interview to understand your life: work, sleep, rest, and habits.
              </p>
              <div className="space-y-4">
                {[
                  { title: "Intake Interview", desc: "AI understands your constraints before planning." },
                  { title: "Dynamic Redistribution", desc: "Missed tasks are intelligently moved to future days." },
                  { title: "Holistic Sync", desc: "Syncs fitness, study, and career goals into one flow." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-2xl hover:bg-[#7C6FF7]/5 border border-transparent hover:border-[#7C6FF7]/10 transition-all">
                    <div className="w-12 h-12 bg-[#7C6FF7]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="text-[#7C6FF7]" />
                    </div>
                    <div>
                      <h4 className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h4>
                      <p className="text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeInWhenVisible>

          <div className={`${theme.cardBg} border ${theme.border} rounded-3xl p-8 shadow-2xl relative overflow-hidden group`}>
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#7C6FF7] to-[#3B82F6]" />
             <div className="flex items-center gap-3 mb-10">
               <div className="flex gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-400" />
                 <div className="w-3 h-3 rounded-full bg-amber-400" />
                 <div className="w-3 h-3 rounded-full bg-emerald-400" />
               </div>
               <div className={`text-xs font-bold ${theme.textMuted} uppercase tracking-widest`}>Intelligence Core v2.0</div>
             </div>

             <div className="space-y-6">
                <ChatBubble role="ai" text="Welcome back! What's your focus for today?" delay={0.2} isDark={isDark} />
                <ChatBubble role="user" text="I need to master React.js in 2 weeks while working full-time." delay={1.0} isDark={isDark} />
                <ChatBubble role="ai" text="Analyzing schedule... I've found 90min blocks in your evenings. Building your roadmap." delay={1.8} isDark={isDark} />
                
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2.8 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">✓</div>
                    <div>
                      <p className="text-emerald-500 font-bold text-sm tracking-tight">Plan Successfully Generated</p>
                      <p className={`text-xs ${theme.textMuted}`}>14-day roadmap · 28 focus sessions · Syncing to calendar</p>
                    </div>
                  </div>
                </motion.div>
             </div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="py-32 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <span className="text-[#7C6FF7] font-black text-sm tracking-widest uppercase">Powerful Modules</span>
          <h2 className={`text-4xl md:text-5xl font-black mt-4 mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>Engineered for Performance.</h2>
          <p className={`${theme.textMuted} text-lg`}>Everything you need to turn vague intentions into undeniable results.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard 
            icon={<Brain className="w-7 h-7" />}
            title="Cognitive Interview"
            desc="Planora's AI identifies your psychological roadblocks and schedule gaps before drafting your plan."
            delay={0.1}
            isDark={isDark}
          />
          <FeatureCard 
            icon={<RefreshCw className="w-7 h-7" />}
            title="Active Rebalancing"
            desc="If life disrupts a task, Planora automatically redistributes the workload to keep you on track."
            delay={0.2}
            isDark={isDark}
          />
          <FeatureCard 
            icon={<BarChart3 className="w-7 h-7" />}
            title="Efficiency Analysis"
            desc="Get weekly intelligence reports on your execution speed and focus patterns."
            delay={0.3}
            isDark={isDark}
          />
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-[#7C6FF7] to-[#3B82F6] rounded-[40px] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl shadow-[#7C6FF7]/20">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none" />
          <h2 className="text-4xl md:text-6xl font-black text-white mb-8 relative z-10">Ready to execute?</h2>
          <p className="text-white/80 text-xl md:text-2xl font-medium mb-12 relative z-10 max-w-2xl mx-auto">
            Join thousands of others who are achieving their goals with the power of Planora AI.
          </p>
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-6">
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="bg-white text-[#7C6FF7] px-12 py-5 rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-xl">
                Get Planora Free
              </button>
            </SignInButton>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={`py-20 border-t ${theme.border} bg-opacity-50`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-[#7C6FF7] to-[#3B82F6] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>Planora</span>
            </div>
            <p className={`${theme.textMuted} text-sm font-medium`}>© 2025 Planora AI · Built with Passion</p>
            <div className="flex gap-8 text-sm font-bold">
              <a href="#" className={`hover:text-[#7C6FF7] transition-colors ${theme.textMuted}`}>GitHub</a>
              <a href="#" className={`hover:text-[#7C6FF7] transition-colors ${theme.textMuted}`}>LinkedIn</a>
              <a href="#" className={`hover:text-[#7C6FF7] transition-colors ${theme.textMuted}`}>Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChatBubble({ role, text, delay, isDark }: { role: "ai" | "user", text: string, delay: number, isDark: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className={`rounded-2xl px-5 py-3 text-sm font-medium max-w-[85%] shadow-sm ${
        role === "ai" 
          ? (isDark ? "bg-white/5 text-white border border-white/10 mr-auto" : "bg-slate-100 text-slate-800 border border-slate-200 mr-auto") 
          : "bg-[#7C6FF7] text-white ml-auto"
      }`}
    >
      {text}
    </motion.div>
  );
}

function FeatureCard({ icon, title, desc, delay, isDark }: { icon: React.ReactNode, title: string, desc: string, delay: number, isDark: boolean }) {
  return (
    <FadeInWhenVisible delay={delay}>
      <div className={`group ${isDark ? 'bg-[#0D1117] border-white/10 hover:bg-white/[0.02]' : 'bg-white border-slate-200 hover:bg-slate-50'} border-2 rounded-[32px] p-10 transition-all duration-300 h-full hover:shadow-2xl hover:-translate-y-2`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDark ? 'bg-white/5 text-[#7C6FF7]' : 'bg-slate-100 text-[#7C6FF7]'}`}>
          {icon}
        </div>
        <h3 className={`font-black text-2xl mt-8 ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
        <p className={`mt-4 leading-relaxed font-medium ${isDark ? 'text-[#8B95A1]' : 'text-slate-500'}`}>
          {desc}
        </p>
      </div>
    </FadeInWhenVisible>
  );
}
