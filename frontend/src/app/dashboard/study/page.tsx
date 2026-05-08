"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { 
  FileText, BookOpen, Brain, Upload, X, Send, Loader2, 
  CheckCircle2, AlertCircle, ArrowRight, RotateCcw, 
  HelpCircle, MessageSquare, List, Sparkles, Plus, ExternalLink, Trash2, Edit3, ChevronDown
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import Link from "next/link";

type Tab = "documents" | "quiz" | "notes";

type FileItem = {
  id: string;
  name: string;
  content: string;
  type: string;
  added_at: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type QuizQuestion = {
  question: string;
  options?: { A: string; B: string; C: string; D: string };
  correct?: string;
  explanation?: string;
  model_answer?: string;
  key_points?: string[];
};

export default function StudyPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("documents");
  
  // --- Documents State ---
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Quiz State ---
  const [quizStep, setQuizStep] = useState<"setup" | "active" | "results">("setup");
  const [quizType, setQuizType] = useState<"mcq" | "descriptive">("mcq");
  const [quizTopic, setQuizTopic] = useState("");
  const [useUploaded, setUseUploaded] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [isGrading, setIsGrading] = useState(false);

  // --- Notes State ---
  const [studyNotes, setStudyNotes] = useState<any[]>([]);

  useEffect(() => {
    // Load files from localStorage
    const savedFiles = localStorage.getItem("planora_study_files");
    if (savedFiles) setFiles(jsonSafeParse(savedFiles, []));
    
    // Load notes
    fetchStudyNotes();
  }, []);

  useEffect(() => {
    localStorage.setItem("planora_study_files", JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const jsonSafeParse = (str: string, fallback: any) => {
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const fetchStudyNotes = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudyNotes(data);
      }
    } catch (err) {}
  };

  // --- Document Handlers ---
  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer) => {
    try {
      if (!(window as any).pdfjsLib) {
        // Dynamically load the script if it failed from layout.tsx
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      
      // @ts-ignore
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += pageText + "\n";
      }
      
      return fullText;
    } catch (err) {
      console.error("PDF extraction failed", err);
      return "Failed to extract text from PDF.";
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      let content = "";
      if (file.type === "application/pdf") {
        setIsAnalyzing(true);
        const arrayBuffer = event.target?.result as ArrayBuffer;
        content = await extractTextFromPdf(arrayBuffer);
        setIsAnalyzing(false);
      } else {
        content = event.target?.result as string;
      }

      const newFile: FileItem = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        content: content,
        type: file.type,
        added_at: new Date().toISOString()
      };
      setFiles([newFile, ...files]);
      setSelectedFile(newFile);
    };

    if (file.type === "application/pdf") {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleSelectNote = (noteId: string) => {
    if (!noteId) return;
    const note = studyNotes.find(n => n.id === noteId);
    if (!note) return;
    
    const newFile: FileItem = {
      id: note.id,
      name: note.title || "Untitled Note",
      content: note.content,
      type: "note",
      added_at: new Date().toISOString()
    };
    
    setFiles([newFile, ...files]);
    setSelectedFile(newFile);
  };

  const handleDocumentAction = async (action: string, messageOverride?: string) => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    
    const msg = messageOverride || chatInput;
    if (!messageOverride) {
      setChatMessages(prev => [...prev, { role: "user", content: msg }]);
      setChatInput("");
    }

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/analyze`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          message: msg,
          file_content: selectedFile.content,
          file_name: selectedFile.name,
          action: action
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: "assistant", content: data.response }]);
        if (data.note_created) {
            fetchStudyNotes();
        }
      } else {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.detail || `Server Error: ${res.status}`;
        alert(`Analysis Failed: ${errorMessage}`);
      }
    } catch (err) {
      console.error("Analysis failed", err);
      alert("Failed to connect to the server.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Quiz Handlers ---
  const handleStartQuiz = async () => {
    setIsGeneratingQuiz(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/generate-quiz`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          topic: quizTopic,
          file_content: useUploaded && selectedFile ? selectedFile.content : null,
          quiz_type: quizType,
          difficulty: difficulty,
          num_questions: numQuestions
        })
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setQuizStep("active");
        setCurrentQuestionIdx(0);
        setUserAnswers([]);
      } else {
        const errorData = await res.json().catch(() => null);
        const errorMessage = errorData?.detail || `Server Error: ${res.status}`;
        alert(`Quiz Generation Failed: ${errorMessage}`);
      }
    } catch (err) {
      console.error("Quiz generation failed", err);
      alert("Failed to connect to the server.");
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else {
      if (quizType === "mcq") {
        calculateMcqResults();
      } else {
        gradeDescriptiveQuiz();
      }
    }
  };

  const calculateMcqResults = () => {
    let score = 0;
    const breakdown = questions.map((q, idx) => {
      const isCorrect = userAnswers[idx] === q.correct;
      if (isCorrect) score++;
      return { ...q, userAnswer: userAnswers[idx], isCorrect };
    });
    setQuizResults({ score, total: questions.length, breakdown });
    setQuizStep("results");
    
    // Award Gamification XP
    getToken().then(token => {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/gamification/add-xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 50, reason: "quiz_completion" })
      }).catch(() => {});
    });
  };

  const gradeDescriptiveQuiz = async () => {
    setIsGrading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/study/grade-descriptive`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          questions: questions,
          answers: userAnswers
        })
      });

      if (res.ok) {
        const data = await res.json();
        const totalScore = data.results.reduce((acc: number, r: any) => acc + r.score, 0);
        setQuizResults({ 
          score: (totalScore / (questions.length * 10)) * 100, 
          isPercentage: true,
          total: 100,
          breakdown: data.results 
        });
        setQuizStep("results");
        
        // Award Gamification XP
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/gamification/add-xp`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ amount: 100, reason: "descriptive_quiz_completion" })
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Grading failed", err);
    } finally {
      setIsGrading(false);
    }
  };

  const handleSaveQuizToNotes = async () => {
    if (!quizResults) return;
    const content = `## Quiz Results: ${quizTopic || "Study Session"}
Date: ${new Date().toLocaleDateString()}
Score: ${quizResults.isPercentage ? quizResults.score + "%" : quizResults.score + "/" + quizResults.total}

### Breakdown:
${quizResults.breakdown.map((b: any, idx: number) => `
**Q${idx + 1}: ${b.question}**
Your Answer: ${b.userAnswer || b.student_answer}
${quizType === "mcq" ? `Correct: ${b.correct}\nExplanation: ${b.explanation}` : `Score: ${b.score}/10\nFeedback: ${b.feedback}`}
`).join("\n---")}`;

    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          title: `Quiz: ${quizTopic || "Untitled"}`,
          content: content,
          tags: "quiz_results, study",
          source: "study_mode"
        })
      });
      if (res.ok) {
        alert("Quiz results saved to your notes!");
        fetchStudyNotes();
      }
    } catch (err) {}
  };

  return (
    <div className="flex flex-col gap-10 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-accent to-purple-500 text-white rounded-2xl flex items-center justify-center shadow-[0_0_15px_var(--color-accent-glow)]">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Study</h1>
            <p className="text-muted text-sm font-medium mt-1">Upload documents and generate study materials</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8">
      {/* Tabs */}
      <div className="flex items-center gap-2 bg-secondary/30 p-1.5 rounded-[20px] w-fit border border-card-border/50 shadow-inner">
        {[
          { id: "documents", label: "Documents", icon: FileText },
          { id: "quiz", label: "Quiz", icon: HelpCircle },
          { id: "notes", label: "My Notes", icon: BookOpen },
        ].map(tab => (
          <button 
            key={tab.id}
            suppressHydrationWarning
            onClick={() => setActiveTab(tab.id as Tab)}
            className={clsx(
              "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-black tracking-tight transition-all duration-300",
              activeTab === tab.id 
                ? "bg-white text-accent shadow-md shadow-accent/10" 
                : "text-muted hover:text-foreground hover:bg-white/50"
            )}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "documents" && (
            <motion.div 
              key="documents"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex flex-col md:flex-row gap-6"
            >
              {/* Left Panel: Files */}
              <div className="w-full md:w-80 flex flex-col gap-4">
                <div className="bg-white border border-card-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                  <label className="flex flex-col items-center justify-center bg-accent/5 border border-accent/20 rounded-2xl p-6 cursor-pointer hover:bg-accent/10 hover:border-accent transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Upload size={40} />
                    </div>
                    <Upload className="w-8 h-8 text-accent group-hover:scale-110 transition-transform mb-3" />
                    <span className="text-xs font-black text-accent text-center uppercase tracking-widest">Drop PDF or Text</span>
                    <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleFileUpload} />
                  </label>
                  
                  <div className="flex items-center gap-3 px-2 text-[10px] font-black text-muted uppercase tracking-widest">
                    <div className="flex-1 h-px bg-card-border/50"></div>
                    <span>OR</span>
                    <div className="flex-1 h-px bg-card-border/50"></div>
                  </div>

                  <div className="relative">
                    <select 
                      suppressHydrationWarning
                      onChange={(e) => { handleSelectNote(e.target.value); e.target.value = ""; }}
                      className="w-full bg-secondary/30 border border-card-border rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-foreground transition-all appearance-none"
                      defaultValue=""
                    >
                      <option value="" disabled>Import existing Note...</option>
                      {studyNotes.map(n => (
                        <option key={n.id} value={n.id}>{n.title || "Untitled Note"}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {files.length === 0 ? (
                    <div className="text-center py-10 text-muted text-sm italic">No files uploaded.</div>
                  ) : (
                    files.map(file => (
                      <div 
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        className={clsx(
                          "group relative p-4 rounded-2xl border cursor-pointer transition-all duration-300",
                          selectedFile?.id === file.id 
                            ? "bg-accent/5 border-accent/40 shadow-sm" 
                            : "bg-white border-card-border hover:border-accent/30 hover:shadow-md hover:shadow-accent/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-surface-elevated rounded-lg flex items-center justify-center text-muted shrink-0">
                            <FileText size={16} />
                          </div>
                          <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                          <button 
                            suppressHydrationWarning
                            onClick={(e) => { e.stopPropagation(); setFiles(files.filter(f => f.id !== file.id)); if (selectedFile?.id === file.id) setSelectedFile(null); }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded-md transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Panel: Chat */}
              <div className="flex-1 bg-white border border-card-border rounded-[2rem] flex flex-col shadow-sm overflow-hidden relative">
                {selectedFile ? (
                  <>
                    <div className="px-6 py-4 border-b border-card-border/50 flex items-center justify-between bg-secondary/5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
                          <FileText size={16} />
                        </div>
                        <span className="font-black text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {["Summarize", "Key Concepts", "Create Notes"].map(action => (
                          <button 
                            key={action}
                            suppressHydrationWarning
                            onClick={() => handleDocumentAction(action.toLowerCase().replace(" ", "_"), action)}
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-white border border-card-border/50 text-accent hover:bg-accent hover:text-white transition-all shadow-sm"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
                          <Brain size={48} className="text-primary mb-4" />
                          <p className="text-sm font-medium">Ask anything about this document...</p>
                        </div>
                      )}
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                          <div className={clsx(
                            "max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed",
                            msg.role === "user" 
                              ? "bg-primary text-white shadow-lg shadow-primary/20" 
                              : "bg-surface-elevated text-foreground prose dark:prose-invert prose-sm"
                          )}>
                            {msg.role === "assistant" ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown> : msg.content}
                          </div>
                        </div>
                      ))}
                      {isAnalyzing && (
                        <div className="flex justify-start">
                          <div className="bg-surface-elevated rounded-2xl p-4 flex items-center gap-3">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-xs text-muted font-medium">AI is studying...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-card-border/50 bg-white">
                      <div className="relative">
                        <input 
                          suppressHydrationWarning
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleDocumentAction("chat")}
                          placeholder="Type your question..."
                          className="w-full bg-secondary/30 border border-card-border rounded-2xl pl-5 pr-14 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        />
                        <button 
                          suppressHydrationWarning
                          onClick={() => handleDocumentAction("chat")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white">
                    <div className="w-24 h-24 bg-accent/5 rounded-full flex items-center justify-center text-accent mb-8 relative">
                      <BookOpen size={40} className="opacity-40" />
                      <div className="absolute -top-1 -right-1 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center shadow-lg shadow-accent/20">
                        <Upload size={16} />
                      </div>
                    </div>
                    <h2 className="text-2xl font-black mb-4 tracking-tight">Upload a study document</h2>
                    <p className="text-muted font-medium text-sm max-w-xs mx-auto leading-relaxed">
                      Once uploaded, you can ask questions, generate summaries, and extract key concepts with AI precision.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "quiz" && (
            <motion.div 
              key="quiz"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col"
            >
              {quizStep === "setup" && (
                <div className="max-w-lg mx-auto w-full mt-12 space-y-8">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold mb-2">Knowledge Quiz</h2>
                    <p className="text-muted text-sm">Test your understanding with Gemini-powered questions.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex justify-between">
                        <span>Quiz Topic</span>
                        <button suppressHydrationWarning onClick={() => setUseUploaded(!useUploaded)} className="text-xs text-primary hover:underline">
                          {useUploaded ? "Type manually" : "Use uploaded document"}
                        </button>
                      </label>
                      {useUploaded ? (
                        <select 
                          suppressHydrationWarning
                          value={selectedFile?.id || ""}
                          onChange={(e) => setSelectedFile(files.find(f => f.id === e.target.value) || null)}
                          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 appearance-none"
                        >
                          <option value="">Select a document...</option>
                          {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      ) : (
                        <input 
                          suppressHydrationWarning
                          type="text" 
                          placeholder="Enter a topic (e.g. Photosynthesis)"
                          value={quizTopic}
                          onChange={(e) => setQuizTopic(e.target.value)}
                          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary/50 transition-all"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: "mcq", label: "MCQ", icon: List },
                        { id: "descriptive", label: "Descriptive", icon: Edit3 },
                      ].map(type => (
                        <button 
                          key={type.id}
                          suppressHydrationWarning
                          onClick={() => setQuizType(type.id as any)}
                          className={clsx(
                            "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300",
                            quizType === type.id 
                              ? "border-primary bg-primary/5 shadow-lg" 
                              : "border-border bg-surface hover:border-primary/20"
                          )}
                        >
                          <type.icon size={24} className={quizType === type.id ? "text-primary" : "text-muted"} />
                          <span className={clsx("font-bold text-sm", quizType === type.id ? "text-primary" : "text-muted")}>{type.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Difficulty</label>
                        <div className="flex bg-surface-elevated rounded-lg p-1">
                          {["easy", "medium", "hard"].map(d => (
                            <button key={d} suppressHydrationWarning onClick={() => setDifficulty(d)} className={clsx("flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all", difficulty === d ? "bg-surface text-primary shadow-sm" : "text-muted")}>
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="w-24 space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Questions</label>
                        <input type="number" min="1" max="20" value={numQuestions || ""} onChange={(e) => setNumQuestions(e.target.value === "" ? 0 : parseInt(e.target.value))} className="w-full bg-surface-elevated rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none" />
                      </div>
                    </div>

                    <button 
                      suppressHydrationWarning
                      onClick={handleStartQuiz}
                      disabled={isGeneratingQuiz || (!quizTopic && !selectedFile)}
                      className="w-full bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20"
                    >
                      {isGeneratingQuiz ? <><Loader2 className="w-5 h-5 animate-spin" /> Preparing Quiz...</> : <><Sparkles className="w-5 h-5" /> Start Quiz <ArrowRight className="w-5 h-5" /></>}
                    </button>
                  </div>
                </div>
              )}

              {quizStep === "active" && questions.length > 0 && (
                <div className="max-w-2xl mx-auto w-full mt-6 space-y-8">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold text-muted uppercase tracking-widest">
                      <span>Question {currentQuestionIdx + 1} of {questions.length}</span>
                      <span>{Math.round(((currentQuestionIdx + 1) / questions.length) * 100)}% Complete</span>
                    </div>
                    <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentQuestionIdx + 1) / questions.length) * 100}%` }}
                        className="h-full bg-primary shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                      />
                    </div>
                  </div>

                  <div className="bg-surface border border-border rounded-3xl p-8 shadow-xl">
                    <h3 className="text-xl font-bold leading-tight mb-8">
                      {questions[currentQuestionIdx].question}
                    </h3>

                    {quizType === "mcq" ? (
                      <div className="grid grid-cols-1 gap-3">
                        {Object.entries(questions[currentQuestionIdx].options || {}).map(([key, value]) => (
                          <button 
                            key={key}
                            suppressHydrationWarning
                            onClick={() => {
                              const newAnswers = [...userAnswers];
                              newAnswers[currentQuestionIdx] = key;
                              setUserAnswers(newAnswers);
                            }}
                            className={clsx(
                              "flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-300",
                              userAnswers[currentQuestionIdx] === key 
                                ? "border-primary bg-primary/5" 
                                : "border-border hover:border-primary/20"
                            )}
                          >
                            <span className={clsx(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                              userAnswers[currentQuestionIdx] === key ? "bg-primary text-white" : "bg-surface-elevated text-muted"
                            )}>
                              {key}
                            </span>
                            <span className="font-medium">{value}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <textarea 
                          suppressHydrationWarning
                          value={userAnswers[currentQuestionIdx] || ""}
                          onChange={(e) => {
                            const newAnswers = [...userAnswers];
                            newAnswers[currentQuestionIdx] = e.target.value;
                            setUserAnswers(newAnswers);
                          }}
                          placeholder="Type your answer here..."
                          className="w-full h-48 bg-surface-elevated border border-border rounded-2xl p-6 text-sm leading-relaxed focus:outline-none focus:border-primary/50 transition-all resize-none"
                        />
                        <div className="flex justify-end">
                          <span className="text-[10px] font-bold text-muted uppercase">Word count: {(userAnswers[currentQuestionIdx] || "").split(/\s+/).filter(w => w).length}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between gap-4">
                    <button 
                      suppressHydrationWarning
                      onClick={() => setCurrentQuestionIdx(currentQuestionIdx - 1)}
                      disabled={currentQuestionIdx === 0}
                      className="px-6 py-3 rounded-xl border border-border text-sm font-bold hover:bg-surface-elevated disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <button 
                      suppressHydrationWarning
                      onClick={handleNextQuestion}
                      disabled={!userAnswers[currentQuestionIdx] || isGrading}
                      className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      {isGrading ? <Loader2 size={20} className="animate-spin" /> : (currentQuestionIdx === questions.length - 1 ? "Finish Quiz" : "Next Question")} <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              )}

              {quizStep === "results" && quizResults && (
                <div className="max-w-3xl mx-auto w-full mt-6 space-y-8 pb-10">
                  <div className="bg-surface border border-border rounded-[2rem] p-10 text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-purple-500 to-primary" />
                    
                    <div className={clsx(
                      "w-40 h-40 rounded-full mx-auto flex flex-col items-center justify-center border-[10px] relative transition-all duration-1000",
                      quizResults.score >= 70 ? "border-emerald-500 text-emerald-500" : quizResults.score >= 50 ? "border-amber-500 text-amber-500" : "border-red-500 text-red-500"
                    )}>
                      <span className="text-6xl font-black">{quizResults.isPercentage ? Math.round(quizResults.score) : quizResults.score}</span>
                      <span className="text-sm font-bold uppercase tracking-widest">{quizResults.isPercentage ? "Percent" : `Out of ${quizResults.total}`}</span>
                      
                      <div className="absolute -inset-4 rounded-full border border-current opacity-20 animate-ping" />
                    </div>

                    <div className="space-y-2">
                      <h2 className="text-3xl font-black tracking-tight">
                        {quizResults.score >= 90 ? "Master Performance!" : quizResults.score >= 70 ? "Excellent Work!" : quizResults.score >= 50 ? "Good Effort!" : "Keep Practicing!"}
                      </h2>
                      <p className="text-muted font-medium max-w-md mx-auto">
                        You've completed the **{quizTopic || "Study Session"}** quiz. Review your performance below to bridge your knowledge gaps.
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-4">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-muted uppercase">Correct</span>
                        <span className="text-lg font-bold text-emerald-500">{quizType === "mcq" ? quizResults.breakdown.filter((b:any) => b.isCorrect).length : "-"}</span>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-muted uppercase">Questions</span>
                        <span className="text-lg font-bold">{questions.length}</span>
                      </div>
                      <div className="w-px h-8 bg-border" />
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-muted uppercase">Level</span>
                        <span className="text-lg font-bold capitalize text-primary">{difficulty}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-3 px-2">
                      <List className="text-primary" /> Detailed Review
                    </h3>
                    {quizResults.breakdown.map((b: any, idx: number) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-surface border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-4">
                          <div className={clsx(
                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-1 shadow-sm",
                            quizType === "mcq" 
                              ? (b.isCorrect ? "bg-emerald-500 text-white" : "bg-red-500 text-white")
                              : (b.score >= 7 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white")
                          )}>
                            {quizType === "mcq" ? (b.isCorrect ? <CheckCircle2 size={20} /> : <X size={20} />) : <span className="text-sm font-black">{b.score}</span>}
                          </div>
                          <div className="flex-1 space-y-4">
                            <p className="font-bold text-lg leading-tight">{b.question}</p>
                            {quizType === "mcq" ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div className={clsx("p-3 rounded-xl border flex flex-col gap-1", b.isCorrect ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20")}>
                                    <span className="text-[10px] font-bold uppercase opacity-60">Your Answer</span>
                                    <span className={clsx("text-sm font-bold", b.isCorrect ? "text-emerald-600" : "text-red-600")}>{b.options[b.userAnswer] || b.userAnswer}</span>
                                  </div>
                                  {!b.isCorrect && (
                                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-1">
                                      <span className="text-[10px] font-bold uppercase opacity-60">Correct Answer</span>
                                      <span className="text-sm font-bold text-emerald-600">{b.options[b.correct]}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="p-4 bg-surface-elevated rounded-xl italic text-sm text-muted leading-relaxed border border-border">
                                  <Sparkles size={14} className="inline mr-2 text-primary" />
                                  {b.explanation}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="p-4 bg-surface-elevated rounded-xl border border-border">
                                  <p className="text-xs font-bold uppercase text-muted mb-2 tracking-tighter">Your Response</p>
                                  <p className="text-sm italic text-foreground/80">{b.student_answer}</p>
                                </div>
                                <div className="p-5 bg-primary/5 rounded-2xl border border-primary/20 relative overflow-hidden">
                                  <div className="absolute top-0 right-0 p-3">
                                    <Brain size={16} className="text-primary opacity-20" />
                                  </div>
                                  <p className="text-xs font-bold uppercase text-primary mb-2 tracking-tighter">AI Evaluation</p>
                                  <p className="text-sm font-medium leading-relaxed mb-4">{b.feedback}</p>
                                  {b.missed_points?.length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-bold uppercase text-amber-600 flex items-center gap-1">
                                        <AlertCircle size={12} /> Points to Improve
                                      </p>
                                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {b.missed_points.map((p: string, i: number) => (
                                          <li key={i} className="text-[11px] bg-white dark:bg-black/20 p-2 rounded-lg border border-border flex items-start gap-2">
                                            <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                            {p}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 pt-6">
                    <button suppressHydrationWarning onClick={() => setQuizStep("setup")} className="flex-1 px-6 py-4 rounded-2xl bg-surface-elevated border border-border font-bold flex items-center justify-center gap-2 hover:bg-surface-hover transition-all">
                      <RotateCcw size={18} /> New Quiz Session
                    </button>
                    <button suppressHydrationWarning onClick={handleSaveQuizToNotes} className="flex-1 px-6 py-4 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-primary-hover transition-all shadow-xl shadow-primary/20">
                      <FileText size={18} /> Export Results to Notes
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "notes" && (
            <motion.div 
              key="notes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="h-full flex flex-col items-center pt-10"
            >
              {studyNotes.length === 0 ? (
                <div className="text-center p-10 opacity-50">
                  <Brain size={64} className="mx-auto mb-4 text-primary" />
                  <h3 className="text-xl font-bold mb-2">No study notes yet</h3>
                  <p className="text-sm">Generate notes from your documents or quizzes to see them here.</p>
                </div>
              ) : (
                <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                  {studyNotes.map(note => (
                    <div key={note.id} className="bg-surface border border-border rounded-2xl p-6 shadow-sm group hover:border-primary/30 transition-all hover:shadow-md">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                          <Sparkles size={20} />
                        </div>
                        <Link href={`/dashboard/notes?id=${note.id}`} className="p-2 bg-surface-elevated rounded-lg text-muted hover:text-primary transition-all">
                          <ExternalLink size={16} />
                        </Link>
                      </div>
                      <h3 className="font-bold text-lg mb-2 truncate">{note.title}</h3>
                      <p className="text-xs text-muted line-clamp-3 mb-4 leading-relaxed">{note.content.substring(0, 200)}...</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {note.tags?.split(",").map((tag: string) => (
                          <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-surface-elevated text-muted font-bold uppercase">{tag.trim()}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/dashboard/notes" className="mt-12 flex items-center gap-2 text-primary font-bold text-sm hover:underline">
                View Workspace <ArrowRight size={16} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>

    <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.4);
        }
      `}</style>
    </div>
  );
}
