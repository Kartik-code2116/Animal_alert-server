import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import './TopBar.css';

const PAGE_TITLES = {
  dashboard:  'Dashboard',
  multiview:  'Live Camera Grid',
  cameras:    'Camera Management',
  alerts:     'Alert History',
  cctvsetup:  'CCTV Setup Guide',
  android:    'Android App Setup',
  server:     'Server Configuration',
  settings:   'Settings',
};

const PAGE_SUBS = {
  dashboard:  'System overview & live feed',
  multiview:  'All cameras — last detection per camera',
  cameras:    'Manage registered cameras',
  alerts:     'Detection log with export',
  cctvsetup:  'Connect RTSP / IP cameras',
  android:    'Connect the WildTrack mobile app',
  server:     'Flask server config & API reference',
  settings:   'Preferences & project config',
};

export default function TopBar({ page, serverStatus, latestAlert }) {
  const ts = latestAlert?.timestamp
    ? new Date(latestAlert.timestamp * 1000).toLocaleTimeString()
    : null;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{PAGE_TITLES[page] || page}</h1>
        <span className="topbar-sub">{PAGE_SUBS[page] || ''}</span>
      </div>
      <div className="topbar-right">
        {latestAlert?.animal_detected ? (
          <div className="topbar-alert-chip danger">
            <AlertTriangle size={13}/>
            <span>{latestAlert.animal_type} detected</span>
            <span className="chip-time">{ts}</span>
          </div>
        ) : latestAlert ? (
          <div className="topbar-alert-chip safe">
            <CheckCircle size={13}/>
            <span>All clear</span>
          </div>
        ) : (
          <div className="topbar-alert-chip idle">
            <RefreshCw size={13} className="spin-slow"/>
            <span>Connecting…</span>
          </div>
        )}
        <div className={`topbar-status-dot ${serverStatus}`} title={`Server ${serverStatus}`}/>
      </div>
    </header>
  );
}
