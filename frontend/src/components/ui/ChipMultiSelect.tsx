"use client";

interface ChipMultiSelectProps {
    options: { label: string; value: string }[];
    value: string[];
    onChange: (val: string[]) => void;
}

export default function ChipMultiSelect({ options, value, onChange }: ChipMultiSelectProps) {
    const toggle = (v: string) => {
        if (value.includes(v)) {
            onChange(value.filter(item => item !== v));
        } else {
            onChange([...value, v]);
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const isActive = value.includes(opt.value);
                return (
                    <button
                        key={opt.value}
                        suppressHydrationWarning
                        onClick={() => toggle(opt.value)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            isActive 
                            ? 'bg-accent/10 border-accent text-accent' 
                            : 'bg-secondary/50 border-card-border text-muted hover:border-accent/50 hover:text-foreground'
                        }`}
                    >
                        {isActive ? '✓ ' : '+ '}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
