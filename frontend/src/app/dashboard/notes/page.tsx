"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { 
  Plus, Search, Sparkles, Trash2, Edit3, Eye, FileText, 
  ChevronDown, Download, Loader2, X, Clock, Tag
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";

type Note = {
  id: string;
  title: string;
  content: string;
  tags: string | null;
  source: string;
  created_at: string;
  updated_at: string;
};

export default function NotesPage() {
  const { getToken } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "manual" | "ai_generated">("all");
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // AI Modal state
  const [aiTopic, setAiTopic] = useState("");
  const [aiLevel, setAiLevel] = useState("detailed");
  const [aiFileContent, setAiFileContent] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
        setSelectedNote(prev => prev ? prev : (data.length > 0 ? data[0] : null));
      }
    } catch (err) {
      console.error("Failed to fetch notes", err);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          title: "New Note",
          content: "",
          tags: "",
          source: "manual"
        })
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes([newNote, ...notes]);
        setSelectedNote(newNote);
        setIsEditing(true);
      }
    } catch (err) {
      console.error("Failed to create note", err);
    }
  };

  const handleUpdateNote = async (updates: Partial<Note>) => {
    if (!selectedNote) return;
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes/${selectedNote.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated = await res.json();
        setNotes(notes.map(n => n.id === updated.id ? updated : n));
        setSelectedNote(updated);
      }
    } catch (err) {
      console.error("Failed to update note", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const remaining = notes.filter(n => n.id !== id);
        setNotes(remaining);
        if (selectedNote?.id === id) {
          setSelectedNote(remaining[0] || null);
        }
      }
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiTopic) return;
    setIsGenerating(true);
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          topic: aiTopic,
          detail_level: aiLevel,
          file_content: aiFileContent
        })
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes([newNote, ...notes]);
        setSelectedNote(newNote);
        setShowAiModal(false);
        setAiTopic("");
        setAiFileContent(null);
      }
    } catch (err) {
      console.error("Failed to generate note", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: string) => {
    if (!selectedNote) return;
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes/${selectedNote.id}/export/${format}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedNote.title}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to export note", err);
    }
  };

  // Debounced auto-save
  useEffect(() => {
    if (!selectedNote || !isEditing) return;
    const timer = setTimeout(() => {
      // Auto-save logic if needed, but we currently update on blur or change
    }, 1000);
    return () => clearTimeout(timer);
  }, [selectedNote, isEditing]);

  // --- PDF Extraction Logic ---
  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer) => {
    try {
      if (!(window as any).pdfjsLib) {
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
      return "";
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsGenerating(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      const text = await extractTextFromPdf(arrayBuffer);
      if (text) {
        setAiTopic(`Summarize this document: ${file.name}`);
        setAiFileContent(text);
        setShowAiModal(true);
        // We'll pass the content to the AI modal or just generate directly
        try {
          const token = await getToken();
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              title: file.name.replace(".pdf", ""),
              content: `> Content extracted from ${file.name}\n\n${text}`,
              tags: "pdf_upload, manual",
              source: "manual"
            })
          });
          if (res.ok) {
            const newNote = await res.json();
            setNotes([newNote, ...notes]);
            setSelectedNote(newNote);
          }
        } catch (err) {}
      }
      setIsGenerating(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredNotes = notes.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) || 
                          (n.tags && n.tags.toLowerCase().includes(search.toLowerCase()));
    const matchesSource = filterSource === "all" ? true : n.source === filterSource;
    return matchesSearch && matchesSource;
  });

  return (
    <div className="flex flex-col gap-10 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-accent to-purple-500 text-white rounded-2xl flex items-center justify-center shadow-[0_0_15px_var(--color-accent-glow)]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Notes</h1>
            <p className="text-muted text-sm font-medium mt-1">Manage your knowledge base</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-stretch h-[calc(100vh-20rem)] min-h-[600px]">
      {/* Sidebar */}
      <div className="w-full md:w-80 flex flex-col gap-4 h-full">
        <div className="bg-surface border border-card-border rounded-2xl p-4 shadow-sm space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              suppressHydrationWarning
              type="text" 
              placeholder="Search your knowledge..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary/30 border border-card-border rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
            />
          </div>

          <div className="flex items-center gap-1 bg-secondary/30 p-1 rounded-xl border border-card-border/50">
            {(["all", "ai_generated", "manual"] as const).map(f => (
              <button
                key={f}
                suppressHydrationWarning
                onClick={() => setFilterSource(f)}
                className={clsx(
                  "flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-all",
                  filterSource === f ? "bg-accent text-white shadow-md shadow-accent/20" : "text-muted hover:text-foreground hover:bg-white/50"
                )}
              >
                {f === "ai_generated" ? "AI" : f}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-card-border/50">
            <button 
              suppressHydrationWarning
              onClick={handleCreateNote}
              className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white rounded-xl px-4 py-3 text-sm font-bold transition-all shadow-lg shadow-accent/20"
            >
              <Plus size={18} /> Add Note Manually
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button 
                suppressHydrationWarning
                onClick={() => setShowAiModal(true)}
                className="flex items-center justify-center gap-2 border border-accent/30 bg-accent/5 hover:bg-accent/10 text-accent rounded-xl px-3 py-2.5 text-xs font-bold transition-all"
              >
                <Sparkles size={14} /> AI Build
              </button>
              <label className="flex items-center justify-center gap-2 border border-card-border bg-white hover:bg-secondary/50 text-foreground rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer">
                <FileText size={14} /> Upload PDF
                <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-card-border rounded-[2rem] shadow-sm">
              <div className="w-16 h-16 bg-accent/5 rounded-full flex items-center justify-center text-accent mb-4">
                <FileText className="w-8 h-8 opacity-40" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No notes found</h3>
              <p className="text-xs text-muted mt-1 text-center">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            filteredNotes.map(note => (
              <motion.div 
                layout
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                key={note.id}
                onClick={() => { setSelectedNote(note); setIsEditing(false); }}
                className={clsx(
                  "group relative p-4 rounded-2xl border cursor-pointer transition-all duration-300",
                  selectedNote?.id === note.id 
                    ? "bg-accent/5 border-accent/40 shadow-sm" 
                    : "bg-white border-card-border hover:border-accent/30 hover:shadow-md hover:shadow-accent/5"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm truncate leading-tight">{note.title || "Untitled Note"}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={clsx(
                        "text-[9px] px-1.5 py-0.5 rounded-lg font-black uppercase tracking-tighter",
                        note.source === "ai_generated" ? "bg-accent/20 text-accent" : "bg-secondary text-muted"
                      )}>
                        {note.source === "ai_generated" ? "AI Generated" : "Manual Entry"}
                      </span>
                      <span className="text-[9px] text-muted font-bold flex items-center gap-1 uppercase">
                        <Clock size={10} className="text-accent" /> {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button 
                    suppressHydrationWarning
                    onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Editor/Viewer */}
      <div className="flex-1 bg-white border border-card-border rounded-[2rem] overflow-hidden flex flex-col shadow-sm relative h-full">
        {selectedNote ? (
          <>
            <div className="p-8 border-b border-card-border/50 flex items-center justify-between gap-6 bg-secondary/5">
              <div className="flex-1 min-w-0">
                <input 
                  suppressHydrationWarning
                  type="text" 
                  value={selectedNote.title}
                  onChange={(e) => setSelectedNote({ ...selectedNote, title: e.target.value })}
                  onBlur={() => handleUpdateNote({ title: selectedNote.title })}
                  className="w-full bg-transparent text-3xl font-black focus:outline-none placeholder:text-muted/30 tracking-tight"
                  placeholder="Untitled Knowledge"
                />
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-card-border">
                    <Tag size={12} className="text-accent" />
                    <input 
                      suppressHydrationWarning
                      type="text" 
                      value={selectedNote.tags || ""}
                      onChange={(e) => setSelectedNote({ ...selectedNote, tags: e.target.value })}
                      onBlur={() => handleUpdateNote({ tags: selectedNote.tags })}
                      className="bg-transparent text-[11px] font-bold text-muted focus:outline-none uppercase tracking-wider"
                      placeholder="Add tags..."
                    />
                  </div>
                  <div className="h-4 w-px bg-card-border/50" />
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest">
                    Last Saved: {new Date(selectedNote.updated_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex bg-secondary/30 rounded-xl p-1 border border-card-border/50">
                  <button 
                    suppressHydrationWarning
                    onClick={() => setIsEditing(true)}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                      isEditing ? "bg-white shadow-sm text-accent" : "text-muted hover:text-foreground"
                    )}
                  >
                    <Edit3 size={14} /> Write
                  </button>
                  <button 
                    suppressHydrationWarning
                    onClick={() => setIsEditing(false)}
                    className={clsx(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
                      !isEditing ? "bg-white shadow-sm text-accent" : "text-muted hover:text-foreground"
                    )}
                  >
                    <Eye size={14} /> Read
                  </button>
                </div>

                <div className="relative group/export">
                  <button 
                    suppressHydrationWarning
                    className="flex items-center gap-2 bg-white border border-card-border rounded-xl px-4 py-3 text-xs font-bold hover:bg-secondary/50 transition-all shadow-sm"
                  >
                    <Download size={14} /> Export <ChevronDown size={14} />
                  </button>
                  <div className="absolute right-0 top-full pt-2 w-40 opacity-0 group-hover/export:opacity-100 pointer-events-none group-hover/export:pointer-events-auto transition-all z-20 translate-y-2 group-hover/export:translate-y-0">
                    <div className="bg-white border border-card-border rounded-2xl shadow-xl py-3 overflow-hidden">
                      <p className="px-4 py-1 text-[10px] font-black text-muted uppercase tracking-widest mb-2 border-b border-card-border/50 pb-2">Select Format</p>
                      <button suppressHydrationWarning onClick={() => handleExport("pdf")} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-accent/10 hover:text-accent transition-colors flex items-center gap-2"><FileText size={12}/> PDF Document</button>
                      <button suppressHydrationWarning onClick={() => handleExport("docx")} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-accent/10 hover:text-accent transition-colors flex items-center gap-2"><FileText size={12}/> Word Doc</button>
                      <button suppressHydrationWarning onClick={() => handleExport("txt")} className="w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-accent/10 hover:text-accent transition-colors flex items-center gap-2"><FileText size={12}/> Plain Text</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col p-10 bg-white">
              {isEditing ? (
                <textarea 
                  suppressHydrationWarning
                  value={selectedNote.content}
                  onChange={(e) => setSelectedNote({ ...selectedNote, content: e.target.value })}
                  onBlur={() => handleUpdateNote({ content: selectedNote.content })}
                  className="flex-1 w-full bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-foreground/80 custom-scrollbar overflow-y-auto"
                  placeholder="# Start documenting your thoughts...&#10;&#10;Use markdown to structure your content."
                />
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar prose dark:prose-invert max-w-none prose-violet prose-headings:font-black prose-headings:tracking-tight prose-p:leading-relaxed prose-table:border-collapse prose-th:border prose-th:p-2 prose-td:border prose-td:p-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedNote.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-white">
            <div className="w-24 h-24 bg-accent/5 rounded-full flex items-center justify-center text-accent mb-8 relative">
              <FileText size={48} className="opacity-40" />
              <div className="absolute -top-1 -right-1 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center shadow-lg shadow-accent/20">
                <Plus size={16} />
              </div>
            </div>
            <h2 className="text-3xl font-black mb-4 tracking-tight">Your Knowledge Hub</h2>
            <p className="text-muted font-medium max-w-sm mx-auto leading-relaxed">
              Capture ideas, analyze documents, and generate study materials. All your notes, powered by AI, organized in one premium workspace.
            </p>
            <div className="flex gap-4 mt-10">
              <button onClick={handleCreateNote} className="px-8 py-4 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all">Create First Note</button>
              <button onClick={() => setShowAiModal(true)} className="px-8 py-4 bg-secondary text-foreground font-bold rounded-2xl hover:bg-secondary/70 transition-all">Try AI Builder</button>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* AI Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isGenerating && setShowAiModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-surface border border-border rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.2)] overflow-hidden"
            >
              <div className="p-8 border-b border-card-border/50 flex items-center justify-between bg-secondary/5">
                <div>
                  <h2 className="text-2xl font-black flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-accent" /> Gemini Note Builder
                  </h2>
                  <p className="text-xs font-bold text-muted uppercase mt-1 tracking-widest">Powered by Google Gemini 1.5</p>
                </div>
                <button suppressHydrationWarning onClick={() => setShowAiModal(false)} className="p-3 hover:bg-secondary rounded-2xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-muted uppercase tracking-tighter">What topic should I explore?</label>
                  <div className="relative">
                    <Sparkles className="absolute left-4 top-4 w-4 h-4 text-accent opacity-50" />
                    <textarea 
                      suppressHydrationWarning
                      rows={3}
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="e.g. The impact of blockchain on global finance..."
                      className="w-full bg-secondary/30 border border-card-border rounded-2xl pl-12 pr-6 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-muted uppercase tracking-tighter">Complexity Level</label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: "brief", label: "Essentials", desc: "Key facts & takeaways" },
                      { id: "detailed", label: "Deep Dive", desc: "Comprehensive analysis" },
                    ].map(level => (
                      <button 
                        key={level.id}
                        suppressHydrationWarning
                        onClick={() => setAiLevel(level.id)}
                        className={clsx(
                          "p-5 rounded-2xl border-2 text-left transition-all group relative overflow-hidden",
                          aiLevel === level.id 
                            ? "border-accent bg-accent/5 shadow-lg" 
                            : "border-card-border bg-white hover:border-accent/20"
                        )}
                      >
                        <p className={clsx("font-black text-sm mb-1", aiLevel === level.id ? "text-accent" : "")}>{level.label}</p>
                        <p className="text-[10px] font-medium text-muted">{level.desc}</p>
                        {aiLevel === level.id && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-accent" />}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  suppressHydrationWarning
                  disabled={!aiTopic || isGenerating}
                  onClick={handleAiGenerate}
                  className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-black rounded-2xl py-5 flex items-center justify-center gap-3 transition-all shadow-2xl shadow-accent/30 text-lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Gemini is thinking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" /> Generate Knowledge
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
