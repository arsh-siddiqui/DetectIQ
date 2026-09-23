import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, BookOpen, Target, Activity, Shield, CheckCircle, BarChart3, Mail, Lightbulb, GraduationCap, ArrowRight, ScanLine, Loader2, Brain, ChevronRight, Globe, Image as ImageLucide } from "lucide-react";
import { useAppData } from "../context/AppDataContext";
import { getScanHistory } from "../services/detectionService";
import { fetchDashboard } from "../services/userService";
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
  const [dashboardStats, setDashboardStats] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [scans, progress, vulns, dashboard] = await Promise.all([
          getScanHistory({ all: true }).catch(() => []),
          getAllProgress().catch(() => []),
          getVulnerabilities().catch(() => []),
          fetchDashboard().catch(() => null)
        ]);
        setScanHistory(scans || []);
        setLearningProgress(progress || []);
        setTotalModules(vulns?.length || 0);
        if (dashboard?.stats) {
          setDashboardStats(dashboard.stats);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalScans = dashboardStats?.totalScans ?? scanHistory.length;
  const phishingScans = dashboardStats?.highRiskScans ?? scanHistory.filter(s => s.riskLevel === 'high' || s.riskLevel === 'critical').length;
  const safeScans = dashboardStats?.safeScans ?? scanHistory.filter(s => s.riskLevel === 'safe' || s.riskLevel === 'low').length;
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8"
    >
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-primary tracking-tight">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm font-medium text-secondary mt-1">Here is your security overview for today.</p>
        </div>
        <Link
          to="/detection/scanner"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-blue to-accent-violet hover:opacity-95 text-white rounded-xl text-sm font-bold transition-all shadow-soft"
        >
          <ScanLine className="w-4 h-4" /> New Scan
        </Link>
      </div>

      {/* TOP ROW: Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Link 
          to="/detection/scanner?mode=email"
          className="group bg-card hover:bg-secondary/50 border border-border rounded-2xl p-6 transition-all shadow-sm flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-1 hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 text-accent-blue flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
            <Mail className="w-6 h-6" />
          </div>
          <span className="font-bold text-primary text-sm group-hover:text-accent-blue transition-colors">Email</span>
        </Link>

        <Link 
          to="/detection/scanner?mode=url"
          className="group bg-card hover:bg-secondary/50 border border-border rounded-2xl p-6 transition-all shadow-sm flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-1 hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-violet/10 text-accent-violet flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
            <Globe className="w-6 h-6" />
          </div>
          <span className="font-bold text-primary text-sm group-hover:text-accent-violet transition-colors">URL</span>
        </Link>

        <Link 
          to="/detection/scanner?mode=message"
          className="group bg-card hover:bg-secondary/50 border border-border rounded-2xl p-6 transition-all shadow-sm flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-1 hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 text-accent-cyan flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
            <MessageSquare className="w-6 h-6" />
          </div>
          <span className="font-bold text-primary text-sm group-hover:text-accent-cyan transition-colors">Message</span>
        </Link>
        
        <Link 
          to="/detection/scanner?mode=qr"
          className="group bg-card hover:bg-secondary/50 border border-border rounded-2xl p-6 transition-all shadow-sm flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-1 hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-2xl bg-warning/10 text-warning flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
            <QrCode className="w-6 h-6" />
          </div>
          <span className="font-bold text-primary text-sm group-hover:text-warning transition-colors">QR Code</span>
        </Link>
        
        <Link 
          to="/detection/scanner?mode=screenshot"
          className="group bg-card hover:bg-secondary/50 border border-border rounded-2xl p-6 transition-all shadow-sm flex flex-col items-center justify-center text-center gap-4 hover:-translate-y-1 hover:shadow-card"
        >
          <div className="w-12 h-12 rounded-2xl bg-success/10 text-success flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
            <ImageLucide className="w-6 h-6" />
          </div>
          <span className="font-bold text-primary text-sm group-hover:text-success transition-colors">Screenshot</span>
        </Link>
      </div>

      {/* TOP ROW: Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard icon={Activity} label="Total Scans" value={totalScans} sub="All time activity" iconColor="text-primary" iconBg="bg-primary/5" />
        <StatCard icon={ShieldAlert} label="Threats Found" value={phishingScans} sub="High risk items" iconColor="text-danger" iconBg="bg-danger/10" />
        <StatCard icon={CheckCircle} label="Safe Items" value={safeScans} sub="Verified clean" iconColor="text-success" iconBg="bg-success/10" />
        <StatCard icon={GraduationCap} label="Lessons Done" value={completedLearning} sub="Training modules" iconColor="text-accent-blue" iconBg="bg-accent-blue/10" />
      </div>

      {/* MIDDLE ROW: Security Overview + Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Security Overview */}
        <div className="xl:col-span-1 bg-card rounded-3xl p-6 sm:p-8 shadow-sm border border-border relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent-blue/5 rounded-full blur-[80px] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h2 className="text-lg font-heading font-extrabold text-primary">Security Posture</h2>
            <Link to="/learning/progress" className="text-xs font-bold text-accent-blue hover:underline">View Details</Link>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative z-10 mb-8">
            {securityScore !== null ? (
              <div className="relative w-48 h-24 flex items-end justify-center overflow-hidden mb-4">
                <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 50" style={{ overflow: 'visible' }}>
                  <path d="M5 50 A45 45 0 0 1 95 50" fill="none" stroke="var(--bg-secondary)" strokeWidth="8" strokeLinecap="round"/>
                  <path
                    d="M5 50 A45 45 0 0 1 95 50"
                    fill="none"
                    stroke={securityScore >= 80 ? 'var(--success)' : securityScore >= 50 ? 'var(--warning)' : 'var(--danger)'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="141"
                    strokeDashoffset={141 - (141 * securityScore / 100)}
                    className="drop-shadow-sm transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="relative z-10 flex flex-col items-center">
                  <span className="text-4xl font-heading font-black text-primary tracking-tight leading-none">{securityScore}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Shield className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm font-bold text-secondary">Profile Building</p>
                <p className="text-xs text-muted mt-1">Scan more items to calculate score</p>
              </div>
            )}
            
            {securityScore !== null && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                securityScore >= 80 ? 'bg-success/10 text-success' : 
                securityScore >= 50 ? 'bg-warning/10 text-warning' : 
                'bg-danger/10 text-danger'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {scoreLabel} Status
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 relative z-10">
            <StatusRow
              icon={phishingScans === 0 ? CheckCircle : ShieldAlert}
              color={phishingScans === 0 ? "text-success" : "text-danger"}
              bg={phishingScans === 0 ? "bg-success/10" : "bg-danger/10"}
              title={phishingScans === 0 ? "Zero Active Threats" : `${phishingScans} Threats Detected`}
              desc={phishingScans === 0 ? "System is secure" : "Action required"}
            />
          </div>
        </div>

        {/* Scan Activity Chart & Quick Actions */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {/* Chart */}
          <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border border-border flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-heading font-extrabold text-primary">Activity Timeline</h2>
              <div className="flex items-center gap-4 text-xs font-bold text-secondary">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-success" />Safe</span>
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-danger" />Threat</span>
              </div>
            </div>
            <div className="h-64 w-full">
              {totalScans > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSafe" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gThreat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-border)" opacity={0.5} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} dy={12} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 500 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-border)', borderRadius: '12px', fontSize: '13px', fontWeight: 600, boxShadow: 'var(--shadow-elevated)' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="safe" name="Safe" stroke="var(--success)" strokeWidth={3} fillOpacity={1} fill="url(#gSafe)" />
                    <Area type="monotone" dataKey="threat" name="Threat" stroke="var(--danger)" strokeWidth={3} fillOpacity={1} fill="url(#gThreat)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted">
                  <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
                  <span className="text-sm font-medium">No scan activity yet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: History & Learning */}
      <div className="grid grid-cols-1 gap-6">

        {/* Recent Scans */}
        <div className="bg-card rounded-3xl p-6 sm:p-8 shadow-sm border border-border flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-heading font-extrabold text-primary">Recent Scans</h2>
            <Link to="/detection/history" className="text-xs font-bold text-accent-blue hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col">
            {scanHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <Shield className="w-10 h-10 text-muted mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium text-secondary">No scans performed yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scanHistory.slice(0, 5).map(scan => (
                  <Link
                    to={`/detection/result/${scan._id}`}
                    key={scan._id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-background hover:bg-secondary border border-transparent hover:border-border transition-all group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        scan.riskLevel === 'high' || scan.riskLevel === 'critical' ? 'bg-danger/10 text-danger' :
                        scan.riskLevel === 'medium' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                      }`}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-primary truncate max-w-[200px] sm:max-w-[280px]">{scan.target}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                             scan.riskLevel === 'high' || scan.riskLevel === 'critical' ? 'bg-danger/10 text-danger' :
                             scan.riskLevel === 'medium' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'
                          }`}>
                            {scan.riskLevel}
                          </span>
                          <span className="text-xs font-medium text-muted capitalize">{scan.scanType}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, sub, iconColor, iconBg }) {
  return (
    <div className="bg-card rounded-3xl p-5 sm:p-6 shadow-sm border border-border flex flex-col gap-4">
      <div className={`w-12 h-12 rounded-2xl ${iconBg} ${iconColor} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-3xl font-heading font-black text-primary tracking-tight mb-1">{value}</p>
        <p className="text-sm font-bold text-secondary">{label}</p>
        <p className="text-xs font-medium text-muted mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function StatusRow({ icon: Icon, color, bg, title, desc }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-border">
      <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm font-bold text-primary mb-0.5">{title}</p>
        <p className="text-xs font-medium text-secondary">{desc}</p>
      </div>
    </div>
  );
}

function LinkIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}
function MessageSquare(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
}
function QrCode(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>;
}function ImageIcon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
}

