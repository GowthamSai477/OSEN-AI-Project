"use client";

import { motion } from "framer-motion";

interface Option {
    label: string;
    value: string;
    icon?: string;
}

interface ChipSelectProps {
    options: Option[];
    value: string;
    onChange: (val: string) => void;
    allowCustom?: boolean;
}

export default function ChipSelect({ options, value, onChange, allowCustom = false }: ChipSelectProps) {
    const isCustom = allowCustom && !options.find(opt => opt.value === value);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const isActive = value === opt.value;
                    return (
                        <button
                            key={opt.value}
                            suppressHydrationWarning
                            onClick={() => onChange(opt.value)}
                            className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                isActive 
                                ? 'bg-accent/10 border-accent text-accent' 
                                : 'bg-secondary/50 border-card-border text-muted hover:border-accent/50 hover:text-foreground'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                {opt.icon && <span>{opt.icon}</span>}
                                {opt.label}
                            </div>
                            {isActive && (
                                <motion.div
                                    layoutId="active-chip"
                                    className="absolute inset-0 rounded-xl border-2 border-accent pointer-events-none"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                        </button>
                    );
                })}
                {allowCustom && (
                    <button
                        suppressHydrationWarning
                        onClick={() => onChange("")}
                        className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            isCustom || value === ""
                            ? 'bg-accent/10 border-accent text-accent' 
                            : 'bg-secondary/50 border-card-border text-muted hover:border-accent/50 hover:text-foreground'
                        }`}
                    >
                        Other...
                    </button>
                )}
            </div>
            {(allowCustom && (isCustom || value === "")) && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative"
                >
                    <input 
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Enter custom value..."
                        className="w-full bg-secondary border border-accent rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent/20"
                        autoFocus
                    />
                </motion.div>
            )}
        </div>
    );
}
