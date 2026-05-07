"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { 
  Plus, Search, Sparkles, Trash2, Edit3, Eye, FileText, 
  ChevronDown, Download, Loader2, X, Clock, Tag
} from "lucide-react";
import ReactMarkdown from "react-markdown";
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
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // AI Modal state
  const [aiTopic, setAiTopic] = useState("");
  const [aiLevel, setAiLevel] = useState("detailed");

  const fetchNotes = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
        if (data.length > 0 && !selectedNote) {
          setSelectedNote(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch notes", err);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, selectedNote]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleCreateNote = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notes/`, {
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
    if (!confirm("Are you sure you want to delete this note?")) return;
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
          detail_level: aiLevel
        })
      });
      if (res.ok) {
        const newNote = await res.json();
        setNotes([newNote, ...notes]);
        setSelectedNote(newNote);
        setShowAiModal(false);
        setAiTopic("");
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

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.tags && n.tags.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col md:flex-row gap-6">
      {/* Sidebar */}
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              suppressHydrationWarning
              type="text" 
              placeholder="Search notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-violet-400 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button 
            suppressHydrationWarning
            onClick={handleCreateNote}
            className="flex items-center justify-center gap-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg px-3 py-2 text-sm transition-colors shadow-sm"
          >
            <Plus size={16} /> New Note
          </button>
          <button 
            suppressHydrationWarning
            onClick={() => setShowAiModal(true)}
            className="flex items-center justify-center gap-2 border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <Sparkles size={16} /> AI Generate
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-10 text-muted text-sm">
              No notes found.
            </div>
          ) : (
            filteredNotes.map(note => (
              <div 
                key={note.id}
                onClick={() => { setSelectedNote(note); setIsEditing(false); }}
                className={clsx(
                  "group relative p-4 rounded-xl border cursor-pointer transition-all duration-300",
                  selectedNote?.id === note.id 
                    ? "bg-violet-500/10 border-violet-500/30" 
                    : "bg-white dark:bg-[#111118] border-gray-200 dark:border-white/10 hover:border-violet-500/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{note.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={clsx(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                        note.source === "ai_generated" ? "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400" : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
                      )}>
                        {note.source === "ai_generated" ? "AI" : "Manual"}
                      </span>
                      <span className="text-[10px] text-muted flex items-center gap-1">
                        <Clock size={10} /> {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button 
                    suppressHydrationWarning
                    onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
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

      {/* Editor/Viewer */}
      <div className="flex-1 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden flex flex-col shadow-sm">
        {selectedNote ? (
          <>
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <input 
                  suppressHydrationWarning
                  type="text" 
                  value={selectedNote.title}
                  onChange={(e) => setSelectedNote({ ...selectedNote, title: e.target.value })}
                  onBlur={() => handleUpdateNote({ title: selectedNote.title })}
                  className="w-full bg-transparent text-2xl font-bold focus:outline-none placeholder:text-gray-300"
                  placeholder="Note Title"
                />
                <div className="flex items-center gap-2 mt-2">
                  <Tag size={14} className="text-muted" />
                  <input 
                    suppressHydrationWarning
                    type="text" 
                    value={selectedNote.tags || ""}
                    onChange={(e) => setSelectedNote({ ...selectedNote, tags: e.target.value })}
                    onBlur={() => handleUpdateNote({ tags: selectedNote.tags })}
                    className="bg-transparent text-sm text-muted focus:outline-none flex-1"
                    placeholder="Add tags (comma separated)..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                  <button 
                    suppressHydrationWarning
                    onClick={() => setIsEditing(true)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      isEditing ? "bg-white dark:bg-[#1a1a24] shadow-sm text-violet-500" : "text-muted hover:text-foreground"
                    )}
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                  <button 
                    suppressHydrationWarning
                    onClick={() => setIsEditing(false)}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      !isEditing ? "bg-white dark:bg-[#1a1a24] shadow-sm text-violet-500" : "text-muted hover:text-foreground"
                    )}
                  >
                    <Eye size={14} /> Preview
                  </button>
                </div>

                <div className="relative group/export">
                  <button 
                    suppressHydrationWarning
                    className="flex items-center gap-2 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <Download size={14} /> Export <ChevronDown size={14} />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl py-2 opacity-0 group-hover/export:opacity-100 pointer-events-none group-hover/export:pointer-events-auto transition-all z-10">
                    <button suppressHydrationWarning onClick={() => handleExport("pdf")} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">PDF</button>
                    <button suppressHydrationWarning onClick={() => handleExport("docx")} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">DOCX</button>
                    <button suppressHydrationWarning onClick={() => handleExport("txt")} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">TXT</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isEditing ? (
                <textarea 
                  suppressHydrationWarning
                  value={selectedNote.content}
                  onChange={(e) => setSelectedNote({ ...selectedNote, content: e.target.value })}
                  onBlur={() => handleUpdateNote({ content: selectedNote.content })}
                  className="w-full h-full bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed"
                  placeholder="Start writing in markdown..."
                />
              ) : (
                <div className="prose dark:prose-invert max-w-none prose-sm md:prose-base">
                  <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
            <div className="w-16 h-16 bg-violet-500/10 rounded-2xl flex items-center justify-center text-violet-500 mb-4">
              <FileText size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Select a note to view</h2>
            <p className="text-muted text-sm max-w-xs mx-auto">
              Create a new note or use the AI generator to build comprehensive study materials in seconds.
            </p>
          </div>
        )}
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
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1a1a24] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-500" /> AI Note Generator
                </h2>
                <button suppressHydrationWarning onClick={() => setShowAiModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted">What topic should I generate notes for?</label>
                  <input 
                    suppressHydrationWarning
                    type="text" 
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="e.g. Quantum Physics, React.js Hooks, World War II"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted">Detail Level</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      suppressHydrationWarning
                      onClick={() => setAiLevel("brief")}
                      className={clsx(
                        "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                        aiLevel === "brief" 
                          ? "bg-violet-500 border-violet-500 text-white" 
                          : "border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                      )}
                    >
                      Brief
                    </button>
                    <button 
                      suppressHydrationWarning
                      onClick={() => setAiLevel("detailed")}
                      className={clsx(
                        "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                        aiLevel === "detailed" 
                          ? "bg-violet-500 border-violet-500 text-white" 
                          : "border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                      )}
                    >
                      Detailed
                    </button>
                  </div>
                </div>

                <button 
                  suppressHydrationWarning
                  disabled={!aiTopic || isGenerating}
                  onClick={handleAiGenerate}
                  className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/20"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" /> Generate Notes
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
