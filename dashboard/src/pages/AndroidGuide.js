import { useState } from 'react';
import { Smartphone, Server, Wifi, Copy, CheckCircle, Globe, Code, BookOpen, Info, AlertTriangle } from 'lucide-react';
import './pages.css';

const STEPS = [
  {
    num: '01',
    title: 'Start the Python Server',
    desc: 'Open a terminal in your project folder and run the server. Keep it running while testing.',
    code: 'cd "D:\\9)projects\\Animal_alert server"\npython server.py',
    tip: 'Or double-click run_server.bat — it does the same thing.',
    icon: <Server size={20} />,
    color: 'var(--success)',
  },
  {
    num: '02',
    title: "Find Your PC's Local IP",
    desc: 'Your Android phone needs to reach the server over Wi-Fi. Find your PC IP address.',
    code: '# Windows — run in CMD:\nipconfig\n\n# Look for: IPv4 Address . . . : 192.168.x.x',
    tip: 'Both devices must be on the same Wi-Fi network.',
    icon: <Wifi size={20} />,
    color: 'var(--accent)',
  },
  {
    num: '03',
    title: 'Configure the Android App',
    desc: 'In the WildTrack app, go to Settings and set the server URL using your PC local IP.',
    code: '// In the Android app Settings:\nBase URL → http://192.168.X.X:5000/',
    tip: "Include the trailing slash. Don't use \"localhost\" — that points to the phone itself.",
    icon: <Smartphone size={20} />,
    color: 'var(--warn)',
  },
  {
    num: '04',
    title: 'Test the Connection',
    desc: "Tap the Test Connection button in app settings, or open this URL in your phone's browser.",
    code: 'http://YOUR_PC_IP:5000/health\n\n// Expected response:\n{"status": "healthy"}',
    tip: 'If it fails, check your Windows Firewall — allow port 5000 for inbound connections.',
    icon: <Globe size={20} />,
    color: 'var(--accent)',
  },
  {
    num: '05',
    title: 'Map shows camera numbers',
    desc: 'Cameras from the website use camera_number (1, 2, 3…) and city from the server. Map markers should show the same numbers as the admin map.',
    code: 'GET /api/cameras\n// Example camera:\n{"id":"CAM_01","camera_number":2,"city":"Pune","name":"North Gate",...}',
    tip: 'In MapFragment.kt use marker.title = "#${cam.camera_number} ${cam.name}"',
    icon: <Globe size={20} />,
    color: 'var(--warn)',
  },
  {
    num: '06',
    title: 'Verify Live Alerts',
    desc: 'Go to the Alert System screen in the app. You should see "Service Running" with a green dot.',
    code: '// The app polls this endpoint every 3 seconds:\nGET http://YOUR_PC_IP:5000/latest-alert\n\n// Returns:\n{"animal_detected": false, "animal_type": null,\n "confidence": 0.0, "location": "...", "timestamp": ...}',
    tip: "The app polls every 3s — you'll see detections within 3 seconds of the server detecting.",
    icon: <CheckCircle size={20} />,
    color: 'var(--success)',
  },
  {
    num: '07',
    title: 'Implement Local Focus (Personal Primary Camera)',
    desc: 'Let each user set their focus camera locally. Store it in SharedPreferences and query /latest-alert?camera_id=CAM_XX to fetch camera-specific alerts.',
    code: '// 1. Save chosen focus camera ID to SharedPreferences:\nval prefs = ctx.getSharedPreferences("wt_prefs", Context.MODE_PRIVATE)\nprefs.edit().putString("personal_focus_cam", "CAM_03").apply()\n\n// 2. Add optional query parameter in Retrofit interface:\ninterface WildTrackApi {\n    @GET("latest-alert")\n    suspend fun getLatestAlert(\n        @Query("camera_id") cameraId: String?\n    ): Response<AlertResponse>\n}\n\n// 3. Retrieve focus and query from background AlertService:\nval currentFocus = prefs.getString("personal_focus_cam", null)\nval response = api.getLatestAlert(currentFocus)',
    tip: 'If camera_id is null or omitted, the server falls back automatically to the global active primary camera.',
    icon: <Smartphone size={20} />,
    color: 'var(--accent)',
  },
];

