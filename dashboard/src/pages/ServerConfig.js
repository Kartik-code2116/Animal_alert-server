import { useState } from 'react';
import { Save, RefreshCw, CheckCircle, Database, Activity } from 'lucide-react';

export default function ServerConfig({
  serverConfig, setServerConfig, cameras, systemStatus,
  serverStatus, serverBase, setPrimaryCamera, setMonitoring, setDeploymentCity, refreshAll,
}) {
  const [local, setLocal] = useState({ ...serverConfig });
  const [saved, setSaved] = useState(false);
  const [cityInput, setCityInput] = useState(systemStatus?.deployment_city || 'Pune');

  const handleSave = () => {
    setServerConfig(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => setLocal({ ...serverConfig });
  const monitoringOn = systemStatus?.monitoring_enabled !== false;
  const primaryId = systemStatus?.active_detection_camera || cameras.find(c => c.is_primary)?.id || '';

  const F = ({ label, desc, field, type = 'number', min, max, step = 1 }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {desc && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4, marginBottom: 2 }}>{desc}</span>}
      <input
        className="form-input"
        type={type}
        min={min} max={max} step={step}
        value={local[field]}
        onChange={e => setLocal(l => ({ ...l, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
      />
    </div>
  );

  return (
    <div className="serverconfig-page">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <div className="section-header" style={{ marginBottom: 16 }}><h2>Connection</h2></div>
          <F label="Host" desc="Flask server hostname or IP" field="host" type="text" />
          <F label="Port" desc="Flask port (default: 5000)" field="port" type="text" />
        </div>

        <div className="card">
          <div className="section-header" style={{ marginBottom: 16 }}><h2>City &amp; Detection</h2></div>
          <div className="form-group">
            <label className="form-label">Deployment city</label>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Shown on maps in website + Android app (e.g. Pune, Mumbai)</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <input
                className="form-input"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="Pune"
                disabled={serverStatus !== 'online'}
              />
              <button
                className="btn btn-sm btn-primary"
                onClick={() => setDeploymentCity(cityInput)}
                disabled={serverStatus !== 'online'}
              >
                Save city
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Primary detection camera</label>
            <select
              className="form-select"
              value={primaryId}
              onChange={e => setPrimaryCamera(e.target.value)}
              disabled={serverStatus !== 'online'}
            >
              {cameras.map(c => (
                <option key={c.id} value={c.id}>{c.name || c.id} ({c.id})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className={`btn btn-sm ${monitoringOn ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => setMonitoring(!monitoringOn)}
              disabled={serverStatus !== 'online'}
            >
              {monitoringOn ? 'Stop monitoring' : 'Start monitoring'}
            </button>
            <button className="btn btn-sm" onClick={refreshAll} disabled={serverStatus !== 'online'}>
              <RefreshCw size={13}/> Sync
            </button>
          </div>
        </div>

        <div className="card">
          <div className="section-header" style={{ marginBottom: 16 }}><h2>Poll Intervals</h2></div>
          <F label="Dashboard Poll Interval (s)" desc="How often dashboard fetches latest alert" field="pollInterval" min={1} max={30} />
          <F label="Detection Interval (s)" desc="Server auto-detection loop (server.py)" field="detectionInterval" min={1} max={60} />
        </div>

        <div className="card">
          <div className="section-header" style={{ marginBottom: 16 }}><h2>Health</h2></div>
          <div className="config-info-rows">
            <InfoRow label="Server" value={serverStatus === 'online' ? 'Online' : 'Offline'} icon={<Activity size={12}/>} />
            <InfoRow label="MongoDB" value={systemStatus?.mongodb_connected ? 'Connected' : 'Offline / mock'} icon={<Database size={12}/>} />
            <InfoRow label="City" value={systemStatus?.deployment_city || cityInput} />
            <InfoRow label="Monitoring" value={monitoringOn ? 'ON' : 'OFF'} />
            <InfoRow label="Camera numbers" value="1, 2, 3… on GET /api/cameras" />
            <InfoRow label="API Base" value={serverBase} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        <button className="btn" onClick={reset}><RefreshCw size={14}/> Reset</button>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><CheckCircle size={14}/> Saved!</> : <><Save size={14}/> Save Config</>}
        </button>
      </div>

      <div className="card" style={{ marginTop: 28 }}>
        <div className="section-header" style={{ marginBottom: 16 }}><h2>API Reference (Android + Website)</h2></div>
        <div className="table-wrap">
          <table className="wt-table">
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              {[
                ['GET', '/health', 'Server health'],
                ['GET', '/latest-alert', 'Latest detection (app polls every 3s)'],
                ['GET', '/api/cameras', 'Camera list for map'],
                ['POST', '/api/cameras', 'Add camera'],
                ['PUT', '/api/cameras/:id', 'Update camera; set_primary in body'],
                ['DELETE', '/api/cameras/:id', 'Remove camera'],
                ['POST', '/api/cameras/:id/control', 'start | stop | set_primary'],
                ['GET', '/api/system/status', 'Monitoring + camera stats'],
                ['PUT', '/api/system/settings', 'monitoring_enabled, active_detection_camera'],
                ['GET', '/api/alerts', 'Last 100 alerts (MongoDB)'],
                ['DELETE', '/api/alerts', 'Clear server history'],
                ['POST', '/api/auth/login', 'App login'],
                ['POST', '/api/auth/register', 'App register'],
                ['GET', '/video_feed', 'Primary MJPEG (browser)'],
              ].map(([m, e, d]) => (
                <tr key={e}>
                  <td><span className={`method-badge ${m.toLowerCase()}`}>{m}</span></td>
                  <td className="mono primary">{e}</td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</span>
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{value}</span>
    </div>
  );
}
