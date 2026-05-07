"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, LayoutTemplate, Send, Clock, Calendar as CalendarIcon, Zap, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CustomTimePicker from "@/components/ui/CustomTimePicker";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import NumberStepper from "@/components/ui/NumberStepper";
import ChipSelect from "@/components/ui/ChipSelect";
import ChipMultiSelect from "@/components/ui/ChipMultiSelect";
import SandyLoading from "@/components/SandyLoading";

const TEMPLATES = [
    {
        id: "weight-loss",
        icon: "🔥",
        title: "Weight Loss Journey",
        description: "Lose 5-10kg with a structured workout and meal plan.",
        color: "red",
        prompt: "Create a weight loss plan for {days} days. My starting weight is {startWeight}kg and target is {targetWeight}kg. I can workout for {workoutDuration} mins. Prefer {dietType} diet.",
        fields: [
            { id: "days", label: "Duration", type: "stepper", unit: "Days", min: 7, max: 90, default: 30 },
            { id: "startWeight", label: "Current Weight", type: "stepper", unit: "kg", min: 40, max: 200, default: 80 },
            { id: "targetWeight", label: "Target Weight", type: "stepper", unit: "kg", min: 40, max: 200, default: 70 },
            { id: "workoutDuration", label: "Daily Workout", type: "stepper", unit: "Mins", min: 15, max: 120, default: 45 },
            { id: "dietType", label: "Diet Preference", type: "chip", options: [{label:"Keto", value:"keto"}, {label:"Vegan", value:"vegan"}, {label:"Balanced", value:"balanced"}], default: "balanced" }
        ]
    },
    {
        id: "exam-prep",
        icon: "📚",
        title: "Ace the Exam",
        description: "Master any subject with active recall and spaced repetition.",
        color: "blue",
        prompt: "I have an exam on {subject} on {examDate}. I want to study {dailyHours} hours daily. Focus on {topics}.",
        fields: [
            { id: "subject", label: "Subject", type: "chip", options: [{label:"Math", value:"math"}, {label:"Science", value:"science"}, {label:"History", value:"history"}, {label:"Coding", value:"coding"}], default: "coding", allowCustom: true },
            { id: "examDate", label: "Exam Date", type: "date", default: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0] },
            { id: "dailyHours", label: "Daily Study", type: "stepper", unit: "Hours", min: 1, max: 12, default: 4 },
            { id: "topics", label: "Key Topics", type: "multi-chip", options: [{label:"Theory", value:"theory"}, {label:"Practice", value:"practice"}, {label:"Past Papers", value:"papers"}, {label:"Summary", value:"summary"}], default: ["practice", "papers"] }
        ]
    },
    {
        id: "learn-skill",
        icon: "💡",
        title: "Learn a New Skill",
        description: "Zero to Hero plan for coding, design, or languages.",
        color: "purple",
        prompt: "I want to learn {skill} starting {startDate}. I'm a {level} and can spend {mins} mins daily.",
        fields: [
            { id: "skill", label: "Skill Name", type: "chip", options: [{label:"React", value:"react"}, {label:"Python", value:"python"}, {label:"UI Design", value:"ui"}, {label:"Guitar", value:"guitar"}], default: "react" },
            { id: "startDate", label: "Start Date", type: "date", default: new Date().toISOString().split('T')[0] },
            { id: "level", label: "Current Level", type: "chip", options: [{label:"Beginner", value:"beginner"}, {label:"Intermediate", value:"intermediate"}], default: "beginner" },
            { id: "mins", label: "Daily Time", type: "stepper", unit: "Mins", min: 20, max: 180, default: 60 }
        ]
    },
    {
        id: "morning-routine",
        icon: "☀️",
        title: "The Ultimate Morning",
        description: "Build a high-performance routine to win the day.",
        color: "orange",
        prompt: "Design a morning routine starting at {wakeTime}. Include {activities} and finish by {endTime}.",
        fields: [
            { id: "wakeTime", label: "Wake Up Time", type: "time", default: "06:00" },
            { id: "endTime", label: "Start Work By", type: "time", default: "09:00" },
            { id: "activities", label: "Include", type: "multi-chip", options: [{label:"Meditation", value:"meditation"}, {label:"Workout", value:"workout"}, {label:"Reading", value:"reading"}, {label:"Journaling", value:"journal"}], default: ["meditation", "reading"] }
        ]
    }
];

