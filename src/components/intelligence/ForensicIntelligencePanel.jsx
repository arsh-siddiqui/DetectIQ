import { Globe, AlertTriangle, MapPin } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import ThreatIntelSummary from "./ThreatIntelSummary";

const STATE_LABELS = {
  flagged: { label: "Intelligence Alert", color: "text-danger" },
  available: { label: "Checked", color: "text-success" },
  extracted: { label: "Extracted", color: "text-secondary" },
};

function IndicatorRow({ indicator }) {
  const stateMeta = STATE_LABELS[indicator.intelligenceState] || STATE_LABELS.extracted;
  const geo = indicator.geolocation;

  return (
    <div className="bg-background p-4 rounded-xl border border-border">
      {/* Row header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-primary break-all">{indicator.value}</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${stateMeta.color}`}>
              {stateMeta.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted capitalize px-1.5 py-0.5 bg-secondary/10 rounded">
              {indicator.type}
            </span>
            {indicator.isPublicIP === false && (
              <span className="text-xs text-muted px-1.5 py-0.5 bg-secondary/10 rounded">Private</span>
            )}
          </div>
        </div>
      </div>

      {/* VT detail */}
      <div className="mt-4">
        <ThreatIntelSummary intelligence={indicator.intelligence} />
      </div>

      {/* Geolocation (only for IPs) */}
      {indicator.type === "ip" && geo?.status === "success" && (
        <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-secondary">
          {(geo.city || geo.country) && (
            <div>
              <span className="text-muted font-semibold uppercase text-[10px]">Location</span>
              <div>{[geo.city, geo.region, geo.country].filter(Boolean).join(", ")}</div>
            </div>
          )}
          {geo.asn && (
            <div>
              <span className="text-muted font-semibold uppercase text-[10px]">ASN</span>
              <div>{geo.asn}</div>
            </div>
          )}
          {geo.isp && (
            <div>
              <span className="text-muted font-semibold uppercase text-[10px]">ISP</span>
              <div>{geo.isp}</div>
            </div>
          )}
          {geo.organization && geo.organization !== geo.isp && (
            <div>
              <span className="text-muted font-semibold uppercase text-[10px]">Org</span>
              <div>{geo.organization}</div>
            </div>
          )}
        </div>
      )}

      {/* Private IP note */}
      {indicator.type === "ip" && indicator.isPublicIP === false && (
        <p className="mt-2 text-xs text-muted italic">
          Private IP — not sent to external intelligence services.
        </p>
      )}
    </div>
  );
}

/**
 * ForensicIntelligencePanel — Displays enriched indicator intelligence from Phase 2.
 *
 * Props:
 *   geoPoints:   Array of map points (from investigation.geoPoints)
 *   indicators:  Array of enriched indicator records
 *   enrichmentStatus: 'completed' | 'partial' | 'skipped' | 'pending'
 *
 * Reusable: Uses IntelligenceMap, which is designed for Phase 3 reuse.
 */
export default function ForensicIntelligencePanel({ geoPoints = [], indicators = [], enrichmentStatus }) {
  const navigate = useNavigate();
  const { id } = useParams();

  if (!indicators || indicators.length === 0) return null;

  const publicIPs = indicators.filter(i => i.type === "ip" && i.isPublicIP);
  const flagged = indicators.filter(i => i.intelligenceState === "flagged");

  return (
    <div className="bg-card p-6 md:p-10 rounded-3xl border border-border shadow-elevated mt-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 text-accent-blue flex items-center justify-center shadow-sm">
          <Globe className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-heading font-extrabold text-primary">Infrastructure Intelligence</h3>
          <p className="text-sm text-secondary mt-0.5">
            {indicators.length} indicator{indicators.length !== 1 ? "s" : ""} enriched
            {enrichmentStatus === "partial" && " (partial — some lookups may have timed out)"}
          </p>
        </div>
        {flagged.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger/10 border border-danger/20">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <span className="text-sm font-bold text-danger">{flagged.length} Flagged</span>
          </div>
        )}
      </div>

      {/* Threat-intelligence does not override classifier notice */}
      {flagged.length > 0 && (
        <div className="mb-6 p-3 rounded-xl bg-warning/5 border border-warning/20 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-secondary">
            VirusTotal flagged one or more indicators. This evidence is incorporated into the detection
            score according to existing risk rules — the overall classification above remains authoritative.
          </p>
        </div>
      )}

      {/* Map */}
      {publicIPs.length > 0 && (
        <div className="mb-8 border border-border rounded-xl p-4 bg-background flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-1">
              Geographic Intelligence
            </h4>
            <p className="text-xs text-secondary">
              {publicIPs.length} indicator{publicIPs.length > 1 ? "s" : ""} have public geolocation data available.
            </p>
          </div>
          <button 
            onClick={() => navigate(`/security/threat-intelligence?investigation=${id}`)}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-4 py-2 rounded-lg transition-colors font-semibold shadow-sm text-sm whitespace-nowrap"
          >
            <MapPin size={16} /> View on Global Threat Map &rarr;
          </button>
        </div>
      )}

      {/* Indicator list */}
      <div>
        <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">
          Public IP Indicators
        </h4>
        <div className="space-y-3">
          {indicators
            .filter(i => i.type === "ip" || i.type === "domain" || i.type === "url" || i.type === "hash")
            .map((indicator, idx) => (
              <IndicatorRow key={idx} indicator={indicator} />
            ))}
        </div>
      </div>
    </div>
  );
}
