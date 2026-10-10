import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  ShieldAlert, Loader2, ArrowRight, ScanLine, Mail, Globe, MessageSquare, 
  QrCode, Image, ChevronLeft, ChevronRight, Download, Search, X, Filter 
} from "lucide-react";
import { getScanHistory } from "../../services/detectionService";
import { motion } from "framer-motion";

const TYPE_ICONS = {
  email: Mail,
  url: Globe,
  message: MessageSquare,
  qr: QrCode,
  screenshot: Image,
};

export default function ScanHistory() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const itemsPerPage = 10;

  useEffect(() => {
    async function load() {
      try {
        const data = await getScanHistory({ all: true });
        setScans(data || []);
      } catch {
        setError("Failed to load scan history.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filtered dataset
  const filtered = useMemo(() => {
    return scans.filter((s) => {
      // Type filter
      if (typeFilter !== "all") {
        const sType = (s.scanType || s.inputType || "").toLowerCase();
        if (sType !== typeFilter.toLowerCase()) return false;
      }

      // Severity filter
      if (severityFilter !== "all") {
        const sRisk = (s.riskLevel || "").toLowerCase();
        const sClass = (s.classification || "").toLowerCase();
        if (severityFilter === "high") {
          if (sRisk !== "high" && sRisk !== "critical" && sClass !== "phishing") return false;
        } else if (severityFilter === "medium") {
          if (sRisk !== "medium" && sClass !== "suspicious") return false;
        } else if (severityFilter === "safe") {
          if (sRisk !== "safe" && sRisk !== "low" && sClass !== "legitimate") return false;
        }
      }

      // Search keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const target = (s.target || "").toLowerCase();
        const classification = (s.classification || "").toLowerCase();
        const type = (s.scanType || s.inputType || "").toLowerCase();
        if (!target.includes(q) && !classification.includes(q) && !type.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [scans, typeFilter, severityFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentScans = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // CSV Export handler
  const exportToCSV = () => {
    if (!filtered || filtered.length === 0) return;
    const headers = ["Scan ID", "Date", "Time", "Input Type", "Target / Subject", "Classification", "Risk Level", "Risk Score"];
    const rows = filtered.map((s) => {
      const d = new Date(s.createdAt);
      const targetClean = (s.target || s.classification || "Scanned Item").replace(/"/g, '""');
      return [
        s._id || "",
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        s.scanType || s.inputType || "unknown",
        `"${targetClean}"`,
        s.classification || "unknown",
        s.riskLevel || "unknown",
        s.riskScore !== undefined ? s.riskScore : ""
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `detectiq_scan_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 text-accent-blue animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-primary">Scan History</h1>
          <p className="text-sm text-secondary mt-0.5">
            {scans.length} total records ({filtered.length} matching current filters)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border hover:border-accent-blue text-primary rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Download records as CSV spreadsheet"
          >
            <Download className="w-4 h-4 text-accent-blue" />
            <span>Export CSV</span>
          </button>
          <Link
            to="/detection/scanner"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white rounded-xl text-sm font-semibold shadow-soft transition-all"
          >
            <ScanLine className="w-4 h-4" /> New Scan
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger border border-danger/20 p-4 rounded-xl text-sm flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Control Bar: Search & Severity Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/60 border border-border/80 p-4 rounded-2xl shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search targets, domains, keywords..."
            className="w-full bg-background border border-border rounded-xl pl-10 pr-9 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-mono font-bold uppercase text-muted mr-1.5 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Risk:
          </span>
          {[
            { id: "all", label: "All" },
            { id: "high", label: "High / Phishing" },
            { id: "medium", label: "Suspicious" },
            { id: "safe", label: "Safe" },
          ].map((sev) => (
            <button
              key={sev.id}
              onClick={() => { setSeverityFilter(sev.id); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                severityFilter === sev.id
                  ? sev.id === "high" ? "bg-danger text-white shadow-sm" :
                    sev.id === "medium" ? "bg-warning text-white shadow-sm" :
                    sev.id === "safe" ? "bg-success text-white shadow-sm" :
                    "bg-accent-blue text-white shadow-sm"
                  : "bg-background border border-border text-secondary hover:text-primary hover:border-accent-blue/50"
              }`}
            >
              {sev.label}
            </button>
          ))}
        </div>
      </div>

      {/* Type Channel Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
        {[
          { id: "all", label: "All Types" },
          { id: "url", label: "URLs" },
          { id: "email", label: "Emails" },
          { id: "message", label: "Messages" },
          { id: "qr", label: "QR Codes" },
          { id: "screenshot", label: "Screenshots" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => { setTypeFilter(f.id); setCurrentPage(1); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              typeFilter === f.id
                ? "bg-primary text-background shadow-sm"
                : "bg-card text-secondary hover:text-primary hover:bg-secondary/70 border border-border/60"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results Content */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center shadow-card border border-border/80">
          <ShieldAlert className="w-10 h-10 text-muted mx-auto mb-3" />
          <h3 className="text-base font-bold text-primary mb-1">No matching scan records</h3>
          <p className="text-sm text-secondary mb-5">
            {searchQuery || typeFilter !== "all" || severityFilter !== "all"
              ? "Try resetting your search query or adjusting active filters."
              : "Submit content for analysis to see results here."}
          </p>
          {(searchQuery || typeFilter !== "all" || severityFilter !== "all") ? (
            <button
              onClick={() => { setSearchQuery(""); setTypeFilter("all"); setSeverityFilter("all"); }}
              className="inline-flex items-center gap-2 bg-secondary text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-secondary/80 transition-all cursor-pointer"
            >
              Clear All Filters
            </button>
          ) : (
            <Link
              to="/detection/scanner"
              className="inline-flex items-center gap-2 bg-accent-blue text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-soft"
            >
              Analyze Content
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-card border border-border/80 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[110px_100px_2fr_110px_90px_50px] px-6 py-3 border-b border-border/40 bg-secondary/30">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Date</span>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Type</span>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Target / Subject</span>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Risk</span>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Score</span>
            <span className="text-right text-[11px] font-bold text-muted uppercase tracking-wider">Action</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/20">
            {currentScans.map((scan) => {
              const isMedium = scan.riskLevel === 'medium' || scan.classification === 'suspicious';
              const isDanger = scan.riskLevel === 'high' || scan.riskLevel === 'critical' || scan.classification === 'phishing';
              const TypeIcon = TYPE_ICONS[scan.scanType || scan.inputType] || ScanLine;
              const riskScore = scan.riskScore !== undefined ? scan.riskScore : (isDanger ? 85 : isMedium ? 50 : 10);

              return (
                <Link
                  key={scan._id}
                  to={`/detection/result/${scan._id}`}
                  className="grid grid-cols-[110px_100px_2fr_110px_90px_50px] items-center px-6 py-4 hover:bg-secondary/40 transition-colors group"
                >
                  <div className="text-xs text-muted font-medium">
                    {new Date(scan.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TypeIcon className="w-3.5 h-3.5 text-muted" />
                    <span className="text-xs font-semibold text-secondary capitalize">{scan.scanType || scan.inputType || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0 pr-4">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isDanger ? 'bg-danger' : isMedium ? 'bg-warning' : 'bg-success'
                    }`} />
                    <span className="text-sm font-semibold text-primary truncate">{scan.target || scan.classification || 'Scanned Item'}</span>
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${
                      isDanger ? 'bg-danger/10 text-danger' :
                      isMedium ? 'bg-warning/10 text-warning' :
                      'bg-success/10 text-success'
                    }`}>
                      {scan.riskLevel || (isDanger ? 'High' : isMedium ? 'Suspicious' : 'Safe')}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-primary">
                    {riskScore}/100
                  </div>
                  <div className="flex justify-end">
                    <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent-blue group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-border/30 px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-muted">
                Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} scans
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="p-1.5 rounded-xl border border-border/40 text-muted hover:text-primary hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 rounded-xl border border-border/40 text-muted hover:text-primary hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
