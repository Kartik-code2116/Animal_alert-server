import { useState } from 'react';
import { Save, RefreshCw, CheckCircle } from 'lucide-react';

export default function ServerConfig({ serverConfig, setServerConfig }) {
  const [local, setLocal] = useState({ ...serverConfig });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setServerConfig(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => setLocal({ ...serverConfig });

  const F = ({ label, desc, field, type='number', min, max, step=1 }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {desc && <span style={{fontSize:11,color:'var(--text-muted)',marginTop:-4,marginBottom:2}}>{desc}</span>}
      <input
        className="form-input"
        type={type}
        min={min} max={max} step={step}
        value={local[field]}
        onChange={e => setLocal(l => ({ ...l, [field]: type==='number' ? Number(e.target.value) : e.target.value }))}
      />
    </div>
  );

  return (
    <div className="serverconfig-page">
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
        {/* Connection */}
        <div className="card">
          <div className="section-header" style={{marginBottom:16}}><h2>Connection</h2></div>
          <F label="Host" desc="Flask server hostname or IP" field="host" type="text" />
          <F label="Port" desc="Flask port (default: 5000)" field="port" type="text" />
        </div>

        {/* Polling */}
        <div className="card">
          <div className="section-header" style={{marginBottom:16}}><h2>Poll Intervals</h2></div>
          <F label="Dashboard Poll Interval (s)" desc="How often dashboard fetches latest alert" field="pollInterval" min={1} max={30} />
          <F label="Detection Interval (s)" desc="Matches server auto-detection loop" field="detectionInterval" min={1} max={60} />
        </div>

        {/* Camera/stream */}
        <div className="card">
          <div className="section-header" style={{marginBottom:16}}><h2>Stream Quality</h2></div>
          <F label="JPEG Quality" desc="0–100 for /video_feed and detection frames" field="jpegQuality" min={10} max={100} />
          <F label="Preview FPS" desc="Target FPS for browser preview" field="previewFps" min={1} max={60} />
        </div>

        {/* Info card */}
        <div className="card">
          <div className="section-header" style={{marginBottom:16}}><h2>Server Info</h2></div>
          <div className="config-info-rows">
            <InfoRow label="API Base" value={`http://${local.host}:${local.port}`} />
            <InfoRow label="Health" value={`http://${local.host}:${local.port}/health`} />
            <InfoRow label="Latest Alert" value={`/latest-alert`} />
            <InfoRow label="Register Camera" value={`POST /register/camera`} />
            <InfoRow label="Submit Frame" value={`POST /camera/detect`} />
            <InfoRow label="Live Preview" value={`http://${local.host}:${local.port}/preview`} />
            <InfoRow label="MJPEG Feed" value={`/video_feed`} />
          </div>
        </div>
      </div>

      <div style={{display:'flex',gap:10,marginTop:24}}>
        <button className="btn" onClick={reset}><RefreshCw size={14}/> Reset</button>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <><CheckCircle size={14}/> Saved!</> : <><Save size={14}/> Save Config</>}
        </button>
      </div>

      {/* API Reference */}
      <div className="card" style={{marginTop:28}}>
        <div className="section-header" style={{marginBottom:16}}><h2>API Reference</h2></div>
        <div className="table-wrap">
          <table className="wt-table">
            <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
            <tbody>
              {[
                ['GET',  '/health',           'Server health check'],
                ['GET',  '/latest-alert',     'Latest detection state (polled by app)'],
                ['POST', '/register/camera',  'Register a CCTV camera with its GPS coordinates'],
                ['POST', '/camera/detect',    'Submit a base64 JPEG frame for ML inference'],
                ['GET',  '/preview',          'Browser live monitor with overlay'],
                ['GET',  '/video_feed',       'Raw MJPEG stream'],
              ].map(([m,e,d]) => (
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

function InfoRow({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
      <span style={{fontSize:12,color:'var(--text-muted)'}}>{label}</span>
      <span style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--accent)'}}>{value}</span>
    </div>
  );
}
