import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import ServerConfig from './pages/ServerConfig';
import MultiView from './pages/MultiView';
import AndroidGuide from './pages/AndroidGuide';
import CctvSetup from './pages/CctvSetup';
import { isDangerousDetection } from './utils/detection';
import './App.css';
import './pages/pages.css';

const DEFAULT_CAMERAS = [
  { id: 'CAM_WEBCAM', name: 'Webcam (Dev)', location: '18.5204,73.8567', place: 'Pune Office', type: 'webcam', status: 'active', rtspUrl: '', streamUrl: '', notes: 'Laptop webcam', addedAt: Date.now() - 86400000 * 3, is_primary: false },
  { id: 'CAM_01', name: 'North Perimeter', location: '18.5204,73.8567', place: 'Pune Office — North Gate', type: 'cctv', status: 'active', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now() - 86400000 * 2, is_primary: true },
  { id: 'CAM_02', name: 'East Gate', location: '18.5250,73.8600', place: 'East Entrance', type: 'cctv', status: 'offline', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now() - 86400000, is_primary: false },
  { id: 'CAM_03', name: 'South Boundary', location: '18.5190,73.8500', place: 'South Sensors', type: 'cctv', status: 'active', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now(), is_primary: false },
];

function alertId(a, index) {
  const ts = a.timestamp > 1e12 ? a.timestamp : (a.timestamp || 0) * 1000;
  return a._id || `${ts}-${a.animal_type || 'none'}-${index}`;
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [serverStatus, setServerStatus] = useState('unknown');
  const [latestAlert, setLatestAlert] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);

  const [personalPrimary, setPersonalPrimary] = useState(() => {
    try {
      const saved = localStorage.getItem('wt_personal_primary');
      return saved || '';
    } catch { return ''; }
  });

  const [alertHistory, setAlertHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('wt_alertHistory');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [cameras, setCameras] = useState(() => {
    try {
      const saved = localStorage.getItem('wt_cameras');
      return saved ? JSON.parse(saved) : DEFAULT_CAMERAS;
    } catch { return DEFAULT_CAMERAS; }
  });

  const [serverConfig, setServerConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('wt_serverconfig');
      return saved ? JSON.parse(saved) : {
        host: 'localhost', port: '5000',
        pollInterval: 3, detectionInterval: 2,
        jpegQuality: 85, previewFps: 20,
      };
    } catch {
      return { host: 'localhost', port: '5000', pollInterval: 3, detectionInterval: 2, jpegQuality: 85, previewFps: 20 };
    }
  });

  // Use relative path in production (served by Flask) so the origin matches exactly,
  // preventing CORS and SSL certificate mismatch errors when using IP addresses.
  const isDev = window.location.port === '3000' || window.location.port === '3001';
  const serverBase = isDev ? `https://${serverConfig.host}:${serverConfig.port}` : '';
  const alertHistoryRef = useRef(alertHistory);
  alertHistoryRef.current = alertHistory;

  useEffect(() => {
    try { localStorage.setItem('wt_cameras', JSON.stringify(cameras)); } catch { /* */ }
  }, [cameras]);

  useEffect(() => {
    try { localStorage.setItem('wt_serverconfig', JSON.stringify(serverConfig)); } catch { /* */ }
  }, [serverConfig]);

  useEffect(() => {
    try {
      const pruned = alertHistory.map((a, i) => (i >= 10 && a.image ? (({ image, ...r }) => r)(a) : a));
      localStorage.setItem('wt_alertHistory', JSON.stringify(pruned));
    } catch { /* */ }
  }, [alertHistory]);

  useEffect(() => {
    try {
      if (personalPrimary) {
        localStorage.setItem('wt_personal_primary', personalPrimary);
      } else {
        localStorage.removeItem('wt_personal_primary');
      }
    } catch { /* */ }
  }, [personalPrimary]);

  const getEffectivePrimary = useCallback(() => {
    if (personalPrimary && cameras.some(c => c.id === personalPrimary)) {
      return personalPrimary;
    }
    const primaryCam = cameras.find(c => c.is_primary);
    if (primaryCam) return primaryCam.id;
    if (systemStatus?.active_detection_camera) return systemStatus.active_detection_camera;
    if (cameras.length > 0) return cameras[0].id;
    return 'CAM_WEBCAM';
  }, [personalPrimary, cameras, systemStatus]);

  const effectivePrimary = getEffectivePrimary();

  const syncCamerasFromServer = useCallback(async () => {
    try {
      const r = await fetch(`${serverBase}/api/cameras`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) return;
      const list = await r.json();
      if (Array.isArray(list) && list.length) setCameras(list);
    } catch { /* */ }
  }, [serverBase]);

  const syncAlertsFromServer = useCallback(async () => {
    try {
      const r = await fetch(`${serverBase}/api/alerts`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return;
      const list = await r.json();
      if (!Array.isArray(list)) return;
      const mapped = list.map((a, i) => ({
        ...a,
        id: alertId(a, i),
        timestamp: a.timestamp > 1e12 ? Math.floor(a.timestamp / 1000) : a.timestamp,
      }));
      setAlertHistory(mapped);
    } catch { /* */ }
  }, [serverBase]);

  const syncSystemStatus = useCallback(async () => {
    try {
      const r = await fetch(`${serverBase}/api/system/status`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) return;
      const d = await r.json();
      setSystemStatus(d);
    } catch { /* */ }
  }, [serverBase]);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${serverBase}/health`, { signal: AbortSignal.timeout(2000) });
        const d = await r.json();
        const online = d.status === 'healthy';
        setServerStatus(online ? 'online' : 'offline');
        if (online) {
          syncCamerasFromServer();
          syncAlertsFromServer();
          syncSystemStatus();
        }
      } catch {
        setServerStatus('offline');
      }
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, [serverBase, syncCamerasFromServer, syncAlertsFromServer, syncSystemStatus]);

  useEffect(() => {
    if (serverStatus !== 'online') return;
    const poll = async () => {
      try {
        const queryParam = effectivePrimary ? `?camera_id=${effectivePrimary}` : '';
        const r = await fetch(`${serverBase}/latest-alert${queryParam}`, { signal: AbortSignal.timeout(3000) });
        const d = await r.json();
        setLatestAlert(d);
        if (isDangerousDetection(d)) {
          const hist = alertHistoryRef.current;
          const ts = d.timestamp > 1e12 ? Math.floor(d.timestamp / 1000) : d.timestamp;
          const isDup = hist.length > 0 &&
            hist[0].animal_type === d.animal_type &&
            Math.abs((hist[0].timestamp || 0) - (ts || 0)) < 5;
          if (!isDup) {
            setAlertHistory(prev => [{ ...d, id: Date.now(), timestamp: ts }, ...prev.slice(0, 99)]);
          }
        }
      } catch { /* */ }
    };
    poll();
    const t = setInterval(poll, (serverConfig.pollInterval || 3) * 1000);
    return () => clearInterval(t);
  }, [serverStatus, serverBase, serverConfig.pollInterval, effectivePrimary]);

  useEffect(() => {
    if (serverStatus !== 'online') return;
    const t = setInterval(syncSystemStatus, 8000);
    return () => clearInterval(t);
  }, [serverStatus, syncSystemStatus]);

  const addCamera = useCallback(async (cam) => {
    const payload = { ...cam, id: cam.id, location: cam.location };
    if (serverStatus === 'online') {
      try {
        const r = await fetch(`${serverBase}/api/cameras`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          await syncCamerasFromServer();
          return;
        }
      } catch { /* */ }
    }
    setCameras(prev => [...prev, { ...cam, addedAt: Date.now() }]);
  }, [serverStatus, serverBase, syncCamerasFromServer]);

  const removeCamera = useCallback(async (id) => {
    if (serverStatus === 'online') {
      try {
        await fetch(`${serverBase}/api/cameras/${id}`, { method: 'DELETE' });
        await syncCamerasFromServer();
        return;
      } catch { /* */ }
    }
    setCameras(prev => prev.filter(c => c.id !== id));
  }, [serverStatus, serverBase, syncCamerasFromServer]);

  const updateCamera = useCallback(async (id, updates) => {
    if (serverStatus === 'online') {
      try {
        await fetch(`${serverBase}/api/cameras/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        await syncCamerasFromServer();
        return;
      } catch { /* */ }
    }
    setCameras(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, [serverStatus, serverBase, syncCamerasFromServer]);

  const cameraControl = useCallback(async (id, action) => {
    if (serverStatus === 'online') {
      try {
        await fetch(`${serverBase}/api/cameras/${id}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        await syncCamerasFromServer();
        if (action === 'set_primary') await syncSystemStatus();
        return;
      } catch { /* */ }
    }
    if (action === 'start') updateCamera(id, { status: 'active' });
    else if (action === 'stop') updateCamera(id, { status: 'offline' });
    else if (action === 'set_primary') {
      setCameras(prev => prev.map(c => ({ ...c, is_primary: c.id === id })));
    }
  }, [serverStatus, serverBase, syncCamerasFromServer, syncSystemStatus, updateCamera]);

  const setMonitoring = useCallback(async (enabled) => {
    if (serverStatus === 'online') {
      try {
        await fetch(`${serverBase}/api/system/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ monitoring_enabled: enabled }),
        });
        await syncSystemStatus();
      } catch { /* */ }
    } else {
      setSystemStatus(prev => ({ ...prev, monitoring_enabled: enabled }));
    }
  }, [serverStatus, serverBase, syncSystemStatus]);

  const setDeploymentCity = useCallback(async (cityName) => {
    if (!cityName?.trim()) return;
    if (serverStatus === 'online') {
      try {
        await fetch(`${serverBase}/api/system/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deployment_city: cityName.trim() }),
        });
        await syncCamerasFromServer();
        await syncSystemStatus();
      } catch { /* */ }
    } else {
      setSystemStatus((prev) => ({ ...prev, deployment_city: cityName.trim() }));
    }
  }, [serverStatus, serverBase, syncCamerasFromServer, syncSystemStatus]);

  const setPrimaryCamera = useCallback(async (cameraId) => {
    if (serverStatus === 'online') {
      try {
        await fetch(`${serverBase}/api/system/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active_detection_camera: cameraId }),
        });
        await syncCamerasFromServer();
        await syncSystemStatus();
      } catch { /* */ }
    }
  }, [serverStatus, serverBase, syncCamerasFromServer, syncSystemStatus]);

  const clearAlerts = useCallback(async () => {
    if (serverStatus === 'online') {
      try {
        await fetch(`${serverBase}/api/alerts`, { method: 'DELETE' });
      } catch { /* */ }
    }
    setAlertHistory([]);
    localStorage.removeItem('wt_alertHistory');
  }, [serverStatus, serverBase]);

  const refreshAll = useCallback(async () => {
    await syncCamerasFromServer();
    await syncAlertsFromServer();
    await syncSystemStatus();
  }, [syncCamerasFromServer, syncAlertsFromServer, syncSystemStatus]);

  const props = {
    serverStatus,
    latestAlert,
    alertHistory,
    cameras,
    systemStatus,
    serverConfig,
    setServerConfig,
    addCamera,
    removeCamera,
    updateCamera,
    cameraControl,
    setMonitoring,
    setDeploymentCity,
    setPrimaryCamera,
    clearAlerts,
    refreshAll,
    syncAlertsFromServer,
    serverBase,
    personalPrimary,
    setPersonalPrimary,
    effectivePrimary,
  };

  const pages = {
    dashboard: Dashboard,
    multiview: MultiView,
    cameras: Cameras,
    alerts: Alerts,
    cctvsetup: CctvSetup,
    android: AndroidGuide,
    server: ServerConfig,
    settings: Settings,
  };
  const PageComponent = pages[page] || Dashboard;

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} serverStatus={serverStatus} cameras={cameras} systemStatus={systemStatus} />
      <div className="main-area">
        <TopBar page={page} serverStatus={serverStatus} latestAlert={latestAlert} systemStatus={systemStatus} personalPrimary={personalPrimary} effectivePrimary={effectivePrimary} cameras={cameras} />
        <main className="page-content">
          <PageComponent {...props} />
        </main>
      </div>
    </div>
  );
}
