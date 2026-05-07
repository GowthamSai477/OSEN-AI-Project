"use client";

import { Minus, Plus } from "lucide-react";

interface NumberStepperProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
}

export default function NumberStepper({ value, onChange, min = 0, max = 1000, step = 1, unit = "" }: NumberStepperProps) {
    return (
        <div className="flex items-center gap-2 bg-secondary/50 border border-card-border p-1.5 rounded-xl w-fit">
            <button
                suppressHydrationWarning
                onClick={() => onChange(Math.max(min, value - step))}
                className="p-2 hover:bg-card rounded-lg transition-all text-muted hover:text-red-400 border border-transparent hover:border-red-400/20"
                disabled={value <= min}
            >
                <Minus size={16} />
            </button>
            
            <div className="px-4 min-w-[60px] text-center">
                <span className="text-sm font-black text-foreground">{value}</span>
                {unit && <span className="ml-1 text-[10px] font-bold text-muted uppercase tracking-tighter">{unit}</span>}
            </div>

            <button
                suppressHydrationWarning
                onClick={() => onChange(Math.min(max, value + step))}
                className="p-2 hover:bg-card rounded-lg transition-all text-muted hover:text-emerald-400 border border-transparent hover:border-emerald-400/20"
                disabled={value >= max}
            >
                <Plus size={16} />
            </button>
        </div>
    );
}
