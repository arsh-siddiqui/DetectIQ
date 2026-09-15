import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, BookOpen, Target, Activity, ShieldCheck, Shield, AlertTriangle, CheckCircle, TrendingUp, ChevronRight, BarChart3, Mail, Lightbulb, GraduationCap, ArrowRight, ScanLine, Link as LinkIcon, MessageSquare, QrCode, ImageIcon, Loader2, Zap, Brain } from "lucide-react";
import { useAppData } from "../context/AppDataContext";
import { getScanHistory } from "../services/detectionService";
import { getAllProgress } from "../services/progressService";
import { getVulnerabilities } from "../services/vulnerabilityService";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user } = useAppData();
  const [loading, setLoading] = useState(true);
  const [scanHistory, setScanHistory] = useState([]);
  const [learningProgress, setLearningProgress] = useState([]);
  const [totalModules, setTotalModules] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        const [scans, progress, vulns] = await Promise.all([
          getScanHistory().catch(() => []),
          getAllProgress().catch(() => []),
          getVulnerabilities().catch(() => [])
        ]);
        setScanHistory(scans || []);
        setLearningProgress(progress || []);
        setTotalModules(vulns?.length || 0);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalScans = scanHistory.length;
  const phishingScans = scanHistory.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical').length;
  const safeScans = scanHistory.filter(s => s.riskLevel === 'safe' || s.riskLevel === 'low').length;
  const suspiciousScans = scanHistory.filter(s => s.riskLevel === 'medium').length;
  const completedLearning = learningProgress.filter(p => p.status === 'completed').length;
  const recommendedFocus = user?.learningProfile?.recommendedFocus || "Security Fundamentals";

  const securityScore = useMemo(() => {
    if (!totalScans) return null;
    const safeRatio = safeScans / totalScans;
    return Math.round(50 + safeRatio * 50);
  }, [safeScans, totalScans]);

  const chartData = useMemo(() => {
    const dataMap = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dataMap[key] = { name: key, safe: 0, threat: 0 };
    }
    scanHistory.forEach(scan => {
      const key = new Date(scan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dataMap[key]) {
        if (scan.riskLevel === 'safe' || scan.riskLevel === 'low') dataMap[key].safe++;
        else dataMap[key].threat++;
      }
    });
    return Object.values(dataMap);
  }, [scanHistory]);

  const scoreColor = securityScore >= 80 ? 'text-success' : securityScore >= 50 ? 'text-warning' : 'text-danger';
  const scoreLabel = securityScore >= 80 ? 'Strong' : securityScore >= 50 ? 'Improving' : 'At Risk';
  const scoreBg = securityScore >= 80 ? 'bg-success' : securityScore >= 50 ? 'bg-warning' : 'bg-danger';

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
      className="p-6 max-w-[1400px] mx-auto space-y-5"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            Welcome back, {user?.name?.split(' ')[0]} ðŸ‘‹
          </h1>
          <p className="text-sm text-muted mt-0.5">Your security overview for today</p>
        </div>
        <Link
          to="/detection/scanner"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <ScanLine className="w-4 h-4" /> New Scan
        </Link>
      </div>

      {/* TOP ROW: Security Overview + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Security Overview â€” 2/3 width */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-bold text-primary">Security Posture</h2>
            <Link to="/learning/progress" className="text-xs font-semibold text-accent-blue hover:underline">View Profile</Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">

            {/* Score Gauge â€” compact */}
            <div className="flex flex-col items-center justify-center p-4 bg-background rounded-xl border border-border">
              {securityScore !== null ? (
                <>
                  {/* Mini arc gauge */}
                  <div className="relative w-28 h-14 flex items-end justify-center overflow-hidden mb-2">
                    <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 50" style={{ overflow: 'visible' }}>
                      {/* Track */}
                      <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="var(--bg-secondary)" strokeWidth="10" strokeLinecap="round"/>
                      {/* Score arc */}
                      <path
                        d="M5 50 A45 45 0 0 1 95 50"
                        fill="none"
                        stroke={securityScore >= 80 ? '#10B981' : securityScore >= 50 ? '#F59E0B' : '#EF4444'}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray="141"
                        strokeDashoffset={141 - (141 * securityScore / 100)}
                      />
                    </svg>
                    <span className="relative z-10 text-2xl font-bold text-primary mb-0.5">{securityScore}</span>
                  </div>
                  <span className={`text-xs font-bold ${scoreColor}`}>{scoreLabel} Posture</span>
                </>
              ) : (
                <div className="text-center py-2">
                  <Shield className="w-8 h-8 text-muted mx-auto mb-2" />
                  <p className="text-xs font-semibold text-secondary">Profile Building</p>
                  <p className="text-[11px] text-muted mt-0.5">Scan content to begin</p>
                </div>
              )}
            </div>

            {/* Status Indicators */}
            <div className="sm:col-span-2 grid grid-cols-1 gap-2.5">
              <StatusRow
                icon={phishingScans === 0 ? CheckCircle : ShieldAlert}
                color={phishingScans === 0 ? "text-success" : "text-danger"}
                bg={phishingScans === 0 ? "bg-success/10" : "bg-danger/10"}
                title={phishingScans === 0 ? "No Active Threats" : `${phishingScans} Threat${phishingScans > 1 ? 's' : ''} Detected`}
                desc={phishingScans === 0 ? "All recent scans are safe" : "Review your scan history"}
              />
              <StatusRow
                icon={Brain}
                color="text-accent-blue"
                bg="bg-accent-blue/10"
                title="Personalized ML"
                desc="Pattern matching active"
              />
              <StatusRow
                icon={GraduationCap}
                color="text-accent-violet"
                bg="bg-accent-violet/10"
                title={`${completedLearning} Lesson${completedLearning !== 1 ? 's' : ''} Completed`}
                desc={`Focus: ${recommendedFocus}`}
              />
            </div>
          </div>
        </div>

        {/* Quick Actions â€” 1/3 width */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Quick Actions</h2>
          <div className="space-y-1.5">
            {[
              { label: "Scan Email", icon: Mail, to: "/detection/email" },
              { label: "Analyze URL", icon: LinkIcon, to: "/detection/url" },
              { label: "Check Message", icon: MessageSquare, to: "/detection/message" },
              { label: "Inspect QR Code", icon: QrCode, to: "/detection/qr" },
              { label: "Analyze Screenshot", icon: ImageIcon, to: "/detection/screenshot" },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-background border border-transparent hover:border-border transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-accent-blue/10 flex items-center justify-center group-hover:bg-accent-blue group-hover:text-white transition-colors">
                    <a.icon className="w-3.5 h-3.5 text-accent-blue group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-primary">{a.label}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Activity} label="Total Scans" value={totalScans} sub="All time" iconColor="text-primary" iconBg="bg-primary/8" />
        <StatCard icon={ShieldAlert} label="Threats" value={phishingScans} sub="High risk" iconColor="text-danger" iconBg="bg-danger/10" />
        <StatCard icon={CheckCircle} label="Safe Items" value={safeScans} sub="Low risk" iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={GraduationCap} label="Lessons Done" value={completedLearning} sub="Modules" iconColor="text-accent-blue" iconBg="bg-accent-blue/10" />
      </div>

      {/* MIDDLE ROW: Chart + Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Scan Activity Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-primary">Scan Activity</h2>
            <div className="flex items-center gap-3 text-xs text-muted font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success inline-block" />Safe</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-danger inline-block" />Threat</span>
            </div>
          </div>
          <div className="h-48">
            {totalScans > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSafe" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gThreat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-border)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-border)', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    labelStyle={{ color: 'var(--text-muted)', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="safe" name="Safe" stroke="#10B981" strokeWidth={1.5} fillOpacity={1} fill="url(#gSafe)" />
                  <Area type="monotone" dataKey="threat" name="Threat" stroke="#EF4444" strokeWidth={1.5} fillOpacity={1} fill="url(#gThreat)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted">
                <BarChart3 className="w-7 h-7 mb-2 opacity-40" />
                <span className="text-sm">No scan activity yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Personalized Insight */}
        <div className="bg-card rounded-xl border border-border p-5 flex flex-col">
          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center mb-3">
            <Lightbulb className="w-4 h-4 text-accent-blue" />
          </div>
          <h2 className="text-sm font-semibold text-primary mb-1.5">Personalized Detection</h2>
          <p className="text-xs text-secondary leading-relaxed mb-4 flex-1">
            Our ML model learns your legitimate email patterns to dramatically reduce false positives in future scans.
          </p>
          <div className="bg-background rounded-lg border border-border px-3 py-2.5 flex items-center gap-3 mb-4">
            <span className="text-xl font-bold text-primary">3</span>
            <span className="text-xs text-secondary font-medium">Active Patterns</span>
          </div>
          <Link
            to="/detection/email-context"
            className="flex items-center justify-center gap-2 w-full py-2 bg-background border border-border text-primary hover:bg-secondary rounded-lg text-xs font-semibold transition-colors"
          >
            Manage Patterns
          </Link>
        </div>
      </div>

      {/* BOTTOM ROW: Recent Scans + Learning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent Scans */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">Recent Scans</h2>
            <Link to="/detection/history" className="text-xs font-semibold text-accent-blue hover:underline">View All</Link>
          </div>
          {scanHistory.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Shield className="w-7 h-7 text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">No scans yet. Start by analyzing content.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {scanHistory.slice(0, 5).map(scan => (
                <Link
                  to={`/detection/result/${scan._id}`}
                  key={scan._id}
                  className="flex items-center justify-between px-5 py-3 hover:bg-background transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      scan.riskLevel === 'high' || scan.riskLevel === 'critical' ? 'bg-danger' :
                      scan.riskLevel === 'medium' ? 'bg-warning' : 'bg-success'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate max-w-[200px]">{scan.target}</p>
                      <p className="text-[11px] text-muted capitalize">{scan.scanType} Â· {new Date(scan.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Vulnerability Learning */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">Vulnerability Learning</h2>
            <Link to="/learning/progress" className="text-xs font-semibold text-accent-blue hover:underline">View Progress</Link>
          </div>
          <div className="p-5">
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">Recommended Focus</p>
              <div className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-accent-blue/10 border border-accent-blue/20 rounded-lg text-xs font-semibold text-accent-blue">
                <Target className="w-3.5 h-3.5" /> {recommendedFocus}
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-semibold text-secondary">Course Progress</span>
                <span className="font-bold text-primary">{completedLearning} <span className="text-muted font-medium">/ {totalModules > 0 ? totalModules : '-'} modules</span></span>
              </div>
              <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-accent-violet rounded-full transition-all duration-1000"
                  style={{ width: `${totalModules > 0 ? (completedLearning / totalModules) * 100 : 0}%` }}
                />
              </div>
            </div>

            <Link
              to="/vulnerabilities"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent-blue hover:bg-accent-blue/90 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <BookOpen className="w-4 h-4" /> Continue Learning
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, sub, iconColor, iconBg }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted font-medium">{label}</p>
        <p className="text-2xl font-bold text-primary leading-tight">{value}</p>
        <p className="text-[11px] text-muted">{sub}</p>
      </div>
    </div>
  );
}

function StatusRow({ icon: Icon, color, bg, title, desc }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-card rounded-lg border border-border">
      <div className={`w-7 h-7 rounded-lg ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-primary leading-tight">{title}</p>
        <p className="text-[11px] text-muted">{desc}</p>
      </div>
    </div>
  );
}

