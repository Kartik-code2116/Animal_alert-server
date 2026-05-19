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
import Landing from './pages/Landing';
import './App.css';

const SERVER_BASE = window.location.origin;

const DEFAULT_CAMERAS = [
  { id: 'CAM_WEBCAM', name: 'Webcam (Dev)', location: '18.5204,73.8567', place: 'Pune Office', type: 'webcam', status: 'active', rtspUrl: '', streamUrl: '', notes: 'Laptop webcam — development/testing camera', addedAt: Date.now() - 86400000 * 3 },
  { id: 'CAM_01', name: 'North Perimeter', location: '18.5204,73.8567', place: 'Pune Office — North Gate', type: 'cctv', status: 'active', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now() - 86400000 * 2 },
  { id: 'CAM_02', name: 'East Gate', location: '18.5250,73.8600', place: 'East Entrance', type: 'cctv', status: 'offline', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now() - 86400000 },
  { id: 'CAM_03', name: 'South Boundary', location: '18.5190,73.8500', place: 'South Sensors', type: 'cctv', status: 'active', rtspUrl: '', streamUrl: '', notes: '', addedAt: Date.now() },
];

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('wt_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [page, setPage] = useState(() => {
    const saved = localStorage.getItem('wt_auth_user');
    return saved ? 'dashboard' : 'landing';
  });

  const [serverStatus, setServerStatus] = useState('unknown');
  const [latestAlert, setLatestAlert] = useState(null);
  const [alertHistory, setAlertHistory] = useState([]);
  const [cameras, setCameras] = useState(() => {
    try {
      const saved = localStorage.getItem('wt_cameras');
      return saved ? JSON.parse(saved) : DEFAULT_CAMERAS;
    } catch { return DEFAULT_CAMERAS; }
  });
  const [serverConfig, setServerConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('wt_serverconfig');
      return saved ? JSON.parse(saved) : { host: 'localhost', port: '5000', pollInterval: 3, detectionInterval: 2, jpegQuality: 85, previewFps: 20 };
    } catch { return { host: 'localhost', port: '5000', pollInterval: 3, detectionInterval: 2, jpegQuality: 85, previewFps: 20 }; }
  });

  const handleLogin = useCallback((newUser) => {
    setUser(newUser);
    localStorage.setItem('wt_auth_user', JSON.stringify(newUser));
    setPage('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('wt_auth_user');
    setPage('landing');
  }, []);

  const alertHistoryRef = useRef(alertHistory);
  alertHistoryRef.current = alertHistory;

  useEffect(() => { localStorage.setItem('wt_cameras', JSON.stringify(cameras)); }, [cameras]);
  useEffect(() => { localStorage.setItem('wt_serverconfig', JSON.stringify(serverConfig)); }, [serverConfig]);

  // Health check
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${SERVER_BASE}/health`, { signal: AbortSignal.timeout(2000) });
        const d = await r.json();
        setServerStatus(d.status === 'healthy' ? 'online' : 'offline');
      } catch { setServerStatus('offline'); }
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, []);

  // Poll latest alert
  useEffect(() => {
    if (serverStatus !== 'online') return;
    const poll = async () => {
      try {
        const r = await fetch(`${SERVER_BASE}/latest-alert`, { signal: AbortSignal.timeout(3000) });
        const d = await r.json();
        setLatestAlert(d);
        if (d.animal_detected) {
          const hist = alertHistoryRef.current;
          const isDup = hist.length > 0 && hist[0].animal_type === d.animal_type && Math.abs(hist[0].timestamp - d.timestamp) < 5;
          if (!isDup) {
            setAlertHistory(prev => [{ ...d, id: Date.now() }, ...prev.slice(0, 99)]);
          }
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, (serverConfig.pollInterval || 3) * 1000);
    return () => clearInterval(t);
  }, [serverStatus, serverConfig.pollInterval]);

  // Load initial cameras and alert history from MongoDB
  useEffect(() => {
    if (serverStatus !== 'online') return;
    const loadDBData = async () => {
      try {
        const camRes = await fetch(`${SERVER_BASE}/api/cameras`);
        if (camRes.ok) {
          const camData = await camRes.json();
          setCameras(camData);
        }
      } catch (err) {
        console.warn("Could not fetch cameras from MongoDB, falling back to local memory:", err);
      }

      try {
        const alertRes = await fetch(`${SERVER_BASE}/api/alerts`);
        if (alertRes.ok) {
          const alertData = await alertRes.json();
          setAlertHistory(alertData);
        }
      } catch (err) {
        console.warn("Could not fetch alerts from MongoDB, falling back to local memory:", err);
      }
    };
    loadDBData();
  }, [serverStatus]);

  const addCamera = useCallback(async (cam) => {
    const newCam = { ...cam, addedAt: Date.now() };
    setCameras(prev => [...prev, newCam]);
    if (serverStatus === 'online') {
      try {
        // Also register in memory route on backend
        await fetch(`${SERVER_BASE}/register/camera`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ camera_id: cam.id, location: cam.location, ...cam }),
        });
      } catch {}
    }
  }, [serverStatus]);

  const removeCamera = useCallback(async (id) => {
    setCameras(prev => prev.filter(c => c.id !== id));
    if (serverStatus === 'online') {
      try {
        await fetch(`${SERVER_BASE}/api/cameras/${id}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn("Failed to delete camera from MongoDB:", err);
      }
    }
  }, [serverStatus]);

  const updateCamera = useCallback(async (id, updates) => {
    setCameras(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    if (serverStatus === 'online') {
      try {
        const payload = { id, ...updates };
        await fetch(`${SERVER_BASE}/api/cameras`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.warn("Failed to update camera in MongoDB:", err);
      }
    }
  }, [serverStatus]);

  const clearAlerts = useCallback(async () => {
    setAlertHistory([]);
    if (serverStatus === 'online') {
      try {
        await fetch(`${SERVER_BASE}/api/alerts`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn("Failed to clear alerts from MongoDB:", err);
      }
    }
  }, [serverStatus]);

  const props = {
    serverStatus, latestAlert, alertHistory, cameras,
    serverConfig, setServerConfig,
    addCamera, removeCamera, updateCamera, clearAlerts,
    serverBase: SERVER_BASE,
    user, onLogin: handleLogin, onLogout: handleLogout, setPage,
  };

  const pages = {
    landing: Landing,
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

  // Intercept and render beautiful landing page if page === 'landing' OR user is not authenticated
  if (page === 'landing' || !user) {
    return (
      <Landing 
        user={user} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
        setPage={setPage}
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar 
        page={page} 
        setPage={setPage} 
        serverStatus={serverStatus} 
        cameras={cameras}
        user={user}
        onLogout={handleLogout}
      />
      <div className="main-area">
        <TopBar page={page} serverStatus={serverStatus} latestAlert={latestAlert}/>
        <main className="page-content">
          <PageComponent {...props}/>
        </main>
      </div>
    </div>
  );
}
