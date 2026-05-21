import { useEffect, useRef, useState, useCallback } from 'react';
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
      else if (++attempts > 120) reject(new Error('Google Maps API timed out'));
      else setTimeout(tick, 50);
    };
    tick();
  });
}

function injectMapsBootstrap() {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  const existing = document.getElementById('wt-maps-bootstrap');
  if (existing) return waitForMapsApi();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'wt-maps-bootstrap';
    script.textContent = `(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key:"${GOOGLE_MAPS_API_KEY}",v:"weekly"});`;
    script.onerror = () => reject(new Error('Google Maps bootstrap failed'));
    document.head.appendChild(script);
    waitForMapsApi().then(resolve).catch(reject);
  });
}

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error('Missing Google Maps API key'));
  }
  if (mapsApiReady()) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = injectMapsBootstrap()
    .then(() => window.google.maps.importLibrary('maps'))
    .then(() => waitForMapsApi())
    .catch((err) => {
      mapsLoadPromise = null;
      throw err;
    });
  return mapsLoadPromise;
}

/** Single draggable marker — add/edit one camera */
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

/** All cameras — numbered pins, click to edit */
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

  if (error) return null;

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
