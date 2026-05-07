"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

interface CustomDatePickerProps {
    value: string; // "YYYY-MM-DD"
    onChange: (value: string) => void;
}

export default function CustomDatePicker({ value, onChange }: CustomDatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [viewDate, setViewDate] = useState(new Date(value || new Date()));

    const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = new Date();
    today.setHours(0,0,0,0);

    const handleDateSelect = (day: number) => {
        const selected = new Date(year, month, day);
        const yyyy = selected.getFullYear();
        const mm = String(selected.getMonth() + 1).padStart(2, '0');
        const dd = String(selected.getDate()).padStart(2, '0');
        onChange(`${yyyy}-${mm}-${dd}`);
        setIsOpen(false);
    };

    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="relative">
            <button
                suppressHydrationWarning
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-secondary border border-card-border rounded-xl px-4 py-3 text-sm flex items-center justify-between hover:border-accent transition-all font-bold"
            >
                <span>{value || "Select Date"}</span>
                <CalendarIcon size={18} className="text-muted" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[110]" onClick={() => setIsOpen(false)} />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-2 w-full bg-card border border-card-border rounded-2xl p-4 shadow-2xl z-[111] min-w-[280px]"
                        >
                            <div className="flex items-center justify-between mb-4 px-1">
                                <h4 className="font-black text-sm uppercase tracking-widest">{monthNames[month]} {year}</h4>
                                <div className="flex gap-1">
                                    <button onClick={prevMonth} className="p-1.5 hover:bg-secondary rounded-lg transition-all text-muted hover:text-foreground">
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button onClick={nextMonth} className="p-1.5 hover:bg-secondary rounded-lg transition-all text-muted hover:text-foreground">
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                    <span key={`${d}-${i}`} className="text-[10px] font-black text-muted/50 py-1">{d}</span>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: firstDayOfMonth(year, month) }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {Array.from({ length: daysInMonth(year, month) }).map((_, i) => {
                                    const d = i + 1;
                                    const isSelected = value === `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                    const isToday = today.getTime() === new Date(year, month, d).getTime();

                                    return (
                                        <button
                                            key={d}
                                            suppressHydrationWarning
                                            onClick={() => handleDateSelect(d)}
                                            className={`py-2 text-xs font-bold rounded-lg transition-all ${
                                                isSelected ? 'bg-accent text-white shadow-lg shadow-accent/30' : 
                                                isToday ? 'bg-accent/10 text-accent border border-accent/20' : 
                                                'hover:bg-secondary text-muted hover:text-foreground'
                                            }`}
                                        >
                                            {d}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
