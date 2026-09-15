import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, MapPin, AlertTriangle, ShieldCheck, HelpCircle, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import * as securityService from '../../services/securityService';
import { normalizeVTState } from '../../utils/intelligenceMapping';

const IndicatorList = () => {
  const navigate = useNavigate();
  const [indicators, setIndicators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    type: '',
    threat: '',
    search: ''
  });
  const [searchInput, setSearchInput] = useState('');

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
                Extracted artifacts and global threat intelligence.
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
                <option value="flagged">Flagged</option>
                <option value="suspicious">Suspicious</option>
                <option value="clean">Clean</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

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
                      <th className="px-6 py-4 font-medium">Threat Intelligence</th>
                      <th className="px-6 py-4 font-medium">Geolocation</th>
                      <th className="px-6 py-4 font-medium">First Seen</th>
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
                          <td className="px-6 py-4">
                            <div className="font-mono text-primary group-hover:text-accent-blue transition-colors truncate max-w-[250px]" title={ind.normalizedValue}>
                              {ind.normalizedValue}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-medium bg-secondary text-secondary border border-border">
                              {ind.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col text-sm">
                              <span className="text-[10px] text-muted mb-1 uppercase tracking-wider font-bold">Threat Intel</span>
                              <div className="flex items-center gap-1.5 text-primary font-medium">
                                {getThreatPresentation(ind).icon}
                                <span className="capitalize">{getThreatPresentation(ind).label}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getGeolocationPresentation(ind)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-secondary">
                            {format(new Date(ind.firstSeen), 'MMM d, yyyy HH:mm')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-secondary">
                            {format(new Date(ind.lastSeen), 'MMM d, yyyy HH:mm')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination */}
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
