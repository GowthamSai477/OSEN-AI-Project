"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import {
  Calendar, LayoutDashboard, MessageSquareText, Settings, Sun, Moon,
  Sparkles, Menu, X, Bell, Zap, AlertTriangle, Flame, CheckCircle2, Info, Trash2, BarChart2, Timer, LayoutTemplate, FileText, BookOpen
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useState, useEffect, useRef, useCallback } from "react";
import { cachedFetch, invalidateNotifications } from "@/lib/api-helpers";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string; // ai_change / missed_task / upcoming_event / streak_milestone / goal_update
  read: boolean;
  link: string | null;
  created_at: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === "ai_change") return <Zap className="w-4 h-4 text-accent shrink-0" />;
  if (type === "missed_task") return <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />;
  if (type === "upcoming_event") return <Bell className="w-4 h-4 text-blue-400 shrink-0" />;
  if (type === "streak_milestone") return <Flame className="w-4 h-4 text-orange-400 shrink-0" />;
  if (type === "goal_update") return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  return <Info className="w-4 h-4 text-muted shrink-0" />;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [showBetaBanner, setShowBetaBanner] = useState(false);

  // Notification bell state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedState = localStorage.getItem("planora_sidebar_collapsed");
    if (savedState === "true") setCollapsed(true);
    const betaDismissed = localStorage.getItem("planora_beta_dismissed");
    if (betaDismissed !== "true") setShowBetaBanner(true);

    // Restore character theme on dashboard mount
    const savedCharacter = localStorage.getItem("planora_character_theme");
    if (savedCharacter && savedCharacter !== "default") {
      document.documentElement.setAttribute("data-character", savedCharacter);
    } else {
      document.documentElement.removeAttribute("data-character");
    }
  }, []);

  // ── Notification fetching ──────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (force: boolean = false) => {
    if (!user) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await cachedFetch<Notification[]>(
        `notifications_${user.id}`, 
        `${process.env.NEXT_PUBLIC_API_URL}/api/notifications`, 
        token, 
        30000,
        force
      );
      if (data) setNotifications(data);
    } catch (e) {
      // silent — non-critical
    }
  }, [getToken, user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close bell on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      invalidateNotifications();
    } catch (e) {}
  };

  const clearAll = async () => {
    try {
      const token = await getToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications([]);
      invalidateNotifications();
    } catch (e) {}
  };

  const handleNotifClick = async (notif: Notification) => {
    if (!notif.read) {
      try {
        const token = await getToken();
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${notif.id}/read`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        invalidateNotifications();
      } catch (e) {}
    }
    setBellOpen(false);
    if (notif.link) router.push(notif.link);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Sidebar helpers ────────────────────────────────────────────────────────
  const toggleSidebar = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem("planora_sidebar_collapsed", String(newState));
  };
  const navLinks = [
    { name: "Overview",    href: "/dashboard",             icon: LayoutDashboard },
    { name: "AI Assistant",href: "/dashboard/ai-assistant",icon: MessageSquareText },
    { name: "Schedule",    href: "/dashboard/schedule",    icon: Calendar },
    { name: "Templates",   href: "/dashboard/templates",   icon: LayoutTemplate },
    { name: "Notes",       href: "/dashboard/notes",       icon: FileText },
    { name: "Study",       href: "/dashboard/study",       icon: BookOpen },
    { name: "Focus",       href: "/dashboard/focus",       icon: Timer },
    { name: "Progress",    href: "/dashboard/progress",    icon: BarChart2 },
    { name: "Settings",    href: "/dashboard/settings",    icon: Settings },
    { name: "AI Settings", href: "/dashboard/ai-settings", icon: Sparkles },
  ];

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const distance = touchStart - touchEnd;
    if (distance > 50 && mobileOpen) setMobileOpen(false);
    if (distance < -50 && !mobileOpen && touchStart < 30) setMobileOpen(true);
    setTouchStart(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Beta Banner */}
      {showBetaBanner && (
        <div className="bg-accent/10 border-b border-accent/20 py-2 px-4 flex items-center justify-between text-sm shrink-0 z-[100] w-full">
          <div className="flex items-center gap-2 text-accent">
            <span className="hidden md:inline font-medium">🚧 Planora is in Beta — You may encounter bugs. Found an issue? Report it →</span>
            <span className="md:hidden font-medium">🚧 Beta — Found a bug?</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSdY4xoXrlMPEbZlVCGOfSkVgprLptUuMpyrswsRb3TVgNKbyA/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer" className="bg-accent text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-purple-600 transition-colors shadow-sm">Report Issue</a>
            <button suppressHydrationWarning onClick={() => { setShowBetaBanner(false); localStorage.setItem("planora_beta_dismissed", "true"); }} className="p-1 text-accent/70 hover:text-accent transition-colors rounded-full hover:bg-accent/10"><X size={16} /></button>
          </div>
        </div>
      )}

      <div
        className="flex flex-1 overflow-hidden transition-colors duration-300 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile Overlay */}
        <div
          className={`md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setMobileOpen(false)}
        />

        {/* Sidebar */}
        <aside className={`fixed md:relative border-r border-card-border bg-card/60 backdrop-blur-2xl flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] z-50 h-full ${mobileOpen ? "translate-x-0 w-64" : "-translate-x-full"} md:translate-x-0 ${collapsed ? "md:w-20" : "md:w-64"}`}>
          <div className="h-20 flex items-center justify-between px-6 border-b border-card-border/50">
            <Link href="/" className={`font-bold text-xl tracking-tight flex items-center gap-3 group transition-opacity duration-300 ${collapsed ? "opacity-0 md:hidden" : "opacity-100"}`}>
              <div className="w-8 h-8 bg-gradient-to-tr from-accent to-purple-400 rounded-lg shadow-[0_0_15px_var(--color-accent-glow)] group-hover:shadow-[0_0_20px_var(--color-accent)] transition-all duration-300 shrink-0" />
              <span className="text-foreground transition-colors duration-300 whitespace-nowrap flex items-center gap-2">
                Planora AI
                <span className="text-[9px] bg-accent/15 border border-accent/20 text-accent px-1.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold shadow-sm">BETA</span>
              </span>
            </Link>
            <button suppressHydrationWarning onClick={toggleSidebar} className={`hidden md:block p-1.5 rounded-lg bg-secondary text-muted hover:text-foreground transition-colors ${collapsed ? "md:mx-auto" : ""}`}>
              <Menu size={18} />
            </button>
            <button suppressHydrationWarning onClick={() => setMobileOpen(false)} className="md:hidden p-1.5 rounded-lg text-muted hover:text-foreground">
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto overflow-x-hidden">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  prefetch={true}
                  onClick={() => setMobileOpen(false)}
                  className={`relative flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group overflow-hidden min-h-[44px] ${isActive ? "bg-primary/10 text-primary font-medium" : "text-muted hover:text-foreground"}`}
                >
                  <div className="absolute inset-0 bg-secondary/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-accent transition-transform duration-300 origin-left ${isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"}`} />
                  <Icon className={`w-5 h-5 transition-colors duration-300 shrink-0 ${isActive ? "text-primary" : "group-hover:text-primary"} ${collapsed ? "md:mx-auto" : ""}`} />
                  <span className={`z-10 relative whitespace-nowrap ${collapsed ? "md:hidden" : "block"}`}>{link.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-card-border/50 flex flex-col gap-4 overflow-hidden">
            <button suppressHydrationWarning
              onClick={toggleTheme}
              className={`flex items-center px-3 py-2.5 rounded-xl min-h-[44px] bg-secondary/50 hover:bg-secondary transition-colors duration-300 group text-sm text-muted hover:text-foreground ${collapsed ? "md:justify-center" : "justify-between"}`}
            >
              <span className="font-medium flex items-center gap-2">
                {theme === "dark" ? <Moon size={16} className="shrink-0" /> : <Sun size={16} className="shrink-0" />}
                <span className={`${collapsed ? "md:hidden" : "block"}`}>Theme</span>
              </span>
              <span className={`text-xs uppercase tracking-wider bg-card-border px-2 py-1 rounded-md ${collapsed ? "md:hidden" : "block"}`}>{theme}</span>
            </button>

            <div className={`flex items-center px-3 py-2 rounded-xl min-h-[44px] hover:bg-secondary/50 transition-colors duration-300 cursor-pointer ${collapsed ? "md:justify-center md:gap-0" : "gap-3"}`}>
              <UserButton appearance={{ elements: { avatarBox: "w-9 h-9 rounded-full border border-card-border shadow-sm shrink-0" } }} />
              <div className={`flex flex-col flex-1 min-w-0 ${collapsed ? "md:hidden" : "block"}`}>
                <span className="text-sm font-semibold truncate text-foreground">{user?.fullName || "My Account"}</span>
                <span className="text-xs text-muted truncate">Manage settings</span>
              </div>
              <Settings className={`w-4 h-4 text-muted shrink-0 ${collapsed ? "md:hidden" : "block"}`} />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto relative transition-colors duration-300 pb-16 md:pb-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.03] pointer-events-none transition-opacity duration-300" />
          <div className="p-4 md:p-8 max-w-6xl mx-auto h-full flex flex-col">
            {/* Mobile Header */}
            {!pathname.includes("ai-assistant") && (
              <div className="md:hidden flex items-center mb-4 gap-3">
                <button suppressHydrationWarning onClick={() => setMobileOpen(true)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-secondary text-foreground">
                  <Menu size={20} />
                </button>
                <span className="font-bold flex items-center gap-2 flex-1">
                  Planora AI
                  <span className="text-[9px] bg-accent/15 border border-accent/20 text-accent px-1.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold shadow-sm">BETA</span>
                </span>

                {/* Bell icon — mobile */}
                <div ref={bellRef} className="relative">
                  <button suppressHydrationWarning onClick={() => setBellOpen(prev => !prev)} className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-secondary text-foreground">
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  {bellOpen && <NotificationDropdown notifications={notifications} onNotifClick={handleNotifClick} onMarkAllRead={markAllRead} onClearAll={clearAll} mobile />}
                </div>
              </div>
            )}

            {/* Desktop Bell (top-right of main area) */}
            <div className="hidden md:flex justify-end mb-0 absolute top-6 right-8 z-30" ref={pathname.includes("ai-assistant") ? undefined : bellRef}>
              <div ref={!pathname.includes("ai-assistant") ? undefined : bellRef} className="relative">
                <button suppressHydrationWarning onClick={() => setBellOpen(prev => !prev)} className="relative p-2 rounded-xl bg-secondary/60 hover:bg-secondary text-muted hover:text-foreground transition-colors border border-card-border">
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {bellOpen && <NotificationDropdown notifications={notifications} onNotifClick={handleNotifClick} onMarkAllRead={markAllRead} onClearAll={clearAll} />}
              </div>
            </div>

            <div className="flex-1 h-[calc(100%-4rem)] md:h-full">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-card-border flex items-center justify-around z-40 px-2 pb-safe">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px] ${isActive ? "text-primary" : "text-muted"}`}
              >
                <Icon size={20} className={`mb-1 transition-transform ${isActive ? "scale-110" : ""}`} />
                <span className="text-[10px] font-medium truncate w-full text-center">{link.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ── Notification Dropdown ────────────────────────────────────────────────────
function NotificationDropdown({
  notifications,
  onNotifClick,
  onMarkAllRead,
  onClearAll,
  mobile = false,
}: {
  notifications: Notification[];
  onNotifClick: (n: Notification) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  mobile?: boolean;
}) {
  return (
    <div className={`absolute ${mobile ? "right-0 w-[calc(100vw-2rem)]" : "right-0 w-80"} top-full mt-2 bg-card border border-card-border rounded-2xl shadow-2xl z-[200] overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border/60">
        <span className="font-bold text-sm text-foreground">Notifications</span>
        <button suppressHydrationWarning onClick={onMarkAllRead} className="text-xs text-accent hover:underline font-medium">Mark all read</button>
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-card-border/40">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-muted text-sm">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No notifications yet
          </div>
        ) : (
          notifications.map(n => (
            <button suppressHydrationWarning
              key={n.id}
              onClick={() => onNotifClick(n)}
              className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-secondary/60 transition-colors group ${!n.read ? "border-l-2 border-accent" : ""}`}
            >
              <div className="mt-0.5">
                <NotifIcon type={n.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${n.read ? "text-muted" : "text-foreground"}`}>{n.title}</p>
                <p className="text-xs text-muted line-clamp-2 leading-relaxed mt-0.5">{n.message}</p>
                <p className="text-[10px] text-muted/70 mt-1">{timeAgo(n.created_at)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2.5 border-t border-card-border/60 flex justify-end">
          <button suppressHydrationWarning onClick={onClearAll} className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition-colors font-medium">
            <Trash2 size={12} />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

