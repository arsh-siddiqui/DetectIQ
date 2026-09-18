import React, { useRef, useEffect, useState, useMemo } from "react";


import { Shield, Info, Map as MapIcon, RotateCcw, AlertTriangle, Maximize2, Minimize2, ZoomIn, ZoomOut, Expand } from "lucide-react";
import { createRoot } from "react-dom/client";
import { useNavigate } from "react-router-dom";

import { indicatorToGeoPoints, buildMapGeoJSON } from "../../utils/intelligenceMapping";
import ThreatMapPopup from "./ThreatMapPopup";

const THREAT_COLORS = {
  malicious: "#ef4444",
  suspicious: "#f97316",
  clean: "#22c55e",
  unavailable: "#94a3b8",
  unknown: "#6b7280",
};

export default function ThreatIntelligenceMap({ markers = [], isLoading = false, selectedIndicatorId = null, totalIndicators = null, selectedCountry = 'all' }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigate = useNavigate();

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      if (mapRef.current) mapRef.current.resize();
    }, 100);
  };

  const geoPoints = useMemo(() => {
    let points = markers.flatMap(indicatorToGeoPoints).filter(Boolean);
    if (selectedCountry && selectedCountry !== 'all') {
      points = points.filter(p => p.country === selectedCountry);
    }
    return points;
  }, [markers, selectedCountry]);

  const geoJsonData = useMemo(() => buildMapGeoJSON(geoPoints), [geoPoints]);
  const validPointsCount = geoJsonData.features.length;

  // Track latest data in refs to avoid stale closures in map load event
  const geoJsonRef = useRef(geoJsonData);
  const selectedIndicatorIdRef = useRef(selectedIndicatorId);
  const markersRef = useRef(markers);
  const activePopupRef = useRef(null);
  const activePopupRootRef = useRef(null);

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

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
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        keyboard: false,
        attributionControl: false,
      });
      
      mapRef.current = map;

      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.resize();
      });
      if (mapContainer.current) {
        resizeObserver.observe(mapContainer.current);
      }

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
          cluster: false,
        });

        map.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'locations',
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
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#0d1117',
          },
        });

        // Add subtle glow layer for unclustered points removed for clarity

        // Click on individual point
        map.on('click', 'unclustered-point', (e) => {
          openIndicatorPopup(e.features[0]);
        });

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
  }, [mapError]);

  // Update data if it changes
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      const source = mapRef.current.getSource('locations');
      if (source) {
        source.setData(geoJsonData);
        
        // Validate active popup
        if (activePopupRef.current && activePopupRef.current._popupData) {
          const { indicatorIds } = activePopupRef.current._popupData;
          if (indicatorIds) {
            let ids = [];
            try {
              ids = JSON.parse(indicatorIds || '[]');
            } catch (e) {}
            
            // Check if ALL of the indicator IDs in the active popup still exist in the CURRENT filtered markers
            // If even one is missing (meaning the filter removed it), we close the popup to prevent stale data display.
            const allValid = ids.every(id => markersRef.current.some(m => (m.id || m._id) === id));
            if (!allValid) {
              activePopupRef.current.remove();
              activePopupRef.current = null;
            }
          }
        }

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
    const popupNode = document.createElement('div');
    const root = createRoot(popupNode);
    activePopupRootRef.current = root;
    
    // We pass a function reference that ThreatMapPopup can call if it determines it is totally empty
    const forceClose = () => {
      if (activePopupRef.current) {
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }
    };

    const handleViewIndicators = (ids) => {
      if (ids && ids.length > 0) {
        navigate(`/security/indicators?ids=${encodeURIComponent(ids.join(','))}`);
      }
    };
    
    root.render(
      <ThreatMapPopup 
        feature={feature} 
        filteredIndicators={markersRef.current} 
        forceClose={forceClose} 
        onViewIndicators={handleViewIndicators} 
      />
    );

    // Remove old popups if they exist
    if (activePopupRef.current) {
      activePopupRef.current.remove();
    }
    const existingPopups = document.querySelectorAll('.maplibregl-popup');
    existingPopups.forEach(p => p.remove());

    const popup = new window.maplibregl.Popup({ 
      className: 'custom-popup-react',
      maxWidth: '360px',
      anchor: 'bottom',
      offset: [0, -10]
    })
      .setLngLat(coordinates)
      .setDOMContent(popupNode)
      .addTo(mapRef.current);
      
    // Store data inside popup object to validate later against filters
    popup._popupData = { indicatorIds: props.indicatorIds };
    activePopupRef.current = popup;

    // Unmount React component when popup closes to prevent memory leaks
    popup.on('close', () => {
      if (activePopupRef.current === popup) {
        activePopupRef.current = null;
      }
      setTimeout(() => {
        root.unmount();
      }, 0);
    });
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

  const handleZoom = (inOut) => {
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.easeTo({ zoom: inOut === 'in' ? currentZoom + 1 : currentZoom - 1 });
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
      
      <div className="absolute top-16 right-4 z-10 flex flex-col gap-1.5">
        <button 
          onClick={() => handleZoom('in')}
          className="bg-[#1e293b]/90 border border-slate-700 p-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg backdrop-blur"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button 
          onClick={() => handleZoom('out')}
          className="bg-[#1e293b]/90 border border-slate-700 p-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg backdrop-blur"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button 
          onClick={() => fitLocations()}
          className="bg-[#1e293b]/90 border border-slate-700 p-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg backdrop-blur"
          title="Fit Locations"
        >
          <Expand size={16} />
        </button>
        <button 
          onClick={resetView}
          className="bg-[#1e293b]/90 border border-slate-700 p-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg backdrop-blur"
          title="Reset View"
        >
          <RotateCcw size={16} />
        </button>
        <button 
          onClick={toggleFullscreen}
          className="bg-[#1e293b]/90 border border-slate-700 p-2 rounded text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow-lg backdrop-blur mt-2"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-3 z-10">
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-lg px-3 py-2 shadow-xl flex items-center gap-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Threat Status:</div>
          <div className="flex flex-row items-center gap-3 flex-wrap">
            {Object.entries(THREAT_COLORS).map(([threat, color]) => (
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
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
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
