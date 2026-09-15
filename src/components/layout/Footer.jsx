import { Link } from "react-router-dom";
import { ShieldCheck, Globe, Users, Rss } from "lucide-react";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Scan Email", to: "/detection/email" },
      { label: "My Progress", to: "/learning/progress" },
      { label: "Vulnerabilities", to: "/vulnerabilities" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/#about" },
      { label: "Features", to: "/#features" },
      { label: "FAQ", to: "/#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login", to: "/login" },
      { label: "Get Started", to: "/register" },
      { label: "Dashboard", to: "/dashboard" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-background border-t border-border mt-24">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <div className="flex items-center gap-2 font-extrabold text-lg text-primary mb-3">
            <span className="w-9 h-9 rounded-xl bg-accent-blue flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" />
            </span>
            DetectIQ
          </div>
          <p className="text-sm text-secondary leading-relaxed max-w-xs">
            Learn Smart. Detect Fast. Stay Safe. AI-powered fraud awareness for everyone, everywhere.
          </p>
          <div className="flex gap-3 mt-5">
            {[Globe, Users, Rss].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-secondary hover:bg-accent-blue hover:text-white transition-colors shadow-sm"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold text-primary mb-4">{col.title}</h4>
            <ul className="space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-secondary hover:text-accent-blue transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border py-6 text-center text-xs text-muted font-medium">
        © 2026 DetectIQ. All rights reserved. Built for a safer internet.
      </div>
    </footer>
  );
}
