import { useState } from 'react';
import { Camera, Wifi, Copy, CheckCircle, Play, AlertTriangle, Info, Code, ChevronDown, ChevronRight, Settings } from 'lucide-react';

const RTSP_BRANDS = [
  { brand: 'Hikvision',   fmt: 'rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101' },
  { brand: 'Dahua',       fmt: 'rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0' },
  { brand: 'Reolink',     fmt: 'rtsp://admin:password@192.168.1.100:554/h264Preview_01_main' },
  { brand: 'Axis',        fmt: 'rtsp://admin:password@192.168.1.100/axis-media/media.amp' },
  { brand: 'Amcrest',     fmt: 'rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0' },
  { brand: 'Generic/ONVIF', fmt: 'rtsp://admin:password@192.168.1.100:554/onvif/profile_s/media.smp' },
];

const INTEGRATION_STEPS = [
  {
    title: 'Add the camera in Camera Management',
    desc: 'Go to Camera Management → Add Camera. Fill in Camera ID, GPS coordinates, type = RTSP, and the RTSP URL of the stream.',
    code: null,
  },
  {
    title: 'Test the RTSP URL in VLC',
    desc: 'Before connecting to the server, verify your RTSP stream works.',
    code: 'VLC Media Player → Media → Open Network Stream\n→ Paste your RTSP URL → Play',
  },
  {
    title: 'Write a Python capture script',
    desc: 'Create a script that reads frames from the RTSP stream and posts them to the server.',
    code: `# cctv_client.py — run alongside server.py
import cv2, base64, requests, time

CAMERA_ID  = "CAM_01"
RTSP_URL   = "rtsp://admin:pass@192.168.1.100:554/stream"
SERVER_URL = "http://localhost:5000"

cap = cv2.VideoCapture(RTSP_URL)
print(f"[INFO] Starting CCTV stream: {CAMERA_ID}")

while True:
    ret, frame = cap.read()
    if not ret:
        print("[WARN] Frame read failed, retrying...")
        time.sleep(2)
        cap = cv2.VideoCapture(RTSP_URL)
        continue

    _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    b64 = base64.b64encode(jpeg.tobytes()).decode("utf-8")

    try:
        r = requests.post(f"{SERVER_URL}/camera/detect",
                          json={"camera_id": CAMERA_ID, "image": b64},
                          timeout=5)
        data = r.json()
        if data.get("dangerous"):
            print(f"[ALERT] {data['detections']}")
    except Exception as e:
        print(f"[ERROR] {e}")

    time.sleep(2)  # run detection every 2s`,
  },
  {
    title: 'Register the camera on startup',
    desc: 'The server needs to know about your camera. This is done when you add it via the dashboard, but you can also call the API directly.',
    code: `# Register via curl (or use the dashboard)
curl -X POST http://localhost:5000/register/camera \\
  -H "Content-Type: application/json" \\
  -d '{"camera_id": "CAM_01", "location": "18.5204,73.8567"}'`,
  },
  {
    title: 'Run both scripts together',
    desc: 'Run server.py and your CCTV client script simultaneously. The client posts frames; the server runs ML and updates the alert state.',
    code: `# Terminal 1
python server.py

# Terminal 2
python cctv_client.py

# The Android app will now receive alerts from your CCTV camera`,
  },
];

