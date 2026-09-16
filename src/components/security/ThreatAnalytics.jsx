import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, BarChart2, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const THREAT_COLORS = {
  malicious: "#ef4444",
  suspicious: "#f97316",
  clean: "#22c55e",
  unknown: "#6b7280",
};

const TYPE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#64748b'];

export default function ThreatAnalytics({ trends, indicatorTypes, summary, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-64 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-secondary rounded-xl border border-border h-full"></div>
        ))}
      </div>
    );
  }

  const hasTrends = trends && trends.length >= 2;
  const hasTypes = indicatorTypes && indicatorTypes.length > 0;
  
  const statusData = summary ? [
    { name: 'Malicious', value: summary.malicious || 0, color: THREAT_COLORS.malicious },
    { name: 'Suspicious', value: summary.suspicious || 0, color: THREAT_COLORS.suspicious },
    { name: 'Clean', value: summary.clean || 0, color: THREAT_COLORS.clean },
    { name: 'Unknown', value: summary.unknown || 0, color: THREAT_COLORS.unknown }
  ] : [];
  
  const hasStatus = statusData.length > 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0d1117] border border-border p-3 rounded-lg shadow-xl">
          <p className="text-sm font-bold text-primary mb-2">
            {label ? format(parseISO(label), 'MMM d, yyyy') : ''}
          </p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-xs mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-secondary capitalize">{entry.name}:</span>
              <span className="text-primary font-bold ml-auto">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Trends Chart */}
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col h-80 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-accent-blue" />
          <h3 className="text-sm font-bold text-primary">Threat Trends Over Time</h3>
        </div>
        
        <div className="flex-1 w-full relative">
          {!hasTrends ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Not enough historical data for this period.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickMargin={10}
                  tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                  minTickGap={20}
                />
                <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="malicious" name="Malicious" stroke={THREAT_COLORS.malicious} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="suspicious" name="Suspicious" stroke={THREAT_COLORS.suspicious} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="clean" name="Clean" stroke={THREAT_COLORS.clean} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Indicator Types Donut */}
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col h-80 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="w-4 h-4 text-accent-violet" />
          <h3 className="text-sm font-bold text-primary">Indicators by Type</h3>
        </div>
        
        <div className="flex-1 w-full relative">
          {!hasTypes ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No indicator types found.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={indicatorTypes}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                  stroke="none"
                >
                  {indicatorTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0d1117', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc', fontSize: '12px' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  formatter={(value) => <span className="text-xs text-secondary capitalize">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          
          {hasTypes && summary?.total > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <span className="text-2xl font-bold text-primary">{summary.total}</span>
              <span className="text-[10px] text-muted uppercase tracking-wider">Total</span>
            </div>
          )}
        </div>
      </div>

      {/* Threat Status Breakdown */}
      <div className="bg-card border border-border rounded-xl p-5 flex flex-col h-80 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-accent-blue" />
          <h3 className="text-sm font-bold text-primary">Threat Status Breakdown</h3>
        </div>
        
        <div className="flex-1 w-full relative">
          {!hasStatus ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
              <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No status data available.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} stroke="#94a3b8" fontSize={11} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: '#1e293b', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#0d1117', borderColor: '#1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#f8fafc', fontSize: '12px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
    </div>
  );
}
