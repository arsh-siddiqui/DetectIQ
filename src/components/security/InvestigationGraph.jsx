import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { Maximize2, Minimize2, X, Copy, ExternalLink } from 'lucide-react';

const NODE_COLORS = {
  investigation: '#3b82f6', // blue
  email: '#3b82f6', // blue
  person: '#10b981', // emerald
  ip: '#f59e0b', // amber
  domain: '#f59e0b', // amber
  url: '#0ea5e9', // light blue/cyan for URL
  hash: '#64748b', // slate
  attachment: '#06b6d4', // cyan
  location: '#84cc16', // lime
  asn: '#d946ef', // fuchsia
  default: '#9ca3af' // gray
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
  location: 'Location',
  asn: 'ASN'
};

const InvestigationGraph = ({ data }) => {
  const navigate = useNavigate();
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

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

  useEffect(() => {
    if (fgRef.current && data?.nodes?.length) {
      // Spread nodes further apart
      fgRef.current.d3Force('charge').strength(-400);
      fgRef.current.d3Force('link').distance(60);
      
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 80); // Increase padding to zoom out slightly, but with spread nodes it will look bigger
      }, 500);
    }
  }, [data]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(3, 1000);
    }
  }, []);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const presentTypes = useMemo(() => {
    if (!data || !data.nodes) return [];
    const types = new Set(data.nodes.map(n => n.type));
    return Array.from(types).sort();
  }, [data]);

  // Find relationships for the selected node
  const selectedNodeRelationships = useMemo(() => {
    if (!selectedNode || !data || !data.links) return [];
    return data.links.filter(
      link => (link.source.id || link.source) === selectedNode.id || (link.target.id || link.target) === selectedNode.id
    ).map(link => {
      const isSource = (link.source.id || link.source) === selectedNode.id;
      const otherNodeId = isSource ? (link.target.id || link.target) : (link.source.id || link.source);
      const otherNode = data.nodes.find(n => n.id === otherNodeId);
      return {
        direction: isSource ? 'outgoing' : 'incoming',
        relType: link.label || link.relationship || 'links to',
        node: otherNode
      };
    });
  }, [selectedNode, data]);

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
        {/* Controls */}
        <div className="absolute top-4 right-4 z-10 flex space-x-2">
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

        <ForceGraph2D
          ref={fgRef}
          width={selectedNode ? dimensions.width - 320 : dimensions.width}
          height={dimensions.height}
          graphData={data}
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
            const rel = link.label || link.relationship || link.type || 'links to';
            return `${source} → ${rel} → ${target}`;
          }}
          onNodeClick={handleNodeClick}
          onBackgroundClick={handleBackgroundClick}
          onNodeHover={setHoveredNode}
          backgroundColor="transparent"
          nodeCanvasObject={(node, ctx, globalScale) => {
            const isHovered = hoveredNode === node;
            const isSelected = selectedNode === node;
            const isCenter = node.type === 'investigation';
            const color = NODE_COLORS[node.type] || NODE_COLORS.default;
            
            ctx.beginPath();
            
            if (isCenter) {
              // Draw a larger central node
              ctx.arc(node.x, node.y, 9, 0, 2 * Math.PI, false);
            } else if (node.type === 'person') {
              ctx.rect(node.x - 5, node.y - 5, 10, 10);
            } else {
              ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
            }
            
            ctx.fillStyle = color;
            ctx.fill();

            // Border
            if (isSelected || isHovered || isCenter) {
              ctx.lineWidth = isCenter ? 2 : 1.5;
              ctx.strokeStyle = 'white';
              ctx.stroke();
            }

            const getShortLabel = (label, type) => {
              if (!label) return '';
              // Don't modify person labels
              if (type === 'email') {
                const parts = label.split('@');
                if (parts.length === 2) return parts[0] + '@...';
              }
              if (type === 'url') {
                try {
                  const url = new URL(label);
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
            
            // Push the label further down depending on the node size to prevent overlap
            const yOffset = isCenter ? 16 : 14; 
            
            ctx.fillStyle = (isHovered || isSelected) ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.7)';
            ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + yOffset - bckgDimensions[1] / 2, bckgDimensions[0], bckgDimensions[1]);
            
            ctx.fillStyle = (isHovered || isSelected) ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
            ctx.fillText(label, node.x, node.y + yOffset);
          }}
        />
      </div>

      {/* Right Side Details Panel */}
      {selectedNode && (
        <div className="w-[320px] bg-card border-l border-border h-full flex flex-col z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.1)] absolute right-0 top-0 overflow-y-auto">
          <div className="p-4 border-b border-border flex justify-between items-start bg-secondary/20">
            <h3 className="font-semibold text-primary">Node Details</h3>
            <button 
              onClick={() => setSelectedNode(null)}
              className="text-muted hover:text-primary transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-7 flex-1 text-sm">
            
            {/* Main Identification */}
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted">{TYPE_LABELS[selectedNode.type] || selectedNode.type || 'Unknown'}</div>
              <div className="text-sm font-medium text-primary break-all">{selectedNode.label || selectedNode.id}</div>
            </div>

            {selectedNode.metadata?.domain && selectedNode.type !== 'domain' && (
               <div className="space-y-1">
                 <div className="text-[10px] uppercase tracking-wider font-bold text-muted">Domain</div>
                 <div className="text-sm font-medium text-primary">{selectedNode.metadata.domain}</div>
               </div>
            )}

            {['ip', 'domain', 'url', 'hash'].includes(selectedNode.type) && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted">Threat Intelligence</div>
                <div className="text-sm font-medium text-primary capitalize">
                  {selectedNode.metadata?.threat
                    ? selectedNode.metadata.threat.replace(/_/g, ' ')
                    : 'Not observed by provider'}
                </div>
              </div>
            )}

            {selectedNode.metadata?.city && (
               <div className="space-y-1">
                 <div className="text-[10px] uppercase tracking-wider font-bold text-muted">Location</div>
                 <div className="text-sm font-medium text-primary">{selectedNode.metadata.city}</div>
               </div>
            )}

            {selectedNode.metadata?.org && (
               <div className="space-y-1">
                 <div className="text-[10px] uppercase tracking-wider font-bold text-muted">Organization</div>
                 <div className="text-sm font-medium text-primary">{selectedNode.metadata.org}</div>
               </div>
            )}

            {/* Relationships */}
            {selectedNodeRelationships.length > 0 && (
              <div className="space-y-2">
                 <div className="text-[10px] uppercase tracking-wider font-bold text-muted border-b border-border pb-1">Relationships</div>
                 <div className="space-y-3 pt-1">
                   {selectedNodeRelationships.map((rel, idx) => (
                     <div key={idx} className="space-y-0.5">
                       <div className="text-primary font-medium truncate">{rel.node?.label || rel.node?.id || 'Unknown'}</div>
                       <div className="text-xs text-muted font-mono flex gap-1">
                         <span className="text-accent-violet">↳</span> {rel.direction === 'outgoing' ? rel.relType : `is ${rel.relType} by this node`}
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-4 border-t border-border">
               <button
                 onClick={() => {
                   const lines = [
                     `Type: ${TYPE_LABELS[selectedNode.type] || selectedNode.type}`,
                     `Value: ${selectedNode.label || selectedNode.id}`,
                     ...(selectedNode.metadata?.threat ? [`Threat: ${selectedNode.metadata.threat}`] : []),
                     ...(selectedNode.metadata?.severity ? [`Severity: ${selectedNode.metadata.severity}`] : []),
                     ...(selectedNode.metadata?.provider ? [`Provider: ${selectedNode.metadata.provider}`] : []),
                   ];
                   navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
                 }}
                 className="w-full flex items-center gap-2 p-2 bg-secondary/50 hover:bg-secondary text-primary rounded-md transition-colors text-sm font-medium border border-border"
               >
                 <Copy size={14} className="text-muted" /> Copy Info
               </button>
               {selectedNode.metadata?.indicatorDbId ? (
                 <button
                   onClick={() => navigate(`/security/indicators/${selectedNode.metadata.indicatorDbId}`)}
                   className="w-full flex items-center justify-between p-2 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue rounded-md transition-colors text-sm font-medium"
                 >
                   <span className="flex items-center gap-2"><ExternalLink size={14} /> View Indicator</span>
                   <span className="text-xs font-bold">→</span>
                 </button>
               ) : (
                 <button
                   disabled
                   className="w-full flex items-center justify-between p-2 bg-secondary/30 text-muted rounded-md text-sm font-medium cursor-not-allowed opacity-50"
                   title="No indicator record for this node"
                 >
                   <span className="flex items-center gap-2"><ExternalLink size={14} /> View Indicator</span>
                   <span className="text-xs">N/A</span>
                 </button>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestigationGraph;
