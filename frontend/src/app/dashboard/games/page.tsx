"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { 
  Award, Flame, TrendingUp, Sparkles, Brain, Loader2, Play, ChevronRight, FileText, CheckCircle2, Clock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";

type GamificationStatus = {
  xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  badges: string[];
};

type Flashcard = {
  term: string;
  definition: string;
};

export default function GamesPage() {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  
  // Game Setup
  const [activeGame, setActiveGame] = useState<"none" | "match" | "trivia">("none");
  const [topic, setTopic] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Notes Import
  const [studyNotes, setStudyNotes] = useState<any[]>([]);
  const [selectedNoteContent, setSelectedNoteContent] = useState<string | null>(null);

  // Match Game State
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [cards, setCards] = useState<{id: string, text: string, isTerm: boolean, matched: boolean}[]>([]);
  const [flippedIds, setFlippedIds] = useState<string[]>([]);
  
  // Trivia Game State
  const [triviaQuestions, setTriviaQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [triviaScore, setTriviaScore] = useState(0);
  const [triviaOver, setTriviaOver] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/gamification/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setStatus(await res.json());
    } catch (err) {}
  }, [getToken]);

  const fetchNotes = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setStudyNotes(await res.json());
    } catch (err) {}
  }, [getToken]);

  useEffect(() => {
    fetchStatus();
    fetchNotes();
  }, [fetchStatus, fetchNotes]);

  const awardXp = async (amount: number, reason: string) => {
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/gamification/add-xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, reason })
      });
      fetchStatus();
    } catch (e) {}
  };

  // --- Start Games ---
  const handleStartMatch = async () => {
    if (!topic && !selectedNoteContent) return;
    setIsGenerating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/gamification/generate-flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic, file_content: selectedNoteContent, num_cards: 6 })
      });
      if (res.ok) {
        const data = await res.json();
        setFlashcards(data.flashcards);
        
        // Prepare deck
        let deck: {id: string, text: string, isTerm: boolean, matched: boolean}[] = [];
        data.flashcards.forEach((fc: any, i: number) => {
          deck.push({ id: `term-${i}`, text: fc.term, isTerm: true, matched: false });
          deck.push({ id: `def-${i}`, text: fc.definition, isTerm: false, matched: false });
        });
        // Shuffle
        deck = deck.sort(() => Math.random() - 0.5);
        setCards(deck);
        setActiveGame("match");
        setFlippedIds([]);
      }
    } catch (err) {
      alert("Failed to generate game");
    }
    setIsGenerating(false);
  };

  const handleStartTrivia = async () => {
    if (!topic && !selectedNoteContent) return;
    setIsGenerating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/generate-quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic, file_content: selectedNoteContent, quiz_type: "mcq", difficulty: "hard", num_questions: 10 })
      });
      if (res.ok) {
        const data = await res.json();
        setTriviaQuestions(data.questions);
        setTriviaScore(0);
        setCurrentQuestion(0);
        setTriviaOver(false);
        setActiveGame("trivia");
      }
    } catch (err) {
      alert("Failed to generate trivia");
    }
    setIsGenerating(false);
  };

  // --- Match Game Logic ---
  const handleCardClick = (id: string) => {
    if (flippedIds.length === 2) return;
    if (flippedIds.includes(id)) return;
    if (cards.find(c => c.id === id)?.matched) return;

    const newFlipped = [...flippedIds, id];
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      const idx1 = parseInt(newFlipped[0].split("-")[1]);
      const idx2 = parseInt(newFlipped[1].split("-")[1]);
      
      if (idx1 === idx2) {
        // Match!
        setTimeout(() => {
          setCards(prev => prev.map(c => c.id === newFlipped[0] || c.id === newFlipped[1] ? { ...c, matched: true } : c));
          setFlippedIds([]);
          
          // Check if game over
          const newMatched = cards.filter(c => c.matched).length + 2;
          if (newMatched === cards.length) {
            awardXp(50, "match_game_win");
          }
        }, 500);
      } else {
        // No match
        setTimeout(() => {
          setFlippedIds([]);
        }, 1000);
      }
    }
  };

  // --- Trivia Game Logic ---
  const handleTriviaAnswer = (letter: string) => {
    const q = triviaQuestions[currentQuestion];
    if (q.correct === letter) {
      setTriviaScore(prev => prev + 1);
      awardXp(5, "trivia_correct_answer");
    }
    
    if (currentQuestion < triviaQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setTriviaOver(true);
    }
  };

  const getProgressPercentage = () => {
    if (!status) return 0;
    const currentLvlXp = Math.pow(status.level - 1, 2) * 50;
    const nextLvlXp = Math.pow(status.level, 2) * 50;
    const progress = status.xp - currentLvlXp;
    const totalNeeded = nextLvlXp - currentLvlXp;
    return (progress / totalNeeded) * 100;
  };
  return (
    <div className="h-full flex flex-col gap-8 pb-20 overflow-y-auto pr-2 custom-scrollbar">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-accent to-purple-500 text-white rounded-2xl flex items-center justify-center shadow-[0_0_15px_var(--color-accent-glow)]">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Games & Rewards</h1>
            <p className="text-muted text-sm font-medium mt-1">Earn XP by challenging your knowledge</p>
          </div>
        </div>
      </div>

      {status && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Player Profile Card */}
          <div className="lg:col-span-2 bg-white border border-card-border rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:bg-accent/10 transition-colors duration-700"></div>
            
            <div className="flex flex-col md:flex-row gap-12 items-center relative z-10">
              {/* Level Ring */}
              <div className="relative w-44 h-44 flex shrink-0 items-center justify-center bg-secondary/30 rounded-full border-[10px] border-white shadow-xl">
                <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-sm">
                  <circle cx="50%" cy="50%" r="44%" className="fill-transparent stroke-secondary stroke-[10px]" />
                  <circle cx="50%" cy="50%" r="44%" className="fill-transparent stroke-accent stroke-[10px] transition-all duration-1000 ease-out" 
                    strokeLinecap="round"
                    strokeDasharray="276" strokeDashoffset={276 - (276 * getProgressPercentage()) / 100} />
                </svg>
                <div className="text-center">
                  <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Level</p>
                  <p className="text-6xl font-black text-foreground tracking-tighter drop-shadow-sm">{status.level}</p>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest mb-4">
                  <Sparkles size={12} /> Elite Scholar
                </div>
                <h2 className="text-3xl font-black mb-2 tracking-tight">Player Profile</h2>
                <p className="text-muted font-medium mb-8 max-w-md">You have <span className="text-foreground font-bold">{status.xp} Total XP</span>. Keep studying to reach the next rank and unlock exclusive badges!</p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                  <div className="bg-orange-500/5 border border-orange-500/10 px-6 py-4 rounded-[1.5rem] flex items-center gap-4 transition-all hover:bg-orange-500/10">
                    <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                      <Flame size={20} className="fill-white" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-orange-500/70 uppercase tracking-widest">Current Streak</p>
                      <p className="text-xl font-black text-orange-500">{status.current_streak} Days</p>
                    </div>
                  </div>
                  <div className="bg-accent/5 border border-accent/10 px-6 py-4 rounded-[1.5rem] flex items-center gap-4 transition-all hover:bg-accent/10">
                    <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-accent/20">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-accent/70 uppercase tracking-widest">Longest Streak</p>
                      <p className="text-xl font-black text-accent">{status.longest_streak} Days</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Badges Card */}
          <div className="bg-white border border-card-border rounded-[2.5rem] p-8 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">Badges Earned</h3>
              <div className="w-8 h-8 bg-secondary/50 rounded-lg flex items-center justify-center text-muted">
                <Award size={16} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 custom-scrollbar pr-1">
              {status.badges.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center justify-center text-center text-muted py-10 opacity-40">
                  <Award size={40} className="mb-4 stroke-[1px]" />
                  <p className="text-xs font-bold uppercase tracking-widest">No badges yet</p>
                </div>
              ) : (
                status.badges.map(b => (
                  <div key={b} className="bg-secondary/30 border border-card-border/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 group hover:bg-white hover:border-accent/30 hover:shadow-md transition-all duration-300">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-accent shadow-sm group-hover:scale-110 transition-transform">
                      <Award size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tight leading-tight">{b.replace(/-/g, " ")}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game Selector */}
      {activeGame === "none" && (
        <div className="bg-white border border-card-border rounded-[2.5rem] p-10 shadow-sm">
          <h2 className="text-2xl font-black mb-8 tracking-tight">Choose a Game</h2>
          
          <div className="max-w-2xl flex flex-col md:flex-row gap-6 mb-12">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-3 px-1">1. Select Study Material</label>
              <div className="relative">
                <select 
                  className="w-full bg-secondary/30 border border-card-border rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-foreground transition-all appearance-none"
                  onChange={(e) => {
                    const note = studyNotes.find(n => n.id === e.target.value);
                    setSelectedNoteContent(note?.content || null);
                    setTopic(""); // clear topic if note selected
                  }}
                >
                  <option value="">-- Use a Manual Topic Below --</option>
                  {studyNotes.map(n => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                  <ChevronRight size={16} className="rotate-90" />
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-end">
              {!selectedNoteContent ? (
                <>
                  <label className="block text-[10px] font-black text-muted uppercase tracking-widest mb-3 px-1">2. Or Type Manual Topic</label>
                  <input 
                    type="text" 
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g. World War 2, Photosynthesis..."
                    className="w-full bg-secondary/30 border border-card-border rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  />
                </>
              ) : (
                <div className="h-[60px] flex items-center px-5 bg-accent/5 border border-accent/20 rounded-2xl">
                   <div className="flex items-center gap-3">
                     <FileText className="text-accent" size={18} />
                     <span className="text-xs font-black text-accent uppercase tracking-widest">Note Selected</span>
                   </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-card-border rounded-[2rem] p-8 bg-white hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5 transition-all duration-500 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-accent/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-6">
                <Brain size={32} />
              </div>
              <h3 className="text-2xl font-black mb-3 tracking-tight">Memory Match</h3>
              <p className="text-sm text-muted font-medium mb-8 leading-relaxed">AI generates flip-cards from your notes. Match terms with definitions. <span className="text-accent font-bold">Earn +50 XP</span> for winning.</p>
              <button 
                onClick={handleStartMatch}
                disabled={(!topic && !selectedNoteContent) || isGenerating}
                className="w-full bg-accent text-white py-4 rounded-2xl font-black text-sm hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-accent/20 group/btn"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin"/> : <Play className="w-5 h-5 fill-white group-hover/btn:scale-110 transition-transform"/>} PLAY MATCH
              </button>
            </div>

            <div className="border border-card-border rounded-[2rem] p-8 bg-white hover:border-red-500/30 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-500 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                <Clock size={32} />
              </div>
              <h3 className="text-2xl font-black mb-3 tracking-tight">Survival Trivia</h3>
              <p className="text-sm text-muted font-medium mb-8 leading-relaxed">AI fires hard multiple-choice questions at you. Survive the gauntlet. <span className="text-red-500 font-bold">Earn +5 XP</span> per correct answer.</p>
              <button 
                onClick={handleStartTrivia}
                disabled={(!topic && !selectedNoteContent) || isGenerating}
                className="w-full bg-red-500 text-white py-4 rounded-2xl font-black text-sm hover:bg-red-500/90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-red-500/20 group/btn"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin"/> : <Play className="w-5 h-5 fill-white group-hover/btn:scale-110 transition-transform"/>} PLAY TRIVIA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memory Match Board */}
      {activeGame === "match" && (
        <div className="bg-surface border border-border rounded-3xl p-8 shadow-xl flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black">Memory Match</h2>
            <button onClick={() => setActiveGame("none")} className="px-4 py-2 bg-surface-elevated rounded-xl text-xs font-bold hover:bg-border transition-colors">Quit Game</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full max-w-4xl">
            {cards.map((card) => {
              const isFlipped = flippedIds.includes(card.id) || card.matched;
              return (
                <div 
                  key={card.id} 
                  onClick={() => handleCardClick(card.id)}
                  className="relative h-40 cursor-pointer perspective-1000"
                >
                  <motion.div 
                    initial={false}
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    transition={{ duration: 0.4, type: "spring", stiffness: 260, damping: 20 }}
                    className="w-full h-full relative preserve-3d"
                  >
                    {/* Front (Hidden) */}
                    <div className="absolute inset-0 backface-hidden bg-primary rounded-2xl flex items-center justify-center border-4 border-primary-hover shadow-lg">
                      <Brain className="w-8 h-8 text-white opacity-50" />
                    </div>
                    {/* Back (Revealed) */}
                    <div className="absolute inset-0 backface-hidden bg-surface-elevated border-2 border-primary rounded-2xl p-4 flex items-center justify-center text-center shadow-lg rotate-y-180 overflow-y-auto custom-scrollbar">
                      <p className={clsx("font-bold text-sm leading-tight", card.isTerm ? "text-primary" : "text-foreground text-xs")}>{card.text}</p>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>

          {cards.every(c => c.matched) && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mt-10 bg-green-500/10 border border-green-500/30 text-green-500 px-8 py-6 rounded-3xl flex flex-col items-center text-center">
              <CheckCircle2 className="w-16 h-16 mb-4" />
              <h2 className="text-3xl font-black mb-2">You Won!</h2>
              <p className="font-bold">+50 XP Added to Profile</p>
              <button onClick={() => setActiveGame("none")} className="mt-6 bg-green-500 text-white px-6 py-2 rounded-xl font-bold">Play Again</button>
            </motion.div>
          )}
        </div>
      )}

      {/* Trivia Board */}
      {activeGame === "trivia" && !triviaOver && (
        <div className="bg-surface border border-border rounded-3xl p-10 shadow-xl max-w-3xl mx-auto w-full">
           <div className="w-full flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black">Survival Trivia</h2>
            <div className="flex items-center gap-4">
              <span className="text-primary font-black">Score: {triviaScore}</span>
              <button onClick={() => setActiveGame("none")} className="px-4 py-2 bg-surface-elevated rounded-xl text-xs font-bold hover:bg-border transition-colors">Quit</button>
            </div>
          </div>

          <div className="mb-8">
            <p className="text-sm font-black text-muted uppercase tracking-widest mb-2">Question {currentQuestion + 1} of {triviaQuestions.length}</p>
            <h3 className="text-2xl font-medium leading-relaxed">{triviaQuestions[currentQuestion].question}</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {Object.entries(triviaQuestions[currentQuestion].options).map(([letter, text]) => (
              <button 
                key={letter}
                onClick={() => handleTriviaAnswer(letter)}
                className="w-full text-left bg-surface-elevated hover:bg-primary/10 hover:border-primary/50 border border-border rounded-2xl p-5 transition-all flex items-center gap-4 group"
              >
                <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center font-black text-sm group-hover:bg-primary group-hover:text-white transition-colors">
                  {letter}
                </div>
                <span className="font-medium flex-1">{text as string}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeGame === "trivia" && triviaOver && (
        <div className="bg-surface border border-border rounded-3xl p-12 shadow-xl max-w-2xl mx-auto w-full text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
            <Award className="w-12 h-12" />
          </div>
          <h2 className="text-4xl font-black mb-4">Gauntlet Complete</h2>
          <p className="text-muted font-medium mb-8">You answered {triviaScore} out of {triviaQuestions.length} correctly.</p>
          
          <div className="bg-surface-elevated border border-border w-full rounded-2xl p-6 mb-8 flex justify-around">
             <div>
               <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">XP Earned</p>
               <p className="text-3xl font-black text-primary">+{triviaScore * 5}</p>
             </div>
          </div>

          <button onClick={() => setActiveGame("none")} className="bg-primary text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:scale-105 transition-all">Back to Games Menu</button>
        </div>
      )}

      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}
