"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { 
  FileText, BookOpen, Brain, Upload, X, Send, Loader2, 
  CheckCircle2, AlertCircle, ArrowRight, RotateCcw, 
  HelpCircle, MessageSquare, List, Sparkles, Plus, ExternalLink, Trash2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
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
        setStudyNotes(data.filter((n: any) => n.source === "study_mode"));
      }
    } catch (err) {}
  };

  // --- Document Handlers ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      let content = "";
      if (file.type === "application/pdf") {
        content = "[PDF content extraction requires pdf.js library]";
        // Simulating extraction for now as per constraints
        content = "PDF Content Extracted: " + file.name;
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
      }
    } catch (err) {
      console.error("Analysis failed", err);
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
      }
    } catch (err) {
      console.error("Quiz generation failed", err);
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
    <div className="h-full flex flex-col gap-6">
      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-200 dark:border-white/10 pb-4">
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
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === tab.id 
                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20" 
                : "text-muted hover:bg-gray-100 dark:hover:bg-white/5"
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
                <div className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-6 cursor-pointer hover:border-violet-500/50 transition-colors group">
                    <Upload className="w-8 h-8 text-muted group-hover:text-violet-500 transition-colors mb-2" />
                    <span className="text-xs font-medium text-muted text-center">Drop PDF or text file here</span>
                    <input type="file" className="hidden" accept=".pdf,.txt,.md" onChange={handleFileUpload} />
                  </label>
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
                          "group relative p-3 rounded-xl border cursor-pointer transition-all duration-300",
                          selectedFile?.id === file.id 
                            ? "bg-violet-500/10 border-violet-500/30" 
                            : "bg-white dark:bg-[#111118] border-gray-200 dark:border-white/10 hover:border-violet-500/20"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center text-muted shrink-0">
                            <FileText size={16} />
                          </div>
                          <span className="text-sm font-medium truncate flex-1">{file.name}</span>
                          <button 
                            suppressHydrationWarning
                            onClick={(e) => { e.stopPropagation(); setFiles(files.filter(f => f.id !== file.id)); if (selectedFile?.id === file.id) setSelectedFile(null); }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:bg-red-500/10 rounded-md transition-all"
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
              <div className="flex-1 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-xl flex flex-col shadow-sm overflow-hidden">
                {selectedFile ? (
                  <>
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-violet-500/10 rounded-lg flex items-center justify-center text-violet-500">
                          <FileText size={16} />
                        </div>
                        <span className="font-bold text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {["Summarize", "Key Concepts", "Create Notes"].map(action => (
                          <button 
                            key={action}
                            suppressHydrationWarning
                            onClick={() => handleDocumentAction(action.toLowerCase().replace(" ", "_"), action)}
                            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 transition-all"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 opacity-40">
                          <Brain size={48} className="text-violet-500 mb-4" />
                          <p className="text-sm font-medium">Ask anything about this document...</p>
                        </div>
                      )}
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                          <div className={clsx(
                            "max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed",
                            msg.role === "user" 
                              ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20" 
                              : "bg-gray-100 dark:bg-white/5 text-foreground prose dark:prose-invert prose-sm"
                          )}>
                            {msg.role === "assistant" ? <ReactMarkdown>{msg.content}</ReactMarkdown> : msg.content}
                          </div>
                        </div>
                      ))}
                      {isAnalyzing && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 dark:bg-white/5 rounded-2xl p-4 flex items-center gap-3">
                            <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                            <span className="text-xs text-muted font-medium">AI is studying...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t border-gray-200 dark:border-white/10">
                      <div className="relative">
                        <input 
                          suppressHydrationWarning
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleDocumentAction("chat")}
                          placeholder="Type your question..."
                          className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-violet-400 transition-all"
                        />
                        <button 
                          suppressHydrationWarning
                          onClick={() => handleDocumentAction("chat")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-all shadow-md"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                    <div className="w-20 h-20 bg-violet-500/10 rounded-3xl flex items-center justify-center text-violet-500 mb-6">
                      <BookOpen size={40} />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Upload a study document</h2>
                    <p className="text-muted text-sm max-w-xs mx-auto">
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
                    <p className="text-muted text-sm">Test your understanding with AI-generated questions.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold flex justify-between">
                        <span>Quiz Topic</span>
                        <button suppressHydrationWarning onClick={() => setUseUploaded(!useUploaded)} className="text-xs text-violet-500 hover:underline">
                          {useUploaded ? "Type manually" : "Use uploaded document"}
                        </button>
                      </label>
                      {useUploaded ? (
                        <select 
                          suppressHydrationWarning
                          value={selectedFile?.id || ""}
                          onChange={(e) => setSelectedFile(files.find(f => f.id === e.target.value) || null)}
                          className="w-full bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400 appearance-none"
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
                          className="w-full bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400 transition-all"
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
                              ? "border-violet-500 bg-violet-500/5 shadow-lg" 
                              : "border-gray-100 dark:border-white/5 bg-white dark:bg-[#111118] hover:border-violet-500/20"
                          )}
                        >
                          <type.icon size={24} className={quizType === type.id ? "text-violet-500" : "text-muted"} />
                          <span className={clsx("font-bold text-sm", quizType === type.id ? "text-violet-500" : "text-muted")}>{type.label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Difficulty</label>
                        <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                          {["easy", "medium", "hard"].map(d => (
                            <button key={d} suppressHydrationWarning onClick={() => setDifficulty(d)} className={clsx("flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all", difficulty === d ? "bg-white dark:bg-[#1a1a24] text-violet-500 shadow-sm" : "text-muted")}>
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="w-24 space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Questions</label>
                        <input type="number" min="1" max="20" value={numQuestions} onChange={(e) => setNumQuestions(parseInt(e.target.value))} className="w-full bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none" />
                      </div>
                    </div>

                    <button 
                      suppressHydrationWarning
                      onClick={handleStartQuiz}
                      disabled={isGeneratingQuiz || (!quizTopic && !selectedFile)}
                      className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 transition-all shadow-xl shadow-violet-500/20"
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
                    <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentQuestionIdx + 1) / questions.length) * 100}%` }}
                        className="h-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                      />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-xl">
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
                                ? "border-violet-500 bg-violet-500/5" 
                                : "border-gray-100 dark:border-white/5 hover:border-violet-500/20"
                            )}
                          >
                            <span className={clsx(
                              "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                              userAnswers[currentQuestionIdx] === key ? "bg-violet-500 text-white" : "bg-gray-100 dark:bg-white/10 text-muted"
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
                          className="w-full h-48 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl p-6 text-sm leading-relaxed focus:outline-none focus:border-violet-400 transition-all resize-none"
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
                      className="px-6 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-bold hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <button 
                      suppressHydrationWarning
                      onClick={handleNextQuestion}
                      disabled={!userAnswers[currentQuestionIdx] || isGrading}
                      className="flex-1 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      {isGrading ? <Loader2 size={20} className="animate-spin" /> : (currentQuestionIdx === questions.length - 1 ? "Finish Quiz" : "Next Question")} <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
              )}

              {quizStep === "results" && quizResults && (
                <div className="max-w-2xl mx-auto w-full mt-6 space-y-8 pb-10">
                  <div className="text-center space-y-4">
                    <div className={clsx(
                      "w-32 h-32 rounded-full mx-auto flex flex-col items-center justify-center border-8",
                      quizResults.score >= 70 ? "border-emerald-500 text-emerald-500" : quizResults.score >= 50 ? "border-yellow-500 text-yellow-500" : "border-red-500 text-red-500"
                    )}>
                      <span className="text-4xl font-black">{quizResults.isPercentage ? Math.round(quizResults.score) : quizResults.score}</span>
                      <span className="text-xs font-bold uppercase">{quizResults.isPercentage ? "%" : "/" + quizResults.total}</span>
                    </div>
                    <h2 className="text-2xl font-bold">Quiz Complete!</h2>
                    <p className="text-muted text-sm px-10">Great job testing your knowledge. Review the breakdown below.</p>
                  </div>

                  <div className="space-y-4">
                    {quizResults.breakdown.map((b: any, idx: number) => (
                      <div key={idx} className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-start gap-4">
                          <div className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                            quizType === "mcq" 
                              ? (b.isCorrect ? "bg-emerald-500 text-white" : "bg-red-500 text-white")
                              : (b.score >= 7 ? "bg-emerald-500 text-white" : "bg-yellow-500 text-white")
                          )}>
                            {quizType === "mcq" ? (b.isCorrect ? <CheckCircle2 size={16} /> : <X size={16} />) : <span className="text-xs font-black">{b.score}</span>}
                          </div>
                          <div className="flex-1 space-y-3">
                            <p className="font-bold text-sm leading-tight">{b.question}</p>
                            {quizType === "mcq" ? (
                              <div className="space-y-1">
                                <p className="text-xs text-muted">Your answer: <span className={b.isCorrect ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>{b.options[b.userAnswer] || b.userAnswer}</span></p>
                                {!b.isCorrect && <p className="text-xs text-muted">Correct answer: <span className="text-emerald-500 font-bold">{b.options[b.correct]}</span></p>}
                                <p className="text-[11px] bg-gray-50 dark:bg-white/5 p-3 rounded-xl mt-2 italic text-muted leading-relaxed">
                                  {b.explanation}
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                                  <p className="text-xs font-bold uppercase text-muted mb-1 tracking-tighter">Your Answer</p>
                                  <p className="text-xs italic text-muted">{b.student_answer}</p>
                                </div>
                                <div className="p-4 bg-violet-500/5 rounded-xl border border-violet-500/20">
                                  <p className="text-xs font-bold uppercase text-violet-500 mb-2 tracking-tighter">AI Feedback</p>
                                  <p className="text-xs font-medium leading-relaxed mb-2">{b.feedback}</p>
                                  {b.missed_points?.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-[10px] font-bold uppercase text-amber-500 mb-1">Missed Points</p>
                                      <ul className="text-[10px] space-y-0.5 list-disc pl-4 text-muted">
                                        {b.missed_points.map((p: string, i: number) => <li key={i}>{p}</li>)}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button suppressHydrationWarning onClick={() => setQuizStep("setup")} className="px-6 py-4 rounded-2xl bg-gray-100 dark:bg-white/5 font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all">
                      <RotateCcw size={18} /> Retry Quiz
                    </button>
                    <button suppressHydrationWarning onClick={handleSaveQuizToNotes} className="px-6 py-4 rounded-2xl bg-violet-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-violet-600 transition-all shadow-lg">
                      <FileText size={18} /> Save to Notes
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
                  <Brain size={64} className="mx-auto mb-4 text-violet-500" />
                  <h3 className="text-xl font-bold mb-2">No study notes yet</h3>
                  <p className="text-sm">Generate notes from your documents or quizzes to see them here.</p>
                </div>
              ) : (
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studyNotes.map(note => (
                    <div key={note.id} className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm group hover:border-violet-500/30 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-500">
                          <Sparkles size={20} />
                        </div>
                        <Link href={`/dashboard/notes?id=${note.id}`} className="p-2 bg-gray-100 dark:bg-white/5 rounded-lg text-muted hover:text-violet-500 transition-all">
                          <ExternalLink size={16} />
                        </Link>
                      </div>
                      <h3 className="font-bold text-lg mb-2 truncate">{note.title}</h3>
                      <p className="text-xs text-muted line-clamp-3 mb-4 leading-relaxed">{note.content.substring(0, 200)}...</p>
                      <div className="flex items-center gap-2">
                        {note.tags?.split(",").map((tag: string) => (
                          <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-muted font-bold uppercase">{tag.trim()}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/dashboard/notes" className="mt-12 flex items-center gap-2 text-violet-500 font-bold text-sm hover:underline">
                View all notes <ArrowRight size={16} />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
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
