import { useState, Fragment, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ScanLine, ShieldAlert, History, Shield, FileSearch, BookOpen, ShieldCheck, Menu, X, Settings2, Target, Globe, User, LogOut, LayoutDashboard } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";

const navSections = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "Detection",
    items: [
      { label: "Scanner", to: "/detection/scanner", icon: ScanLine },
      { label: "History", to: "/detection/history", icon: History },
      { label: "My Email Patterns", to: "/detection/email-context", icon: FileSearch },
    ]
  },
  {
    title: "Security Intelligence",
    items: [
      { label: "Threat Intelligence", to: "/security/threat-intelligence", icon: Globe },
      { label: "Investigations", to: "/security/investigations", icon: ShieldAlert },
      { label: "Indicators", to: "/security/indicators", icon: Shield },
    ]
  },
  {
    title: "Vulnerability Learning",
    items: [
      { label: "Vulnerabilities", to: "/vulnerabilities", icon: BookOpen },
      { label: "My Progress", to: "/learning/progress", icon: Target },
    ]
  }
];

export default function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAppData();

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <div className="lg:hidden sticky top-0 z-40 bg-background/90 backdrop-blur-lg border-b border-border shadow-sm">
      <div className="flex items-center justify-between px-4 h-16">
        <div className="flex items-center gap-2 font-heading font-extrabold text-xl text-primary">
          <ShieldCheck className="w-6 h-6 text-accent-blue" />
          DetectIQ
        </div>
        <div className="flex items-center gap-3">
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setProfileOpen(!profileOpen)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-white flex items-center justify-center text-xs font-bold shadow-soft focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-1 focus:ring-offset-card transition-all"
            >
              {user?.avatar || user?.name?.[0] || "U"}
            </button>
            
            <AnimatePresence>
              {profileOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-elevated rounded-xl shadow-elevated border border-border overflow-hidden z-50 origin-top-right"
                >
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button onClick={() => { setOpen(!open); setProfileOpen(false); }} className="p-2 text-primary hover:bg-secondary rounded-lg transition-colors">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col p-3 gap-1 bg-background border-t border-border shadow-soft max-h-[80vh] overflow-y-auto">
              {navSections.map((section, idx) => (
                <Fragment key={idx}>
                  {section.title && (
                    <div className="text-[11px] font-bold text-muted uppercase tracking-wider mt-2 mb-1 px-4">
                      {section.title}
                    </div>
                  )}
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                          isActive ? "text-accent-blue bg-accent-blue/10" : "text-muted hover:text-primary hover:bg-secondary"
                        }`
                      }
                    >
                      <item.icon className="w-[18px] h-[18px]" />
                      {item.label}
                    </NavLink>
                  ))}
                </Fragment>
              ))}
              {user?.isAdmin && (
                <NavLink
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold mt-2 ${
                      isActive ? "text-primary bg-primary-50" : "text-ink-light"
                    }`
                  }
                >
                  <Settings2 className="w-4.5 h-4.5" />
                  Admin
                </NavLink>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
