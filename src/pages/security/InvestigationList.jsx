import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ShieldAlert, AlertTriangle, Cpu, ChevronLeft, ChevronRight } from 'lucide-react';
import * as securityService from '../../services/securityService';

const InvestigationList = () => {
  const navigate = useNavigate();
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    classification: '',
    riskLevel: ''
  });

  const fetchInvestigations = async (currentPage = 1, currentFilters = filters) => {
    try {
      setLoading(true);
      const data = await securityService.getInvestigations({ 
        page: currentPage, 
        limit: 15,
        ...currentFilters
      });
      setInvestigations(data.investigations);
      setTotalPages(data.pages || 1);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to load investigations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestigations(page, filters);
  }, [page, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1); // Reset to first page on filter change
  };

  const getRiskColor = (level) => {
    switch(level) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'safe': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
                <ShieldAlert className="text-accent-violet" />
                Email Investigations
              </h1>
              <p className="text-secondary text-sm mt-1">
                Forensic analysis and threat intelligence for uploaded emails.
              </p>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <select 
                name="classification"
                value={filters.classification}
                onChange={handleFilterChange}
                className="bg-input border border-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-violet"
              >
                <option value="">All Classifications</option>
                <option value="phishing">Phishing</option>
                <option value="suspicious">Suspicious</option>
                <option value="legitimate">Legitimate</option>
              </select>
              
              <select 
                name="riskLevel"
                value={filters.riskLevel}
                onChange={handleFilterChange}
                className="bg-input border border-input text-primary rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-violet"
              >
                <option value="">All Risks</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            {error ? (
              <div className="p-8 text-center text-red-400 flex flex-col items-center">
                <AlertTriangle className="mb-2" size={24} />
                <p>{error}</p>
                <button 
                  onClick={() => fetchInvestigations(page, filters)}
                  className="mt-4 px-4 py-2 bg-secondary hover:bg-interactive rounded-lg text-sm text-primary transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-primary">
                  <thead className="text-xs text-secondary uppercase bg-secondary/30 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">Subject</th>
                      <th className="px-6 py-4 font-medium">Sender</th>
                      <th className="px-6 py-4 font-medium">Classification</th>
                      <th className="px-6 py-4 font-medium">Risk</th>
                      <th className="px-6 py-4 font-medium text-center">Indicators</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-8 text-center text-muted">
                          <div className="flex justify-center items-center">
                            <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mr-2"></div>
                            Loading investigations...
                          </div>
                        </td>
                      </tr>
                    ) : investigations.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-muted">
                          <ShieldAlert className="mx-auto mb-3 opacity-20" size={32} />
                          No investigations found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      investigations.map((inv) => (
                        <tr 
                          key={inv.id} 
                          onClick={() => navigate(`/security/investigations/${inv.id}`)}
                          className="hover:bg-interactive cursor-pointer transition-colors group"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-secondary">
                            {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                            <div className="text-xs text-muted">{format(new Date(inv.createdAt), 'HH:mm')}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-primary truncate max-w-[200px] group-hover:text-accent-blue transition-colors">
                              {inv.subject || '(No Subject)'}
                            </div>
                            <div className="text-xs text-muted uppercase tracking-wider mt-1">
                              {inv.sourceType.replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-6 py-4 truncate max-w-[200px]">
                            {inv.sender || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap capitalize">
                            {inv.classification}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${getRiskColor(inv.riskLevel)}`}>
                              {inv.riskLevel}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-secondary text-xs font-medium border border-border">
                              {inv.indicatorCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {inv.enrichmentStatus === 'completed' ? (
                                <Cpu size={14} className="text-success" />
                              ) : inv.enrichmentStatus === 'pending' ? (
                                <div className="w-3 h-3 rounded-full border-2 border-warning border-t-transparent animate-spin" />
                              ) : (
                                <Cpu size={14} className="text-muted" />
                              )}
                              <span className="text-xs capitalize text-secondary">
                                {inv.enrichmentStatus}
                              </span>
                            </div>
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

export default InvestigationList;
