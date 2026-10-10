import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import apiClient from "../../services/apiClient";
import { Globe, RefreshCw, FilterX, ArrowLeft, AlertTriangle } from "lucide-react";

import ThreatIntelligenceMap from "../../components/security/ThreatIntelligenceMap";
import ThreatSummaryCards from "../../components/security/ThreatSummaryCards";
import RecentThreatActivity from "../../components/security/RecentThreatActivity";
import ThreatAnalytics from "../../components/security/ThreatAnalytics";

export default function ThreatIntelligence() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIndicatorId = searchParams.get('indicator');
  
  // Filters State
  const [filters, setFilters] = useState({
    timeRange: selectedIndicatorId ? "all" : "30d",
    threatStatus: "all",
    indicatorType: "all",
    country: "all",
    investigation: "all",
  });
  
  // Data State
  const [data, setData] = useState({
    indicators: [],
    recentInvestigations: [],
    limitReached: false
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Readable investigation title generator
  const getInvestigationTitle = useCallback((inv) => {
    if (!inv) return 'Email Investigation';
    if (inv.headers?.subject?.trim()) return inv.headers.subject.trim();
    if (inv.headers?.from?.trim()) return `Email from ${inv.headers.from.trim()}`;
    if (inv.sourceType) {
      const cleanSource = inv.sourceType.replace(/_/g, ' ');
      return `Email Scan (${cleanSource})`;
    }
    return 'Email Investigation';
  }, []);

  // Map investigation IDs to objects for fast lookup
  const invMap = useMemo(() => {
    const map = new Map();
    data.recentInvestigations.forEach(inv => {
      map.set(String(inv._id), inv);
    });
    return map;
  }, [data.recentInvestigations]);

  // Dropdown options for filtering by investigation
  const investigationOptions = useMemo(() => {
    return data.recentInvestigations.map(inv => ({
      id: String(inv._id),
      label: getInvestigationTitle(inv)
    }));
  }, [data.recentInvestigations, getInvestigationTitle]);

  // Enrich indicators with investigation context (title and ID)
  const enrichedIndicators = useMemo(() => {
    return data.indicators.map(ind => {
      const invObj = (typeof ind.investigation === 'object' && ind.investigation !== null)
        ? ind.investigation
        : invMap.get(String(ind.investigation));

      const invTitle = invObj ? getInvestigationTitle(invObj) : null;
      const invId = invObj?._id ? String(invObj._id) : (ind.investigation ? String(ind.investigation) : null);

      return {
        ...ind,
        investigationId: invId,
        investigationTitle: invTitle,
      };
    });
  }, [data.indicators, invMap, getInvestigationTitle]);

  // Compute available countries across the entire unfiltered dataset (so dropdown doesn't lose options)
  const availableCountries = useMemo(() => {
    const countrySet = new Set();
    enrichedIndicators.forEach(ind => {
      let c = ind.geolocation?.country;
      if (!c && ind.geolocations?.length) c = ind.geolocations[0].country;
      if (c) countrySet.add(c);
    });
    return Array.from(countrySet).sort();
  }, [enrichedIndicators]);

  // SINGLE FILTERED DATASET: Apply status, type, country, and investigation filters on the client
  const filteredIndicators = useMemo(() => {
    return enrichedIndicators.filter(ind => {
      // If a specific indicator is selected (e.g. from Indicator Detail page), always preserve it in the dataset
      const isDirectlySelected = selectedIndicatorId && (String(ind._id) === selectedIndicatorId || String(ind.id) === selectedIndicatorId);

      // Investigation Filter
      if (filters.investigation !== 'all' && !isDirectlySelected) {
        if (ind.investigationId !== filters.investigation) return false;
      }

      // Threat Status: 'all' includes all indicators (including Not Observed / Not Configured)
      if (filters.threatStatus !== 'all' && !isDirectlySelected) {
        if (ind.threatStatus !== filters.threatStatus) return false;
      }

      // Indicator Type
      if (filters.indicatorType !== 'all' && !isDirectlySelected) {
        if (ind.type !== filters.indicatorType) return false;
      }

      // Country
      if (filters.country !== 'all' && !isDirectlySelected) {
        const c1 = ind.geolocation?.country;
        const c2 = ind.geolocations?.[0]?.country;
        if (c1 !== filters.country && c2 !== filters.country) return false;
      }

      return true;
    });
  }, [enrichedIndicators, filters, selectedIndicatorId]);

  // Derived Summary KPIs
  const summary = useMemo(() => {
    let s = { total: filteredIndicators.length, malicious: 0, suspicious: 0, clean: 0, unknown: 0 };
    filteredIndicators.forEach(ind => {
      if (ind.threatStatus === 'malicious') s.malicious++;
      else if (ind.threatStatus === 'suspicious') s.suspicious++;
      else if (ind.threatStatus === 'clean') s.clean++;
      else s.unknown++;
    });
    return s;
  }, [filteredIndicators]);

  // Derived Top Countries
  const topCountries = useMemo(() => {
    const counts = {};
    filteredIndicators.forEach(ind => {
      let c = ind.geolocation?.country;
      if (!c && ind.geolocations?.length) c = ind.geolocations[0].country;
      if (c) {
        counts[c] = (counts[c] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredIndicators]);

  // Derived Indicator Types
  const indicatorTypes = useMemo(() => {
    const counts = {};
    filteredIndicators.forEach(ind => {
      const type = ind.type;
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [filteredIndicators]);

  // Derived Recent Activity (Indicators + Investigations)
  const recentActivity = useMemo(() => {
    let activity = [];
    
    // Top 10 indicators by date from the filtered set
    const recentInds = [...filteredIndicators].slice(0, 10);
    recentInds.forEach(ind => {
      let c = ind.geolocation?.country;
      if (!c && ind.geolocations?.length) c = ind.geolocations[0].country;
      activity.push({
        id: ind._id,
        entityType: 'indicator',
        title: ind.normalizedValue || ind.value,
        type: ind.type,
        status: ind.threatStatus,
        country: c || null,
        timestamp: ind.createdAt,
        investigationId: ind.investigationId,
        investigationTitle: ind.investigationTitle,
      });
    });

    // Investigations (only if no specific country/type filters are actively hiding them)
    if (filters.indicatorType === 'all' && filters.country === 'all') {
      const invList = filters.investigation !== 'all'
        ? data.recentInvestigations.filter(inv => String(inv._id) === filters.investigation)
        : data.recentInvestigations;

      invList.forEach(inv => {
        activity.push({
          id: inv._id,
          entityType: 'investigation',
          title: getInvestigationTitle(inv),
          type: 'Investigation',
          status: inv.status,
          country: null,
          timestamp: inv.createdAt
        });
      });
    }

    return activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20);
  }, [filteredIndicators, data.recentInvestigations, filters, getInvestigationTitle]);

  // Derived Trends
  const trends = useMemo(() => {
    const dates = {};
    filteredIndicators.forEach(ind => {
      if (!ind.createdAt) return;
      const dateStr = new Date(ind.createdAt).toISOString().split('T')[0];
      if (!dates[dateStr]) {
        dates[dateStr] = { malicious: 0, suspicious: 0, clean: 0, unknown: 0 };
      }
      if (ind.threatStatus === 'malicious') dates[dateStr].malicious++;
      else if (ind.threatStatus === 'suspicious') dates[dateStr].suspicious++;
      else if (ind.threatStatus === 'clean') dates[dateStr].clean++;
      else dates[dateStr].unknown++;
    });
    return Object.entries(dates)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [filteredIndicators]);

  // Fetch Data
  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.timeRange !== "all") params.append("timeRange", filters.timeRange);
      if (filters.investigation !== "all") params.append("investigation", filters.investigation);

      const res = await apiClient.get(`/security/threat-intelligence/overview?${params.toString()}`);
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch threat intelligence overview", err);
      setError("Unable to load threat intelligence. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOverview();
  }, [filters, fetchOverview]); // Refetch when filters change

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    if (selectedIndicatorId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('indicator');
      setSearchParams(newParams);
    }
  };

  const resetFilters = () => {
    setFilters({
      timeRange: "30d",
      threatStatus: "all",
      indicatorType: "all",
      country: "all",
      investigation: "all",
    });
    if (selectedIndicatorId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('indicator');
      setSearchParams(newParams);
    }
  };



  return (
    <div className="w-full max-w-[1600px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {selectedIndicatorId && (
            <button 
              onClick={() => {
                const newParams = new URLSearchParams(searchParams);
                newParams.delete('indicator');
                setSearchParams(newParams);
              }}
              className="p-2 hover:bg-interactive rounded-lg text-secondary transition-colors border border-border bg-card self-start mt-1"
              title="Clear Selection"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-6 h-6 text-accent-blue" />
              <h1 className="text-2xl lg:text-3xl font-heading font-bold text-primary">
                Global Threat Intelligence
              </h1>
            </div>
            <p className="text-secondary text-sm lg:text-base max-w-2xl">
              Explore threat activity, indicators, and geographic intelligence from your investigations.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="text-xs text-muted font-medium">
              Data updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <button 
            onClick={fetchOverview}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary border border-border hover:border-primary/30 text-primary font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Live Data..." : "Live Data"}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
          <span className="text-sm font-medium">{error}</span>
          <button onClick={fetchOverview} className="text-sm font-bold underline hover:text-red-400">Retry</button>
        </div>
      )}

      {data.limitReached && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Dataset Limit Reached</p>
            <p className="opacity-90">
              The API returned the maximum of 2000 recent indicators for this time range. 
              Filtering and analytics below are strictly applied to this dataset to prevent silent truncation. 
              To view all indicators, use a shorter time window or the Indicators tab.
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl p-3 mb-6 flex flex-wrap items-center gap-3">
        <select 
          name="timeRange" 
          value={filters.timeRange} 
          onChange={handleFilterChange}
          className="bg-background border border-border text-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-blue min-w-[120px]"
        >
          <option value="today">Today</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>

        <select 
          name="threatStatus" 
          value={filters.threatStatus} 
          onChange={handleFilterChange}
          className="bg-background border border-border text-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-blue min-w-[120px]"
        >
          <option value="all">All Statuses</option>
          <option value="malicious">Malicious</option>
          <option value="suspicious">Suspicious</option>
          <option value="clean">Clean</option>
          <option value="unknown">Not Observed / Info</option>
        </select>

        <select 
          name="indicatorType" 
          value={filters.indicatorType} 
          onChange={handleFilterChange}
          className="bg-background border border-border text-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-blue min-w-[120px]"
        >
          <option value="all">All Types</option>
          <option value="ip">IP</option>
          <option value="domain">Domain</option>
          <option value="url">URL</option>
          <option value="email">Email</option>
          <option value="hash">Hash</option>
        </select>

        <select 
          name="country" 
          value={filters.country} 
          onChange={handleFilterChange}
          className="bg-background border border-border text-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-blue min-w-[140px]"
        >
          <option value="all">All Countries</option>
          {availableCountries.map((country, idx) => (
            <option key={idx} value={country}>{country}</option>
          ))}
        </select>

        <select 
          name="investigation" 
          value={filters.investigation} 
          onChange={handleFilterChange}
          className="bg-background border border-border text-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent-blue min-w-[180px] max-w-[280px] truncate"
          title="Filter by Email Investigation"
        >
          <option value="all">All Email Investigations</option>
          {investigationOptions.map((inv) => (
            <option key={inv.id} value={inv.id} title={inv.label}>
              {inv.label}
            </option>
          ))}
        </select>

        <div className="flex-1"></div>

        <button 
          onClick={resetFilters}
          className="flex items-center gap-1.5 px-3 py-1.5 text-muted hover:text-primary transition-colors text-sm font-medium"
        >
          <FilterX className="w-4 h-4" />
          Reset Filters
        </button>
      </div>

      {/* Main Grid: Left Panel | Map | Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 h-auto lg:h-[600px]">
        {/* Left Panel: KPI Cards */}
        <div className="lg:col-span-3 h-auto lg:h-full overflow-hidden">
          <ThreatSummaryCards 
            summary={summary} 
            countries={topCountries} 
            isLoading={isLoading} 
          />
        </div>

        <div className="lg:col-span-6 h-[400px] lg:h-full relative flex flex-col overflow-hidden rounded-2xl">
          <ThreatIntelligenceMap 
            markers={filteredIndicators} 
            isLoading={isLoading} 
            selectedIndicatorId={selectedIndicatorId}
            totalIndicators={summary.total}
            selectedCountry={filters.country}
          />
        </div>

        {/* Right Panel: Recent Activity */}
        <div className="lg:col-span-3 h-[400px] lg:h-full bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <RecentThreatActivity 
            activities={recentActivity} 
            isLoading={isLoading} 
          />
        </div>
      </div>

      {/* Bottom Analytics */}
      <ThreatAnalytics 
        trends={trends} 
        indicatorTypes={indicatorTypes} 
        summary={summary}
        isLoading={isLoading} 
      />
      
    </div>
  );
}
