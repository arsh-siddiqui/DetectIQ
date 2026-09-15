import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, Search, MapPin, AlertTriangle, ShieldCheck, 
  HelpCircle, Globe, Hash, Clock, Server, Link as LinkIcon 
} from 'lucide-react';
import * as securityService from '../../services/securityService';
import ThreatIntelSummary from '../../components/intelligence/ThreatIntelSummary';
import { normalizeVTState } from '../../utils/intelligenceMapping';

const Section = ({ title, icon: Icon, children }) => {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden shadow-soft">
      <div className="flex items-center p-4 border-b border-border bg-secondary/30 text-primary font-medium">
        <Icon size={18} className="text-accent-violet mr-2" />
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
};

const IndicatorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ind, setInd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await securityService.getIndicatorById(id);
        setInd(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load indicator details. It may not exist or you do not have access.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const getThreatPresentation = (status, vtObj, size = 24) => {
    if (vtObj) {
      const stateInfo = normalizeVTState(vtObj);
      if (stateInfo.state === 'clean') return { icon: <ShieldCheck size={size} className="text-success" />, label: 'Clean', colorClass: 'text-success', borderClass: 'bg-success/10 border-success/30' };
      if (stateInfo.state === 'malicious') return { icon: <AlertTriangle size={size} className="text-danger" />, label: 'Malicious', colorClass: 'text-danger', borderClass: 'bg-danger/10 border-danger/30' };
      if (stateInfo.state === 'suspicious') return { icon: <AlertTriangle size={size} className="text-warning" />, label: 'Suspicious', colorClass: 'text-warning', borderClass: 'bg-warning/10 border-warning/30' };
      if (stateInfo.state === 'not_found') return { icon: <HelpCircle size={size} className="text-muted" />, label: 'Not observed by provider', colorClass: 'text-muted', borderClass: 'bg-secondary/50 border-border' };
      if (stateInfo.state === 'unavailable') return { icon: <AlertTriangle size={size} className="text-secondary" />, label: 'Unavailable', colorClass: 'text-secondary', borderClass: 'bg-secondary/50 border-border' };
      return { icon: <HelpCircle size={size} className="text-muted" />, label: stateInfo.label, colorClass: 'text-muted', borderClass: 'bg-secondary/50 border-border' };
    }

    switch(status) {
      case 'flagged': 
      case 'malicious': return { icon: <AlertTriangle size={size} className="text-danger" />, label: 'Malicious', colorClass: 'text-danger', borderClass: 'bg-danger/10 border-danger/30' };
      case 'clean': return { icon: <HelpCircle size={size} className="text-muted" />, label: 'Not observed by provider', colorClass: 'text-secondary', borderClass: 'bg-secondary/50 border-border' };
      case 'suspicious': return { icon: <AlertTriangle size={size} className="text-warning" />, label: 'Suspicious', colorClass: 'text-warning', borderClass: 'bg-warning/10 border-warning/30' };
      default: return { icon: <HelpCircle size={size} className="text-muted" />, label: 'Not observed by provider', colorClass: 'text-secondary', borderClass: 'bg-secondary/50 border-border' };
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'ip': return <Server size={18} />;
      case 'domain': return <Globe size={18} />;
      case 'url': return <LinkIcon size={18} />;
      case 'hash': return <Hash size={18} />;
      default: return <Search size={18} />;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-muted">
          <div className="w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error || !ind) {
    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-danger">
          <Search size={48} className="mb-4 opacity-50" />
          <p>{error || 'Indicator not found.'}</p>
          <button 
            onClick={() => navigate('/security/indicators')}
            className="mt-6 px-4 py-2 bg-secondary hover:bg-interactive text-primary rounded-lg transition-colors"
          >
            Back to Indicators
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/security/indicators')}
                className="p-2 hover:bg-interactive rounded-lg text-secondary transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-secondary rounded-lg border border-border text-accent-violet">
                  {getTypeIcon(ind.type)}
                </div>
                <div>
                  <h1 className="text-[28px] font-bold font-mono text-primary truncate max-w-2xl break-all">
                    {ind.normalizedValue}
                  </h1>
                  <div className="flex items-center gap-3 text-sm text-secondary mt-1">
                    <span className="uppercase tracking-wide font-medium bg-secondary px-2 py-0.5 rounded text-[10px] text-primary">
                      {ind.type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> First Seen: {format(new Date(ind.firstSeen), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={`px-4 py-3 rounded-lg border flex items-center gap-3 ${getThreatPresentation(ind.threatStatus, ind.intelligence?.virustotal || ind.intelligence?.virusTotal).borderClass}`}>
              {getThreatPresentation(ind.threatStatus, ind.intelligence?.virustotal || ind.intelligence?.virusTotal, 28).icon}
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted mb-0.5">Threat Status</div>
                <div className={`text-[22px] font-bold capitalize leading-none ${getThreatPresentation(ind.threatStatus, ind.intelligence?.virustotal || ind.intelligence?.virusTotal).colorClass}`}>
                  {getThreatPresentation(ind.threatStatus, ind.intelligence?.virustotal || ind.intelligence?.virusTotal).label}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Column */}
            <div className="space-y-6">
              
              <Section title="Threat Intelligence" icon={ShieldCheck}>
                {ind.intelligence && Object.keys(ind.intelligence).length > 0 ? (
                  <div className="space-y-4">
                    <ThreatIntelSummary intelligence={ind.intelligence} />
                    
                    {/* Optional Technical Details block */}
                    <details className="mt-4 bg-card border border-border rounded-lg group">
                      <summary className="p-3 text-sm font-medium text-secondary cursor-pointer hover:text-primary transition-colors list-none flex items-center justify-between">
                        <span>Technical Details</span>
                        <span className="text-xs text-muted group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="p-4 border-t border-border space-y-4">
                        {Object.entries(ind.intelligence).map(([provider, data]) => (
                          <div key={provider}>
                            <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
                              {provider.replace(/([A-Z])/g, ' $1').trim()} Raw Data
                            </div>
                            <pre className="text-xs text-secondary bg-secondary/30 p-3 rounded overflow-x-auto border border-border">
                              {JSON.stringify(data, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="text-muted text-sm py-4">No threat intelligence data available for this indicator.</div>
                )}
              </Section>

              <Section title="Related Investigations" icon={Search}>
                {ind.relatedInvestigations && ind.relatedInvestigations.length > 0 ? (
                  <div className="space-y-2">
                    {ind.relatedInvestigations.map((inv) => (
                      <div 
                        key={inv.id} 
                        onClick={() => navigate(`/security/investigations/${inv.id}`)}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-interactive cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="text-sm font-medium text-primary group-hover:text-accent-violet">
                            {inv.subject || '(No Subject)'}
                          </div>
                          <div className="text-xs text-muted capitalize mt-1">
                            {inv.sourceType?.replace('_', ' ')}
                          </div>
                        </div>
                        <div className="text-xs text-secondary mt-2 sm:mt-0 whitespace-nowrap flex items-center gap-1">
                          <Clock size={12} /> {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted text-sm py-4">No related investigations found.</div>
                )}
              </Section>
            </div>

            <div className="space-y-6">
              <Section title="Geolocation" icon={MapPin}>
                {ind.geolocation && ind.geolocation.status === 'success' && ind.geolocation.country ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-muted mb-1 uppercase tracking-wider">Country</div>
                        <div className="text-lg text-primary font-bold">{ind.geolocation.country}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1 uppercase tracking-wider">City</div>
                        <div className="text-lg text-primary font-bold">{ind.geolocation.city || 'Unknown'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1 uppercase tracking-wider">ISP</div>
                        <div className="text-base text-primary font-bold truncate" title={ind.geolocation.isp}>{ind.geolocation.isp || 'Unknown'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-1 uppercase tracking-wider">ASN</div>
                        <div className="text-base text-primary font-bold">{ind.geolocation.asn || 'Unknown'}</div>
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-border flex justify-end">
                      <button 
                        onClick={() => navigate(`/security/threat-intelligence?indicator=${ind.id || ind._id}`)}
                        className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-4 py-2.5 rounded-lg transition-colors font-semibold shadow-sm"
                      >
                        <MapPin size={16} /> View on Global Threat Map &rarr;
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted text-sm py-4">
                    {ind.type === 'ip' ? 'Location data unavailable or private IP.' : 'Geolocation is only applicable to IP addresses.'}
                  </div>
                )}
              </Section>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default IndicatorDetail;
