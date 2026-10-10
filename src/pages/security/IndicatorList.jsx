import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  Search, MapPin, AlertTriangle, ShieldCheck, HelpCircle, 
  ChevronLeft, ChevronRight, Activity, XCircle, Mail, 
  ExternalLink, Copy, Check, FileText 
} from 'lucide-react';
import * as securityService from '../../services/securityService';
import { normalizeVTState } from '../../utils/intelligenceMapping';

const IndicatorList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const idsParam = searchParams.get('ids');
  const invParam = searchParams.get('investigation');
  
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [copiedVal, setCopiedVal] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
    threat: '',
    search: '',
    ids: idsParam || ''
  });
  const [searchInput, setSearchInput] = useState('');

  // Sync ids parameter to filter state if URL changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, ids: idsParam || '' }));
    setPage(1);
  }, [idsParam]);

  const fetchIndicators = async (currentPage = 1, currentFilters = filters) => {
    try {
      setLoading(true);
      const data = await securityService.getIndicators({ 
        page: currentPage, 
        limit: 20,
        ...currentFilters
      });
      setIndicators(data.indicators);
      setTotalPages(data.pages || 1);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load indicators');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchIndicators(page, filters);
  }, [page, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleCopy = (e, val) => {
    e.stopPropagation();
    navigator.clipboard.writeText(val).catch(() => {});
    setCopiedVal(val);
    setTimeout(() => setCopiedVal(null), 2000);
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case 'ip':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'domain':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'url':
        return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'hash':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'email':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      default:
        return 'bg-secondary text-secondary border-border';
    }
  };

  const getThreatPresentation = (ind) => {
    // If VirusTotal object exists, prioritize it directly
    const vt = ind.intelligence?.virustotal || ind.intelligence?.virusTotal || ind.virusTotal;
    if (vt) {
      const stateInfo = normalizeVTState(vt);
      if (stateInfo.state === 'clean') return { icon: <ShieldCheck size={16} className="text-emerald-400" />, label: 'Clean' };
      if (stateInfo.state === 'malicious') return { icon: <AlertTriangle size={16} className="text-red-400" />, label: 'Malicious' };
      if (stateInfo.state === 'suspicious') return { icon: <AlertTriangle size={16} className="text-orange-400" />, label: 'Suspicious' };
      if (stateInfo.state === 'not_found') return { icon: <HelpCircle size={16} className="text-slate-400" />, label: 'Not observed' };
      if (stateInfo.state === 'unavailable') return { icon: <AlertTriangle size={16} className="text-slate-500" />, label: 'Unavailable' };
      if (stateInfo.state === 'unconfigured' || stateInfo.state === 'skipped') return { icon: <HelpCircle size={16} className="text-slate-400" />, label: 'Not configured' };
      return { icon: <HelpCircle size={16} className="text-slate-400" />, label: stateInfo.label };
    }
    
    // Fallback to legacy indicator threatStatus if VT is missing
    switch(ind.threatStatus) {
      case 'flagged': 
      case 'malicious': return { icon: <AlertTriangle size={16} className="text-red-400" />, label: 'Malicious' };
      case 'clean': return { icon: <ShieldCheck size={16} className="text-emerald-400" />, label: 'Clean' };
      case 'suspicious': return { icon: <AlertTriangle size={16} className="text-orange-400" />, label: 'Suspicious' };
      default: return { icon: <HelpCircle size={16} className="text-slate-400" />, label: 'Unknown' };
    }
  };

  const getGeolocationPresentation = (ind) => {
    let validGeo = null;
    if (ind.geolocations && ind.geolocations.length > 0) {
      validGeo = ind.geolocations.find(g => g.country);
    }
    if (!validGeo && ind.geolocation?.country) {
      validGeo = ind.geolocation;
    }

    if (validGeo) {
      let sourceLabel = 'Direct IP';
      if (validGeo.sourceType === 'resolved_ip') sourceLabel = 'DNS-resolved IP';
      if (validGeo.sourceType === 'received_header_ip') sourceLabel = 'Received-header IP';

      return (
        <div className="flex flex-col text-sm">
          <span className="text-[10px] text-muted mb-1 uppercase tracking-wider font-bold">Location</span>
          <div className="flex items-center gap-1.5 text-primary font-medium">
            <MapPin size={14} className="text-secondary" />
            <span>{validGeo.country}</span>
          </div>
          <span className="text-xs text-secondary mt-0.5">{sourceLabel}</span>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col text-sm">
        <span className="text-[10px] text-muted mb-1 uppercase tracking-wider font-bold">Location</span>
        <span className="text-secondary">Not available</span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
                <Activity className="text-accent-violet" />
                Indicators of Compromise
              </h1>
              <p className="text-secondary text-sm mt-1">
                Extracted artifacts, source email provenance, and global threat intelligence.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                <input 
                  type="text" 
                  placeholder="Search values..." 
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 bg-input border border-input text-primary rounded-lg text-sm focus:outline-none focus:border-accent-violet"
                />
              </div>

              <select 
                name="type"
                value={filters.type}
                onChange={handleFilterChange}
                className="bg-input border border-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-violet"
              >
                <option value="">All Types</option>
                <option value="ip">IP Address</option>
                <option value="domain">Domain</option>
                <option value="url">URL</option>
                <option value="hash">File Hash</option>
                <option value="email">Email</option>
              </select>
              
              <select 
                name="threat"
                value={filters.threat}
                onChange={handleFilterChange}
                className="bg-input border border-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-violet"
              >
                <option value="">All Threat States</option>
                <option value="malicious">Malicious</option>
                <option value="suspicious">Suspicious</option>
                <option value="clean">Clean</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

          {filters.ids && (
            <div className="bg-accent-violet/10 border border-accent-violet/20 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="text-accent-violet" size={16} />
                <span className="text-sm font-medium text-primary">
                  Showing {indicators.length} indicators from the selected map location
                </span>
              </div>
              <button 
                onClick={() => {
                  searchParams.delete('ids');
                  setSearchParams(searchParams);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-accent-violet hover:text-white hover:bg-accent-violet px-2.5 py-1.5 rounded transition-colors"
              >
                <XCircle size={14} />
                Clear Location Filter
              </button>
            </div>
          )}

          {invParam && (
            <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="text-accent-blue" size={16} />
                <span className="text-sm font-medium text-primary">
                  Showing indicators linked to specific email investigation
                </span>
              </div>
              <button 
                onClick={() => {
                  searchParams.delete('investigation');
                  setSearchParams(searchParams);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-accent-blue hover:text-white hover:bg-accent-blue px-2.5 py-1.5 rounded transition-colors"
              >
                <XCircle size={14} />
                Clear Investigation Filter
              </button>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            {error ? (
              <div className="p-8 text-center text-red-400 flex flex-col items-center">
                <AlertTriangle className="mb-2" size={24} />
                <p>{error}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-primary">
                  <thead className="text-xs text-secondary uppercase bg-secondary/30 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Indicator</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Originating Email</th>
                      <th className="px-6 py-4 font-medium">Threat Intelligence</th>
                      <th className="px-6 py-4 font-medium">Geolocation</th>
                      <th className="px-6 py-4 font-medium">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-muted">
                          <div className="flex justify-center items-center">
                            <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mr-2"></div>
                            Loading indicators...
                          </div>
                        </td>
                      </tr>
                    ) : indicators.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-12 text-center text-muted">
                          <Search className="mx-auto mb-3 opacity-20" size={32} />
                          No indicators found.
                        </td>
                      </tr>
                    ) : (
                      indicators.map((ind) => (
                        <tr 
                          key={ind._id} 
                          onClick={() => navigate(`/security/indicators/${ind._id}`)}
                          className="hover:bg-interactive cursor-pointer transition-colors group"
                        >
                          {/* Indicator Value */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 max-w-[280px]">
                              <div 
                                className="font-mono text-xs text-primary group-hover:text-accent-blue transition-colors truncate tracking-tight font-medium" 
                                title={ind.normalizedValue}
                              >
                                {ind.normalizedValue}
                              </div>
                              <button
                                onClick={(e) => handleCopy(e, ind.normalizedValue)}
                                title="Copy indicator"
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary/70 rounded transition-all text-muted hover:text-primary shrink-0"
                              >
                                {copiedVal === ind.normalizedValue ? (
                                  <Check size={12} className="text-emerald-400" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Type */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium border ${getTypeBadgeClass(ind.type)}`}>
                              {ind.type}
                            </span>
                          </td>

                          {/* Originating Email / Investigation */}
                          <td className="px-6 py-4">
                            {ind.investigation ? (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/security/investigations/${ind.investigation._id || ind.investigation.id}`);
                                }}
                                className="flex items-start gap-2 max-w-[260px] group/email hover:text-accent-violet transition-colors cursor-pointer"
                                title={`View investigation: ${ind.investigation.headers?.subject || 'Email Investigation'}`}
                              >
                                <Mail size={15} className="text-accent-violet flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-primary group-hover/email:text-accent-violet transition-colors truncate">
                                    {ind.investigation.headers?.subject || 'Untitled Email'}
                                  </div>
                                  <div className="text-[11px] text-muted truncate flex items-center gap-1 mt-0.5">
                                    {ind.investigation.headers?.from ? (
                                      <span className="truncate">{ind.investigation.headers.from}</span>
                                    ) : (
                                      <span>{ind.investigation.sourceType === 'eml_upload' ? 'EML Upload' : 'Email Scan'}</span>
                                    )}
                                    <ExternalLink size={10} className="text-muted/60 group-hover/email:text-accent-violet shrink-0" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-muted">
                                <FileText size={13} className="opacity-40" />
                                <span>Direct IOC</span>
                              </div>
                            )}
                          </td>

                          {/* Threat Intelligence */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col text-sm">
                              <span className="text-[10px] text-muted mb-1 uppercase tracking-wider font-bold">Threat Intel</span>
                              <div className="flex items-center gap-1.5 text-primary font-medium">
                                {getThreatPresentation(ind).icon}
                                <span className="capitalize">{getThreatPresentation(ind).label}</span>
                              </div>
                            </div>
                          </td>

                          {/* Geolocation */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getGeolocationPresentation(ind)}
                          </td>

                          {/* Last Seen & First Seen */}
                          <td className="px-6 py-4 whitespace-nowrap text-secondary text-xs">
                            <div>{format(new Date(ind.lastSeen || ind.updatedAt || Date.now()), 'MMM d, yyyy HH:mm')}</div>
                            {ind.firstSeen && ind.lastSeen && new Date(ind.firstSeen).toDateString() !== new Date(ind.lastSeen).toDateString() && (
                              <div className="text-[10px] text-muted mt-0.5">
                                First: {format(new Date(ind.firstSeen), 'MMM d, yyyy')}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {/*Pagination*/}
            {!loading && totalPages > 1 && (
              <div className="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-between">
                <span className="text-sm text-secondary">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-border text-secondary hover:bg-interactive disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-border text-secondary hover:bg-interactive disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default IndicatorList;
