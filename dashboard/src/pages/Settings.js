import { useState } from 'react';
import { Save, CheckCircle, Info } from 'lucide-react';

export default function Settings() {
  const [prefs, setPrefs] = useState(() => {
    const s = localStorage.getItem('wt_prefs');
    return s ? JSON.parse(s) : {
      projectName: 'WildTrack Animal Alert',
      location: 'Pune, Maharashtra',
      timezone: 'Asia/Kolkata',
      dangerousAnimals: 'Tiger,Leopard,Bear,Elephant,Crocodile',
      enableSoundAlerts: false,
      enableDesktopNotifs: false,
      autoExport: false,
    };
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    try {
      localStorage.setItem('wt_prefs', JSON.stringify(prefs));
      setSaved(true);
    } catch (e) {
      console.warn('Failed to save wt_prefs to localStorage:', e);
      alert('Failed to save preferences: storage full or restricted.');
    }
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (k, v) => setPrefs(p => ({ ...p, [k]: v }));

  return (
    <div className="settings-page">
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
        {/* Project */}
        <div className="card">
          <div className="section-header" style={{marginBottom:16}}><h2>Project Info</h2></div>
          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input className="form-input" value={prefs.projectName} onChange={e=>set('projectName',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Deployment Location</label>
            <input className="form-input" value={prefs.location} onChange={e=>set('location',e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Timezone</label>
            <input className="form-input" value={prefs.timezone} onChange={e=>set('timezone',e.target.value)} />
          </div>
        </div>

        {/* Detection */}
        <div className="card">
          <div className="section-header" style={{marginBottom:16}}><h2>Detection Config</h2></div>
          <div className="form-group">
            <label className="form-label">Dangerous Animals</label>
            <span style={{fontSize:11,color:'var(--text-muted)',marginBottom:4,display:'block'}}>Comma-separated — used by server.py for priority alerts</span>
            <textarea
              className="form-input"
              rows={3}
              style={{resize:'vertical'}}
              value={prefs.dangerousAnimals}
              onChange={e=>set('dangerousAnimals',e.target.value)}
            />
          </div>
          <div className="notice-banner info" style={{fontSize:12}}>
            <Info size={13}/>
            Copy this list to <code style={{fontFamily:'var(--font-mono)',background:'rgba(255,255,255,0.06)',padding:'1px 5px',borderRadius:3}}>ml_models/detector.py</code> as DANGEROUS_ANIMALS
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <div className="section-header" style={{marginBottom:16}}><h2>Notifications</h2></div>
          <ToggleRow
            label="Sound Alerts"
            desc="Play a sound when an animal is detected"
            checked={prefs.enableSoundAlerts}
            onChange={v => set('enableSoundAlerts', v)}
          />
          <ToggleRow
            label="Desktop Notifications"
            desc="Show browser notification on detection"
            checked={prefs.enableDesktopNotifs}
            onChange={v => {
              if (v && Notification.permission !== 'granted') Notification.requestPermission();
              set('enableDesktopNotifs', v);
            }}
          />
          <ToggleRow
            label="Auto Export Alerts"
            desc="Automatically save alerts to CSV on page close"
            checked={prefs.autoExport}
            onChange={v => set('autoExport', v)}
          />
        </div>

        {/* About */}
        <div className="card">
          <div className="section-header" style={{marginBottom:16}}><h2>About</h2></div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <AboutRow label="App" value="WildTrack Dashboard" />
            <AboutRow label="Version" value="1.0.0" />
            <AboutRow label="Server" value="Flask + OpenCV + YOLO" />
            <AboutRow label="Android App" value="WildTrack Mobile" />
            <AboutRow label="Detection" value="ml_models/detector.py" />
            <AboutRow label="Built for" value="Wildlife monitoring" />
          </div>
          <div className="divider" />
          <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.7}}>
            This dashboard manages cameras and monitors the Flask REST server.
            To add CCTV cameras, go to <strong style={{color:'var(--text-secondary)'}}>Camera Management</strong>.
            The server accepts any camera source sending base64 frames to <code style={{fontFamily:'var(--font-mono)',color:'var(--accent)'}}>POST /camera/detect</code>.
          </div>
        </div>
      </div>

      <button className="btn btn-primary" style={{marginTop:24}} onClick={handleSave}>
        {saved ? <><CheckCircle size={14}/> Saved!</> : <><Save size={14}/> Save Preferences</>}
      </button>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
      <div>
        <div style={{fontSize:13,fontWeight:500,color:'var(--text-primary)'}}>{label}</div>
        <div style={{fontSize:11,color:'var(--text-muted)'}}>{desc}</div>
      </div>
      <button
        className={`toggle-btn ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
        aria-label={label}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}

function AboutRow({ label, value }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
      <span style={{color:'var(--text-muted)'}}>{label}</span>
      <span style={{color:'var(--text-secondary)',fontWeight:500}}>{value}</span>
    </div>
  );
}
