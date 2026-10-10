import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { 
  Maximize2, Minimize2, X, Copy, ExternalLink, Network, 
  BookOpen, Info, ArrowLeft, ShieldAlert, Globe, Server, 
  Link as LinkIcon, Mail, CheckCircle2, AlertTriangle, Layers, HelpCircle
} from 'lucide-react';

const NODE_COLORS = {
  investigation: '#3b82f6', 
  email: '#3b82f6', 
  person: '#10b981', 
  ip: '#f59e0b', 
  domain: '#f59e0b', 
  url: '#0ea5e9', 
  hash: '#64748b', 
  attachment: '#06b6d4', 
  location: '#84cc16', 
  threat_intel: '#ef4444', 
  asn: '#d946ef', 
  default: '#9ca3af' 
};

const TYPE_LABELS = {
  investigation: 'Investigation',
  email: 'Email',
  person: 'Person',
  ip: 'IP Address',
  domain: 'Domain',
  url: 'URL',
  hash: 'Hash',
  attachment: 'Attachment',
  location: 'Geolocation',
  threat_intel: 'Threat Intelligence',
  asn: 'ASN'
};

const FILTERS = ['All', 'IPs', 'Domains', 'URLs', 'Emails', 'Attachments'];

const getNodeRoleExplanation = (node, allLinks = [], allNodes = []) => {
  if (!node) return '';
  const type = node.type;
  const label = node.label || node.id;
  
  if (type === 'email') {
    return 'Central investigation subject representing the analyzed email message. All observed headers, relay IPs, extracted domains, and hyperlinks connect directly to this node.';
  }
  if (type === 'person') {
    return `Identity entity extracted from email headers (${label}) representing the sender, recipient, or reply-to mailbox.`;
  }
  if (type === 'domain') {
    const isSender = allLinks.some(l => {
      const rel = l.relation || l.label;
      const tId = l.target?.id || l.target;
      return (rel === 'sent from' || rel === 'reply_to domain') && tId === node.id;
    });
    if (isSender) {
      return `Primary sender domain (${label}) from the From: header address. Mail routing authentication (SPF/DKIM/DMARC) aligns with this organization.`;
    }
    return `External domain (${label}) referenced in hyperlinks or body content.`;
  }
  if (type === 'ip') {
    const locLink = allLinks.find(l => {
      const rel = l.relation || l.label;
      const sId = l.source?.id || l.source;
      return rel === 'located in' && sId === node.id;
    });
    const locNode = locLink ? allNodes.find(n => n.id === (locLink.target?.id || locLink.target)) : null;
    const locStr = locNode ? ` and geolocates to ${locNode.label}` : '';
    return `Mail relay hop IP (${label}) recorded in message Received: headers. It indicates transport server infrastructure${locStr}.`;
  }
  if (type === 'location') {
    return `Physical hosting jurisdiction (${label}) where the sending mail server or resolved domain IP was located via IP geolocation.`;
  }
  if (type === 'url') {
    return `Hyperlink (${label}) embedded in the email body. Recipient interaction would navigate to this web endpoint.`;
  }
  if (type === 'attachment') {
    return `File payload (${label}) delivered as a MIME attachment inside the email message.`;
  }
  if (type === 'hash') {
    return `SHA-256 cryptographic checksum (${label}) computed from email attachment files for malware database cross-referencing.`;
  }
  if (type === 'threat_intel') {
    return `Security intelligence provider (${label}) reporting reputation scoring and indicator telemetry.`;
  }
  return `Forensic indicator (${label}) discovered during inspection.`;
};