export default function TemplatesPage() {
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [formData, setFormData] = useState<any>({});
    const [generateSubtasks, setGenerateSubtasks] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        setLoading(false);
    }, []);

    const handleSelectTemplate = (tpl: any) => {
        setSelectedTemplate(tpl);
        const initialData: any = {};
        tpl.fields.forEach((f: any) => initialData[f.id] = f.default);
        setFormData(initialData);
        setGenerateSubtasks(false); // reset
    };

    const handleBack = () => {
        if (selectedTemplate) {
            setSelectedTemplate(null);
        } else {
            router.push("/dashboard");
        }
    };

    const handleGenerate = () => {
        let finalPrompt = selectedTemplate.prompt;
        Object.keys(formData).forEach(key => {
            const val = Array.isArray(formData[key]) ? formData[key].join(", ") : formData[key];
            finalPrompt = finalPrompt.replace(`{${key}}`, val);
        });

        if (generateSubtasks) {
            finalPrompt += " For every main task generated, also generate 3-5 specific subtasks for it.";
        }

        // Store prompt and redirect to assistant
        sessionStorage.setItem("planora_template_prompt", finalPrompt);
        router.push("/dashboard/ai-assistant");
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-[60vh]">
                <SandyLoading />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-20">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
                        <LayoutTemplate className="text-accent" />
                        Smart Templates
                    </h1>
                    <p className="text-muted font-medium">Select a goal and let Planora build your custom plan.</p>
                </div>
                <button suppressHydrationWarning 
                    onClick={handleBack}
                    className="glass-card px-4 py-2 text-xs font-bold flex items-center gap-2 hover:bg-secondary transition-all"
                >
                    <ArrowLeft size={14} /> Back
                </button>
            </header>

            <AnimatePresence mode="wait">
                {!selectedTemplate ? (
                    <motion.div
                        key="grid"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                    >
                        {TEMPLATES.map((tpl) => (
                            <button suppressHydrationWarning
                                key={tpl.id}
                                onClick={() => handleSelectTemplate(tpl)}
                                className="group relative text-left p-6 glass-card border-card-border hover:border-accent transition-all duration-500 overflow-hidden"
                            >
                                <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${tpl.color}-500/10 rounded-full blur-2xl group-hover:bg-${tpl.color}-500/20 transition-all duration-500`} />
                                <div className="text-4xl mb-4">{tpl.icon}</div>
                                <h3 className="text-lg font-black mb-2">{tpl.title}</h3>
                                <p className="text-xs text-muted leading-relaxed mb-6">{tpl.description}</p>
                                <div className="flex items-center gap-2 text-[10px] font-black text-accent uppercase tracking-widest">
                                    Configure <Sparkles size={12} />
                                </div>
                            </button>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="max-w-2xl mx-auto"
                    >
                        <div className="glass-card p-8 space-y-8 relative overflow-hidden">
                            <div className="flex items-center gap-4 mb-4">
                                <span className="text-4xl">{selectedTemplate.icon}</span>
                                <div>
                                    <h2 className="text-2xl font-black">{selectedTemplate.title}</h2>
                                    <p className="text-xs text-muted">{selectedTemplate.description}</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {selectedTemplate.fields.map((field: any) => (
                                    <div key={field.id} className="space-y-3">
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest">{field.label}</label>
                                        
                                        {field.type === "stepper" && (
                                            <NumberStepper 
                                                value={formData[field.id]} 
                                                onChange={(v) => setFormData({...formData, [field.id]: v})}
                                                min={field.min}
                                                max={field.max}
                                                unit={field.unit}
                                            />
                                        )}

                                        {field.type === "date" && (
                                            <CustomDatePicker 
                                                value={formData[field.id]} 
                                                onChange={(v) => setFormData({...formData, [field.id]: v})}
                                            />
                                        )}

                                        {field.type === "time" && (
                                            <CustomTimePicker 
                                                value={formData[field.id]} 
                                                onChange={(v) => setFormData({...formData, [field.id]: v})}
                                            />
                                        )}

                                        {field.type === "chip" && (
                                            <ChipSelect 
                                                options={field.options}
                                                value={formData[field.id]}
                                                onChange={(v) => setFormData({...formData, [field.id]: v})}
                                                allowCustom={field.allowCustom}
                                            />
                                        )}

                                        {field.type === "multi-chip" && (
                                            <ChipMultiSelect 
                                                options={field.options}
                                                value={formData[field.id]}
                                                onChange={(v) => setFormData({...formData, [field.id]: v})}
                                            />
                                        )}
                                    </div>
                                ))}

                                <div className="pt-4 border-t border-card-border/50">
                                    <button suppressHydrationWarning 
                                        onClick={() => setGenerateSubtasks(!generateSubtasks)}
                                        className="flex items-center gap-3 group"
                                    >
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${generateSubtasks ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20' : 'border-muted group-hover:border-accent/50'}`}>
                                            {generateSubtasks && <Sparkles size={14} />}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-xs font-black uppercase tracking-widest">Generate Subtasks</p>
                                            <p className="text-[10px] text-muted font-bold">AI will break down each task into smaller steps automatically.</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button suppressHydrationWarning
                                    onClick={() => setSelectedTemplate(null)}
                                    className="flex-1 px-6 py-4 rounded-2xl bg-secondary text-sm font-bold hover:bg-secondary/70 transition-all"
                                >
                                    Cancel
                                </button>
                                <button suppressHydrationWarning
                                    onClick={handleGenerate}
                                    className="flex-[2] px-6 py-4 rounded-2xl bg-accent text-white text-sm font-black flex items-center justify-center gap-3 shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-95 transition-all"
                                >
                                    Generate Plan <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

