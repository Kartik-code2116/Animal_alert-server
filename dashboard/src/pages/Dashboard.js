import { Camera, AlertTriangle, CheckCircle, Activity, Clock, Eye, Play, Square, RefreshCw, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { isDangerousDetection } from '../utils/detection';

// Fix: accept serverBase from props so the live feed URL follows user-configured server address
export default function Dashboard({ serverStatus, latestAlert, alertHistory, cameras, serverBase, systemStatus, setMonitoring, refreshAll, personalPrimary, effectivePrimary }) {
  const activeCams = systemStatus?.cameras?.active ?? cameras.filter(c => c.status === 'active').length;
  const totalCams = systemStatus?.cameras?.total ?? cameras.length;
  const offlineCams = systemStatus?.cameras?.offline ?? cameras.filter(c => c.status === 'offline').length;
  const monitoringOn = systemStatus?.monitoring_enabled !== false;
  const isDangerous = isDangerousDetection(latestAlert);
  const primaryName = systemStatus?.primary_camera?.name || cameras.find(c => c.is_primary)?.name || '—';
  const focusedCamera = cameras.find(c => c.id === effectivePrimary);
  const focusedCameraName = focusedCamera?.name || effectivePrimary || primaryName;
  const isPersonalFocus = Boolean(personalPrimary && personalPrimary === effectivePrimary);
  const todayAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return alertHistory.filter(a => {
      const ts = a.timestamp ? (a.timestamp > 1e12 ? a.timestamp : a.timestamp * 1000) : a.id;
      return new Date(ts) >= today;
    }).length;
  }, [alertHistory]);

  // Build hourly chart data from history
  const chartData = useMemo(() => {
    const hours = {};
    for (let i = 23; i >= 0; i--) {
      const h = new Date();
      h.setHours(h.getHours() - i, 0, 0, 0);
      hours[h.getHours()] = { hour: `${String(h.getHours()).padStart(2,'0')}:00`, alerts: 0 };
    }
    alertHistory.forEach(a => {
      const ts = a.timestamp ? (a.timestamp > 1e12 ? a.timestamp : a.timestamp * 1000) : a.id;
      const h = new Date(ts).getHours();
      if (hours[h]) hours[h].alerts++;
    });
    return Object.values(hours);
  }, [alertHistory]);

  // Species breakdown
  const speciesMap = useMemo(() => {
    const m = {};
    alertHistory.forEach(a => {
      if (a.animal_type) m[a.animal_type] = (m[a.animal_type] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [alertHistory]);

  const recent = alertHistory.slice(0, 5);

  return (
    <div className="dashboard">
      {/* Operations controls */}
      <div className="card" style={{marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12}}>
        <div>
          <div style={{fontSize:11, color:'var(--text-muted)', marginBottom:4}}>Operations</div>
          <div style={{fontSize:15, fontWeight:700, color: monitoringOn ? 'var(--success)' : 'var(--warn)'}}>
            {monitoringOn ? 'MONITORING ON' : 'MONITORING PAUSED'}
            <span style={{fontWeight:400, color:'var(--text-secondary)', fontSize:12, marginLeft:10}}>
              · {activeCams}/{totalCams} cameras · {primaryName}
            </span>
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          {monitoringOn ? (
            <button className="btn btn-sm btn-danger" onClick={() => setMonitoring(false)} disabled={serverStatus !== 'online'}>
              <Square size={13}/> Stop All Monitoring
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={() => setMonitoring(true)} disabled={serverStatus !== 'online'}>
              <Play size={13}/> Start Monitoring
            </button>
          )}
          <button className="btn btn-sm" onClick={refreshAll} disabled={serverStatus !== 'online'}>
            <RefreshCw size={13}/> Refresh
          </button>
        </div>
      </div>

      {/* Stat row */}
      <div className="stats-grid">
        <StatCard
          label="Server Status"
          value={serverStatus === 'online' ? 'Online' : 'Offline'}
          sub="Flask REST API"
          color={serverStatus === 'online' ? 'var(--success)' : 'var(--danger)'}
          icon={<Activity size={18} />}
        />
        <StatCard
          label="Active Cameras"
          value={activeCams}
          sub={`${offlineCams} offline`}
          color="var(--accent)"
          icon={<Camera size={18} />}
        />
        <StatCard
          label="Alerts Today"
          value={todayAlerts}
          sub={`${alertHistory.length} total recorded`}
          color="var(--warn)"
          icon={<AlertTriangle size={18} />}
        />
        <StatCard
          label="Current Status"
          value={isDangerous ? 'ALERT' : 'Safe'}
          sub={latestAlert?.animal_type || 'No detection'}
          color={isDangerous ? 'var(--danger)' : 'var(--success)'}
          icon={<Eye size={18} />}
        />
      </div>

      <div className="dash-grid-2">
        {/* Live feed card */}
        <div className="card">
          <div className="section-header live-feed-header">
            <div className="live-feed-title-block">
              <h2>Live Camera Feed</h2>
              <div className="live-camera-meta">
                <span className="live-camera-label">Camera</span>
                <span className={`live-camera-name ${isPersonalFocus ? 'personal' : ''}`}>
                  {focusedCameraName}
                </span>
                {isPersonalFocus && (
                  <span className="live-focus-badge">
                    <Star size={10} />
                    Personal Focus
                  </span>
                )}
              </div>
            </div>
            <span className={`pill ${serverStatus === 'online' ? 'pill-online' : 'pill-offline'}`}>
              <span className={`pill-dot ${serverStatus === 'online' ? 'pulse' : ''}`}/>
              {serverStatus === 'online' ? 'Streaming' : 'Offline'}
            </span>
          </div>
          {serverStatus === 'online' ? (
            <div className="live-feed-wrap">
              <img
                src={`${serverBase}/video_feed?camera_id=${effectivePrimary}`}
                alt="Live camera feed"
                className="live-feed-img"
                onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
              <div className="feed-error" style={{display:'none'}}>
                <Camera size={32} />
                <p>Feed unavailable</p>
              </div>
              {isDangerous && (
                <div className="live-overlay-badge">
                  <AlertTriangle size={12} />
                  {latestAlert.animal_type} — {latestAlert.confidence}%
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{minHeight:200}}>
              <Camera size={36} />
              <p>Server offline — start server.py to view feed</p>
            </div>
          )}
        </div>

        {/* Latest detection */}
        <div className="card">
          <div className="section-header">
            <h2>Latest Detection</h2>
            {latestAlert && (
              <span className="text-muted mono" style={{fontSize:11}}>
                {latestAlert.timestamp ? new Date(latestAlert.timestamp*1000).toLocaleTimeString() : '—'}
              </span>
            )}
          </div>
          {latestAlert ? (
            <div className="detection-detail">
              <div className={`detection-status-icon ${isDangerous ? 'alert' : 'clear'}`}>
                {isDangerous
                  ? <AlertTriangle size={28} />
                  : <CheckCircle size={28} />}
              </div>
              <div className="detection-rows">
                <DetRow label="Animal" value={latestAlert.animal_type || 'None'} />
                <DetRow label="Confidence" value={latestAlert.confidence ? `${latestAlert.confidence}%` : '—'} />
                <DetRow label="Location" value={latestAlert.location || '—'} mono />
                <DetRow label="Status" value={isDangerous ? 'Danger' : 'Safe'} />
              </div>
              {latestAlert.image && (
                <div className="detection-thumb-wrap">
                  <img
                    src={`data:image/jpeg;base64,${latestAlert.image}`}
                    alt="Detection"
                    className="detection-thumb"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{minHeight:180}}>
              <Clock size={28} />
              <p>Waiting for first poll…</p>
            </div>
          )}
        </div>
      </div>

      <div className="dash-grid-2">
        {/* Alert frequency chart */}
        <div className="card">
          <div className="section-header">
            <h2>Alert Frequency (24h)</h2>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{top:4,right:4,bottom:0,left:-20}}>
              <XAxis dataKey="hour" tick={{fontSize:10, fill:'var(--text-muted)'}} interval={3} />
              <YAxis tick={{fontSize:10, fill:'var(--text-muted)'}} allowDecimals={false} />
              <Tooltip
                contentStyle={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:6,fontSize:12}}
                labelStyle={{color:'var(--text-secondary)'}}
                itemStyle={{color:'var(--accent)'}}
              />
              <Line type="monotone" dataKey="alerts" stroke="var(--accent)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Species breakdown */}
        <div className="card">
          <div className="section-header"><h2>Top Detected Species</h2></div>
          {speciesMap.length === 0 ? (
            <div className="empty-state" style={{minHeight:140}}>
              <p>No detections recorded yet</p>
            </div>
          ) : (
            <div className="species-list">
              {speciesMap.map(([name, count]) => {
                const pct = Math.round((count / alertHistory.length) * 100);
                return (
                  <div key={name} className="species-row">
                    <span className="species-name">{name}</span>
                    <div className="species-bar-wrap">
                      <div className="species-bar" style={{width:`${pct}%`}} />
                    </div>
                    <span className="species-count">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent alerts table */}
      <div className="card">
        <div className="section-header">
          <h2>Recent Alerts</h2>
          <span className="text-muted" style={{fontSize:12}}>{alertHistory.length} total</span>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={28} />
            <p>No alerts recorded this session</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="wt-table">
              <thead>
                <tr>
                  <th>Animal</th>
                  <th>Confidence</th>
                  <th>Location</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(a => (
                  <tr key={a.id}>
                    <td className="primary">{a.animal_type}</td>
                    <td><ConfidenceBadge conf={a.confidence} /></td>
                    <td className="mono" style={{fontSize:11}}>{a.location}</td>
                    <td>{new Date(a.timestamp ? (a.timestamp > 1e12 ? a.timestamp : a.timestamp * 1000) : a.id).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-accent-bar" style={{background: color}} />
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
        <div className="stat-label">{label}</div>
        <div style={{color, opacity:0.7}}>{icon}</div>
      </div>
      <div className="stat-value" style={{color}}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function DetRow({ label, value, mono }) {
  return (
    <div className="det-row">
      <span className="det-label">{label}</span>
      <span className={`det-value${mono ? ' mono' : ''}`}>{value}</span>
    </div>
  );
}

function ConfidenceBadge({ conf }) {
  const color = conf >= 80 ? 'var(--danger)' : conf >= 50 ? 'var(--warn)' : 'var(--text-secondary)';
  return <span style={{color, fontWeight:600, fontFamily:'var(--font-mono)', fontSize:12}}>{conf}%</span>;
}
