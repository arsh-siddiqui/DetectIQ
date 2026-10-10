import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Menu, X, Sun, Moon } from "lucide-react";
import { useAppData } from "../../context/AppDataContext";
import useScrollPosition from "../../hooks/useScrollPosition";

const links = [
  { label: "Home", targetId: "hero" },
  { label: "Features", targetId: "features" },
  { label: "About", targetId: "about" },
  { label: "Investigate", targetId: "investigate" },
  { label: "Resources", targetId: "resources" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const scrolled = useScrollPosition(20);
  const { theme, toggleTheme } = useAppData();

  const handleNavClick = (targetId) => {
    if (targetId === "hero") {
      if (location.pathname !== "/") {
        navigate("/");
        setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
      } else {
        window.history.pushState(null, "", "/");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    if (location.pathname !== "/") {
      navigate(`/#${targetId}`);
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    } else {
      window.history.pushState(null, "", `#${targetId}`);
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-card/85 border-b border-border/60 shadow-sm"
          : "backdrop-blur-md bg-background/70 border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-[68px] flex items-center justify-between select-none">
        {/* Logo */}
        <button 
          onClick={() => handleNavClick("hero")}
          className="group flex items-center gap-2.5 font-bold text-base text-primary cursor-pointer text-left"
        >
          <motion.div 
            whileHover={{ scale: 1.1, rotate: -5 }}
            whileTap={{ scale: 0.9 }}
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center flex-shrink-0 shadow-sm group-hover:shadow-glow transition-all"
          >
            <ShieldCheck className="w-4.5 h-4.5 text-white" />
          </motion.div>
          <span className="font-heading tracking-tight font-black text-lg group-hover:text-accent-blue transition-colors">DetectIQ</span>
        </button>

        {/* Center nav - Smooth In-Page Section Scrolling */}
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <motion.div key={l.label} whileHover={{ scale: 1.05, y: -1 }} whileTap={{ scale: 0.95 }}>
              <button
                type="button"
                onClick={() => handleNavClick(l.targetId)}
                className="text-sm font-medium text-secondary hover:text-accent-blue transition-colors relative group py-1 cursor-pointer bg-transparent border-0"
              >
                {l.label}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-accent-blue transition-all duration-200 group-hover:w-full" />
              </button>
            </motion.div>
          ))}
        </nav>

        {/* Right controls */}
        <div className="hidden md:flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.08, rotate: 15 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-muted hover:text-primary hover:bg-secondary/80 border border-border/50 transition-all cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-accent-blue" />}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/login")}
            className="px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary/80 rounded-xl transition-all cursor-pointer"
          >
            Login
          </motion.button>

          <motion.button
            whileHover={{ 
              scale: 1.04, 
              y: -1,
              boxShadow: "0 0 20px rgba(37, 99, 235, 0.4)"
            }}
            whileTap={{ scale: 0.95, y: 1 }}
            onClick={() => navigate("/register")}
            className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white rounded-xl shadow-soft transition-all cursor-pointer"
          >
            Get Started
          </motion.button>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-primary border border-border"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button className="p-1.5 text-primary" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden border-t border-border bg-card"
          >
            <div className="px-6 py-4 flex flex-col gap-3">
              {links.map((l) => (
                <button 
                  key={l.label} 
                  onClick={() => { handleNavClick(l.targetId); setOpen(false); }} 
                  className="text-sm font-medium text-secondary hover:text-accent-blue text-left py-1"
                >
                  {l.label}
                </button>
              ))}
              <div className="flex gap-2 pt-2">
                <button
                  className="flex-1 py-2 text-sm font-semibold text-primary border border-border rounded-lg hover:bg-secondary transition-colors"
                  onClick={() => { navigate("/login"); setOpen(false); }}
                >
                  Login
                </button>
                <button
                  className="flex-1 py-2 text-sm font-semibold bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 transition-colors"
                  onClick={() => { navigate("/register"); setOpen(false); }}
                >
                  Get Started
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
