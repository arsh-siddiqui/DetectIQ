import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, Globe, Shield, Activity } from "lucide-react";

const columns = [
  {
    title: "Platform",
    links: [
      { label: "Live Threat Scanner", to: "/#investigate" },
      { label: "Detection Suite", to: "/#features" },
      { label: "Security Pipeline", to: "/#about" },
      { label: "Threat Intelligence", to: "/security/threat-intelligence" },
    ],
  },
  {
    title: "Security & Learning",
    links: [
      { label: "Vulnerability Center", to: "/vulnerabilities" },
      { label: "My Progress", to: "/learning/progress" },
      { label: "Email Patterns", to: "/detection/email-context" },
      { label: "Investigations", to: "/security/investigations" },
    ],
  },
  {
    title: "Account & Portal",
    links: [
      { label: "Login", to: "/login" },
      { label: "Get Started", to: "/register" },
      { label: "Dashboard", to: "/dashboard" },
      { label: "Scan History", to: "/detection/history" },
    ],
  },
];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLinkClick = (e, to) => {
    if (to.startsWith("/#")) {
      e.preventDefault();
      const targetId = to.replace("/#", "");
      if (location.pathname !== "/") {
        navigate(to);
      } else {
        window.history.pushState(null, "", `#${targetId}`);
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <footer className="relative z-10 backdrop-blur-md bg-background/80 border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <div className="flex items-center gap-2 font-extrabold text-lg text-primary mb-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </span>
            <span className="font-heading tracking-tight font-black text-xl">DetectIQ</span>
          </div>
          <p className="text-sm text-secondary leading-relaxed max-w-xs font-medium">
            Learn Smart. Detect Fast. Stay Safe. AI-powered fraud awareness and threat detection for everyone, everywhere.
          </p>
          <div className="flex gap-3 mt-5">
            {[Globe, Shield, Activity].map((Icon, i) => (
              <div
                key={i}
                className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-secondary hover:text-accent-blue hover:border-accent-blue/40 transition-all shadow-sm cursor-pointer"
              >
                <Icon className="w-4 h-4" />
              </div>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold text-primary mb-4 font-heading tracking-tight">{col.title}</h4>
            <ul className="space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link 
                    to={l.to} 
                    onClick={(e) => handleLinkClick(e, l.to)}
                    className="text-sm font-medium text-secondary hover:text-accent-blue transition-colors cursor-pointer"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted font-mono font-medium">
        © 2026 DetectIQ. All rights reserved. Built for a safer internet.
      </div>
    </footer>
  );
}
