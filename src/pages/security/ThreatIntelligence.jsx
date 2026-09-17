import React, { useState, useEffect } from "react";
import { useAppData } from "../../context/AppDataContext";
import { useSearchParams } from "react-router-dom";
import apiClient from "../../services/apiClient";
import { Globe, RefreshCw, FilterX, ArrowLeft } from "lucide-react";

import ThreatIntelligenceMap from "../../components/security/ThreatIntelligenceMap";
import ThreatSummaryCards from "../../components/security/ThreatSummaryCards";
import RecentThreatActivity from "../../components/security/RecentThreatActivity";
import ThreatAnalytics from "../../components/security/ThreatAnalytics";

export default function ThreatIntelligence() {
  const { user } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIndicatorId = searchParams.get('indicator');
  
  // Filters State
  const [filters, setFilters] = useState({
    timeRange: "30d",
    threatStatus: "all",
    indicatorType: "all",
    country: "all",
    investigation: "all",
  });
  
  // Data State
  const [data, setData] = useState({
    summary: { total: 0, malicious: 0, suspicious: 0, clean: 0, unknown: 0 },
    markers: [],
    countries: [],
    recentActivity: [],
    trends: [],
    indicatorTypes: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Fetch Data
  const fetchOverview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.timeRange !== "all") params.append("timeRange", filters.timeRange);
      if (filters.threatStatus !== "all") params.append("threatStatus", filters.threatStatus);
      if (filters.indicatorType !== "all") params.append("indicatorType", filters.indicatorType);
      if (filters.country !== "all") params.append("country", filters.country);
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
  };

  useEffect(() => {
    fetchOverview();
  }, [filters]); // Refetch when filters change

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

  // Derive unique countries from the fetched data's countries list for the dropdown
  // Realistically we'd want a separate endpoint for ALL user countries, but this is a good approximation
  const availableCountries = data.countries?.map(c => c.name).sort() || [];

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
          <option value="unknown">Unknown</option>
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
            summary={data.summary} 
            countries={data.countries} 
            isLoading={isLoading} 
          />
        </div>

        <div className="lg:col-span-6 h-[400px] lg:h-full relative flex flex-col overflow-hidden rounded-2xl">
          <ThreatIntelligenceMap 
            markers={data.markers} 
            isLoading={isLoading} 
            selectedIndicatorId={selectedIndicatorId}
            totalIndicators={data.summary.total}
            selectedCountry={filters.country}
          />
        </div>

        {/* Right Panel: Recent Activity */}
        <div className="lg:col-span-3 h-[400px] lg:h-full bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <RecentThreatActivity 
            activities={data.recentActivity} 
            isLoading={isLoading} 
          />
        </div>
      </div>

      {/* Bottom Analytics */}
      <ThreatAnalytics 
        trends={data.trends} 
        indicatorTypes={data.indicatorTypes} 
        summary={data.summary}
        isLoading={isLoading} 
      />
      
    </div>
  );
}
