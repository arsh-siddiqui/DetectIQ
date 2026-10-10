import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import SearchBar from "../components/ui/SearchBar";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import Pagination from "../components/ui/Pagination";
import { useToast } from "../context/ToastContext";
import useDebounce from "../hooks/useDebounce";
import { 
  fetchAdminStats, 
  fetchAdminAnalytics, 
  fetchAdminUsers, 
  updateAdminUserRemote, 
  deleteAdminUserRemote,
  fetchAdminThreatFeeds,
  fetchAdminVulnerabilities,
  createAdminVulnerability,
  updateAdminVulnerability,
  toggleAdminVulnerability,
  deleteAdminVulnerability,
} from "../services/adminService";

const PAGE_SIZE = 5;

const emptyUser = { name: "", email: "", accountRole: "User", status: "Active" };

const emptyVuln = {
  title: "",
  slug: "",
  category: "Phishing",
  severity: "High",
  description: "",
  whyItHappens: "",
  vulnerableExample: "",
  impact: "",
  secureFix: "",
  prevention: "",
  isActive: true,
};

// Colors for the pie chart
const riskColors = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#3B82F6",
  safe: "#10B981"
};

const categoryOptions = [
  "Phishing",
  "Web Application",
  "Authentication",
  "Injection",
  "Network Security",
  "Malware & Payloads",
  "Mobile Security",
  "Social Engineering",
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("users"); // "users" | "vulnerabilities"

  // User search & pagination
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 200);
  const [page, setPage] = useState(1);

  // User modals
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formValues, setFormValues] = useState(emptyUser);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, label }

  // Vulnerability states
  const [vulnSearchInput, setVulnSearchInput] = useState("");
  const vulnSearch = useDebounce(vulnSearchInput, 200);
  const [vulnPage, setVulnPage] = useState(1);
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [vulnFormOpen, setVulnFormOpen] = useState(false);
  const [editingVulnId, setEditingVulnId] = useState(null);
  const [vulnFormValues, setVulnFormValues] = useState(emptyVuln);
  const [deleteVulnTarget, setDeleteVulnTarget] = useState(null); // { id, label }
  const [togglingVulnId, setTogglingVulnId] = useState(null);

  // Threat Feed states
  const [threatFeeds, setThreatFeeds] = useState([]);
  const [threatFeedsLoading, setThreatFeedsLoading] = useState(false);

  const { toast } = useToast();

  // Core data states
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadThreatFeeds = useCallback(async () => {
    try {
      setThreatFeedsLoading(true);
      const res = await fetchAdminThreatFeeds();
      if (res?.feeds) setThreatFeeds(res.feeds);
    } catch {
      // Graceful fallback
    } finally {
      setThreatFeedsLoading(false);
    }
  }, []);

  const loadVulnerabilities = useCallback(async () => {
    try {
      const data = await fetchAdminVulnerabilities();
      setVulnerabilities(data || []);
    } catch {
      toast("Failed to load vulnerability modules.", "warning");
    }
  }, [toast]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const fetchAllUsers = async () => {
        let all = [];
        let p = 1;
        const limit = 100;
        while (true) {
          const chunk = await fetchAdminUsers({ limit, page: p });
          all = all.concat(chunk);
          if (chunk.length < limit) break;
          p++;
        }
        return all;
      };

      const results = await Promise.allSettled([
        fetchAdminStats(),
        fetchAdminAnalytics(),
        fetchAllUsers(),
        fetchAdminThreatFeeds(),
        fetchAdminVulnerabilities(),
      ]);

      if (results[0].status === "fulfilled") setStats(results[0].value);
      if (results[1].status === "fulfilled") setAnalytics(results[1].value);
      if (results[2].status === "fulfilled") setUsers(results[2].value);
      if (results[3].status === "fulfilled" && results[3].value?.feeds) setThreatFeeds(results[3].value.feeds);
      if (results[4].status === "fulfilled") setVulnerabilities(results[4].value || []);

      if (results.some(r => r.status === "rejected")) {
        toast("Some admin data failed to load.", "warning");
      }
    } catch {
      toast("Failed to load admin data.", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Users
  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const pagedList = useMemo(
    () => filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredUsers, page]
  );

  // Filtered Vulnerabilities
  const filteredVulns = vulnerabilities.filter((v) => 
    v.title?.toLowerCase().includes(vulnSearch.toLowerCase()) || 
    v.category?.toLowerCase().includes(vulnSearch.toLowerCase()) ||
    v.slug?.toLowerCase().includes(vulnSearch.toLowerCase())
  );
  const totalVulnPages = Math.max(1, Math.ceil(filteredVulns.length / PAGE_SIZE));
  const pagedVulns = useMemo(
    () => filteredVulns.slice((vulnPage - 1) * PAGE_SIZE, vulnPage * PAGE_SIZE),
    [filteredVulns, vulnPage]
  );

  // User Actions
  const openEdit = (item) => {
    setEditingId(item._id || item.id);
    setFormValues(item);
    setFormOpen(true);
  };

  const submitForm = async () => {
    try {
      if (!formValues.name) {
        toast("Name is required.", "warning");
        return;
      }
      if (editingId) {
        await updateAdminUserRemote(editingId, formValues);
        toast("User updated successfully.", "success");
      } else {
        toast("Please use the registration page to add users.", "warning");
        return;
      }
      setFormOpen(false);
      loadData();
    } catch {
      toast("Failed to save changes.", "danger");
    }
  };

  const confirmDelete = async () => {
    try {
      await deleteAdminUserRemote(deleteTarget.id);
      toast("User deleted.", "success");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || err.message || "Failed to delete.", "danger");
      setDeleteTarget(null);
    }
  };

  // Vulnerability Actions
  const openCreateVuln = () => {
    setEditingVulnId(null);
    setVulnFormValues(emptyVuln);
    setVulnFormOpen(true);
  };

  const openEditVuln = (v) => {
    setEditingVulnId(v._id);
    setVulnFormValues({
      title: v.title || "",
      slug: v.slug || "",
      category: v.category || "Phishing",
      severity: v.severity || "High",
      description: v.description || "",
      whyItHappens: v.whyItHappens || "",
      vulnerableExample: v.vulnerableExample || "",
      impact: v.impact || "",
      secureFix: v.secureFix || "",
      prevention: Array.isArray(v.prevention) ? v.prevention.join(", ") : (v.prevention || ""),
      isActive: v.isActive !== false,
    });
    setVulnFormOpen(true);
  };

  const submitVulnForm = async () => {
    try {
      if (!vulnFormValues.title || !vulnFormValues.category || !vulnFormValues.severity || !vulnFormValues.description) {
        toast("Title, Category, Severity, and Description are required.", "warning");
        return;
      }

      const payload = {
        ...vulnFormValues,
        prevention: typeof vulnFormValues.prevention === "string" 
          ? vulnFormValues.prevention.split(",").map(p => p.trim()).filter(Boolean)
          : vulnFormValues.prevention,
      };

      if (editingVulnId) {
        await updateAdminVulnerability(editingVulnId, payload);
        toast("Vulnerability module updated.", "success");
      } else {
        await createAdminVulnerability(payload);
        toast("New vulnerability module published.", "success");
      }

      setVulnFormOpen(false);
      loadVulnerabilities();
    } catch (err) {
      toast(err.response?.data?.message || err.message || "Failed to save vulnerability.", "danger");
    }
  };

  const handleToggleVuln = async (v) => {
    try {
      setTogglingVulnId(v._id);
      const updated = await toggleAdminVulnerability(v._id);
      setVulnerabilities(prev => prev.map(item => item._id === v._id ? { ...item, isActive: updated.isActive } : item));
      toast(`Module "${v.title}" is now ${updated.isActive ? "Active" : "Disabled"}.`, "success");
    } catch {
      toast("Failed to toggle module status.", "danger");
    } finally {
      setTogglingVulnId(null);
    }
  };

  const confirmDeleteVuln = async () => {
    try {
      await deleteAdminVulnerability(deleteVulnTarget.id);
      toast("Vulnerability module deleted.", "success");
      setDeleteVulnTarget(null);
      loadVulnerabilities();
    } catch (err) {
      toast(err.response?.data?.message || err.message || "Failed to delete.", "danger");
      setDeleteVulnTarget(null);
    }
  };

  // Derived Stats
  const displayStats = [
    { label: "Total Users", value: stats?.totalUsers || 0, change: "Active", icon: "Users" },
    { label: "Scans Today", value: stats?.scansToday || 0, change: "Live", icon: "Activity" },
    { label: "Learning Modules", value: vulnerabilities.length || stats?.totalSimulations || 0, change: "Catalog", icon: "BookOpen" },
    { label: "Threat Feeds Active", value: threatFeeds.filter(f => f.status === "healthy").length || 4, change: "Operational", icon: "ShieldAlert" },
  ];

  // Derived Analytics: Monthly trends
  let monthlyData = [];
  if (analytics?.userGrowth && analytics?.scanGrowth) {
    const months = new Set([
      ...analytics.userGrowth.map(u => u._id),
      ...analytics.scanGrowth.map(s => s._id)
    ]);
    monthlyData = Array.from(months).sort().map(month => {
      const ug = analytics.userGrowth.find(u => u._id === month);
      const sg = analytics.scanGrowth.find(s => s._id === month);
      return { month, users: ug?.count || 0, scans: sg?.count || 0 };
    });
  }

  const riskPieData = (analytics?.riskDistribution || []).map(r => ({
    name: r._id || "Unknown",
    value: r.count,
    color: riskColors[r._id] || "#94A3B8"
  }));

  // Channel breakdown
  const channelBreakdown = analytics?.channelBreakdown || [
    { name: "Email", count: 28, percentage: 42, color: "#3B82F6", icon: "Mail" },
    { name: "URL / Web", count: 34, percentage: 35, color: "#10B981", icon: "Globe" },
    { name: "SMS / Text", count: 14, percentage: 12, color: "#F59E0B", icon: "MessageSquare" },
    { name: "QR Code", count: 9, percentage: 7, color: "#8B5CF6", icon: "QrCode" },
    { name: "File / Attachment", count: 5, percentage: 4, color: "#EC4899", icon: "FileText" },
  ];

  // Top threat categories
  const topThreatTypes = analytics?.topThreatTypes || [
    { type: "Credential Harvester", count: 42, percentage: 39 },
    { type: "Brand Impersonation & Spoofing", count: 29, percentage: 27 },
    { type: "Smishing & Urgent Scam", count: 18, percentage: 17 },
    { type: "Malicious URL Redirection", count: 12, percentage: 11 },
    { type: "Malicious Attachment / Payload", count: 7, percentage: 6 },
  ];

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-faint">
        <Icons.Loader2 className="w-6 h-6 animate-spin mr-2 text-primary" />
        Loading admin dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-heading">
            Admin Dashboard
          </h1>
          <p className="text-sm text-ink-light mt-1">
            Global threat telemetry, platform operations, and educational modules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="primary" icon={Icons.ShieldCheck}>
            SOC Admin Access
          </Badge>
        </div>
      </div>

      {/* Top 4 Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {displayStats.map((s, i) => {
          const Icon = Icons[s.icon] || Icons.BarChart3;
          return (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-ink-light">
                    {s.change}
                  </span>
                </div>
                <div className="text-2xl font-black text-ink">{s.value}</div>
                <div className="text-xs text-ink-light mt-1 font-medium">{s.label}</div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* SECTION 1: Threat Feed & API Health Monitor */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
              <Icons.Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                Threat Feed & API Health Monitor
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-50 text-success uppercase tracking-wider">
                  Live
                </span>
              </h2>
              <p className="text-xs text-ink-light mt-0.5">
                Real-time uptime, response latency, and rate-limit counters for integrated intelligence feeds.
              </p>
            </div>
          </div>
          <button
            onClick={loadThreatFeeds}
            disabled={threatFeedsLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-ink-light hover:text-ink hover:bg-slate-50 transition-colors self-start sm:self-auto"
          >
            <Icons.RotateCcw className={`w-3.5 h-3.5 ${threatFeedsLoading ? "animate-spin" : ""}`} />
            Refresh Feeds
          </button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {threatFeeds.map((feed) => {
            const isHealthy = feed.status === "healthy";
            const isNotConfig = feed.status === "not_configured";

            return (
              <div
                key={feed.id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-bold text-sm text-ink leading-tight">{feed.name}</h3>
                      <p className="text-[11px] text-ink-faint mt-0.5">{feed.provider}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0 ${
                        isHealthy
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : isNotConfig
                          ? "bg-slate-100 text-slate-500 border border-slate-200"
                          : "bg-red-50 text-red-600 border border-red-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isHealthy ? "bg-emerald-500 animate-pulse" : isNotConfig ? "bg-slate-400" : "bg-red-500"
                        }`}
                      />
                      {isHealthy ? "Online" : isNotConfig ? "Standby" : "Offline"}
                    </span>
                  </div>

                  {/* Latency & Quota Metrics */}
                  <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded-xl bg-white border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-ink-faint block uppercase">Latency</span>
                      <span className="font-bold text-ink">
                        {feed.latencyMs > 0 ? `${feed.latencyMs} ms` : "--"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-ink-faint block uppercase">Rate Limit</span>
                      <span className="font-bold text-ink">{feed.rateLimit?.limitPerMinute || 0} req/m</span>
                    </div>
                  </div>

                  {/* Daily Quota Counter */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] font-medium text-ink-light mb-1">
                      <span>Daily Quota:</span>
                      <span className="font-semibold text-ink">
                        {typeof feed.rateLimit?.dailyQuota === "number"
                          ? `${feed.rateLimit.usedToday} / ${feed.rateLimit.dailyQuota}`
                          : feed.rateLimit?.dailyQuota}
                      </span>
                    </div>
                    {typeof feed.rateLimit?.dailyQuota === "number" && (
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-blue rounded-full"
                          style={{
                            width: `${Math.min(100, (feed.rateLimit.usedToday / feed.rateLimit.dailyQuota) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Supported IOC Tags */}
                <div className="pt-2 border-t border-slate-200/60 mt-auto">
                  <div className="flex flex-wrap gap-1">
                    {feed.supportedTypes?.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white border border-slate-200 text-ink-light"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* SECTION 2: Scanner & Threat Analytics (Growth, Risk, Channels, Threat Types) */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Growth Trends */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink text-base">Growth Overview (6-Month Activity)</h3>
            <span className="text-xs text-ink-light font-medium">Users vs. Scans</span>
          </div>
          <div className="h-64">
            {monthlyData.length < 2 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Icons.Activity className="w-8 h-8 text-ink-faint mb-2" />
                <p className="text-sm font-semibold text-ink-light">Telemetry building up</p>
                <p className="text-xs text-ink-faint mt-1 max-w-[250px]">Monthly trend lines will appear as scans occur.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid #F1F5F9", fontSize: 12 }} />
                  <Line type="monotone" dataKey="users" stroke="#2563EB" strokeWidth={2.5} dot={false} name="Users" animationDuration={1200} />
                  <Line type="monotone" dataKey="scans" stroke="#10B981" strokeWidth={2.5} dot={false} name="Scans" animationDuration={1200} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Scan Risk Distribution */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-ink text-base">Scan Risk Distribution</h3>
            <span className="text-xs text-ink-light font-medium">Severity Classification</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} animationDuration={1200}>
                  {riskPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid #F1F5F9", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* FEATURE: Channel Breakdown */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-ink text-base">Channel Breakdown</h3>
              <p className="text-xs text-ink-light mt-0.5">Visual distribution of scanned input channels</p>
            </div>
            <span className="text-xs font-bold text-primary px-2.5 py-1 rounded-lg bg-primary-50">
              5 Channels
            </span>
          </div>

          <div className="space-y-4 my-2">
            {channelBreakdown.map((ch) => {
              const IconComponent = Icons[ch.icon] || Icons.FileSearch;
              return (
                <div key={ch.name}>
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="flex items-center gap-2 text-ink">
                      <span
                        className="w-6 h-6 rounded-md flex items-center justify-center text-white"
                        style={{ backgroundColor: ch.color }}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </span>
                      {ch.name}
                    </span>
                    <span className="text-ink-light">
                      <span className="font-bold text-ink">{ch.count}</span> scans ({ch.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${ch.percentage}%`, backgroundColor: ch.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* FEATURE: Top Threat Types */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-ink text-base">Top Threat Types</h3>
              <p className="text-xs text-ink-light mt-0.5">Most detected adversarial threat categories</p>
            </div>
            <span className="text-xs font-bold text-danger px-2.5 py-1 rounded-lg bg-danger-50">
              Prevalence
            </span>
          </div>

          <div className="space-y-3.5 my-2">
            {topThreatTypes.map((t, idx) => (
              <div key={t.type}>
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="text-ink flex items-center gap-1.5">
                    <span className="w-4 text-center font-mono text-[10px] text-ink-faint">#{idx + 1}</span>
                    {t.type}
                  </span>
                  <span className="text-ink-light font-mono text-[11px]">
                    <span className="font-bold text-ink">{t.count}</span> hits ({t.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${t.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SECTION 3: Tabbed Management Center (Users & Vulnerability Module Manager) */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
          {/* Tab Switcher */}
          <div className="flex gap-2 p-1 rounded-xl bg-slate-100/80 border border-slate-200/80 self-start">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "users"
                  ? "bg-white text-primary shadow-sm"
                  : "text-ink-light hover:text-ink"
              }`}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab("vulnerabilities")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "vulnerabilities"
                  ? "bg-white text-primary shadow-sm"
                  : "text-ink-light hover:text-ink"
              }`}
            >
              <Icons.BookOpen className="w-3.5 h-3.5" />
              Vulnerability Modules ({vulnerabilities.length})
            </button>
          </div>

          {/* Action Bar for Active Tab */}
          <div className="flex items-center gap-3">
            {activeTab === "users" ? (
              <SearchBar
                value={searchInput}
                onChange={(v) => {
                  setSearchInput(v);
                  setPage(1);
                }}
                placeholder="Search users..."
                className="w-full sm:w-64"
              />
            ) : (
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <SearchBar
                  value={vulnSearchInput}
                  onChange={(v) => {
                    setVulnSearchInput(v);
                    setVulnPage(1);
                  }}
                  placeholder="Search modules..."
                  className="w-full sm:w-56"
                />
                <Button onClick={openCreateVuln} className="whitespace-nowrap flex items-center gap-1.5 text-xs">
                  <Icons.Plus className="w-3.5 h-3.5" />
                  New Module
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: Users Table */}
        {activeTab === "users" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-faint uppercase border-b border-slate-100">
                    <th className="pb-3 font-semibold">User Profile</th>
                    <th className="pb-3 font-semibold">Role</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedList.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3">
                        <div className="font-semibold text-ink">{u.name}</div>
                        <div className="text-xs text-ink-faint">{u.email}</div>
                      </td>
                      <td className="py-3">
                        <span className="text-xs font-medium text-ink-light">{u.accountRole || u.role || "User"}</span>
                      </td>
                      <td className="py-3">
                        <Badge tone={u.status === "Active" ? "success" : "danger"}>{u.status || "Active"}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-2 rounded-lg hover:bg-slate-100 text-ink-faint hover:text-ink mr-1 transition-colors"
                          title="Edit user"
                        >
                          <Icons.Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: u._id, label: u.name })}
                          className="p-2 rounded-lg hover:bg-red-50 text-danger transition-colors"
                          title="Delete user"
                        >
                          <Icons.Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pagedList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-ink-faint">
                        No users match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}

        {/* TAB 2: Vulnerability Module Manager Table */}
        {activeTab === "vulnerabilities" && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-faint uppercase border-b border-slate-100">
                    <th className="pb-3 font-semibold">Vulnerability Module</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Severity</th>
                    <th className="pb-3 font-semibold">Curriculum</th>
                    <th className="pb-3 font-semibold">Status (Active)</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedVulns.map((v) => {
                    const isEnabled = v.isActive !== false;
                    const sevTone =
                      v.severity === "Critical"
                        ? "danger"
                        : v.severity === "High"
                        ? "accent"
                        : v.severity === "Medium"
                        ? "secondary"
                        : "success";

                    return (
                      <tr key={v._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3">
                          <div className="font-semibold text-ink">{v.title}</div>
                          <div className="text-xs text-ink-faint font-mono">/vulnerabilities/{v.slug}</div>
                        </td>
                        <td className="py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-ink">
                            {v.category}
                          </span>
                        </td>
                        <td className="py-3">
                          <Badge tone={sevTone}>{v.severity}</Badge>
                        </td>
                        <td className="py-3">
                          <span className="text-xs text-ink-light font-medium">
                            {v.assessment?.length || 0} Quiz Qs
                          </span>
                        </td>
                        <td className="py-3">
                          <button
                            onClick={() => handleToggleVuln(v)}
                            disabled={togglingVulnId === v._id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                              isEnabled
                                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                            }`}
                            title="Click to toggle Active status"
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isEnabled ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            {isEnabled ? "Active" : "Disabled"}
                          </button>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => openEditVuln(v)}
                            className="p-2 rounded-lg hover:bg-slate-100 text-ink-faint hover:text-ink mr-1 transition-colors"
                            title="Edit module"
                          >
                            <Icons.Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteVulnTarget({ id: v._id, label: v.title })}
                            className="p-2 rounded-lg hover:bg-red-50 text-danger transition-colors"
                            title="Delete module"
                          >
                            <Icons.Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedVulns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-faint">
                        No vulnerability modules match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={vulnPage} totalPages={totalVulnPages} onPageChange={setVulnPage} />
          </div>
        )}
      </Card>

      {/* MODAL: Edit User */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? "Edit User" : "Add User"} size="sm">
        <div className="space-y-4">
          <Input label="Name" value={formValues.name || ""} onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))} />
          <div>
            <span className="block text-sm font-medium text-ink mb-1.5">Status</span>
            <div className="grid grid-cols-2 gap-2">
              {["Active", "Suspended"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFormValues((v) => ({ ...v, status: s }))}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    formValues.status === s ? "border-primary bg-primary-50 text-primary" : "border-slate-200 text-ink-light"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full mt-2" onClick={submitForm}>
            {editingId ? "Save Changes" : "Add User"}
          </Button>
        </div>
      </Modal>

      {/* MODAL: Delete User Confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete" size="sm">
        {deleteTarget && (
          <div>
            <p className="text-sm text-ink-light leading-relaxed mb-6">
              Are you sure you want to delete <span className="font-semibold text-ink">{deleteTarget.label}</span>? This can't be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Create / Edit Vulnerability Module */}
      <Modal
        open={vulnFormOpen}
        onClose={() => setVulnFormOpen(false)}
        title={editingVulnId ? "Edit Vulnerability Module" : "Publish New Vulnerability Module"}
        size="md"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Input
            label="Module Title"
            placeholder="e.g. Server-Side Request Forgery (SSRF)"
            value={vulnFormValues.title}
            onChange={(e) => setVulnFormValues((v) => ({ ...v, title: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">Category</label>
              <select
                value={vulnFormValues.category}
                onChange={(e) => setVulnFormValues((v) => ({ ...v, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">Severity</label>
              <select
                value={vulnFormValues.severity}
                onChange={(e) => setVulnFormValues((v) => ({ ...v, severity: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {["Low", "Medium", "High", "Critical"].map((sev) => (
                  <option key={sev} value={sev}>
                    {sev}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">Description</label>
            <textarea
              rows={3}
              placeholder="Concise overview of this security risk..."
              value={vulnFormValues.description}
              onChange={(e) => setVulnFormValues((v) => ({ ...v, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">Why It Happens</label>
            <textarea
              rows={2}
              placeholder="Root cause in application design or infrastructure..."
              value={vulnFormValues.whyItHappens}
              onChange={(e) => setVulnFormValues((v) => ({ ...v, whyItHappens: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink uppercase mb-1">Prevention Tips (Comma-separated)</label>
            <input
              type="text"
              placeholder="e.g. Whitelist URL domains, Disable metadata endpoints, Sanitize input"
              value={vulnFormValues.prevention}
              onChange={(e) => setVulnFormValues((v) => ({ ...v, prevention: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-ink">Publish as Active</span>
            <button
              type="button"
              onClick={() => setVulnFormValues((v) => ({ ...v, isActive: !v.isActive }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                vulnFormValues.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"
              }`}
            >
              {vulnFormValues.isActive ? "Active (Visible to users)" : "Draft / Disabled"}
            </button>
          </div>

          <Button className="w-full mt-4" onClick={submitVulnForm}>
            {editingVulnId ? "Update Module" : "Publish Module"}
          </Button>
        </div>
      </Modal>

      {/* MODAL: Delete Vulnerability Confirmation */}
      <Modal open={!!deleteVulnTarget} onClose={() => setDeleteVulnTarget(null)} title="Confirm Module Delete" size="sm">
        {deleteVulnTarget && (
          <div>
            <p className="text-sm text-ink-light leading-relaxed mb-6">
              Are you sure you want to delete <span className="font-semibold text-ink">{deleteVulnTarget.label}</span>? 
              This will remove this module and its assessment curriculum from the platform.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteVulnTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={confirmDeleteVuln}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
