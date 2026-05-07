"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Sun, Moon, User, Palette, Check } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useUser, useClerk } from "@clerk/nextjs";
import SandyLoading from "@/components/SandyLoading";

// ── Theme definitions ──────────────────────────────────────────────────────
const THEMES = [
  {
    id: "default",
    name: "Default",
    emoji: "⚡",
    vibe: "Purple • Classic Planora",
    accent: "#7C3AED",
    secondary: "#9F67FF",
    surface: "#111118",
  },
  {
    id: "iron-man",
    name: "Iron Man",
    emoji: "🔴",
    vibe: "Red + Gold • Tech HUD",
    accent: "#C0392B",
    secondary: "#E67E22",
    surface: "#1a0a0a",
  },
  {
    id: "thor",
    name: "Thor",
    emoji: "⚡",
    vibe: "Blue + Gold • Lightning",
    accent: "#1A6EBF",
    secondary: "#F1C40F",
    surface: "#0a0f1a",
  },
  {
    id: "loki",
    name: "Loki",
    emoji: "🟢",
    vibe: "Green + Gold • Mischief",
    accent: "#1A7A4A",
    secondary: "#C9A227",
    surface: "#0a1a0f",
  },
  {
    id: "black-panther",
    name: "Black Panther",
    emoji: "🟣",
    vibe: "Purple • Vibranium Royal",
    accent: "#6C3483",
    secondary: "#A569BD",
    surface: "#0d0a1a",
  },
  {
    id: "doctor-strange",
    name: "Doctor Strange",
    emoji: "🔮",
    vibe: "Crimson • Arcane Magic",
    accent: "#E74C3C",
    secondary: "#F39C12",
    surface: "#1a0a0d",
  },
] as const;

type ThemeId = typeof THEMES[number]["id"];

// ── Toast component ────────────────────────────────────────────────────────
function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className="fixed bottom-24 md:bottom-8 left-1/2 z-[9999] pointer-events-none"
      style={{
        transform: "translateX(-50%)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      <div className="bg-accent text-white px-5 py-3 rounded-2xl shadow-[0_0_30px_var(--color-accent-glow)] text-sm font-semibold whitespace-nowrap">
        {message}
      </div>
    </div>
  );
}

// ── Settings page ──────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  const [characterTheme, setCharacterTheme] = useState<ThemeId>("default");
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [loading, setLoading] = useState(true);

  // Load saved character theme on mount
  useEffect(() => {
    const saved = localStorage.getItem("planora_character_theme") as ThemeId | null;
    if (saved) setCharacterTheme(saved);
    setLoading(false);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }, []);

  const applyCharacterTheme = (id: ThemeId) => {
    setCharacterTheme(id);
    localStorage.setItem("planora_character_theme", id);

    if (id === "default") {
      document.documentElement.removeAttribute("data-character");
    } else {
      document.documentElement.setAttribute("data-character", id);
    }

    const selected = THEMES.find((t) => t.id === id)!;
    showToast(`Theme changed to ${selected.name} ${selected.emoji}`);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <SandyLoading />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 max-w-4xl pb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-muted">Manage your account and application preferences.</p>
        </div>

        {/* ── Appearance (Light / Dark toggle) ── */}
        <div className="glass-card p-6 border-l-4 border-l-accent flex flex-col gap-6">
          <div className="flex items-center gap-3 text-accent font-semibold text-lg">
            <Settings className="w-5 h-5" />
            <span>Appearance</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-foreground">Theme Mode</h3>
              <p className="text-sm text-muted mt-1">Switch between Light and Dark mode instantly.</p>
            </div>

            <button suppressHydrationWarning onClick={toggleTheme}
              className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 min-h-[44px] bg-secondary hover:bg-secondary-hover border border-card-border rounded-xl transition-all duration-300 shadow-sm hover:shadow-md group"
            >
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              ) : (
                <Sun className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
              )}
              <span className="font-medium capitalize">{theme} Mode</span>
            </button>
          </div>
        </div>

        {/* ── UI Theme (Marvel character themes) ── */}
        <div className="glass-card p-6 border-l-4 border-l-accent flex flex-col gap-6">
          <div className="flex items-center gap-3 text-accent font-semibold text-lg">
            <Palette className="w-5 h-5" />
            <span>🎨 UI Theme</span>
          </div>
          <p className="text-sm text-muted -mt-4">Choose your Planora experience</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {THEMES.map((t) => {
              const isSelected = characterTheme === t.id;
              return (
                <button suppressHydrationWarning key={t.id}
                  onClick={() => applyCharacterTheme(t.id)}
                  className="relative text-left p-4 rounded-2xl border-2 transition-all duration-300 group focus:outline-none"
                  style={{
                    borderColor: isSelected ? t.accent : "var(--border)",
                    background: isSelected
                      ? `linear-gradient(135deg, ${t.surface}cc, ${t.surface}88)`
                      : "var(--surface-elevated)",
                    boxShadow: isSelected
                      ? `0 0 20px ${t.accent}55, inset 0 0 20px ${t.accent}10`
                      : undefined,
                  }}
                >
                  {/* Selected checkmark badge */}
                  {isSelected && (
                    <span
                      className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ background: t.accent }}
                    >
                      <Check size={11} />
                    </span>
                  )}

                  {/* Character emoji + name */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl leading-none">{t.emoji}</span>
                    <span
                      className="font-bold text-sm"
                      style={{ color: isSelected ? t.accent : "var(--foreground)" }}
                    >
                      {t.name}
                    </span>
                  </div>

                  {/* Color dot preview */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <span
                      className="w-4 h-4 rounded-full ring-1 ring-white/20 shadow-sm"
                      style={{ background: t.accent }}
                      title="Accent"
                    />
                    <span
                      className="w-4 h-4 rounded-full ring-1 ring-white/20 shadow-sm"
                      style={{ background: t.secondary }}
                      title="Secondary"
                    />
                    <span
                      className="w-4 h-4 rounded-full ring-1 ring-white/20 shadow-sm"
                      style={{ background: t.surface }}
                      title="Surface"
                    />
                  </div>

                  {/* Vibe description */}
                  <p className="text-xs text-muted leading-snug">{t.vibe}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Account & Profile ── */}
        <div className="glass-card p-6 border-l-4 border-l-blue-500 flex flex-col gap-6">
          <div className="flex items-center gap-3 text-blue-500 font-semibold text-lg">
            <User className="w-5 h-5" />
            <span>Account &amp; Profile</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card/50 p-4 rounded-xl border border-card-border gap-4">
            <div className="flex items-center gap-4">
              {user?.imageUrl && (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  className="w-12 h-12 rounded-full border border-card-border shadow-sm"
                />
              )}
              <div>
                <h3 className="font-medium text-foreground">{user?.fullName || "User"}</h3>
                <p className="text-sm text-muted">{user?.primaryEmailAddress?.emailAddress}</p>
              </div>
            </div>

            <button suppressHydrationWarning onClick={() => openUserProfile()}
              className="px-4 py-2 min-h-[44px] bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-all duration-300 shadow-sm w-full sm:w-auto"
            >
              Manage Profile
            </button>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      <Toast message={toast.message} visible={toast.visible} />
    </>
  );
}