export default function CctvSetup({ cameras, serverStatus, serverBase, serverConfig }) {
  const [copied, setCopied] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [rtspBuilder, setRtspBuilder] = useState({
    user: 'admin', pass: 'password', ip: '192.168.1.100', port: '554', path: '/stream'
  });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const builtUrl = `rtsp://${rtspBuilder.user}:${rtspBuilder.pass}@${rtspBuilder.ip}:${rtspBuilder.port}${rtspBuilder.path}`;

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  };

  const testServer = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch(`${serverBase}/health`, { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      setTestResult({ ok: true, msg: `Server healthy · Response: ${JSON.stringify(d)}` });
    } catch (e) {
      setTestResult({ ok: false, msg: `Connection failed: ${e.message}` });
    }
    setTesting(false);
  };

  return (
    <div className="cctv-setup">
      {/* Hero */}
      <div className="ag-hero">
        <div className="ag-hero-icon" style={{background:'rgba(251,191,36,0.12)',color:'var(--warn)'}}>
          <Camera size={28}/>
        </div>
        <div>
          <div className="ag-hero-title">CCTV / RTSP Camera Setup</div>
          <div className="ag-hero-sub">Connect IP cameras, CCTV systems, and RTSP streams to WildTrack</div>
        </div>
        <button className="btn btn-sm" style={{marginLeft:'auto'}} onClick={testServer} disabled={testing}>
          {testing ? <><RefreshCwIcon/> Testing…</> : <><Play size={13}/> Test Server</>}
        </button>
      </div>

      {testResult && (
        <div className={`notice-banner ${testResult.ok ? 'info' : 'warn'}`}>
          {testResult.ok ? <CheckCircle size={13}/> : <AlertTriangle size={13}/>}
          {testResult.msg}
        </div>
      )}

      {/* RTSP URL builder */}
      <div className="card">
        <div className="section-header" style={{marginBottom:16}}>
          <h2>🔧 RTSP URL Builder</h2>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>Build your camera's stream URL</span>
        </div>
        <div className="rtsp-builder-grid">
          {[
            {label:'Username', key:'user', placeholder:'admin'},
            {label:'Password', key:'pass', placeholder:'password', type:'password'},
            {label:'Camera IP', key:'ip', placeholder:'192.168.1.100'},
            {label:'Port', key:'port', placeholder:'554'},
            {label:'Stream Path', key:'path', placeholder:'/stream'},
          ].map(f => (
            <div key={f.key} className="form-group" style={{marginBottom:0}}>
              <label className="form-label">{f.label}</label>
              <input
                className="form-input"
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={rtspBuilder[f.key]}
                onChange={e => setRtspBuilder(p => ({...p, [f.key]: e.target.value}))}
              />
            </div>
          ))}
        </div>
        <div className="rtsp-result">
          <span className="rtsp-label">Generated URL:</span>
          <span className="rtsp-url mono">{builtUrl}</span>
          <button className="btn btn-sm btn-primary" onClick={() => copy(builtUrl, 'rtsp')}>
            {copied === 'rtsp' ? <><CheckCircle size={12}/> Copied!</> : <><Copy size={12}/> Copy</>}
          </button>
        </div>
      </div>

      {/* Brand-specific URLs */}
      <div className="card">
        <div className="section-header" style={{marginBottom:14}}>
          <h2>📷 RTSP URL Formats by Brand</h2>
        </div>
        <div className="rtsp-brands">
          {RTSP_BRANDS.map((b,i) => (
            <div key={i} className="rtsp-brand-row">
              <span className="rtsp-brand-name">{b.brand}</span>
              <span className="rtsp-brand-url mono">{b.fmt}</span>
              <button className="btn btn-sm btn-icon" onClick={() => copy(b.fmt, `brand-${i}`)}>
                {copied === `brand-${i}` ? <CheckCircle size={12}/> : <Copy size={12}/>}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Integration steps */}
      <div className="card">
        <div className="section-header" style={{marginBottom:14}}>
          <h2><Code size={15} style={{display:'inline',marginRight:6}}/>Integration Steps</h2>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>Follow these to connect any CCTV camera</span>
        </div>
        <div className="cctv-steps">
          {INTEGRATION_STEPS.map((step, i) => (
            <div key={i} className="cctv-step">
              <button
                className="cctv-step-header"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div className="cctv-step-num">{String(i+1).padStart(2,'0')}</div>
                <div className="cctv-step-title">{step.title}</div>
                {expanded === i ? <ChevronDown size={14} style={{marginLeft:'auto',color:'var(--accent)'}}/> : <ChevronRight size={14} style={{marginLeft:'auto',color:'var(--text-muted)'}}/>}
              </button>
              {expanded === i && (
                <div className="cctv-step-body">
                  <p className="cctv-step-desc">{step.desc}</p>
                  {step.code && (
                    <div className="ag-code-block" style={{marginTop:10}}>
                      <pre className="ag-pre">{step.code}</pre>
                      <button className="ag-copy-btn" onClick={() => copy(step.code, `step-${i}`)}>
                        {copied === `step-${i}` ? <CheckCircle size={12}/> : <Copy size={12}/>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Registered cameras table */}
      <div className="card">
        <div className="section-header" style={{marginBottom:14}}>
          <h2>Registered Cameras</h2>
          <span style={{fontSize:11,color:'var(--text-muted)'}}>{cameras.length} cameras · {cameras.filter(c=>c.status==='active').length} active</span>
        </div>
        {cameras.length === 0 ? (
          <div className="empty-state">
            <Camera size={28}/><p>No cameras yet — add them in Camera Management</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="wt-table">
              <thead>
                <tr><th>ID</th><th>Name</th><th>Type</th><th>GPS</th><th>RTSP URL</th><th>Status</th></tr>
              </thead>
              <tbody>
                {cameras.map(cam => (
                  <tr key={cam.id}>
                    <td className="primary mono" style={{fontSize:12}}>{cam.id}</td>
                    <td>{cam.name || '—'}</td>
                    <td><span className="method-badge get" style={{textTransform:'uppercase'}}>{cam.type}</span></td>
                    <td className="mono" style={{fontSize:11}}>{cam.location}</td>
                    <td className="mono" style={{fontSize:11,color:'var(--text-muted)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {cam.rtspUrl || <span style={{opacity:0.4}}>Not set</span>}
                    </td>
                    <td>
                      <span className={`pill ${cam.status==='active' ? 'pill-online':'pill-offline'}`} style={{fontSize:10}}>
                        <span className="pill-dot"/>{cam.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="notice-banner info" style={{marginTop:12}}>
          <Info size={13}/>
          Add RTSP URLs when creating cameras in <strong>Camera Management</strong>. They're stored locally for reference.
        </div>
      </div>

      {/* Architecture note */}
      <div className="card">
        <div className="section-header" style={{marginBottom:12}}>
          <h2>⚡ How Multi-Camera Detection Works</h2>
        </div>
        <div className="arch-flow">
          {[
            { label: 'CCTV / IP Camera', icon: '📷', sub: 'RTSP stream' },
            { label: 'cctv_client.py', icon: '🐍', sub: 'Reads frames, POSTs base64' },
            { label: 'Flask Server', icon: '⚙️', sub: 'POST /camera/detect' },
            { label: 'YOLOv8 Model', icon: '🧠', sub: 'ML inference' },
            { label: 'Android App', icon: '📱', sub: 'GET /latest-alert (3s poll)' },
          ].map((node, i, arr) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:0}}>
              <div className="arch-flow-node">
                <div className="arch-flow-icon">{node.icon}</div>
                <div className="arch-flow-label">{node.label}</div>
                <div className="arch-flow-sub">{node.sub}</div>
              </div>
              {i < arr.length - 1 && <div className="arch-flow-arrow">→</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RefreshCwIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}
