"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock } from "lucide-react";

interface CustomTimePickerProps {
    value: string; // "HH:mm" (24hr)
    onChange: (value: string) => void;
}

export default function CustomTimePicker({ value, onChange }: CustomTimePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    
    const [hours, mins] = value.split(":");
    const hNum = parseInt(hours);
    const displayH = hNum % 12 || 12;
    const isPM = hNum >= 12;
    const displayM = mins;

    const updateTime = (h: number, m: string, pm: boolean) => {
        let finalH = h;
        if (pm && h < 12) finalH += 12;
        if (!pm && h === 12) finalH = 0;
        const hStr = String(finalH).padStart(2, '0');
        onChange(`${hStr}:${m}`);
    };

    return (
        <div className="relative">
            <button
                suppressHydrationWarning
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-secondary border border-card-border rounded-xl px-4 py-3 text-sm flex items-center justify-between hover:border-accent transition-all"
            >
                <span className="font-bold">{displayH}:{displayM} {isPM ? 'PM' : 'AM'}</span>
                <Clock size={18} className="text-muted" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[110]" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-2 w-full bg-card border border-card-border rounded-2xl p-4 shadow-2xl z-[111]"
                        >
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest text-center">Hours</p>
                                    <div className="grid grid-cols-3 gap-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                                            <button
                                                key={h}
                                                suppressHydrationWarning
                                                onClick={() => updateTime(h, displayM, isPM)}
                                                className={`py-2 text-xs font-bold rounded-lg transition-all ${displayH === h ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'hover:bg-secondary text-muted hover:text-foreground'}`}
                                            >
                                                {h}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 space-y-2">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest text-center">Minutes</p>
                                    <div className="grid grid-cols-2 gap-1">
                                        {["00", "15", "30", "45"].map(m => (
                                            <button
                                                key={m}
                                                suppressHydrationWarning
                                                onClick={() => updateTime(displayH, m, isPM)}
                                                className={`py-2 text-xs font-bold rounded-lg transition-all ${displayM === m ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'hover:bg-secondary text-muted hover:text-foreground'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="w-16 space-y-2">
                                    <p className="text-[10px] font-black text-muted uppercase tracking-widest text-center">P/A</p>
                                    <div className="flex flex-col gap-1">
                                        <button
                                            suppressHydrationWarning
                                            onClick={() => updateTime(displayH, displayM, false)}
                                            className={`py-2 text-xs font-bold rounded-lg transition-all ${!isPM ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'hover:bg-secondary text-muted hover:text-foreground'}`}
                                        >
                                            AM
                                        </button>
                                        <button
                                            suppressHydrationWarning
                                            onClick={() => updateTime(displayH, displayM, true)}
                                            className={`py-2 text-xs font-bold rounded-lg transition-all ${isPM ? 'bg-accent text-white shadow-lg shadow-accent/30' : 'hover:bg-secondary text-muted hover:text-foreground'}`}
                                        >
                                            PM
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