const API_ENDPOINTS = [
  { method: 'GET',  path: '/api/cameras',     desc: 'Each camera has camera_number (1,2,3…), city, is_primary — show # on map', used: 'MapFragment polls every 30s' },
  { method: 'GET',  path: '/api/system/status', desc: 'deployment_city + camera counts for dashboard badge', used: 'DashboardFragment' },
  { method: 'GET',  path: '/health',          desc: 'Health check — returns {"status":"healthy"}', used: 'App startup check' },
  { method: 'GET',  path: '/latest-alert',    desc: 'Latest alert. Accepts optional ?camera_id=CAM_XX to filter alerts locally.', used: 'Polled every 3s by AlertService' },
  { method: 'POST', path: '/register/camera', desc: 'Register a camera with GPS coords',            used: 'Camera Management → Add Camera' },
  { method: 'POST', path: '/camera/detect',   desc: 'Submit a base64 JPEG for ML inference',        used: 'CCTV frame submission' },
  { method: 'GET',  path: '/video_feed',      desc: 'MJPEG stream (browser preview). Supports ?camera_id=CAM_XX', used: 'Dashboard live feed' },
  { method: 'GET',  path: '/preview',         desc: 'Styled browser monitor page',                  used: 'Quick preview' },
];

const ANDROID_CONFIG = [
  { label: 'Variable',       value: 'BASE_URL',             file: 'build.gradle.kts → BuildConfig' },
  { label: 'Format',         value: 'http://192.168.X.X:5000/', file: 'Include trailing slash' },
  { label: 'Poll interval',  value: '3 seconds',            file: 'AlertService.kt' },
  { label: 'Health timeout', value: '2 seconds',            file: 'App health check' },
  { label: 'Auth',           value: 'None (planned JWT)',    file: 'Phase 1 of upgrade plan' },
  { label: 'Protocol',       value: 'HTTP → HTTPS (future)',file: 'Upgrade Phase 1: cert pinning' },
];

const FIREWALL_STEPS = [
  'Press Win+R, type wf.msc, hit Enter',
  'Click "Inbound Rules" → "New Rule"',
  'Select "Port" → TCP → Specific local port: 5000',
  'Select "Allow the connection"',
  'Apply to all profiles, name it "WildTrack Server"',
];

