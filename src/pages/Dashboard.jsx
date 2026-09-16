import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  ShieldAlert, Target, Activity, Shield, CheckCircle, 
  ArrowRight, ScanLine, Loader2, Globe, AlertTriangle, 
  MapPin, Clock, Search, Database, Fingerprint, FileText
} from "lucide-react";
import { useAppData } from "../context/AppDataContext";
import apiClient from "../services/apiClient";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { user } = useAppData();
  
  const [data, setData] = useState({
    scans: null,
    investigations: null,
    threatIntel: null,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      
      const [scansRes, invRes, intelRes] = await Promise.allSettled([
        apiClient.get('/users/dashboard'),
        apiClient.get('/security/investigations?limit=10'),
        apiClient.get('/security/threat-intelligence/overview?timeRange=30d')
      ]);

      if (mounted) {
        setData({
          scans: scansRes.status === 'fulfilled' ? scansRes.value.data?.data : null,
          investigations: invRes.status === 'fulfilled' ? invRes.value.data : null,
          threatIntel: intelRes.status === 'fulfilled' ? intelRes.value.data : null,
        });
        setLastUpdated(new Date());
        setLoading(false);
      }
    }
    loadDashboard();

    return () => { mounted = false; };
  }, []);

  // ---------------------------------------------------------
  // Derivations & KPI Calculations
  // ---------------------------------------------------------

  // Scans
  const scanStats = data.scans?.stats || { totalScans: 0, safeScans: 0, highRiskScans: 0 };
  const totalScans = scanStats.totalScans;
  const highRiskScans = scanStats.highRiskScans;

  // Investigations
  const invTotal = data.investigations?.total || 0;
  const recentInvestigations = data.investigations?.investigations || [];
  const needsAttention = recentInvestigations.filter(inv => 
    inv.riskLevel === 'high' || inv.riskLevel === 'critical' || inv.enrichmentStatus === 'pending'
  );

  // Indicators & Threat Intel
  const intelSummary = data.threatIntel?.summary || { total: 0, malicious: 0, suspicious: 0, clean: 0 };
  const indicatorsTotal = intelSummary.total;
  
  const markers = data.threatIntel?.markers || [];
  const coveredIndicators = markers.filter(m => m.intelligence && Object.keys(m.intelligence).length > 0).length;
  const coverageCount = markers.length > 0 ? `${coveredIndicators} Enriched` : 'No indicators';

  // Trends Chart Data
  const trendsData = data.threatIntel?.trends || [];
  
  // Threat Overview Pie Data
  const pieData = [
    { name: 'Malicious', value: intelSummary.malicious, color: 'var(--danger)' },
    { name: 'Suspicious', value: intelSummary.suspicious, color: 'var(--warning)' },
    { name: 'Clean', value: intelSummary.clean, color: 'var(--success)' },
  ].filter(d => d.value > 0);

  // Geolocation summary
  const countries = data.threatIntel?.countries || [];
  const totalLocations = countries.reduce((acc, curr) => acc + curr.count, 0);

  // Top Indicators (Recent Activity)
  const topIndicators = data.threatIntel?.recentActivity?.filter(a => a.entityType === 'indicator').slice(0, 5) || [];

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
      className="p-4 lg:p-6 max-w-[1600px] mx-auto space-y-6"
    >
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-black text-primary tracking-tight">
            Security Operations Command Center
          </h1>
          <div className="text-sm font-medium text-secondary mt-1 flex items-center gap-2 flex-wrap">
            <span>Monitoring {totalScans} scans &middot; {invTotal} investigations &middot; {indicatorsTotal} indicators</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs font-bold text-muted">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Link
            to="/detection/scanner"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-background rounded-lg text-sm font-bold transition-colors shadow-sm"
          >
            <ScanLine className="w-4 h-4" /> New Scan
          </Link>
        </div>
      </div>

      {/* TOP KPI COMMAND STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Total Scans" value={totalScans} icon={Activity} color="text-primary" />
        <KpiCard title="High Risk Scans" value={highRiskScans} icon={ShieldAlert} color="text-danger" />
        <KpiCard title="Investigations" value={invTotal} icon={Search} color="text-accent-blue" />
        <KpiCard title="Indicators" value={indicatorsTotal} icon={Fingerprint} color="text-accent-violet" />
        <KpiCard title="Safe Scans" value={scanStats.safeScans} icon={CheckCircle} color="text-success" />
        <KpiCard title="Intelligence Coverage" value={coverageCount} icon={Database} color="text-primary" />
      </div>

      {/* ERROR STATES */}
      {(!data.scans || !data.investigations || !data.threatIntel) && (
        <div className="bg-warning/10 border border-warning/20 text-warning px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-bold">
            Some dashboard modules are temporarily unavailable due to network issues. Partial data is displayed.
          </span>
        </div>
      )}

      {/* ROW 1: Threat Overview & Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Threat Overview */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col">
          <h2 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-muted" /> Threat Overview
          </h2>
          {!data.threatIntel ? (
            <EmptyState message="Threat intelligence data temporarily unavailable." />
          ) : pieData.length === 0 ? (
            <EmptyState message="No indicators discovered yet." />
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[200px]">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-border)', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-3 ml-4">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2 text-xs font-bold text-secondary">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: d.color }} />
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-danger uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Priority Queue / Needs Attention
            </h2>
          </div>
          {!data.investigations ? (
            <EmptyState message="Investigation data temporarily unavailable." />
          ) : needsAttention.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-muted">
              <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm font-bold">No priority items require review.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-auto space-y-2">
              {needsAttention.slice(0, 4).map(inv => (
                <Link to={`/security/investigations/${inv.id}`} key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border hover:border-danger/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center flex-shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary truncate max-w-[300px]">{inv.subject || 'Investigation'}</p>
                      <p className="text-xs text-muted font-medium mt-0.5">Classification: {inv.classification}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-danger/10 text-danger">
                      {inv.riskLevel} Risk
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 2: Threat Activity & Recent Investigations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Threat Activity Over Time */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col">
          <h2 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted" /> Threat Activity (30 Days)
          </h2>
          {!data.threatIntel ? (
            <EmptyState message="Threat intelligence data temporarily unavailable." />
          ) : trendsData.length === 0 ? (
            <EmptyState message="Not enough historical data for trend analysis." />
          ) : (
            <div className="h-56 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendsData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gMalicious" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-border)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }} dy={10} 
                         tickFormatter={(val) => { const d = new Date(val); return `${d.getMonth()+1}/${d.getDate()}` }}/>
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 'bold' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-border)', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                  />
                  <Area type="monotone" dataKey="malicious" name="Malicious" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#gMalicious)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Investigations */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted" /> Recent Investigations
            </h2>
            <Link to="/security/investigations" className="text-xs font-bold text-accent-blue hover:underline">View All</Link>
          </div>
          {!data.investigations ? (
            <EmptyState message="Investigation data temporarily unavailable." />
          ) : recentInvestigations.length === 0 ? (
            <EmptyState message="No recent investigations." />
          ) : (
            <div className="flex-1 overflow-auto space-y-2">
              {recentInvestigations.slice(0, 5).map(inv => (
                <Link to={`/security/investigations/${inv.id}`} key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-transparent hover:border-border transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-primary truncate max-w-[250px]">{inv.subject || 'Unknown Subject'}</p>
                    <p className="text-xs text-muted font-medium mt-0.5 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] uppercase font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded">
                      {inv.sourceType === 'eml_upload' ? 'EML' : 'Text'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: Geographic Overview & Top Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Geographic Overview */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted" /> Geographic Overview
            </h2>
            <Link to="/security/threat-intelligence" className="text-xs font-bold text-accent-blue hover:underline">View Map &rarr;</Link>
          </div>
          
          {!data.threatIntel ? (
            <EmptyState message="Geographic data temporarily unavailable." />
          ) : countries.length === 0 ? (
            <EmptyState message="No geographic data observed." />
          ) : (
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-6 mb-6">
                <div>
                  <p className="text-2xl font-black text-primary">{totalLocations}</p>
                  <p className="text-xs font-bold text-muted uppercase tracking-wide">Public IPs</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-primary">{countries.length}</p>
                  <p className="text-xs font-bold text-muted uppercase tracking-wide">Countries</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-bold text-secondary uppercase tracking-wider border-b border-border pb-1">Top Locations</p>
                {countries.slice(0, 4).map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-accent-blue" /> {c.name}
                    </span>
                    <span className="text-sm font-bold text-secondary">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Indicators */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-muted" /> Top Indicators
            </h2>
            <Link to="/security/threat-intelligence" className="text-xs font-bold text-accent-blue hover:underline">Explore All</Link>
          </div>
          
          {!data.threatIntel ? (
            <EmptyState message="Indicator data temporarily unavailable." />
          ) : topIndicators.length === 0 ? (
            <EmptyState message="No indicators recorded." />
          ) : (
            <div className="flex-1 overflow-auto space-y-2">
              {topIndicators.map(ind => (
                <div key={ind.id} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-bold text-primary truncate max-w-[220px]">{ind.title}</p>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">{ind.type}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded ${
                      ind.status === 'malicious' ? 'bg-danger/10 text-danger' :
                      ind.status === 'suspicious' ? 'bg-warning/10 text-warning' :
                      ind.status === 'clean' ? 'bg-success/10 text-success' : 'bg-secondary/10 text-secondary'
                    }`}>
                      {ind.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </motion.div>
  );
}

// ---------------------------------------------------------
// Helper Components
// ---------------------------------------------------------

function KpiCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{title}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <span className="text-2xl font-heading font-black text-primary">{value}</span>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted">
      <Search className="w-8 h-8 mb-2 opacity-30" />
      <p className="text-xs font-bold">{message}</p>
    </div>
  );
}
