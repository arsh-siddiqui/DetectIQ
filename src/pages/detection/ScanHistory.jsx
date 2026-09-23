import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Loader2, ArrowRight, ScanLine, Mail, Globe, MessageSquare, QrCode, Image, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [filter, setFilter] = useState("all");
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

  const filtered = filter === "all" ? scans : scans.filter(s => s.scanType === filter || s.inputType === filter);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentScans = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      className="p-6 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-primary">Scan History</h1>
          <p className="text-sm text-secondary mt-0.5">{scans.length} total scan records analyzed</p>
        </div>
        <Link
          to="/detection/scanner"
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white rounded-xl text-sm font-semibold shadow-soft transition-all"
        >
          <ScanLine className="w-4 h-4" /> New Scan
        </Link>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger border border-danger/20 p-4 rounded-xl text-sm mb-5 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 hide-scrollbar">
        {[
          { id: "all", label: "All Scans" },
          { id: "email", label: "Email" },
          { id: "url", label: "URL" },
          { id: "message", label: "Message" },
          { id: "qr", label: "QR Payload" },
          { id: "screenshot", label: "Screenshot" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); setCurrentPage(1); }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              filter === f.id
                ? "bg-accent-blue text-white shadow-sm"
                : "bg-card text-secondary hover:text-primary hover:bg-secondary/70"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 text-center shadow-card">
          <ShieldAlert className="w-10 h-10 text-muted mx-auto mb-3" />
          <h3 className="text-base font-bold text-primary mb-1">No scans found</h3>
          <p className="text-sm text-secondary mb-5">
            {filter === "all" ? "Submit content for analysis to see results here." : `No ${filter} scans yet.`}
          </p>
          <Link
            to="/detection/scanner"
            className="inline-flex items-center gap-2 bg-accent-blue text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-all shadow-soft"
          >
            Analyze Content
          </Link>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[110px_100px_2fr_110px_90px_50px] px-6 py-3 border-b border-border/40 bg-secondary/30">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Date</span>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Type</span>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Target</span>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Risk</span>
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Score</span>
            <span className="text-right text-[11px] font-bold text-muted uppercase tracking-wider">Action</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/20">
            {currentScans.map((scan) => {
              const isMedium = scan.riskLevel === 'medium';
              const isDanger = scan.riskLevel === 'high' || scan.riskLevel === 'critical';
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
                      {scan.riskLevel || 'Unknown'}
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
                  className="p-1.5 rounded-xl border border-border/40 text-muted hover:text-primary hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="p-1.5 rounded-xl border border-border/40 text-muted hover:text-primary hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

