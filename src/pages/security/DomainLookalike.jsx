import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Globe,
  ShieldAlert,
  ShieldCheck,
  Search,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Radio,
  Mail,
  Download,
  ArrowRight,
  Server,
  Layers,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { useToast } from "../../context/ToastContext";
import { analyzeTyposquattingApi } from "../../services/securityService";

const BRAND_PRESETS = [
  "paypal.com",
  "google.com",
  "microsoft.com",
  "apple.com",
  "netflix.com",
  "chase.com",
  "detectiq.com",
];

export default function DomainLookalike() {
  const [targetInput, setTargetInput] = useState("paypal.com");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [checkDns, setCheckDns] = useState(true);
  const [filterTab, setFilterTab] = useState("all"); // "all" | "weaponized" | "active" | "punycode" | "available"
  const [tableSearch, setTableSearch] = useState("");
  const [copiedDomain, setCopiedDomain] = useState(null);

  const { toast } = useToast();

  const handleScan = async (overrideTarget) => {
    const brandToScan = overrideTarget || targetInput;
    if (!brandToScan || brandToScan.trim().length < 2) {
      toast("Please enter a brand name or domain to analyze.", "warning");
      return;
    }

    try {
      setLoading(true);
      const res = await analyzeTyposquattingApi({
        brand: brandToScan.trim(),
        checkDns,
      });

      if (res?.data) {
        setData(res.data);
        toast(`Discovered ${res.data.lookalikes?.length || 0} lookalike permutations.`, "success");
      }
    } catch (err) {
      toast(err.response?.data?.message || err.message || "Failed to analyze typosquatting.", "danger");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedDomain(text);
    setTimeout(() => setCopiedDomain(null), 2000);
    toast("Domain copied to clipboard.", "info");
  };

  const handleExportCsv = () => {
    if (!data?.lookalikes?.length) return;

    const headers = ["Domain", "Punycode", "Variant Type", "Risk", "Status", "Is Live", "IPs", "Has MX Records"];
    const rows = data.lookalikes.map((l) => [
      l.domain,
      l.punycode,
      l.variantType,
      l.risk,
      l.status,
      l.isLive ? "YES" : "NO",
      (l.ips || []).join(";"),
      l.hasMx ? "YES" : "NO",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lookalikes_${data.brand}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("Lookalike domain intelligence exported to CSV.", "success");
  };

  // Filtered list
  const filteredLookalikes = useMemo(() => {
    if (!data?.lookalikes) return [];

    let list = data.lookalikes;

    if (filterTab === "weaponized") {
      list = list.filter((l) => l.hasMx);
    } else if (filterTab === "active") {
      list = list.filter((l) => l.isLive && !l.hasMx);
    } else if (filterTab === "punycode") {
      list = list.filter((l) => l.isPunycode);
    } else if (filterTab === "available") {
      list = list.filter((l) => l.status === "available");
    }

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (l) =>
          l.domain.toLowerCase().includes(q) ||
          l.punycode.toLowerCase().includes(q) ||
          l.variantType.toLowerCase().includes(q) ||
          (l.ips || []).some((ip) => ip.includes(q))
      );
    }

    return list;
  }, [data, filterTab, tableSearch]);

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-heading">
              Domain Typosquatting & Lookalike Radar
            </h1>
          </div>
          <p className="text-sm text-ink-light">
            Detect active lookalike domains, weaponized MX mail spoofing, and IDN homoglyph punycode attacks globally.
          </p>
        </div>

        <Badge tone="primary" icon={ShieldAlert}>
          Brand Defense Engine
        </Badge>
      </div>

      {/* Search & Configuration Card */}
      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScan();
          }}
          className="space-y-4"
        >
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-ink-faint absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="Enter brand name or domain (e.g. paypal.com, google, microsoft)..."
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 bg-white text-ink text-sm font-medium placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue transition-all"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="py-3.5 px-6 whitespace-nowrap flex items-center justify-center gap-2 text-sm font-bold shadow-soft"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Permutations...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  Scan Lookalikes
                </>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-ink-faint">Popular Targets:</span>
              {BRAND_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => {
                    setTargetInput(p);
                    handleScan(p);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-ink-light font-medium transition-colors cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* DNS Resolution Toggle */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-light font-medium">Verify Live DNS (A & MX):</span>
              <button
                type="button"
                onClick={() => setCheckDns(!checkDns)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  checkDns ? "bg-accent-blue" : "bg-slate-300"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    checkDns ? "left-5.5" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </form>
      </Card>

      {/* Results Display */}
      {data && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-center justify-between text-xs text-ink-light font-medium mb-1">
                <span>Total Analyzed</span>
                <Layers className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-ink">{data.summary.totalGenerated}</div>
              <div className="text-[11px] text-ink-faint mt-1">Algorithmic Permutations</div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-red-50/50 to-white border-red-200/60">
              <div className="flex items-center justify-between text-xs text-red-600 font-semibold mb-1">
                <span>Weaponized MX</span>
                <Mail className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-2xl font-black text-red-600">{data.summary.criticalMxCount}</div>
              <div className="text-[11px] text-red-500/80 mt-1">Active Email Phishing Threat</div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-amber-50/50 to-white border-amber-200/60">
              <div className="flex items-center justify-between text-xs text-amber-700 font-semibold mb-1">
                <span>Active Web Hosts</span>
                <Server className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-700">{data.summary.activeCount}</div>
              <div className="text-[11px] text-amber-600/80 mt-1">Live IP Address Detected</div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50/50 to-white border-purple-200/60">
              <div className="flex items-center justify-between text-xs text-purple-700 font-semibold mb-1">
                <span>Punycode (IDN)</span>
                <Globe className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-purple-700">{data.summary.punycodeCount}</div>
              <div className="text-[11px] text-purple-600/80 mt-1">Homoglyph Deceptions</div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-emerald-50/50 to-white border-emerald-200/60">
              <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold mb-1">
                <span>Defensive Openings</span>
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-700">{data.summary.availableCount}</div>
              <div className="text-[11px] text-emerald-600/80 mt-1">Unregistered / Available</div>
            </Card>
          </div>

          {/* Results Table & Filter Card */}
          <Card className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                <button
                  onClick={() => setFilterTab("all")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    filterTab === "all" ? "bg-white text-primary shadow-sm" : "text-ink-light hover:text-ink"
                  }`}
                >
                  All ({data.lookalikes.length})
                </button>
                <button
                  onClick={() => setFilterTab("weaponized")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    filterTab === "weaponized"
                      ? "bg-red-500 text-white shadow-sm"
                      : "text-red-600 hover:bg-red-50"
                  }`}
                >
                  Weaponized MX ({data.summary.criticalMxCount})
                </button>
                <button
                  onClick={() => setFilterTab("active")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    filterTab === "active" ? "bg-amber-500 text-white shadow-sm" : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  Active Web ({data.summary.activeCount})
                </button>
                <button
                  onClick={() => setFilterTab("punycode")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    filterTab === "punycode" ? "bg-purple-600 text-white shadow-sm" : "text-purple-700 hover:bg-purple-50"
                  }`}
                >
                  Punycode ({data.summary.punycodeCount})
                </button>
                <button
                  onClick={() => setFilterTab("available")}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    filterTab === "available" ? "bg-emerald-600 text-white shadow-sm" : "text-emerald-700 hover:bg-emerald-50"
                  }`}
                >
                  Available ({data.summary.availableCount})
                </button>
              </div>

              {/* Table search & Export */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter results..."
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-ink-light hover:text-ink hover:bg-slate-50 transition-colors"
                  title="Export to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Lookalike Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-faint uppercase border-b border-slate-100">
                    <th className="pb-3 font-semibold">Lookalike Domain</th>
                    <th className="pb-3 font-semibold">Attack Vector / Fuzzer</th>
                    <th className="pb-3 font-semibold">Live Telemetry</th>
                    <th className="pb-3 font-semibold">Threat Level</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLookalikes.map((item, idx) => {
                    const isCopied = copiedDomain === item.domain;
                    const isCritical = item.risk === "CRITICAL";
                    const isHigh = item.risk === "HIGH";
                    const isPunycode = item.isPunycode;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink font-mono text-sm tracking-tight">
                              {item.domain}
                            </span>
                            {isPunycode && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                IDN Punycode
                              </span>
                            )}
                          </div>
                          {isPunycode && (
                            <div className="text-[11px] text-ink-faint font-mono mt-0.5">
                              ASCII: {item.punycode}
                            </div>
                          )}
                          <div className="text-[11px] text-ink-light mt-0.5">{item.verdict}</div>
                        </td>

                        <td className="py-3.5">
                          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-ink">
                            {item.variantType}
                          </span>
                          <div className="text-[11px] text-ink-faint mt-1">
                            {item.similarity}% visual similarity
                          </div>
                        </td>

                        <td className="py-3.5">
                          {item.isLive ? (
                            <div className="space-y-1">
                              {item.hasMx && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                                  <Mail className="w-3 h-3" />
                                  MX Active ({item.mxHosts?.[0] || "Mail Server"})
                                </span>
                              )}
                              {item.ips?.length > 0 && (
                                <div className="text-xs font-mono text-ink-light flex items-center gap-1">
                                  <Server className="w-3 h-3 text-ink-faint" />
                                  IP: {item.ips[0]}
                                  {item.ips.length > 1 && (
                                    <span className="text-[10px] text-ink-faint">+{item.ips.length - 1}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3" />
                              Not Resolved (Available)
                            </span>
                          )}
                        </td>

                        <td className="py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                              isCritical
                                ? "bg-red-50 text-red-600 border border-red-200"
                                : isHigh
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : item.risk === "MEDIUM"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isCritical
                                  ? "bg-red-500 animate-pulse"
                                  : isHigh
                                  ? "bg-amber-500"
                                  : item.risk === "MEDIUM"
                                  ? "bg-purple-500"
                                  : "bg-emerald-500"
                              }`}
                            />
                            {item.risk}
                          </span>
                        </td>

                        <td className="py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleCopy(item.domain)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-ink-faint hover:text-ink transition-colors"
                              title="Copy lookalike domain"
                            >
                              {isCopied ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>

                            <Link
                              to={`/detection/scanner?mode=url&target=${encodeURIComponent(`http://${item.punycode}`)}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary font-bold text-xs transition-colors"
                              title="Scan this domain in DetectIQ Scanner"
                            >
                              Scan
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLookalikes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-ink-faint">
                        No lookalike domains match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
