/**
 * ==============================================================================
 * MuleShield (SIH26184) - Field Officer Mobile Tactical Map (Google Maps + Directions API)
 * ==============================================================================
 * Replaces MapLibre with Google Maps JavaScript API:
 * - Custom Dark Mode styling matching the #0A0E1A forensic palette
 * - Blue pulsing dot indicator for Officer GPS location
 * - Red destination pin at designated ATM intercept point
 * - DirectionsService + DirectionsRenderer for live DRIVING route
 * - Turn-by-turn step guidance overlay parsed from legs[0].steps
 * - Simulated Navigation along route path (~15s animation)
 * - Real-time ETA and distance tracking
 * - "Arrived" action button updating dispatch status via onArrived callback
 * ==============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { CheckCircle, Navigation, Route, ShieldAlert, Compass } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const LIBRARIES = ['places', 'visualization'];

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

const OFFICER_BLUE_DOT = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="14" fill="%2306B6D4" fill-opacity="0.3"/>
  <circle cx="18" cy="18" r="7" fill="%2338BDF8" stroke="%23FFFFFF" stroke-width="2"/>
  <circle cx="18" cy="18" r="2.5" fill="%23FFFFFF"/>
</svg>`;

const DESTINATION_RED_PIN = `data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <path d="M17 2C11.5 2 7 6.5 7 12c0 8 10 18 10 18s10-10 10-18c0-5.5-4.5-10-10-10z" fill="%23EF4444" stroke="%23FFFFFF" stroke-width="2"/>
  <circle cx="17" cy="12" r="4.5" fill="%23FFFFFF"/>
</svg>`;

export default function FieldMap({ dispatch, officer, onArrived }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(null);
  const timerRef = useRef(null);

  // Determine Destination and Officer Origin
  const destinationPoint = useMemo(() => {
    if (!dispatch?.destination) return null;
    return {
      lat: Number(dispatch.destination.lat),
      lng: Number(dispatch.destination.lon),
    };
  }, [dispatch]);

  const officerStart = useMemo(() => {
    if (!destinationPoint) return null;
    const rawLat = Number(officer?.lat);
    const rawLng = Number(officer?.lng || officer?.lon);
    const isSamePoint =
      !isNaN(rawLat) &&
      !isNaN(rawLng) &&
      Math.abs(rawLat - destinationPoint.lat) < 0.001 &&
      Math.abs(rawLng - destinationPoint.lng) < 0.001;

    return {
      lat: isSamePoint || isNaN(rawLat) ? destinationPoint.lat - 0.015 : rawLat,
      lng: isSamePoint || isNaN(rawLng) ? destinationPoint.lng - 0.018 : rawLng,
    };
  }, [officer, destinationPoint]);

  // Reset navigation when dispatch changes
  useEffect(() => {
    setNavigating(false);
    setProgress(0);
    setDirectionsResponse(null);
    if (officerStart) setCurrentPosition(officerStart);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [dispatch?.dispatch_id, officerStart]);

  // Request Directions from Google Maps DirectionsService
  useEffect(() => {
    if (!isLoaded || !window.google || !officerStart || !destinationPoint) return;

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: officerStart,
        destination: destinationPoint,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirectionsResponse(result);
          if (map) {
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(officerStart);
            bounds.extend(destinationPoint);
            map.fitBounds(bounds, { top: 70, bottom: 90, left: 40, right: 40 });
          }
        } else {
          console.warn('[FieldMap] DirectionsService status:', status);
        }
      }
    );
  }, [isLoaded, officerStart, destinationPoint, map]);

  // Extract Turn-by-Turn Steps from DirectionsResult
  const steps = useMemo(() => {
    if (!directionsResponse?.routes?.[0]?.legs?.[0]?.steps) {
      return [
        'Proceed along tactical vector towards designated ATM intercept zone',
        'Maintain visual contact on approach corridor',
        'Arrive at target ATM point',
      ];
    }
    return directionsResponse.routes[0].legs[0].steps.map((s) =>
      s.instructions.replace(/<[^>]*>?/gm, ' ')
    );
  }, [directionsResponse]);

  // Calculate polyline points for animated movement
  const pathPoints = useMemo(() => {
    if (!directionsResponse?.routes?.[0]?.overview_path) {
      if (!officerStart || !destinationPoint) return [];
      // Fallback interpolation if directions API is mocked/unavailable
      return Array.from({ length: 30 }, (_, i) => {
        const p = i / 29;
        return {
          lat: officerStart.lat + (destinationPoint.lat - officerStart.lat) * p,
          lng: officerStart.lng + (destinationPoint.lng - officerStart.lng) * p,
        };
      });
    }
    return directionsResponse.routes[0].overview_path.map((pt) => ({
      lat: pt.lat(),
      lng: pt.lng(),
    }));
  }, [directionsResponse, officerStart, destinationPoint]);

  // Update Officer Marker Position during Navigation
  useEffect(() => {
    if (!pathPoints.length) return;
    const segment = progress * (pathPoints.length - 1);
    const low = Math.floor(segment);
    const high = Math.min(pathPoints.length - 1, low + 1);
    const blend = segment - low;

    const lat = pathPoints[low].lat + (pathPoints[high].lat - pathPoints[low].lat) * blend;
    const lng = pathPoints[low].lng + (pathPoints[high].lng - pathPoints[low].lng) * blend;
    setCurrentPosition({ lat, lng });
  }, [progress, pathPoints]);

  // Start Navigation animation over ~15 seconds
  const startNavigation = () => {
    setNavigating(true);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);

    // 30 increments of 500ms = 15 seconds total
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 1) {
          clearInterval(timerRef.current);
          return 1;
        }
        return Math.min(1, prev + 1 / 30);
      });
    }, 500);
  };

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    if (officerStart && destinationPoint && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(officerStart);
      bounds.extend(destinationPoint);
      mapInstance.fitBounds(bounds, { top: 70, bottom: 90, left: 40, right: 40 });
    }
  }, [officerStart, destinationPoint]);

  if (loadError) {
    return (
      <div className="h-[calc(100vh-160px)] bg-[#0A0E1A] border border-red-500/30 rounded-xl grid place-items-center p-6 text-center text-red-400">
        <div>
          <ShieldAlert className="w-8 h-8 mx-auto mb-2 text-red-500" />
          <p className="font-semibold text-sm">Failed to Load Google Maps Navigation</p>
          <p className="text-xs text-slate-400 mt-1 font-mono">Verify VITE_GOOGLE_MAPS_API_KEY</p>
        </div>
      </div>
    );
  }

  if (!dispatch || !destinationPoint) {
    return (
      <div className="h-[calc(100vh-160px)] grid place-items-center text-slate-500 text-sm font-mono">
        Select a tactical dispatch to view Google Maps navigation route.
      </div>
    );
  }

  const durationText = directionsResponse?.routes?.[0]?.legs?.[0]?.duration?.text;
  const distanceText = directionsResponse?.routes?.[0]?.legs?.[0]?.distance?.text;

  const liveEta =
    progress >= 1
      ? 'Arrived at Target'
      : durationText
      ? `${Math.max(1, Math.ceil(parseInt(durationText) * (1 - progress)))} mins`
      : `${Math.max(1, Math.ceil(Number(dispatch.eta_minutes || 8) * (1 - progress)))} min`;

  const liveDistance =
    progress >= 1
      ? '0.0 km'
      : distanceText
      ? distanceText
      : `${(Number(dispatch.distance_km || 2.3) * (1 - progress)).toFixed(1)} km`;

  const currentStep = steps[Math.min(steps.length - 1, Math.floor(progress * steps.length))];

  return (
    <div className="relative h-[calc(100vh-160px)] rounded-xl overflow-hidden border border-slate-800 bg-[#0A0E1A]">
      {!isLoaded ? (
        <div className="absolute inset-0 bg-[#0A0E1A] flex flex-col items-center justify-center space-y-3 z-30">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-cyan-300">Loading Google Maps Directions...</p>
        </div>
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={destinationPoint}
          zoom={14}
          options={{
            styles: DARK_MAP_STYLE,
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            backgroundColor: '#0A0E1A',
          }}
          onLoad={onMapLoad}
        >
          {/* Render Directions from DirectionsService */}
          {directionsResponse ? (
            <DirectionsRenderer
              directions={directionsResponse}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#06B6D4',
                  strokeOpacity: 0.9,
                  strokeWeight: 5,
                },
              }}
            />
          ) : pathPoints.length > 0 ? (
            <Polyline
              path={pathPoints}
              options={{
                strokeColor: '#06B6D4',
                strokeOpacity: 0.9,
                strokeWeight: 5,
              }}
            />
          ) : null}

          {/* Officer Current Position (Blue Dot with Pulse) */}
          {currentPosition && (
            <Marker
              position={currentPosition}
              icon={{
                url: OFFICER_BLUE_DOT,
                scaledSize: window.google ? new window.google.maps.Size(36, 36) : null,
                anchor: window.google ? new window.google.maps.Point(18, 18) : null,
              }}
            />
          )}

          {/* Destination Intercept Point (Red Pin) */}
          <Marker
            position={destinationPoint}
            icon={{
              url: DESTINATION_RED_PIN,
              scaledSize: window.google ? new window.google.maps.Size(34, 34) : null,
              anchor: window.google ? new window.google.maps.Point(17, 34) : null,
            }}
          />
        </GoogleMap>
      )}

      {/* Turn-by-Turn Guidance Overlay */}
      <div className="absolute top-3 left-3 right-14 bg-[#111827]/95 backdrop-blur-md rounded-xl border border-slate-700 p-3 shadow-xl z-10">
        <div className="flex items-center gap-2 text-cyan-300">
          <Route className="w-4 h-4" />
          <span className="text-[10px] font-mono tracking-wider">TACTICAL TURN-BY-TURN GUIDANCE</span>
        </div>
        <p className="mt-1 text-sm font-semibold text-white leading-tight">{currentStep}</p>
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>{Math.round(progress * 100)}% route complete</span>
          <span className="text-cyan-400">{progress >= 1 ? 'INTERCEPT ZONE' : 'EN ROUTE'}</span>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
          <div
            className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      </div>

      {/* Bottom Action & ETA Panel */}
      <div className="absolute bottom-3 left-3 right-3 bg-[#111827]/95 backdrop-blur-md rounded-xl border border-slate-700 p-4 shadow-xl z-10">
        <div className="text-[10px] font-mono text-cyan-300">INTERCEPT DESTINATION</div>
        <div className="text-sm text-white font-semibold">
          {dispatch.destination?.name || 'ATM hotspot'}, {dispatch.city || 'Gurugram'}
        </div>
        <div className="text-lg text-white font-bold mt-1">
          {liveEta} <span className="text-slate-500">·</span> {liveDistance}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={startNavigation}
            disabled={navigating || progress >= 1}
            className="min-h-11 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Navigation className="w-4 h-4" />
            <span>{navigating ? 'Navigating…' : 'Start Navigation'}</span>
          </button>
          <button
            onClick={() => {
              if (timerRef.current) clearInterval(timerRef.current);
              onArrived(dispatch);
            }}
            className="min-h-11 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{progress >= 1 ? 'Arrived at Destination' : 'Arrived'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
