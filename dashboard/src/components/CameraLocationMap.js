import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin } from 'lucide-react';
import {
  GOOGLE_MAPS_API_KEY,
  parseLocation,
  formatLocation,
  DEFAULT_MAP_CENTER,
  numberedMarkerOptions,
  getCameraNumber,
} from '../config/maps';

let mapsLoadPromise = null;

function mapsApiReady() {
  return typeof window.google?.maps?.Map === 'function'
    && typeof window.google?.maps?.Marker === 'function';
}

function waitForMapsApi() {
  if (mapsApiReady()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = () => {
      if (mapsApiReady()) resolve();
      else if (++attempts > 600) reject(new Error('Google Maps API timed out'));
      else setTimeout(tick, 50);
    };
    tick();
  });
}

function injectMapsBootstrap() {
  if (mapsApiReady()) return Promise.resolve();
  const existing = document.getElementById('wt-maps-bootstrap');
  if (existing) return waitForMapsApi();
  return new Promise((resolve, reject) => {
    window.initWtMaps = () => {
      resolve();
    };
    const script = document.createElement('script');
    script.id = 'wt-maps-bootstrap';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initWtMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Google Maps script load failed'));
    document.head.appendChild(script);
  });
}

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Missing Google Maps API key'));
  }
  if (mapsApiReady()) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = injectMapsBootstrap()
    .then(() => waitForMapsApi())
    .catch((err) => {
      mapsLoadPromise = null;
      throw err;
    });
  return mapsLoadPromise;
}

export function CameraLocationMap({ location, onLocationChange, height = 240, camera }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => { if (!cancelled) setReady(true); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready || !mapDivRef.current || !mapsApiReady()) return;

    try {
      const pos = parseLocation(location);
      const g = window.google.maps;
      const markerOpts = camera
        ? numberedMarkerOptions({ ...camera, location })
        : { draggable: true, title: 'Drag pin to set camera location' };

      if (!mapRef.current) {
        mapRef.current = new g.Map(mapDivRef.current, {
          center: pos,
          zoom: 16,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        markerRef.current = new g.Marker({
          position: pos,
          map: mapRef.current,
          draggable: true,
          ...markerOpts,
        });
        markerRef.current.addListener('dragend', () => {
          const p = markerRef.current.getPosition();
          onLocationChangeRef.current(formatLocation(p.lat(), p.lng()));
        });
        mapRef.current.addListener('click', (e) => {
          markerRef.current.setPosition(e.latLng);
          onLocationChangeRef.current(formatLocation(e.latLng.lat(), e.latLng.lng()));
        });
      } else {
        mapRef.current.setCenter(pos);
        markerRef.current.setPosition(pos);
        if (camera) markerRef.current.setOptions(numberedMarkerOptions({ ...camera, location }));
      }
    } catch (err) {
      console.error('CameraLocationMap: init failed', err);
      setError(err?.message || 'Map failed to load');
    }
  }, [ready, location, camera]);

  const num = camera ? getCameraNumber(camera) : null;

  if (error) {
    return (
      <div className="camera-map-error">
        <MapPin size={14} />
        <span>{error}. Set REACT_APP_GOOGLE_MAPS_API_KEY in dashboard/.env</span>
      </div>
    );
  }

  return (
    <div className="camera-map-wrap">
      {num != null && (
        <div className="camera-map-number-badge">Camera #{num}{camera?.city ? ` · ${camera.city}` : ''}</div>
      )}
      <div ref={mapDivRef} className="camera-map-canvas" style={{ height }} />
      {!ready && <div className="camera-map-loading">Loading map…</div>}
      <p className="camera-map-hint">Numbered pins match the Android app map in your city</p>
    </div>
  );
}

