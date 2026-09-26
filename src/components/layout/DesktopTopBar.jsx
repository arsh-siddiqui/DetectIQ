import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sun, Moon, User, LogOut } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";

const searchTargets = [
  { label: "Dashboard", to: "/dashboard", keywords: ["home", "dash"] },
  { label: "Scan Email", to: "/detection/email", keywords: ["scan", "email"] },
  { label: "Scan URL", to: "/detection/url", keywords: ["scan", "url", "link"] },
  { label: "Scan History", to: "/detection/history", keywords: ["history", "past"] },
  { label: "My Email Patterns", to: "/detection/email-context", keywords: ["email", "patterns", "rag"] },
  { label: "Vulnerabilities", to: "/vulnerabilities", keywords: ["vulnerability", "learn"] },
  { label: "My Progress", to: "/learning/progress", keywords: ["progress", "stats"] },
  { label: "Profile", to: "/profile", keywords: ["profile", "settings"] },
];

export default function DesktopTopBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const { user, theme, toggleTheme, logout } = useAppData();

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const availableTargets = user?.isAdmin
    ? [...searchTargets, { label: "Admin", to: "/admin", keywords: ["admin"] }]
    : searchTargets;

  const results = query
    ? availableTargets.filter(
        (t) => t.label.toLowerCase().includes(query.toLowerCase()) ||
               t.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : [];

  const goTo = (to) => {
    setQuery("");
    setOpen(false);
    navigate(to);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <header className="hidden lg:flex h-14 items-center justify-between px-6 bg-card border-b border-border sticky top-0 z-30 flex-shrink-0">
      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search pages, tools..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg text-primary placeholder:text-muted focus:border-accent-blue focus:outline-none transition-colors"
        />
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-elevated rounded-xl shadow-elevated border border-border overflow-hidden z-50">
            {results.map((r) => (
              <button
                key={r.to}
                onMouseDown={() => goTo(r.to)}
                className="w-full text-left px-4 py-2.5 text-sm text-primary hover:bg-secondary transition-colors"
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary hover:bg-secondary border border-border transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-white flex items-center justify-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-1 focus:ring-offset-card transition-all shadow-sm"
          >
            {user?.avatar || user?.name?.[0] || "U"}
          </button>
          
          {profileOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-elevated rounded-xl shadow-elevated border border-border overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-sm font-semibold text-primary truncate">{user?.name}</div>
                <div className="text-xs text-muted truncate">{user?.email}</div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-primary hover:bg-secondary flex items-center gap-3 transition-colors"
                >
                  <User className="w-[18px] h-[18px] text-muted" /> Profile
                </button>
                <div className="my-1 border-t border-border"></div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-danger/10 flex items-center gap-3 transition-colors"
                >
                  <LogOut className="w-[18px] h-[18px] text-danger" /> Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
