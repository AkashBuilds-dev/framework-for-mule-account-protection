/**
 * ==============================================================================
 * MuleShield (SIH26184) - Geospatial Tactical Risk Map (Google Maps JavaScript API)
 * ==============================================================================
 * Replaces MapLibre GL with Google Maps JavaScript API:
 * - Custom Dark Mode styling matching the #0A0E1A forensic palette
 * - 449-cell uniform urban risk grid rendered as Google Maps Data Layer GeoJSON polygons
 * - Choropleth color styling (Red >0.85, Amber 0.50-0.85, Green <0.50)
 * - Top 5 predicted cash-out zones with custom red pulsing SVG markers
 * - Cyan markers for ATM cash points & case severity markers
 * - Interactive InfoWindow on marker / cell click
 * - Smooth Auto-Fit camera to loaded Indian risk cells with Reset View button
 * - Clean loading spinner and layer toggles (Grid, Top 5, Arcs)
 * ==============================================================================
 * Budget Warning:
 * // Google Maps free tier: $200/month credit
 * // Demo uses ~$0.50/hour at current rate
 * ==============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline, Polygon } from '@react-google-maps/api';
import { RotateCcw, ShieldAlert, Layers, Navigation } from 'lucide-react';
import { useAppStore } from '../store/appStore';

// Google Maps API Key strictly loaded from .env
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const LIBRARIES = ['places', 'visualization'];

// Dark Mode Theme JSON for Google Maps matching MuleShield #0A0E1A UI
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0A0E1A' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0E1A' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1F2937' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0F172A' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#111827' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1E293B' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
];

// Custom SVGs for Map Markers
const PULSING_RED_PIN = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
  <circle cx="19" cy="19" r="16" fill="%23EF4444" fill-opacity="0.3"/>
  <circle cx="19" cy="19" r="10" fill="%23EF4444" stroke="%23FFFFFF" stroke-width="2.5"/>
  <circle cx="19" cy="19" r="3.5" fill="%23FFFFFF"/>
</svg>`;

const CYAN_ATM_PIN = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <circle cx="11" cy="11" r="8" fill="%2306B6D4" stroke="%23FFFFFF" stroke-width="1.8"/>
  <circle cx="11" cy="11" r="3" fill="%230A0E1A"/>
</svg>`;

const CASE_VICTIM_PIN = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <path d="M14 2C8.5 2 4 6.5 4 12c0 7.5 10 14 10 14s10-6.5 10-14c0-5.5-4.5-10-10-10z" fill="%23F59E0B" stroke="%23FFFFFF" stroke-width="1.5"/>
  <circle cx="14" cy="12" r="3.5" fill="%230A0E1A"/>
</svg>`;

export default function RiskMap() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const { gridGeojson, topZones, selectedCase, mapTarget, loading } = useAppStore();

  const [map, setMap] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeInfo, setActiveInfo] = useState(null);
  const [layers, setLayers] = useState({
    grid: true,
    topZones: true,
    atms: true,
    arcs: true,
  });

  // Default Center of India
  const defaultCenter = useMemo(() => ({ lat: 22.5, lng: 78.9 }), []);

  // Map configuration options
  const mapOptions = useMemo(
    () => ({
      styles: DARK_MAP_STYLE,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      backgroundColor: '#0A0E1A',
    }),
    []
  );

  // Auto-fit bounds to the loaded risk cells so India stays prominent.
  const fitToRiskGrid = useCallback(() => {
    if (!map || !window.google || !Array.isArray(gridGeojson?.features)) return;
    const bounds = new window.google.maps.LatLngBounds();
    gridGeojson.features.forEach((feature) => {
      const ring = feature?.geometry?.type === 'Polygon' ? feature.geometry.coordinates?.[0] : [];
      ring?.forEach(([lng, lat]) => {
        if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
          bounds.extend({ lat: Number(lat), lng: Number(lng) });
        }
      });
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
    }
  }, [map, gridGeojson]);

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const onMapIdle = useCallback(() => {
    setMapReady(true);
  }, []);

  const getRiskPolygonStyle = useCallback((riskScore) => {
    if (riskScore > 0.85) {
      return {
        fillColor: '#EF4444',
        fillOpacity: 0.72,
        strokeColor: '#EF4444',
        strokeOpacity: 0.9,
        strokeWeight: 2,
      };
    }

    if (riskScore >= 0.5) {
      return {
        fillColor: '#F59E0B',
        fillOpacity: 0.66,
        strokeColor: '#F59E0B',
        strokeOpacity: 0.9,
        strokeWeight: 1.75,
      };
    }

    return {
      fillColor: '#10B981',
      fillOpacity: 0.6,
      strokeColor: '#34D399',
      strokeOpacity: 0.9,
      strokeWeight: 1.25,
    };
  }, []);

  // Explicit React Polygon children are more reliable than an imperative map.data layer.
  // GeoJSON is [lng, lat]; Google Maps Polygon paths are { lat, lng }.
  const gridPolygons = useMemo(() => {
    if (!Array.isArray(gridGeojson?.features)) return [];

    return gridGeojson.features
      .filter((feature) => feature?.geometry?.type === 'Polygon')
      .map((feature, index) => {
        const paths = (feature.geometry.coordinates?.[0] || [])
          .map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }))
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

        return {
          id: feature.properties?.cell_id || `grid-cell-${index}`,
          paths,
          properties: feature.properties || {},
        };
      })
      .filter((cell) => cell.paths.length >= 3);
  }, [gridGeojson]);

  // Log the API payload and the mounted overlay count for browser-console diagnosis.
  useEffect(() => {
    if (!mapReady) return;
    const receivedFeatureCount = Array.isArray(gridGeojson?.features) ? gridGeojson.features.length : 0;
    console.log(`[RiskMap] Grid GeoJSON received: ${receivedFeatureCount} features.`);
    console.log(`[RiskMap] Polygon overlays mounted: ${layers.grid ? gridPolygons.length : 0} features.`);
  }, [mapReady, gridGeojson, gridPolygons.length, layers.grid]);

  useEffect(() => {
    if (mapReady && gridPolygons.length) fitToRiskGrid();
  }, [mapReady, gridPolygons.length, fitToRiskGrid]);

  // Sync Map Camera on External mapTarget change
  useEffect(() => {
    if (!map || !mapTarget) return;
    map.panTo({ lat: Number(mapTarget.lat), lng: Number(mapTarget.lon) });
    map.setZoom(mapTarget.zoom || 12);
  }, [map, mapTarget]);

  // Compute Arcs (Lines) from Selected Case victim to top forecasted cash-out zones
  const arcCoordinates = useMemo(() => {
    if (!selectedCase || !selectedCase.predicted_cashout_zones?.length || !layers.arcs) {
      return [];
    }
    const vLat = Number(selectedCase.victim_info?.lat);
    const vLon = Number(selectedCase.victim_info?.lon);
    if (!vLat || !vLon) return [];

    return selectedCase.predicted_cashout_zones.map((zone) => [
      { lat: vLat, lng: vLon },
      { lat: Number(zone.lat), lng: Number(zone.lon) },
    ]);
  }, [selectedCase, layers.arcs]);

  // Extract Top ATMs from zones for cyan markers
  const nearbyAtms = useMemo(() => {
    if (!layers.atms || !topZones?.length) return [];
    const points = [];
    topZones.slice(0, 8).forEach((zone) => {
      if (zone.nearest_atms && Array.isArray(zone.nearest_atms)) {
        zone.nearest_atms.forEach((atm, i) => {
          // slight deterministic offset for visual display
          const offsetLat = (i - 1) * 0.003;
          const offsetLon = (i - 1) * 0.0025;
          points.push({
            id: `${zone.cell_id}-atm-${i}`,
            name: typeof atm === 'string' ? atm : `ATM Hub #${i + 1}`,
            city: zone.city,
            lat: zone.lat + offsetLat,
            lng: zone.lon + offsetLon,
            zone_id: zone.cell_id,
          });
        });
      }
    });
    return points.slice(0, 15);
  }, [topZones, layers.atms]);

  if (loadError) {
    return (
      <div className="relative w-full h-[500px] bg-[#0A0E1A] border border-red-500/30 rounded-xl flex items-center justify-center p-6 text-center text-red-400">
        <div>
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="font-semibold text-sm">Failed to Load Google Maps</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">Check VITE_GOOGLE_MAPS_API_KEY in frontend/.env</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] bg-[#0A0E1A] border border-border-subtle rounded-xl overflow-hidden shadow-card mb-5">
      {!isLoaded ? (
        <div className="absolute inset-0 bg-[#0A0E1A] flex flex-col items-center justify-center space-y-3 z-30">
          <div className="w-9 h-9 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-cyan-300">Initializing Google Maps Tactical Grid...</p>
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={defaultCenter}
          zoom={5}
          options={mapOptions}
          onLoad={onMapLoad}
          onIdle={onMapIdle}
        >
          {/* Explicit heatmap overlays: GeoJSON [lng, lat] is converted above for Google Maps. */}
          {layers.grid &&
            gridPolygons.map((cell) => {
              const riskScore = Number(cell.properties.risk_score) || 0;
              return (
                <Polygon
                  key={cell.id}
                  paths={cell.paths}
                  options={{
                    ...getRiskPolygonStyle(riskScore),
                    clickable: true,
                    zIndex: 2,
                  }}
                  onClick={(event) =>
                    setActiveInfo({
                      position: event.latLng?.toJSON() || cell.paths[0],
                      title: `Cell ${cell.properties.cell_id} (${cell.properties.city})`,
                      content: {
                        cell_id: cell.properties.cell_id,
                        city: cell.properties.city,
                        risk_score: riskScore,
                        atm_count: cell.properties.atm_count,
                        is_hub: cell.properties.is_syndicate_hub,
                      },
                    })
                  }
                />
              );
            })}

          {/* Top 5 Pulsing Red Cash-Out Prediction Markers */}
          {layers.topZones &&
            topZones.slice(0, 5).map((zone, idx) => (
              <Marker
                key={`top-zone-${zone.cell_id || idx}`}
                position={{ lat: Number(zone.lat), lng: Number(zone.lon) }}
                icon={{
                  url: PULSING_RED_PIN,
                  scaledSize: window.google ? new window.google.maps.Size(38, 38) : null,
                  anchor: window.google ? new window.google.maps.Point(19, 19) : null,
                }}
                onClick={() =>
                  setActiveInfo({
                    position: { lat: Number(zone.lat), lng: Number(zone.lon) },
                    title: `Top #${idx + 1} Cash-Out Zone (${zone.cell_id})`,
                    content: {
                      cell_id: zone.cell_id,
                      city: zone.city,
                      risk_score: zone.risk_score,
                      window: zone.predicted_withdrawal_window,
                      exposure: zone.estimated_amount_at_risk,
                      is_top: true,
                    },
                  })
                }
              />
            ))}

          {/* ATM Cyan Markers */}
          {layers.atms &&
            nearbyAtms.map((atm) => (
              <Marker
                key={atm.id}
                position={{ lat: Number(atm.lat), lng: Number(atm.lng) }}
                icon={{
                  url: CYAN_ATM_PIN,
                  scaledSize: window.google ? new window.google.maps.Size(22, 22) : null,
                  anchor: window.google ? new window.google.maps.Point(11, 11) : null,
                }}
                onClick={() =>
                  setActiveInfo({
                    position: { lat: Number(atm.lat), lng: Number(atm.lng) },
                    title: atm.name,
                    content: {
                      name: atm.name,
                      city: atm.city,
                      zone: atm.zone_id,
                      type: 'Monitored Cash-Out Terminal',
                    },
                  })
                }
              />
            ))}

          {/* Active Case Victim Marker */}
          {selectedCase?.victim_info?.lat && selectedCase?.victim_info?.lon && (
            <Marker
              position={{
                lat: Number(selectedCase.victim_info.lat),
                lng: Number(selectedCase.victim_info.lon),
              }}
              icon={{
                url: CASE_VICTIM_PIN,
                scaledSize: window.google ? new window.google.maps.Size(28, 28) : null,
                anchor: window.google ? new window.google.maps.Point(14, 26) : null,
              }}
              onClick={() =>
                setActiveInfo({
                  position: {
                    lat: Number(selectedCase.victim_info.lat),
                    lng: Number(selectedCase.victim_info.lon),
                  },
                  title: `Victim: ${selectedCase.victim_info.name || 'Complainant'}`,
                  content: {
                    case_id: selectedCase.case_id,
                    amount_lost: selectedCase.victim_info.amount_lost,
                    fraud_type: selectedCase.victim_info.fraud_type,
                    city: selectedCase.victim_info.city,
                  },
                })
              }
            />
          )}

          {/* Curvilinear Arcs from Victim to Forecasted ATMs */}
          {arcCoordinates.map((coords, i) => (
            <Polyline
              key={`arc-${i}`}
              path={coords}
              options={{
                strokeColor: '#06B6D4',
                strokeOpacity: 0.8,
                strokeWeight: 2,
                geodesic: true,
              }}
            />
          ))}

          {/* Interactive InfoWindow */}
          {activeInfo && (
            <InfoWindow position={activeInfo.position} onCloseClick={() => setActiveInfo(null)}>
              <div className="bg-[#0B0F19] text-white p-2 rounded max-w-[260px] font-sans border border-slate-700 shadow-2xl">
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
                  <span className="text-xs font-bold text-cyan-400">{activeInfo.title}</span>
                  {activeInfo.content?.risk_score !== undefined && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        activeInfo.content.risk_score > 0.75
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      Risk: {(activeInfo.content.risk_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {activeInfo.content?.city && (
                  <p className="text-xs text-slate-300 font-semibold">{activeInfo.content.city} Zone</p>
                )}

                {activeInfo.content?.atm_count !== undefined && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    ATMs in Perimeter: <b className="text-white font-mono">{activeInfo.content.atm_count}</b>
                  </p>
                )}

                {activeInfo.content?.window && (
                  <p className="text-[11px] text-amber-400 font-mono mt-1">
                    Golden Window: {activeInfo.content.window}
                  </p>
                )}

                {activeInfo.content?.exposure && (
                  <p className="text-[11px] text-slate-300 font-mono">
                    ₹{Number(activeInfo.content.exposure).toLocaleString('en-IN')} payout exposure
                  </p>
                )}

                {activeInfo.content?.name && (
                  <p className="text-[11px] text-cyan-300 font-mono mt-1">
                    Terminal: {activeInfo.content.name}
                  </p>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}

      {/* Top Left: Map Header & 449-Cell Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 bg-[#111827]/90 border border-slate-700/60 backdrop-blur-md px-3 py-1.5 rounded-lg shadow-lg">
        <ShieldAlert className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-white tracking-tight">Tactical Cash-Out Forecast Grid</span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/30">
          449 CELLS (~2km²) • GOOGLE MAPS
        </span>
      </div>

      {/* Top Right: Layer Controls & "Reset View" Button */}
      <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
        <button
          onClick={fitToRiskGrid}
          className="flex items-center space-x-1.5 bg-[#111827]/90 hover:bg-[#1A2234] border border-slate-700/60 text-slate-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md transition shadow-lg cursor-pointer"
          title="Auto-fit camera to encompass all loaded risk-grid cells in India"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Reset View (Risk Grid)</span>
        </button>

        {/* Layer Toggles */}
        <div className="flex items-center space-x-1 bg-[#111827]/90 border border-slate-700/60 backdrop-blur-md p-1 rounded-lg shadow-lg text-xs">
          <button
            onClick={() => setLayers((l) => ({ ...l, grid: !l.grid }))}
            className={`px-2.5 py-1 rounded transition text-xs font-medium ${
              layers.grid ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setLayers((l) => ({ ...l, topZones: !l.topZones }))}
            className={`px-2.5 py-1 rounded transition text-xs font-medium ${
              layers.topZones ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Top 5
          </button>
          <button
            onClick={() => setLayers((l) => ({ ...l, atms: !l.atms }))}
            className={`px-2.5 py-1 rounded transition text-xs font-medium ${
              layers.atms ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            ATMs
          </button>
          <button
            onClick={() => setLayers((l) => ({ ...l, arcs: !l.arcs }))}
            className={`px-2.5 py-1 rounded transition text-xs font-medium ${
              layers.arcs ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-white'
            }`}
          >
            Arcs
          </button>
        </div>
      </div>

      {/* Bottom Left: Risk Heatmap Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-[#111827]/90 border border-slate-700/60 backdrop-blur-md px-3 py-2 rounded-lg text-[11px] font-mono flex items-center space-x-4 shadow-lg">
        <span className="text-slate-400 text-[10px] uppercase font-semibold">Risk Heat:</span>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span>
          <span className="text-slate-300">&gt;85% High</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
          <span className="text-slate-300">50-85% Mod</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
          <span className="text-slate-300">&lt;50% Normal</span>
        </div>
        <div className="flex items-center space-x-1.5 pl-2 border-l border-slate-700">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
          <span className="text-red-400 font-semibold">Pulsing: Top 5 Target ATMs</span>
        </div>
      </div>
    </div>
  );
}