export default function AndroidGuide({ serverStatus, serverConfig }) {
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [urlInput, setUrlInput] = useState('192.168.1.100');
  const serverUrl = `http://${urlInput}:${serverConfig?.port || 5000}/`;

  const copy = (text, idx) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  return (
    <div className="android-guide">
      {/* Hero */}
      <div className="ag-hero">
        <div className="ag-hero-icon">
          <Smartphone size={28} />
        </div>
        <div>
          <div className="ag-hero-title">Android App Connection Guide</div>
          <div className="ag-hero-sub">Step-by-step setup to connect WildTrack mobile to this server</div>
        </div>
        <div
          className={`pill ${serverStatus === 'online' ? 'pill-online' : 'pill-offline'}`}
          style={{ marginLeft: 'auto' }}
        >
          <span className="pill-dot pulse" />
          Server {serverStatus === 'online' ? 'running — ready to connect' : 'offline — start server.py first'}
        </div>
      </div>

      {/* URL builder */}
      <div className="card ag-url-builder">
        <div className="section-header" style={{ marginBottom: 14 }}>
          <h2>🔗 Your Server URL</h2>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter this in the Android app settings</span>
        </div>
        <div className="ag-url-row">
          <span className="ag-url-prefix">http://</span>
          <input
            className="form-input ag-url-input"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="192.168.1.100"
          />
          <span className="ag-url-suffix">:{serverConfig?.port || 5000}/</span>
          <button className="btn btn-primary" onClick={() => copy(serverUrl, 'url')}>
            {copiedIdx === 'url'
              ? <><CheckCircle size={13} /> Copied!</>
              : <><Copy size={13} /> Copy URL</>}
          </button>
        </div>
        <div className="ag-url-full mono">{serverUrl}</div>
        <div className="notice-banner info" style={{ marginTop: 10 }}>
          <Info size={13} />
          Replace the IP with your PC actual local IP — run{' '}
          <code style={{ fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 3 }}>
            ipconfig
          </code>{' '}
          in CMD to find it.
        </div>
      </div>

      {/* Steps */}
      <div className="ag-steps">
        {STEPS.map((step, i) => (
          <div key={i} className="ag-step-card">
            <div className="ag-step-num" style={{ color: step.color, borderColor: step.color }}>
              {step.num}
            </div>
            <div className="ag-step-body">
              <div className="ag-step-header">
                <div className="ag-step-icon" style={{ color: step.color, background: `${step.color}18` }}>
                  {step.icon}
                </div>
                <div>
                  <div className="ag-step-title">{step.title}</div>
                  <div className="ag-step-desc">{step.desc}</div>
                </div>
              </div>
              <div className="ag-code-block">
                <pre className="ag-pre">{step.code}</pre>
                <button className="ag-copy-btn" onClick={() => copy(step.code, i)}>
                  {copiedIdx === i ? <CheckCircle size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <div className="ag-tip">
                <span className="ag-tip-dot">💡</span>
                {step.tip}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Android app config reference */}
      <div className="card">
        <div className="section-header" style={{ marginBottom: 16 }}>
          <h2>
            <Code size={15} style={{ display: 'inline', marginRight: 6 }} />
            Android App Config Reference
          </h2>
        </div>
        <div className="table-wrap">
          <table className="wt-table">
            <thead>
              <tr><th>Config Item</th><th>Value</th><th>Location</th></tr>
            </thead>
            <tbody>
              {ANDROID_CONFIG.map((r, i) => (
                <tr key={i}>
                  <td className="primary mono" style={{ fontSize: 12 }}>{r.label}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>{r.value}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.file}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* API endpoints */}
      <div className="card">
        <div className="section-header" style={{ marginBottom: 16 }}>
          <h2>
            <BookOpen size={15} style={{ display: 'inline', marginRight: 6 }} />
            API Endpoints Used by the App
          </h2>
        </div>
        <div className="table-wrap">
          <table className="wt-table">
            <thead>
              <tr><th>Method</th><th>Endpoint</th><th>What it does</th><th>Used by</th></tr>
            </thead>
            <tbody>
              {API_ENDPOINTS.map((ep, i) => (
                <tr key={i}>
                  <td><span className={`method-badge ${ep.method.toLowerCase()}`}>{ep.method}</span></td>
                  <td className="primary mono" style={{ fontSize: 12 }}>{ep.path}</td>
                  <td style={{ fontSize: 12 }}>{ep.desc}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ep.used}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Firewall guide */}
      <div className="card ag-firewall">
        <div className="section-header" style={{ marginBottom: 14 }}>
          <h2>
            <AlertTriangle size={15} style={{ display: 'inline', marginRight: 6, color: 'var(--warn)' }} />
            Windows Firewall Setup (if connection fails)
          </h2>
        </div>
        <div className="ag-firewall-steps">
          {FIREWALL_STEPS.map((s, i) => (
            <div key={i} className="ag-firewall-step">
              <div className="ag-fw-num">{i + 1}</div>
              <div className="ag-fw-text">{s}</div>
            </div>
          ))}
        </div>
        <div className="ag-code-block" style={{ marginTop: 12 }}>
          <pre className="ag-pre">{`# Or via PowerShell (run as Admin):\nnetsh advfirewall firewall add rule name="WildTrack" dir=in action=allow protocol=TCP localport=5000`}</pre>
          <button
            className="ag-copy-btn"
            onClick={() => copy('netsh advfirewall firewall add rule name="WildTrack" dir=in action=allow protocol=TCP localport=5000', 'fw')}
          >
            {copiedIdx === 'fw' ? <CheckCircle size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Upgrade note */}
      <div className="card ag-upgrade-note">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 22 }}>🚀</div>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 14 }}>
              Upgrade Plan Note — Security (Phase 1)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Currently the connection uses plain HTTP with no authentication. Per your{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Upgrade Plan Phase 1</strong>, this should be
              replaced with: HTTPS + certificate pinning (OkHttp), JWT refresh tokens in
              EncryptedSharedPreferences, and{' '}
              <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>BuildConfig.BASE_URL</code>{' '}
              instead of a hardcoded IP. This dashboard URL builder is a temporary dev tool.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
