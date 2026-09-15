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
    <footer className="bg-white border-t border-slate-100 mt-24">
      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <div className="flex items-center gap-2 font-extrabold text-lg text-ink mb-3">
            <span className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </span>
            DetectIQ
          </div>
          <p className="text-sm text-ink-light leading-relaxed max-w-xs">
            Learn Smart. Detect Fast. Stay Safe. AI-powered fraud awareness for everyone, everywhere.
          </p>
          <div className="flex gap-3 mt-5">
            {[Globe, Users, Rss].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-ink-light hover:bg-primary hover:text-white transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold text-ink mb-4">{col.title}</h4>
            <ul className="space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-ink-light hover:text-primary transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 py-6 text-center text-xs text-ink-faint">
        © 2026 DetectIQ. All rights reserved. Built for a safer internet.
      </div>
    </footer>
  );
}
