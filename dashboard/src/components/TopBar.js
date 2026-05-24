import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { isDangerousDetection } from '../utils/detection';
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

export default function TopBar({ page, serverStatus, latestAlert, systemStatus, personalPrimary, effectivePrimary, cameras }) {
  const mon = systemStatus?.monitoring_enabled !== false;
  const camStats = systemStatus?.cameras;
  const city = systemStatus?.deployment_city;
  const badge = systemStatus && serverStatus === 'online'
    ? `${city ? `${city} · ` : ''}${mon ? 'MONITORING ON' : 'MONITORING OFF'} · ${camStats?.active ?? 0}/${camStats?.total ?? 0} CAMERAS`
    : null;
  const ts = latestAlert?.timestamp
    ? new Date(latestAlert.timestamp * 1000).toLocaleTimeString()
    : null;
  const isDangerous = isDangerousDetection(latestAlert);

  const focusedCam = cameras?.find(c => c.id === effectivePrimary);
  const focusName = focusedCam ? focusedCam.name : (systemStatus?.primary_camera?.name || 'No camera');
  const isPersonal = personalPrimary && focusedCam && personalPrimary === focusedCam.id;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{PAGE_TITLES[page] || page}</h1>
        <span className="topbar-sub">{PAGE_SUBS[page] || ''}</span>
      </div>
      <div className="topbar-right">
        {badge && (
          <div className="topbar-alert-chip" style={{ background: mon ? 'rgba(52,211,153,0.12)' : 'rgba(251,191,36,0.12)', color: mon ? 'var(--success)' : 'var(--warn)' }}>
            <span>{badge}</span>
            {focusName && (
              <span className="chip-time">
                {' '}·{' '}
                <span style={{ color: isPersonal ? 'var(--accent)' : 'inherit', fontWeight: isPersonal ? 'bold' : 'normal' }}>
                  {isPersonal ? `★ ${focusName}` : focusName}
                </span>
              </span>
            )}
          </div>
        )}
        {isDangerous ? (
          <div className="topbar-alert-chip danger">
            <AlertTriangle size={13}/>
            <span>{latestAlert.animal_type} detected</span>
            <span className="chip-time">{ts}</span>
          </div>
        ) : latestAlert ? (
          <div className="topbar-alert-chip safe">
            <CheckCircle size={13}/>
            <span>{latestAlert.animal_detected ? `${latestAlert.animal_type} safe` : 'All clear'}</span>
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
