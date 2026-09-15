import { useState, Fragment } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, ScanLine, ShieldAlert, History, Shield, FileSearch, TrendingUp, BookOpen, User, ShieldCheck, Menu, X, Settings2, Bot, Target } from "lucide-react";
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
      { label: "Threat Intelligence", to: "/security/threat-intelligence", icon: ShieldAlert },
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

export default function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const { user } = useAppData();
  return (
    <div className="lg:hidden sticky top-0 z-40 bg-background/90 backdrop-blur-lg border-b border-border shadow-sm">
      <div className="flex items-center justify-between px-4 h-16">
        <div className="flex items-center gap-2 font-heading font-extrabold text-xl text-primary">
          <ShieldCheck className="w-6 h-6 text-accent-blue" />
          DetectIQ
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-accent-blue text-white flex items-center justify-center text-xs font-bold shadow-soft">
            {user.avatar}
          </div>
          <button onClick={() => setOpen(!open)} className="p-2 text-primary hover:bg-secondary rounded-lg transition-colors">
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
          >
            <div className="flex flex-col p-3 gap-1 bg-background border-t border-border shadow-soft">
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
