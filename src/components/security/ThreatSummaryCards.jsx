import { ShieldAlert, ShieldCheck, AlertTriangle, MapPin, Globe } from "lucide-react";

export default function ThreatSummaryCards({ summary, countries, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-secondary rounded-xl border border-border"></div>
        ))}
        <div className="mt-4 h-48 bg-secondary rounded-xl border border-border"></div>
      </div>
    );
  }

  const { total = 0, malicious = 0, suspicious = 0, clean = 0 } = summary || {};

  const cards = [
    {
      title: "Total Indicators",
      value: total,
      icon: Globe,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Malicious",
      value: malicious,
      icon: ShieldAlert,
      color: "text-red-500",
      bg: "bg-red-500/10"
    },
    {
      title: "Suspicious",
      value: suspicious,
      icon: AlertTriangle,
      color: "text-orange-500",
      bg: "bg-orange-500/10"
    },
    {
      title: "Clean / Benign",
      value: clean,
      icon: ShieldCheck,
      color: "text-green-500",
      bg: "bg-green-500/10"
    }
  ];

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
        {cards.map((card, idx) => (
          <div key={idx} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 hover:border-primary/30 transition-colors">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${card.bg}`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-0.5">
                {card.title}
              </div>
              <div className="text-2xl font-bold text-primary">
                {card.value.toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl flex-1 flex flex-col overflow-hidden min-h-[200px]">
        <div className="px-4 py-3 border-b border-border bg-secondary/30 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-accent-blue" />
          <h3 className="text-sm font-bold text-primary">Top Affected Countries</h3>
        </div>
        <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
          {!countries || countries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted text-sm px-4 text-center py-6">
              No country data available.
            </div>
          ) : (
            <div className="space-y-1">
              {countries.map((country, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary truncate max-w-[150px]">
                      {country.name}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-primary bg-secondary px-2 py-0.5 rounded-md">
                    {country.count.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