const InvestigationGraph = ({ data, investigation }) => {
  const navigate = useNavigate();
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [showExplanation, setShowExplanation] = useState(true);

  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: isFullscreen ? window.innerHeight : containerRef.current.offsetHeight || 600
      });
    }
  }, [isFullscreen]);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Compute filtered graph data
  const filteredData = useMemo(() => {
    if (!data || !data.nodes) return { nodes: [], links: [] };
    if (activeFilter === 'All') return data;

    let allowedNodeIds = new Set();
    const centralEmailNode = data.nodes.find(n => n.type === 'email');
    if (centralEmailNode) allowedNodeIds.add(centralEmailNode.id);

    // Helper to find immediate neighbors
    const getNeighbors = (nodeIds) => {
      const neighbors = new Set();
      data.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (nodeIds.has(sourceId)) neighbors.add(targetId);
        if (nodeIds.has(targetId)) neighbors.add(sourceId);
      });
      return neighbors;
    };

    let coreNodes = new Set();

    if (activeFilter === 'IPs') {
      data.nodes.filter(n => n.type === 'ip').forEach(n => coreNodes.add(n.id));
    } else if (activeFilter === 'Domains') {
      data.nodes.filter(n => n.type === 'domain').forEach(n => coreNodes.add(n.id));
    } else if (activeFilter === 'URLs') {
      data.nodes.filter(n => n.type === 'url').forEach(n => coreNodes.add(n.id));
    } else if (activeFilter === 'Emails') {
      data.nodes.filter(n => n.type === 'person' || n.type === 'email').forEach(n => coreNodes.add(n.id));
      // Add sender domains
      data.links.forEach(link => {
        if (link.relation === 'sent from' || link.relation === 'reply_to domain') {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
          if (centralEmailNode && sourceId === centralEmailNode.id) {
            coreNodes.add(targetId);
          }
        }
      });
    } else if (activeFilter === 'Attachments') {
      data.nodes.filter(n => n.type === 'attachment' || n.type === 'hash').forEach(n => coreNodes.add(n.id));
    }

    coreNodes.forEach(id => allowedNodeIds.add(id));
    const neighbors = getNeighbors(coreNodes);
    neighbors.forEach(id => allowedNodeIds.add(id));

    const nodes = data.nodes.filter(n => allowedNodeIds.has(n.id));
    const links = data.links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      return allowedNodeIds.has(sourceId) && allowedNodeIds.has(targetId);
    });

    return { nodes, links };
  }, [data, activeFilter]);

  // Handle selected node disappearing when filter changes
  useEffect(() => {
    if (selectedNode && !filteredData.nodes.find(n => n.id === selectedNode.id)) {
      setSelectedNode(null);
    }
  }, [filteredData, selectedNode]);

  useEffect(() => {
    if (fgRef.current && filteredData.nodes.length) {
      fgRef.current.d3Force('charge').strength(-400);
      fgRef.current.d3Force('link').distance(60);
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 80);
      }, 500);
    }
  }, [filteredData]);

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(3, 1000);
    }
  }, []);

  const handleBackgroundClick = useCallback(() => setSelectedNode(null), []);

  const presentTypes = useMemo(() => {
    if (!filteredData.nodes) return [];
    const types = new Set(filteredData.nodes.map(n => n.type));
    return Array.from(types).sort();
  }, [filteredData]);

  const selectedNodeRelationships = useMemo(() => {
    if (!selectedNode || !filteredData.links) return [];
    return filteredData.links.filter(
      link => (link.source.id || link.source) === selectedNode.id || (link.target.id || link.target) === selectedNode.id
    ).map(link => {
      const isSource = (link.source.id || link.source) === selectedNode.id;
      const otherNodeId = isSource ? (link.target.id || link.target) : (link.source.id || link.source);
      const otherNode = filteredData.nodes.find(n => n.id === otherNodeId);
      return {
        direction: isSource ? 'outgoing' : 'incoming',
        relType: link.relation || link.label || link.type || 'links to',
        node: otherNode
      };
    });
  }, [selectedNode, filteredData]);

  const graphNarrative = useMemo(() => {
    const nodes = data?.nodes || [];
    const centralEmail = nodes.find(n => n.type === 'email');
    const subject = investigation?.headers?.subject || centralEmail?.label || 'Analyzed Email';
    const from = investigation?.headers?.from || nodes.find(n => n.type === 'person')?.label || 'Unknown Sender';
    const ips = nodes.filter(n => n.type === 'ip');
    const domains = nodes.filter(n => n.type === 'domain');
    const urls = nodes.filter(n => n.type === 'url');
    const locations = nodes.filter(n => n.type === 'location');
    const flagged = nodes.filter(n => n.metadata?.threat === 'malicious' || n.metadata?.threat === 'suspicious');

    return {
      subject,
      from,
      ipCount: ips.length,
      domainCount: domains.length,
      urlCount: urls.length,
      locations: locations.map(l => l.label).filter(Boolean).join(', ') || 'Global endpoints',
      flaggedCount: flagged.length,
      classification: investigation?.scan?.classification || 'Analyzed',
      riskScore: investigation?.scan?.riskScore ?? null,
      riskLevel: investigation?.scan?.riskLevel || 'unknown'
    };
  }, [data, investigation]);

  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted bg-card rounded-lg border border-border h-full">
        <p>No graph data available for this investigation.</p>
      </div>
    );
  }

  return (
    <div 
      className={`relative bg-[#0f172a] rounded-xl border border-border overflow-hidden flex ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : 'h-full min-h-[600px]'}`}
      ref={containerRef}
    >
      <div className="flex-1 relative h-full">
        {/* Graph Header and Filters */}
        <div className="absolute top-4 left-4 z-10 space-y-3">
          <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Network size={16} className="text-accent-violet" />
              Investigation Graph
            </h3>
            <div className="text-[11px] text-muted mt-1 leading-relaxed">
              Explore how evidence and indicators are connected.<br/>Click any node for details.
            </div>
            <div className="text-[11px] font-medium text-secondary mt-3 uppercase tracking-wider">
              {activeFilter !== 'All' ? `${activeFilter} · ` : ''}{filteredData.nodes.length} Entities · {filteredData.links.length} Relationships
            </div>
          </div>
          
          <div className="bg-card/90 backdrop-blur border border-border rounded-lg p-2 shadow-xl flex gap-1">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  activeFilter === f 
                    ? 'bg-accent-blue text-white shadow-sm' 
                    : 'text-secondary hover:text-primary hover:bg-secondary/50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
          <button 
            onClick={() => setShowExplanation(!showExplanation)}
            className={`px-3 py-2 rounded-md transition-colors text-xs font-semibold border backdrop-blur flex items-center gap-1.5 shadow-sm ${
              showExplanation 
                ? 'bg-accent-violet text-white border-accent-violet/60' 
                : 'bg-secondary/80 text-white hover:bg-interactive border-border'
            }`}
            title="Toggle Graph Insights & Explanation"
          >
            <BookOpen size={14} />
            <span className="hidden sm:inline">{showExplanation ? "Hide Insights" : "Graph Insights"}</span>
          </button>
          <button 
            onClick={() => {
              if (fgRef.current) fgRef.current.zoomToFit(400, 80);
            }}
            className="p-2 bg-secondary/80 hover:bg-interactive text-white rounded-md transition-colors text-xs font-medium border border-border backdrop-blur flex items-center gap-1"
            title="Reset View"
          >
            Reset View
          </button>
          <button 
            onClick={toggleFullscreen}
            className="p-2 bg-secondary/80 hover:bg-interactive text-white rounded-md transition-colors border border-border backdrop-blur"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-card/90 backdrop-blur border border-border rounded-lg p-3 shadow-xl pointer-events-none">
          <h3 className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">Legend</h3>
          <div className="flex flex-col gap-1.5">
            {presentTypes.map(type => (
              <div key={type} className="flex items-center gap-2 text-[11px] font-medium text-slate-200">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_COLORS[type] || NODE_COLORS.default }} />
                {TYPE_LABELS[type] || type}
              </div>
            ))}
          </div>
        </div>

        {filteredData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-secondary text-sm bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border">
              No {activeFilter.toLowerCase()} relationships were found in this investigation.
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={selectedNode ? dimensions.width - 320 : dimensions.width}
            height={dimensions.height}
            graphData={filteredData}
            nodeLabel=""
            nodeColor={(node) => NODE_COLORS[node.type] || NODE_COLORS.default}
            nodeRelSize={6}
            linkColor={() => 'rgba(255,255,255,0.2)'}
            linkWidth={1.5}
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            linkLabel={(link) => {
              const source = typeof link.source === 'object' ? link.source.label || link.source.id : link.source;
              const target = typeof link.target === 'object' ? link.target.label || link.target.id : link.target;
              const rel = link.relation || link.label || link.type || 'links to';
              return `${source} → ${rel} → ${target}`;
            }}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            onNodeHover={setHoveredNode}
            backgroundColor="transparent"
            nodeCanvasObject={(node, ctx, globalScale) => {
              const isHovered = hoveredNode === node;
              const isSelected = selectedNode === node;
              const isCenter = node.type === 'investigation' || node.type === 'email';
              const color = NODE_COLORS[node.type] || NODE_COLORS.default;
              
              ctx.beginPath();
              
              if (isCenter) {
                ctx.arc(node.x, node.y, 9, 0, 2 * Math.PI, false);
              } else if (node.type === 'person') {
                ctx.rect(node.x - 5, node.y - 5, 10, 10);
              } else {
                ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
              }
              
              ctx.fillStyle = color;
              ctx.fill();

              if (isSelected || isHovered || isCenter) {
                ctx.lineWidth = isCenter ? 2 : 1.5;
                ctx.strokeStyle = 'white';
                ctx.stroke();
              }

              const getShortLabel = (label, type) => {
                if (!label) return '';
                if (type === 'email') {
                  const parts = label.split('@');
                  if (parts.length === 2) return parts[0] + '@...';
                }
                if (type === 'url') {
                  try {
                    const url = new URL(label.startsWith('http') ? label : `http://${label}`);
                    const paths = url.pathname.split('/').filter(p => p);
                    if (paths.length > 0) return paths[paths.length - 1];
                    return url.hostname;
                  } catch(e) {}
                }
                if (label.length > 25) return label.substring(0, 22) + '...';
                return label;
              };

              const fullLabel = node.label || node.id;
              const label = (isHovered || isSelected) ? fullLabel : getShortLabel(fullLabel, node.type);
              const fontSize = (isHovered || isSelected) ? 12 / globalScale : 10 / globalScale;
              
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              const textWidth = ctx.measureText(label).width;
              const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);
              
              const yOffset = isCenter ? 16 : 14; 
              
              ctx.fillStyle = (isHovered || isSelected) ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.7)';
              ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + yOffset - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
              
              ctx.fillStyle = (isHovered || isSelected) ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
              ctx.fillText(label, node.x, node.y + yOffset);
            }}
          />
        )}
      </div>

      {/* Right Side Details & Explanation Panel */}
      {showExplanation && (
        <div className="w-[340px] max-w-[90vw] bg-card border-l border-border h-full flex flex-col z-20 shadow-[-4px_0_20px_rgba(0,0,0,0.25)] absolute right-0 top-0 overflow-hidden">
          {selectedNode ? (
            /* Mode 1: Selected Node Detailed Explanation */
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/20">
                <button 
                  onClick={() => setSelectedNode(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-accent-blue hover:text-accent-blue/80 transition-colors"
                >
                  <ArrowLeft size={14} /> Back to Overview
                </button>
                <button 
                  onClick={() => setShowExplanation(false)}
                  className="text-muted hover:text-primary transition-colors p-1"
                  title="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-6 flex-1 overflow-y-auto custom-scrollbar text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: NODE_COLORS[selectedNode.type] || NODE_COLORS.default }} />
                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted">
                      {TYPE_LABELS[selectedNode.type] || selectedNode.type || 'Unknown'}
                    </span>
                  </div>
                  <div className="text-sm font-bold font-mono text-primary break-words">
                    {selectedNode.label || selectedNode.id}
                  </div>
                </div>

                {/* Role in Investigation Callout */}
                <div className="p-3.5 rounded-xl bg-accent-violet/10 border border-accent-violet/20">
                  <div className="flex items-center gap-1.5 text-accent-violet text-[10px] uppercase font-bold tracking-wider mb-1">
                    <Info size={13} /> Role in Investigation
                  </div>
                  <p className="text-xs text-primary leading-relaxed">
                    {getNodeRoleExplanation(selectedNode, filteredData.links, filteredData.nodes)}
                  </p>
                </div>

                {selectedNode.metadata?.domain && selectedNode.type !== 'domain' && (
                  <div className="space-y-1 bg-secondary/30 p-2.5 rounded-lg border border-border/60">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted">Associated Domain</div>
                    <div className="text-xs font-semibold text-primary">{selectedNode.metadata.domain}</div>
                  </div>
                )}

                {['ip', 'domain', 'url', 'hash'].includes(selectedNode.type) && (
                  <div className="space-y-1 bg-secondary/30 p-2.5 rounded-lg border border-border/60">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted">Threat Intelligence</div>
                    <div className={`text-xs font-bold capitalize ${
                      selectedNode.metadata?.threat === 'malicious' ? 'text-danger' :
                      selectedNode.metadata?.threat === 'suspicious' ? 'text-warning' :
                      selectedNode.metadata?.threat === 'clean' ? 'text-success' : 'text-secondary'
                    }`}>
                      {selectedNode.metadata?.threat
                        ? selectedNode.metadata.threat.replace(/_/g, ' ')
                        : 'Not observed by provider'}
                    </div>
                  </div>
                )}

                {selectedNode.metadata?.city && (
                  <div className="space-y-1 bg-secondary/30 p-2.5 rounded-lg border border-border/60">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted">Location</div>
                    <div className="text-xs font-semibold text-primary">{selectedNode.metadata.city}</div>
                  </div>
                )}

                {/* Connected Relationships */}
                {selectedNodeRelationships.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted border-b border-border pb-1">
                      Connected Relationships ({selectedNodeRelationships.length})
                    </div>
                    <div className="space-y-2 pt-1 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {selectedNodeRelationships.map((rel, idx) => (
                        <div key={idx} className="p-2 rounded bg-secondary/40 border border-border/50 text-xs">
                          <div className="text-primary font-medium truncate">{rel.node?.label || rel.node?.id || 'Unknown'}</div>
                          <div className="text-[11px] text-muted font-mono flex items-center gap-1 mt-0.5">
                            <span className="text-accent-violet">↳</span> 
                            <span className="capitalize">{rel.direction === 'outgoing' ? rel.relType : `is ${rel.relType} by`}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-3 border-t border-border">
                  <button
                    onClick={() => {
                      const lines = [
                        `Type: ${TYPE_LABELS[selectedNode.type] || selectedNode.type}`,
                        `Value: ${selectedNode.label || selectedNode.id}`,
                        `Role: ${getNodeRoleExplanation(selectedNode, filteredData.links, filteredData.nodes)}`,
                        ...(selectedNode.metadata?.threat ? [`Threat: ${selectedNode.metadata.threat}`] : []),
                      ];
                      navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
                    }}
                    className="w-full flex items-center justify-center gap-2 p-2 bg-secondary/60 hover:bg-secondary text-primary rounded-lg transition-colors text-xs font-semibold border border-border"
                  >
                    <Copy size={13} className="text-muted" /> Copy Node Intelligence
                  </button>
                  {selectedNode.metadata?.indicatorDbId && (
                    <button
                      onClick={() => navigate(`/security/indicators/${selectedNode.metadata.indicatorDbId}`)}
                      className="w-full flex items-center justify-between p-2 bg-accent-blue/15 hover:bg-accent-blue/25 text-accent-blue rounded-lg transition-colors text-xs font-bold"
                    >
                      <span className="flex items-center gap-1.5"><ExternalLink size={13} /> View in Threat Intelligence</span>
                      <span>&rarr;</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Mode 2: Overarching Graph Story & Insights */
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/20">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-accent-violet" />
                  <h3 className="font-bold text-primary text-sm">Graph Insights & Story</h3>
                </div>
                <button 
                  onClick={() => setShowExplanation(false)}
                  className="text-muted hover:text-primary transition-colors p-1"
                  title="Close panel"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-6 flex-1 overflow-y-auto custom-scrollbar text-sm">
                {/* Executive Narrative */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted">Investigation Narrative</span>
                  <p className="text-xs text-secondary leading-relaxed">
                    This interactive topology maps the complete delivery chain and entity attack surface for{' '}
                    <span className="text-primary font-bold">"{graphNarrative.subject}"</span>.
                  </p>
                </div>

                {/* Architecture Highlights */}
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted">Topology Breakdown</span>
                  
                  {/* Sender & Identity */}
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border/70 flex items-start gap-2.5">
                    <Mail size={16} className="text-accent-blue flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-primary">Sender Identity</div>
                      <div className="text-[11px] text-muted font-mono break-all mt-0.5">{graphNarrative.from}</div>
                    </div>
                  </div>

                  {/* Relay Infrastructure */}
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border/70 flex items-start gap-2.5">
                    <Server size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-primary">Routing Infrastructure</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {graphNarrative.ipCount} server relay {graphNarrative.ipCount === 1 ? 'hop' : 'hops'} observed. Physical servers geolocate to{' '}
                        <span className="text-primary font-semibold">{graphNarrative.locations || 'Global endpoints'}</span>.
                      </div>
                    </div>
                  </div>

                  {/* External Ecosystem */}
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border/70 flex items-start gap-2.5">
                    <Globe size={16} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-primary">Domain & Link Ecosystem</div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {graphNarrative.domainCount} connected domains and {graphNarrative.urlCount} hyperlinks embedded in the message payload.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Threat Summary Pill */}
                <div className="p-3 rounded-xl border bg-secondary/20 border-border">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted mb-1.5">Threat Correlation</div>
                  {graphNarrative.flaggedCount > 0 ? (
                    <div className="flex items-center gap-2 text-danger text-xs font-bold">
                      <ShieldAlert size={15} />
                      <span>{graphNarrative.flaggedCount} entities flagged by threat intelligence providers</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                      <CheckCircle2 size={15} />
                      <span>All endpoints clean or unobserved on public blocklists</span>
                    </div>
                  )}
                </div>

                {/* How to use */}
                <div className="p-3 rounded-xl bg-accent-blue/10 border border-accent-blue/20 text-xs text-accent-blue leading-relaxed">
                  <span className="font-bold block mb-1">💡 Interactive Analysis:</span>
                  Click any entity node on the canvas to inspect its role, connected neighbors, and technical attributes.
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InvestigationGraph;