export function AreaPolygonMap({ coordinates = [], onCoordinatesChange, height = 240 }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => { if (!cancelled) setReady(true); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const clearDrawing = useCallback(() => {
    if (polygonRef.current) polygonRef.current.setMap(null);
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    onCoordinatesChange([]);
  }, [onCoordinatesChange]);

  useEffect(() => {
    if (!ready || !mapDivRef.current || !mapsApiReady()) return;

    try {
      const g = window.google.maps;
      
      if (!mapRef.current) {
        mapRef.current = new g.Map(mapDivRef.current, {
          center: coordinates.length > 0 ? coordinates[0] : DEFAULT_MAP_CENTER,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        mapRef.current.addListener('click', (e) => {
          const newCoord = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          onCoordinatesChange([...coordinates, newCoord]);
        });
      }

      // Sync visual polygon with coordinates prop
      if (polygonRef.current) polygonRef.current.setMap(null);
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      if (coordinates.length > 0) {
        polygonRef.current = new g.Polygon({
          paths: coordinates,
          strokeColor: '#3b82f6',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.35,
          map: mapRef.current,
        });

        coordinates.forEach((coord, idx) => {
          const marker = new g.Marker({
            position: coord,
            map: mapRef.current,
            icon: {
              path: g.SymbolPath.CIRCLE,
              fillColor: '#ffffff',
              fillOpacity: 1,
              strokeColor: '#3b82f6',
              strokeWeight: 2,
              scale: 5,
            },
            title: `Point ${idx + 1}`
          });
          markersRef.current.push(marker);
        });
      }
    } catch (err) {
      setError(err?.message || 'Map failed to load');
    }
  }, [ready, coordinates, onCoordinatesChange]);

  if (error) {
    return (
      <div className="camera-map-error">
        <MapPin size={14} />
        <span>{error}. Set REACT_APP_GOOGLE_MAPS_API_KEY</span>
      </div>
    );
  }

  return (
    <div className="camera-map-wrap" style={{ position: 'relative' }}>
      <div ref={mapDivRef} className="camera-map-canvas" style={{ height }} />
      {!ready && <div className="camera-map-loading">Loading map…</div>}
      
      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
        <button 
          onClick={(e) => { e.preventDefault(); clearDrawing(); }}
          style={{ background: 'white', color: '#ef4444', border: '1px solid #ef4444', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
        >
          Clear Area
        </button>
      </div>
      <p className="camera-map-hint" style={{ marginTop: '8px' }}>
        Click on the map to place boundary points. Place 3 or more points to define your Area.
      </p>
    </div>
  );
}

export function AllCamerasMap({ cameras, selectedId, onSelectCamera, height = 320, city }) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const onSelectRef = useRef(onSelectCamera);
  onSelectRef.current = onSelectCamera;

  const cityLabel = city || cameras[0]?.city || 'Your city';

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => { if (!cancelled) setReady(true); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  const refreshMarkers = useCallback(() => {
    if (!mapRef.current || !mapsApiReady()) return;

    try {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      const bounds = new window.google.maps.LatLngBounds();
      const g = window.google.maps;

      cameras.forEach((cam) => {
        const pos = parseLocation(cam.location);
        const latLng = new g.LatLng(pos.lat, pos.lng);
        bounds.extend(latLng);

        const marker = new g.Marker({
          position: latLng,
          map: mapRef.current,
          ...numberedMarkerOptions(cam),
        });
        marker.addListener('click', () => onSelectRef.current(cam));
        markersRef.current.push(marker);
      });

      if (cameras.length > 1) {
        mapRef.current.fitBounds(bounds, 56);
      } else if (cameras.length === 1) {
        mapRef.current.setCenter(bounds.getCenter());
        mapRef.current.setZoom(16);
      } else {
        mapRef.current.setCenter(DEFAULT_MAP_CENTER);
        mapRef.current.setZoom(12);
      }
    } catch (err) {
      console.error('AllCamerasMap: failed to render markers', err);
      setError(err?.message || 'Map failed to load');
    }
  }, [cameras]);

  useEffect(() => {
    if (!ready || !mapDivRef.current || !mapsApiReady()) return;

    try {
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(mapDivRef.current, {
          center: DEFAULT_MAP_CENTER,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
        });
      }
      refreshMarkers();
    } catch (err) {
      console.error('AllCamerasMap: init failed', err);
      setError(err?.message || 'Map failed to load');
    }
  }, [ready, cameras, refreshMarkers]);

  useEffect(() => {
    if (!ready || !selectedId || !mapRef.current) return;
    const cam = cameras.find((c) => c.id === selectedId);
    if (!cam) return;
    mapRef.current.panTo(parseLocation(cam.location));
    mapRef.current.setZoom(17);
  }, [ready, selectedId, cameras]);

  if (error) {
    return (
      <div className="card camera-map-overview">
        <div className="section-header" style={{ marginBottom: 8 }}>
          <h2>{cityLabel} — camera map</h2>
          <span className="text-muted" style={{ fontSize: 11 }}>
            Pins show camera #1, #2, #3… (same on every phone app)
          </span>
        </div>
        <div className="camera-map-error">
          <MapPin size={14} />
          <span>{error}. Set REACT_APP_GOOGLE_MAPS_API_KEY in dashboard/.env</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card camera-map-overview">
      <div className="section-header" style={{ marginBottom: 8 }}>
        <h2>{cityLabel} — camera map</h2>
        <span className="text-muted" style={{ fontSize: 11 }}>
          Pins show camera #1, #2, #3… (same on every phone app)
        </span>
      </div>
      <div className="camera-map-legend">
        <span><i className="legend-dot active"/> Active</span>
        <span><i className="legend-dot offline"/> Offline</span>
        <span><i className="legend-dot primary"/> Primary ★</span>
      </div>
      <div className="camera-map-wrap">
        <div ref={mapDivRef} className="camera-map-canvas" style={{ height }} />
        {!ready && <div className="camera-map-loading">Loading map…</div>}
      </div>
    </div>
  );
}
