"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Brain, RefreshCw, MessageSquareText, Target, BarChart3, ShieldCheck, Play } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";

// Animation utility for scroll reveals
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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const tabs = [
    { name: "Chat Assistant", description: "Talk to Planora like a human. Ask it to schedule tasks, get diet plans, or review your week." },
    { name: "Planner View", description: "See your full week/month at a glance with color-coded tasks and completion status." },
    { name: "Adding Tasks", description: "Watch Planora intelligently slot new tasks into your schedule without conflicts." },
    { name: "Weekly Report", description: "Planora analyses your week and gives specific recommendations for improvement." },
    { name: "Goal Setup", description: "From goal to 7-day plan in under 2 minutes through the AI interview process." }
  ];

  return (
    <div className="bg-[#080B14] min-h-screen text-[#F0F4FF] selection:bg-[#7C6FF7]/30">
      
      {/* PART 1 — NAVBAR */}
      <nav 
        className={`fixed top-0 left-0 right-0 h-16 z-50 flex items-center justify-between px-6 transition-all duration-300 ${
          isScrolled 
            ? "bg-[#080B14]/85 backdrop-blur-[12px] border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]" 
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="font-bold text-[20px] tracking-tight">Planora</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-[14px] text-[#8B95A1]">
          {["how-it-works", "features", "demo", "contact"].map((id) => (
            <a 
              key={id} 
              href={`#${id}`} 
              onClick={(e) => handleNavClick(e, id)}
              className="hover:text-white transition-colors capitalize"
            >
              {id.replace(/-/g, ' ')}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {!isLoaded ? (
            <div className="w-24 h-8 bg-white/5 animate-pulse rounded-full" />
          ) : !isSignedIn ? (
            <>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="hidden sm:block text-[14px] text-white hover:text-white/80 transition-colors bg-transparent border border-white/20 rounded-full px-5 py-2 hover:border-white/40">
                  Sign In
                </button>
              </SignInButton>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="bg-[#7C6FF7] text-white text-[14px] font-medium px-5 py-2 rounded-full hover:bg-[#6B5FE6] transition-colors">
                  Start Free →
                </button>
              </SignInButton>
            </>
          ) : (
            <Link href="/dashboard">
              <button className="bg-[#7C6FF7] text-white text-[14px] font-medium px-5 py-2 rounded-full hover:bg-[#6B5FE6] transition-colors">
                Go to Dashboard →
              </button>
            </Link>
          )}
        </div>
      </nav>

      {/* PART 2 — HERO */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,111,247,0.15)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.02] pointer-events-none" />
        
        {/* Orbs */}
        <div className="absolute top-0 left-0 w-[384px] h-[384px] bg-[#7C6FF7] rounded-full blur-[120px] opacity-15 pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[384px] h-[384px] bg-[#3B82F6] rounded-full blur-[120px] opacity-15 pointer-events-none translate-x-1/2 translate-y-1/2" />

        <div className="relative z-10 flex flex-col items-center px-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#7C6FF7]/30 bg-[#7C6FF7]/10 text-[#7C6FF7] text-[14px] mb-[32px]"
          >
            <span className="animate-pulse">●</span>
            AI-Powered Life Execution System
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-[48px] md:text-[72px] font-bold leading-[1.1] tracking-tight"
          >
            <span className="text-white block">Adaptive Planning,</span>
            <span className="bg-gradient-to-r from-[#7C6FF7] to-[#3B82F6] text-transparent bg-clip-text block pb-2">
              Powered by AI
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-[#8B95A1] text-[18px] leading-[1.7] max-w-[600px] mt-[24px]"
          >
            Most people have goals. Very few achieve them.
            Planora learns your schedule, builds realistic execution plans,
            and adapts automatically when life gets in the way.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center gap-[16px] mt-[40px]"
          >
            {!isLoaded ? (
              <div className="w-48 h-12 bg-white/5 animate-pulse rounded-full" />
            ) : !isSignedIn ? (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="bg-[#7C6FF7] text-white px-[32px] py-[12px] rounded-full font-medium hover:bg-[#6B5FE6] hover:scale-[1.02] transition-all">
                  Start Planning Free →
                </button>
              </SignInButton>
            ) : (
              <Link href="/dashboard">
                <button className="bg-[#7C6FF7] text-white px-[32px] py-[12px] rounded-full font-medium hover:bg-[#6B5FE6] hover:scale-[1.02] transition-all">
                  Go to Dashboard →
                </button>
              </Link>
            )}
            <a 
              href="#how-it-works"
              onClick={(e) => handleNavClick(e, "how-it-works")}
              className="px-[32px] py-[12px] rounded-full border border-white/20 text-white/70 hover:text-white hover:border-white transition-all font-medium"
            >
              See how it works
            </a>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-[48px] flex items-center justify-center gap-4 text-[#4A5568] text-[13px] font-medium tracking-wide flex-wrap"
          >
            <span>10,000+ Goals Tracked</span>
            <span className="hidden sm:inline">|</span>
            <span>95% Plan Completion</span>
            <span className="hidden sm:inline">|</span>
            <span>7-Day AI Plans</span>
          </motion.div>
        </div>

        <motion.div 
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="absolute bottom-[32px] left-1/2 -translate-x-1/2 text-white/30 text-[12px]"
        >
          ↓ Scroll to explore
        </motion.div>
      </section>

      {/* PART 3 — WHAT IS PLANORA */}
      <section id="how-it-works" className="py-[96px] md:py-[128px] max-w-[1280px] mx-auto px-[24px]">
        <FadeInWhenVisible className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div>
            <p className="text-[#7C6FF7] text-[12px] uppercase tracking-[0.1em] font-semibold mb-4">ABOUT PLANORA</p>
            <h2 className="text-white text-[28px] md:text-[36px] font-bold leading-tight mb-8">
              Your Goals Deserve More Than a To-Do List
            </h2>
            <div className="space-y-6 text-[#8B95A1] text-[16px] leading-[1.7]">
              <p>
                Most productivity apps are just digital notepads. You write your goals down, and then nothing happens. Planora is different — it is an AI agent that actively manages your schedule.
              </p>
              <p>
                Tell Planora your goal — lose weight, learn a skill, prepare for exams — and it conducts a short interview to understand your daily life: when you wake up, when you work, what your limits are.
              </p>
              <p>
                From that conversation, it generates a complete 7-day action plan and keeps it updated. Miss a workout? Planora rebalances your week. Ask it to add something? It schedules it intelligently.
              </p>
            </div>
            
            <div className="mt-8 space-y-3">
              {[
                "Personalised to your actual schedule",
                "Adapts when life disrupts your plan",
                "Works across fitness, study, diet, and career"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-white text-[15px]">
                  <span className="text-[#7C6FF7] font-bold">✓</span> {item}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0D1117] border border-[#1C2333] rounded-[16px] p-[24px] shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#1C2333] pb-4 mb-6">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#eab308]" />
                <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
              </div>
              <div className="flex-1 text-center text-[13px] text-[#8B95A1] font-medium mr-12">
                Planora Agent
              </div>
            </div>

            <div className="space-y-4">
              <ChatBubble role="ai" text="What time do you usually wake up?" delay={0.2} />
              <ChatBubble role="user" text="Around 7am" delay={0.8} />
              <ChatBubble role="ai" text="What are your work hours?" delay={1.4} />
              <ChatBubble role="user" text="9am to 5pm, Monday to Friday" delay={2.0} />
              <ChatBubble role="ai" text="Perfect. Building your plan..." delay={2.6} />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 3.6 }}
                className="bg-[#10B981]/15 text-[#10B981] p-[14px] rounded-[12px] text-[14px] w-full flex items-center gap-2"
              >
                <span>✅</span> 7-day plan created — 24 tasks scheduled
              </motion.div>
            </div>
          </div>

        </FadeInWhenVisible>
      </section>

      {/* PART 4 — UI PREVIEW */}
      <section id="features" className="py-[96px] md:py-[128px] max-w-[1280px] mx-auto px-[24px]">
        <FadeInWhenVisible className="text-center mb-12">
          <p className="text-[#7C6FF7] text-[12px] uppercase tracking-[0.1em] font-semibold mb-4">THE INTERFACE</p>
          <h2 className="text-white text-[32px] md:text-[40px] font-bold mb-4">
            Built for clarity. Designed for speed.
          </h2>
          <p className="text-[#8B95A1] text-[16px] max-w-[500px] mx-auto">
            Every screen in Planora is designed to get out of your way and let you focus on execution.
          </p>
        </FadeInWhenVisible>

        <FadeInWhenVisible className="flex justify-center mb-12">
          <div className="bg-[#1C2333] p-[4px] rounded-full flex">
            <button 
              onClick={() => setIsDark(true)}
              className={`flex items-center gap-2 px-[20px] py-[6px] rounded-full transition-all duration-200 ${isDark ? 'bg-[#7C6FF7] text-white' : 'text-[#8B95A1]'}`}
            >
              🌙 Dark
            </button>
            <button 
              onClick={() => setIsDark(false)}
              className={`flex items-center gap-2 px-[20px] py-[6px] rounded-full transition-all duration-200 ${!isDark ? 'bg-[#7C6FF7] text-white' : 'text-[#8B95A1]'}`}
            >
              ☀️ Light
            </button>
          </div>
        </FadeInWhenVisible>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FadeInWhenVisible delay={0.1}>
            <div className="text-center text-[#8B95A1] text-[12px] mb-3">Dashboard</div>
            <div className={`rounded-[16px] overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(124,111,247,0.12)] aspect-video flex flex-col items-center justify-center transition-colors duration-500 ${isDark ? 'bg-gradient-to-br from-[#0D1117] to-[#1C2333]' : 'bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1]'}`}>
              {/* TODO: Replace placeholder divs with actual <img> or <Image> tags once screenshots are ready */}
              {/* Dark mode: /screenshots/dashboard-dark.png and /screenshots/assistant-dark.png */}
              {/* Light mode: /screenshots/dashboard-light.png and /screenshots/assistant-light.png */}
              <p className={isDark ? "text-[#8B95A1]" : "text-[#475569]"}>Dashboard Screenshot</p>
              <p className={`text-[12px] mt-2 ${isDark ? "text-[#4A5568]" : "text-[#64748b]"}`}>(replace with actual screenshot)</p>
            </div>
          </FadeInWhenVisible>

          <FadeInWhenVisible delay={0.2}>
            <div className="text-center text-[#8B95A1] text-[12px] mb-3">AI Assistant</div>
            <div className={`rounded-[16px] overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(124,111,247,0.12)] aspect-video flex flex-col items-center justify-center transition-colors duration-500 ${isDark ? 'bg-gradient-to-br from-[#0D1117] to-[#1C2333]' : 'bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1]'}`}>
              <p className={isDark ? "text-[#8B95A1]" : "text-[#475569]"}>AI Assistant Screenshot</p>
              <p className={`text-[12px] mt-2 ${isDark ? "text-[#4A5568]" : "text-[#64748b]"}`}>(replace with actual screenshot)</p>
            </div>
          </FadeInWhenVisible>
        </div>

        <FadeInWhenVisible className="flex flex-wrap justify-center gap-4 mt-[40px]">
          {["📅 Calendar View", "🤖 AI Chat", "📊 Progress Tracking"].map(tag => (
            <div key={tag} className="border border-[#1C2333] bg-[#0D1117] rounded-full px-[20px] py-[8px] text-[#8B95A1] text-[14px]">
              {tag}
            </div>
          ))}
        </FadeInWhenVisible>
      </section>

      {/* PART 5 — HOW IT HELPS */}
      <section className="py-[96px] md:py-[128px] max-w-[1280px] mx-auto px-[24px]">
        <FadeInWhenVisible className="text-center mb-16">
          <p className="text-[#7C6FF7] text-[12px] uppercase tracking-[0.1em] font-semibold mb-4">WHY PLANORA</p>
          <h2 className="text-white text-[32px] md:text-[40px] font-bold">
            Stop managing tasks. Start achieving goals.
          </h2>
        </FadeInWhenVisible>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<Brain />}
            title="AI That Knows You"
            desc="Planora learns your schedule through a 5-question interview before building a single task. No generic templates."
            delay={0.1}
          />
          <FeatureCard 
            icon={<RefreshCw />}
            title="Auto-Rebalancing"
            desc="Missed a workout? Planora detects the skip and redistributes your missed work across upcoming days automatically."
            delay={0.2}
          />
          <FeatureCard 
            icon={<MessageSquareText />}
            title="Talk Like a Human"
            desc="'Add gym 3 times this week' — Planora understands natural language and schedules it with the right times."
            delay={0.3}
          />
          <FeatureCard 
            icon={<Target />}
            title="Goal-Driven Planning"
            desc="Every task connects back to your goal. Planora tracks whether your schedule is actually moving you forward."
            delay={0.4}
          />
          <FeatureCard 
            icon={<BarChart3 />}
            title="Weekly Intelligence Reports"
            desc="Every week, Planora analyses your completion patterns and tells you exactly what to improve next week."
            delay={0.5}
          />
          <FeatureCard 
            icon={<ShieldCheck />}
            title="Schedule Guard"
            desc="Planora never schedules tasks during your sleep hours, work hours, or over locked commitments."
            delay={0.6}
          />
        </div>
      </section>

      {/* PART 6 — DEMO SECTION */}
      <section id="demo" className="py-[96px] md:py-[128px] max-w-[1280px] mx-auto px-[24px]">
        <FadeInWhenVisible className="text-center mb-12">
          <p className="text-[#7C6FF7] text-[12px] uppercase tracking-[0.1em] font-semibold mb-4">SEE IT IN ACTION</p>
          <h2 className="text-white text-[32px] md:text-[40px] font-bold mb-4">
            Watch Planora Build Your Life Plan
          </h2>
          <p className="text-[#8B95A1] text-[16px]">
            Click any feature below to see exactly how it works.
          </p>
        </FadeInWhenVisible>

        <FadeInWhenVisible className="flex flex-wrap justify-center gap-[8px] mb-[32px]">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`px-[20px] py-[10px] rounded-full text-[14px] transition-all duration-200 ${
                activeTab === idx 
                  ? 'bg-[#7C6FF7] text-white' 
                  : 'bg-transparent text-[#8B95A1] border border-[#1C2333] hover:text-white hover:border-white/20'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </FadeInWhenVisible>

        <FadeInWhenVisible className="max-w-[768px] mx-auto border border-[#1C2333] bg-[#0D1117] rounded-[16px] overflow-hidden aspect-video flex flex-col items-center justify-center relative">
          {/* TODO: Replace placeholder divs with actual <video> tags */}
          {/* Video files: /videos/chat-demo.mp4, /videos/planner-demo.mp4, etc. */}
          {/* Use autoPlay muted loop playsInline attributes */}
          <div className="w-[64px] h-[64px] rounded-full border-2 border-[#7C6FF7] flex items-center justify-center mb-6">
            <Play className="w-8 h-8 text-[#7C6FF7] ml-1" fill="currentColor" />
          </div>
          <h3 className="text-white text-[24px] font-bold mb-2 transition-opacity duration-300">
            {tabs[activeTab].name}
          </h3>
          <p className="text-[#8B95A1] text-[16px] max-w-[500px] text-center px-6 transition-opacity duration-300">
            {tabs[activeTab].description}
          </p>
        </FadeInWhenVisible>
        
        <FadeInWhenVisible className="text-center mt-[16px]">
          <p className="text-[#4A5568] text-[13px]">No account needed to watch the demos.</p>
        </FadeInWhenVisible>
      </section>

      {/* PART 7 — FOOTER */}
      <footer id="contact" className="bg-[#04060D] border-t border-[#1C2333] pt-[64px] pb-[40px] px-[24px]">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[48px] mb-[64px]">
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚡</span>
                <span className="font-bold text-[20px] text-white tracking-tight">Planora</span>
              </div>
              <p className="text-[#8B95A1] text-[14px] mt-[12px]">Turn your goals into daily execution.</p>
              <p className="text-[#4A5568] text-[13px] mt-[8px]">Built for INT428 — AI Systems Course</p>
              <p className="text-[#4A5568] text-[13px] mt-[24px]">© 2025 Planora</p>
            </div>

            <div className="flex flex-col gap-[6px]">
              <h4 className="text-[#4A5568] text-[11px] font-bold tracking-[0.1em] uppercase mb-[16px]">DEVELOPER</h4>
              <p className="text-white font-bold text-[16px]">[Your Full Name]</p>
              <p className="text-[#8B95A1] text-[14px]">Roll No: [Your Roll Number]</p>
              <p className="text-[#8B95A1] text-[14px]">[Branch] — [Semester]</p>
              <p className="text-[#8B95A1] text-[14px]">[University Name]</p>
              <p className="text-[#8B95A1] text-[14px]">Guide: [Faculty Name]</p>
            </div>

            <div className="flex flex-col gap-[12px]">
              <h4 className="text-[#4A5568] text-[11px] font-bold tracking-[0.1em] uppercase mb-[4px]">CONNECT</h4>
              <a href="https://github.com/GowthamSai477/planora-ai" target="_blank" rel="noopener noreferrer" className="flex items-center gap-[8px] text-[#8B95A1] hover:text-white transition-colors duration-200">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                GowthamSai477/planora-ai
              </a>
              <a href="#" className="flex items-center gap-[8px] text-[#8B95A1] hover:text-white transition-colors duration-200">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                linkedin.com/in/[username]
              </a>
              <a href="#" className="flex items-center gap-[8px] text-[#8B95A1] hover:text-white transition-colors duration-200">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path></svg>
                @[username]
              </a>
            </div>

          </div>

          <div className="border-t border-[#1C2333] pt-[32px] text-center">
            <p className="text-[#4A5568] text-[12px]">Built with ❤️ using Next.js · FastAPI · Groq AI · Supabase</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChatBubble({ role, text, delay }: { role: "ai" | "user", text: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className={`rounded-[12px] p-[8px_14px] text-[14px] max-w-[85%] ${
        role === "ai" 
          ? "bg-white/5 text-white mr-auto" 
          : "bg-[#7C6FF7]/20 text-[#7C6FF7] ml-auto"
      }`}
    >
      {text}
    </motion.div>
  );
}

function FeatureCard({ icon, title, desc, delay }: { icon: React.ReactNode, title: string, desc: string, delay: number }) {
  return (
    <FadeInWhenVisible delay={delay}>
      <div className="group bg-[#0D1117] border border-[#1C2333] hover:border-[#7C6FF7]/40 rounded-[16px] p-[24px] transition-all duration-300 h-full">
        <div className="w-[24px] h-[24px] text-[#7C6FF7] group-hover:text-[#9b8bfa] transition-colors">
          {icon}
        </div>
        <h3 className="text-white font-bold text-[18px] mt-[16px]">{title}</h3>
        <p className="text-[#8B95A1] text-[14px] leading-[1.6] mt-[8px]">
          {desc}
        </p>
      </div>
    </FadeInWhenVisible>
  );
}
