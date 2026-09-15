import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, ScanLine, ShieldAlert, History, Shield, FileSearch, TrendingUp, BookOpen, User, ShieldCheck, Settings2, LogOut, Bot, Target, Globe } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";

const navSections = [
  {
    title: "",
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
  },
  {
    title: "",
    items: [
      { label: "Profile", to: "/profile", icon: User },
    ]
  }
];

export default function Sidebar() {
  const { user, xp, logout } = useAppData();
  const level = Math.max(1, Math.floor((xp || 0) / 300) + 1);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  return (
    <aside className="hidden lg:flex flex-col w-[240px] flex-shrink-0 h-screen sticky top-0 bg-background border-r border-border py-6 px-4">
      <div className="flex items-center gap-2 font-heading font-extrabold text-2xl text-primary px-2 mb-8">
        <ShieldCheck className="w-7 h-7 text-accent-blue" />
        DetectIQ
      </div>

      <nav className="flex flex-col gap-4 flex-1 overflow-y-auto pr-2 pb-4 hide-scrollbar">
        {navSections.map((section, idx) => (
          <div key={idx}>
            {section.title && (
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-2 px-3 mt-4">
                {section.title}
              </div>
            )}
            <div className="flex flex-col gap-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      isActive 
                        ? "text-accent-blue bg-accent-blue/10" 
                        : "text-muted hover:text-primary hover:bg-secondary"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon className={`w-[18px] h-[18px] transition-colors ${isActive ? "text-accent-blue" : "text-muted"}`} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {user?.isAdmin && (
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold mb-2 transition-colors ${
              isActive ? "text-primary bg-primary/10" : "text-ink-light hover:bg-secondary hover:text-primary"
            }`
          }
        >
          <Settings2 className="w-4.5 h-4.5" />
          Admin
        </NavLink>
      )}

      <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-card border border-border shadow-soft mt-auto hover:border-primary/30 transition-colors group">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-soft">
            {user.avatar}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-primary truncate">{user.name}</div>
            <div className="text-[11px] font-medium text-muted truncate">Level {level} · {user.role}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" title="Log Out">
          <LogOut className="w-[14px] h-[14px]" />
        </button>
      </div>
    </aside>
  );
}
