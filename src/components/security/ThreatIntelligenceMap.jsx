import React, { useRef, useEffect, useState, useMemo } from "react";


import { Shield, Info, Map as MapIcon, RotateCcw, AlertTriangle, Maximize2, Minimize2 } from "lucide-react";

import { indicatorToGeoPoints, buildMapGeoJSON } from "../../utils/intelligenceMapping";

const THREAT_COLORS = {
  malicious: "#ef4444",
  suspicious: "#f97316",
  clean: "#22c55e",
  unavailable: "#94a3b8",
  unknown: "#6b7280",
};

export default function ThreatIntelligenceMap({ markers = [], isLoading = false, selectedIndicatorId = null, totalIndicators = null }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 100);
  };

  const geoPoints = useMemo(() => {
    return markers.flatMap(indicatorToGeoPoints).filter(Boolean);
  }, [markers]);

  const geoJsonData = useMemo(() => buildMapGeoJSON(geoPoints), [geoPoints]);
  const validPointsCount = geoJsonData.features.length;

  // Track latest data in refs to avoid stale closures in map load event
  const geoJsonRef = useRef(geoJsonData);
  const selectedIndicatorIdRef = useRef(selectedIndicatorId);

  useEffect(() => {
    geoJsonRef.current = geoJsonData;
  }, [geoJsonData]);

  useEffect(() => {
    selectedIndicatorIdRef.current = selectedIndicatorId;
  }, [selectedIndicatorId]);

  useEffect(() => {
    if (mapError) return;
    if (mapRef.current) return; // Initialize map only once

    let resizeObserver = null;

    try {
      const map = new window.maplibregl.Map({
        container: mapContainer.current,
        style: `https://tiles.openfreemap.org/styles/positron`,
        center: [0, 20],
        zoom: 1.5,
        attributionControl: false,
      });
      
      mapRef.current = map;

      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.resize();
      });
      if (mapContainer.current) {
        resizeObserver.observe(mapContainer.current);
      }

      map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(new window.maplibregl.AttributionControl({ customAttribution: 'OpenStreetMap contributors' }), 'bottom-left');

      map.on('error', (e) => {
        // Prevent generic errors from crashing the UI, only log
        console.warn("MapLibre non-fatal error:", e);
      });

      map.on('load', () => {
        setTimeout(() => {
          if (mapRef.current) mapRef.current.resize();
        }, 100);

        map.addSource('locations', {
          type: 'geojson',
          data: geoJsonRef.current,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'locations',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#1e40af',
            'circle-radius': ['step', ['get', 'point_count'], 15, 10, 22, 50, 30],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#0f172a',
          },
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'locations',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'locations',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'match',
              ['get', 'threat'],
              'malicious', THREAT_COLORS.malicious,
              'suspicious', THREAT_COLORS.suspicious,
              'clean', THREAT_COLORS.clean,
              'unavailable', THREAT_COLORS.unavailable,
              THREAT_COLORS.unknown
            ],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#0d1117',
          },
        });

        // Add subtle glow layer for unclustered points removed for clarity

        // Click on cluster
        map.on('click', 'clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
          if (!features.length) return;

          const clusterId = features[0].properties.cluster_id;
          const pointCount = features[0].properties.point_count;
          
          map.getSource('locations').getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            
            const coordinates = features[0].geometry.coordinates.slice();
            const popupHtml = `
              <div class="p-2 min-w-[150px] text-gray-900">
                <div class="font-bold text-sm mb-1 text-center">${pointCount} indicators in this area</div>
                <div class="text-xs text-gray-500 text-center mb-2">Zoom in to explore</div>
                <button id="zoom-cluster-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm transition-colors">
                  Zoom
                </button>
              </div>
            `;
            
            const popup = new window.maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              className: 'detectiq-map-popup'
            }).setLngLat(coordinates)
              .setHTML(popupHtml)
              .addTo(map);

            document.getElementById('zoom-cluster-btn')?.addEventListener('click', () => {
              popup.remove();
              map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom + 1 });
            });
          });
        });

        // Click on individual point
        map.on('click', 'unclustered-point', (e) => {
          openIndicatorPopup(e.features[0]);
        });

        map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
        map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = ''; });

        if (geoJsonRef.current.features.length > 0) {
          setTimeout(() => {
            fitLocations(true); // pass true for initial fit
          }, 300);
        }
      });
      
    } catch (err) {
      console.error("Map initialization failed", err);
      setMapError(true);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update data if it changes
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      const source = mapRef.current.getSource('locations');
      if (source) {
        source.setData(geoJsonData);
        // Only fit locations if not zooming to a specific indicator
        if (validPointsCount > 0 && !selectedIndicatorIdRef.current) {
          setTimeout(() => {
            fitLocations();
          }, 200);
        }
      }
    }
  }, [geoJsonData, validPointsCount]);

  // Handle selectedIndicatorId focusing
  useEffect(() => {
    if (selectedIndicatorId && mapRef.current && mapRef.current.isStyleLoaded()) {
      const feature = geoJsonData.features.find(f => f.properties.id === selectedIndicatorId);
      if (feature) {
        mapRef.current.flyTo({
          center: feature.geometry.coordinates,
          zoom: 12,
          essential: true
        });
        openIndicatorPopup(feature);
      }
    }
  }, [selectedIndicatorId, geoJsonData]);

  // Handle Resize globally
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const openIndicatorPopup = (feature) => {
    if (!mapRef.current) return;

    const coordinates = feature.geometry.coordinates.slice();
    const props = feature.properties;

    // Ensure that if the map is zoomed out such that
    // multiple copies of the feature are visible, the
    // popup appears over the copy being pointed to.
    while (Math.abs(mapRef.current.getCenter().lng - coordinates[0]) > 180) {
      coordinates[0] += mapRef.current.getCenter().lng > coordinates[0] ? 360 : -360;
    }
    
    const locationText = [props.city, props.country].filter(Boolean).join(" · ");
    const threatColor = THREAT_COLORS[props.threat] || THREAT_COLORS.unknown;

    // Add source text mapping
    const sourceLabelMap = {
      'direct_ip': 'Direct IP',
      'resolved_ip': 'DNS-resolved IP',
      'received_header_ip': 'Received-header IP'
    };
    const sourceText = sourceLabelMap[props.sourceType] || props.sourceType || 'Direct IP';

    const popupHtml = `
      <div class="p-1 min-w-[240px] text-gray-900 flex flex-col h-full">
        <div class="flex flex-col gap-1 mb-3 pb-3 border-b border-gray-200">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style="background-color: ${threatColor}"></div>
            <span class="font-mono text-[15px] font-bold truncate max-w-[200px]" title="${props.ip}">${props.ip}</span>
          </div>
          <div class="text-[10px] uppercase font-bold text-gray-500 tracking-wider flex items-center justify-between">
            <span>${props.type}</span>
            <span style="color: ${threatColor}" class="capitalize">${props.threat}</span>
          </div>
        </div>
        
        <div class="space-y-2 text-[11px] text-gray-600 mb-4">
          ${locationText ? `<div class="font-medium text-gray-800 flex items-center gap-1.5"><span class="text-gray-400">📍</span> ${locationText}</div>` : ''}
          <div class="text-gray-500 italic">Source: ${sourceText}</div>
          ${props.asn || props.isp ? `
            <div class="flex flex-col gap-0.5 bg-gray-50 p-2 rounded border border-gray-100">
              ${props.isp ? `<div class="truncate text-gray-800 font-medium" title="${props.isp}">${props.isp}</div>` : ''}
              ${props.asn ? `<div class="text-gray-500">${props.asn}</div>` : ''}
            </div>
          ` : ''}
          ${props.abuseIpDbStatus === 'available' && props.abuseReports > 0 ? `
            <div class="mt-2 flex flex-col gap-0.5 bg-red-50 p-2 rounded border border-red-100">
              <div class="text-[10px] font-bold text-red-800 uppercase tracking-wider">AbuseIPDB</div>
              <div class="flex justify-between items-center text-red-700 font-medium">
                <span>Confidence: ${props.abuseConfidenceScore}%</span>
                <span>Reports: ${props.abuseReports}</span>
              </div>
            </div>
          ` : ''}
          ${props.urlhausStatus === 'available' ? `
            <div class="mt-2 flex flex-col gap-0.5 ${props.urlhausThreat === 'malicious' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'} p-2 rounded border">
              <div class="text-[10px] font-bold ${props.urlhausThreat === 'malicious' ? 'text-red-800' : 'text-gray-600'} uppercase tracking-wider">URLhaus</div>
              <div class="flex justify-between items-center ${props.urlhausThreat === 'malicious' ? 'text-red-700' : 'text-gray-600'} font-medium">
                <span>${props.urlhausThreat === 'malicious' ? 'Malicious URL' : 'Available'}</span>
              </div>
            </div>
          ` : ''}
          ${props.otxStatus === 'available' && props.otxPulseCount > 0 ? `
            <div class="mt-2 flex flex-col gap-0.5 bg-orange-50 border-orange-100 p-2 rounded border">
              <div class="text-[10px] font-bold text-orange-800 uppercase tracking-wider">AlienVault OTX</div>
              <div class="flex justify-between items-center text-orange-700 font-medium">
                <span>Observed in ${props.otxPulseCount} pulse${props.otxPulseCount > 1 ? 's' : ''}</span>
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="mt-auto pt-2 border-t border-gray-200 flex items-center gap-2">
          <button id="copy-indicator-btn-${props.id}" class="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 px-2 rounded transition-colors text-xs font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
          <a href="/security/indicators/${props.id}" class="flex-[2] flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded transition-colors text-xs font-bold">
            View Indicator 
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        </div>
      </div>
    `;

    // Remove old popups if they exist
    const existingPopups = document.querySelectorAll('.maplibregl-popup');
    existingPopups.forEach(p => p.remove());

    new window.maplibregl.Popup({ className: 'custom-popup' })
      .setLngLat(coordinates)
      .setHTML(popupHtml)
      .addTo(mapRef.current);

    // Bind event listeners
    setTimeout(() => {
      const copyBtn = document.getElementById(`copy-indicator-btn-${props.id}`);
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(props.ip);
          const originalHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-600"><polyline points="20 6 9 17 4 12"></polyline></svg> <span class="text-green-700">Copied</span>`;
          copyBtn.classList.remove('bg-gray-100', 'text-gray-700');
          copyBtn.classList.add('bg-green-100', 'border-green-200');
          setTimeout(() => {
            if (document.body.contains(copyBtn)) {
              copyBtn.innerHTML = originalHtml;
              copyBtn.classList.add('bg-gray-100', 'text-gray-700');
              copyBtn.classList.remove('bg-green-100', 'border-green-200');
            }
          }, 2000);
        });
      }
    }, 0);
  };

  const fitLocations = (initial = false) => {
    const currentGeoJson = geoJsonRef.current;
    const currentValidPointsCount = currentGeoJson.features.length;
    const currentSelectedId = selectedIndicatorIdRef.current;

    if (!mapRef.current || currentValidPointsCount === 0) return;
    
    // If selectedIndicatorId exists, we shouldn't fit to all locations,
    // the other useEffect will fly to the specific indicator
    if (currentSelectedId && initial) return;

    if (currentValidPointsCount === 1) {
      const p = currentGeoJson.features[0].geometry.coordinates;
      mapRef.current.flyTo({
        center: p,
        zoom: 8,
        essential: true
      });
      return;
    }

    const bounds = new window.maplibregl.LngLatBounds();
    currentGeoJson.features.forEach(f => {
      if (Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length === 2) {
        bounds.extend(f.geometry.coordinates);
      }
    });
    
    if (!bounds.isEmpty()) {
      try {
        mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
      } catch (err) {
        console.warn("fitBounds failed, possibly due to zero map dimensions", err);
      }
    }
  };

  const resetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [0, 20], zoom: 1.5, essential: true });
    }
  };

  if (mapError) {
    return (
      <div className="w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-border bg-[#0d1117] flex flex-col items-center justify-center relative shadow-inner">
        <div className="text-center bg-secondary/80 rounded-xl px-8 py-6 border border-border max-w-md mx-4 space-y-3">
          <MapIcon className="w-10 h-10 text-muted mx-auto mb-2 opacity-50" />
          <h3 className="text-lg font-bold text-primary">Map unavailable</h3>
          <p className="text-sm text-secondary font-medium">
            Threat intelligence data is still available below.
          </p>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted pt-2 border-t border-border mt-3">
            <AlertTriangle size={12} />
            <span>IP geolocation is approximate.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[520px] rounded-2xl overflow-hidden border border-border bg-[#0d1117] shadow-lg ${isFullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''}`}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border/50 bg-[#0d1117]/80 backdrop-blur-sm z-10 absolute top-0 left-0 right-0">
        <Info className="w-4 h-4 text-secondary flex-shrink-0" />
        <span className="text-xs text-secondary font-medium truncate">
          Approximate IP location — IP geolocation is not precise and does not imply device location
        </span>
      </div>

      <div ref={mapContainer} className="absolute inset-0 z-0" />
      
      <div className="absolute top-16 right-4 z-10 flex flex-col gap-2">
        <button 
          onClick={toggleFullscreen}
          className="bg-[#1e293b]/90 border border-slate-700 p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg backdrop-blur"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button 
          onClick={() => fitLocations()}
          className="bg-[#1e293b]/90 border border-slate-700 p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg backdrop-blur"
          title="Fit Locations"
        >
          <MapIcon size={16} />
        </button>
        <button 
          onClick={resetView}
          className="bg-[#1e293b]/90 border border-slate-700 p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg backdrop-blur"
          title="Reset View"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-3 z-10">
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-lg px-3 py-2 shadow-xl flex items-center gap-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Threat Status:</div>
          <div className="flex flex-row items-center gap-3 flex-wrap">
            {Object.entries(THREAT_COLORS)
              .filter(([threat]) => !['unavailable', 'unknown'].includes(threat))
              .map(([threat, color]) => (
              <div key={threat} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-slate-300 capitalize font-medium">{threat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {validPointsCount > 0 && (
        <div className="absolute bottom-4 right-4 z-10">
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-lg px-3 py-1.5 shadow-lg group relative cursor-help">
            <span className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              {totalIndicators ? `Showing ${validPointsCount} location${validPointsCount !== 1 ? "s" : ""} from ${totalIndicators} indicator${totalIndicators !== 1 ? "s" : ""}` : `${validPointsCount} geolocated location${validPointsCount !== 1 ? "s" : ""}`}
              <Info size={12} className="text-slate-400 ml-1" />
            </span>
            {/* Tooltip to explain why counts differ */}
            <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-[#1e293b] border border-slate-700 rounded-lg text-xs text-slate-300 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50">
              Only indicators with a valid physical location (IPs and resolved Domains) can be plotted on the map. Hashes, email addresses, and private IPs do not have geographic coordinates.
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-[#0d1117]/60 flex items-center justify-center z-20 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-slate-700 px-5 py-3 rounded-xl text-sm font-medium text-white flex items-center gap-3 shadow-2xl">
            <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            Updating Map...
          </div>
        </div>
      )}

      {/* Empty State Overlay if Map is loaded but no points */}
      {!isLoading && validPointsCount === 0 && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
          <div className="bg-[#0f172a]/90 border border-slate-800 px-8 py-6 rounded-2xl text-center backdrop-blur-md shadow-2xl max-w-sm pointer-events-auto">
            <Shield className="w-10 h-10 text-slate-500 mx-auto mb-3 opacity-80" />
            <h3 className="text-white font-bold text-lg mb-1">No geolocated indicators</h3>
            <p className="text-sm text-slate-400 font-medium">Try adjusting your filters or search terms.</p>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .custom-popup .maplibregl-popup-content {
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
          padding: 12px;
          border: 1px solid #e2e8f0;
        }
        .custom-popup .maplibregl-popup-close-button {
          font-size: 18px;
          color: #94a3b8;
          padding: 4px 6px;
          border-radius: 0 12px 0 0;
          transition: all 0.2s;
        }
        .custom-popup .maplibregl-popup-close-button:hover {
          color: #0f172a;
          background: #f1f5f9;
        }
        .custom-popup .maplibregl-popup-tip {
          border-top-color: #fff;
        }
      `}} />
    </div>
  );
}
