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
import './App.css';
import './pages/pages.css';

const DEFAULT_CAMERAS = [
  { id: 'CAM_WEBCAM', name: 'Webcam (Dev)', location: '18.5204,73.8567', place: 'Pune Office', type: 'webcam', status: 'active', rtspUrl: '', streamUrl: '', notes: 'Laptop webcam — development/testing camera', addedAt: Date.now() - 86400000 * 3 },
  { id: 'CAM_01', name: 'North Perimeter', location: '18.5204,73.8567', place: 'Pune Office — North Gate', type: 'cctv', status: 'active', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now() - 86400000 * 2 },
  { id: 'CAM_02', name: 'East Gate', location: '18.5250,73.8600', place: 'East Entrance', type: 'cctv', status: 'offline', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now() - 86400000 },
  { id: 'CAM_03', name: 'South Boundary', location: '18.5190,73.8500', place: 'South Sensors', type: 'cctv', status: 'active', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now() },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [serverStatus, setServerStatus] = useState('unknown');
  const [latestAlert, setLatestAlert] = useState(null);

  // Fix: persist alertHistory to localStorage so it survives page reload
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

  // Fix: derive serverBase from serverConfig so changing host/port actually takes effect
  const serverBase = `http://${serverConfig.host}:${serverConfig.port}`;

  const alertHistoryRef = useRef(alertHistory);
  alertHistoryRef.current = alertHistory;

  // Persist state to localStorage
  useEffect(() => { localStorage.setItem('wt_cameras', JSON.stringify(cameras)); }, [cameras]);
  useEffect(() => { localStorage.setItem('wt_serverconfig', JSON.stringify(serverConfig)); }, [serverConfig]);
  // Fix: persist alertHistory (was missing — history reset on every page reload)
  useEffect(() => { localStorage.setItem('wt_alertHistory', JSON.stringify(alertHistory)); }, [alertHistory]);

  // Health check — re-runs when serverConfig.host or serverConfig.port changes
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${serverBase}/health`, { signal: AbortSignal.timeout(2000) });
        const d = await r.json();
        setServerStatus(d.status === 'healthy' ? 'online' : 'offline');
      } catch {
        setServerStatus('offline');
      }
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  // Fix: depend on serverBase so health check updates when user changes server address
  }, [serverBase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll latest alert
  useEffect(() => {
    if (serverStatus !== 'online') return;
    const poll = async () => {
      try {
        const r = await fetch(`${serverBase}/latest-alert`, { signal: AbortSignal.timeout(3000) });
        const d = await r.json();
        setLatestAlert(d);
        if (d.animal_detected) {
          const hist = alertHistoryRef.current;
          const isDup =
            hist.length > 0 &&
            hist[0].animal_type === d.animal_type &&
            Math.abs(hist[0].timestamp - d.timestamp) < 5;
          if (!isDup) {
            setAlertHistory(prev => [{ ...d, id: Date.now() }, ...prev.slice(0, 99)]);
          }
        }
      } catch { /* server temporarily unreachable */ }
    };
    poll();
    const t = setInterval(poll, (serverConfig.pollInterval || 3) * 1000);
    return () => clearInterval(t);
  // Fix: depend on serverBase so poll target updates when user changes server address
  }, [serverStatus, serverBase, serverConfig.pollInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  const addCamera = useCallback(async (cam) => {
    setCameras(prev => [...prev, { ...cam, addedAt: Date.now() }]);
    if (serverStatus === 'online') {
      try {
        await fetch(`${serverBase}/register/camera`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camera_id: cam.id, location: cam.location }),
        });
      } catch { /* non-blocking */ }
    }
  }, [serverStatus, serverBase]);

  const removeCamera = useCallback((id) => {
    setCameras(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCamera = useCallback((id, updates) => {
    setCameras(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  // Fix: also clear localStorage when clearing alerts
  const clearAlerts = useCallback(() => {
    setAlertHistory([]);
    localStorage.removeItem('wt_alertHistory');
  }, []);

  const props = {
    serverStatus,
    latestAlert,
    alertHistory,
    cameras,
    serverConfig,
    setServerConfig,
    addCamera,
    removeCamera,
    updateCamera,
    clearAlerts,
    serverBase,   // Fix: passes the dynamic serverBase, not the old hardcoded SERVER_BASE constant
  };

  const pages = {
    dashboard: Dashboard,
    multiview: MultiView,
    cameras:   Cameras,
    alerts:    Alerts,
    cctvsetup: CctvSetup,
    android:   AndroidGuide,
    server:    ServerConfig,
    settings:  Settings,
  };
  const PageComponent = pages[page] || Dashboard;

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} serverStatus={serverStatus} cameras={cameras} />
      <div className="main-area">
        <TopBar page={page} serverStatus={serverStatus} latestAlert={latestAlert} />
        <main className="page-content">
          <PageComponent {...props} />
        </main>
      </div>
    </div>
  );
}
