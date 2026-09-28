import { useState, useEffect, useRef } from 'react';
import { Camera, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff, Eye, Activity } from 'lucide-react';
import { isDangerousDetection } from '../utils/detection';
import './pages.css';

const DANGER_LEVELS = {
  bear: 5, wolf: 5, lion: 5, tiger: 5, leopard: 5, crocodile: 5, alligator: 5,
  elephant: 5, cobra: 5, snake: 4,
  boar: 4, moose: 4, bison: 4,
  deer: 3, fox: 3, coyote: 3, raccoon: 3,
  rabbit: 2, squirrel: 2, bird: 2, cat: 2, dog: 2,
};

function getDangerLevel(animalType) {
  if (!animalType) return 0;
  const key = animalType.toLowerCase();
  for (const [k, v] of Object.entries(DANGER_LEVELS)) {
    if (key.includes(k)) return v;
  }
  return 1;
}
function levelColor(lvl) {
  if (lvl >= 5) return 'var(--danger)';
  if (lvl >= 4) return '#f97316';
  if (lvl >= 3) return 'var(--warn)';
  if (lvl >= 2) return 'var(--accent)';
  return 'var(--success)';
}
function levelGlow(lvl) {
  if (lvl >= 5) return 'rgba(248,113,113,0.18)';
  if (lvl >= 4) return 'rgba(249,115,22,0.15)';
  if (lvl >= 3) return 'rgba(251,191,36,0.12)';
  return 'rgba(52,211,153,0.1)';
}
function levelBorder(lvl) {
  if (lvl >= 5) return 'rgba(248,113,113,0.5)';
  if (lvl >= 4) return 'rgba(249,115,22,0.4)';
  if (lvl >= 3) return 'rgba(251,191,36,0.35)';
  return 'rgba(99,179,237,0.3)';
}

export default function MultiView({ cameras, alertHistory, latestAlert, serverStatus, serverBase }) {
  const [camAlerts, setCamAlerts] = useState({});
  const [layout, setLayout] = useState('grid');
  const prevAlertRef = useRef(null);

  useEffect(() => {
    const map = {};
    [...alertHistory].reverse().forEach(a => {
      cameras.forEach(cam => {
        if (cam.location && a.location && a.location.trim() === cam.location.trim()) {
          if (!map[cam.id]) map[cam.id] = a;
        }
      });
    });
    setCamAlerts(map);
  }, [alertHistory, cameras]);

  useEffect(() => {
    if (!latestAlert?.animal_detected) return;
    if (prevAlertRef.current?.timestamp === latestAlert.timestamp) return;
    prevAlertRef.current = latestAlert;
    let matched = false;
    cameras.forEach(cam => {
      if (cam.location && latestAlert.location && latestAlert.location.trim() === cam.location.trim()) {
        setCamAlerts(prev => ({ ...prev, [cam.id]: { ...latestAlert, id: Date.now() } }));
        matched = true;
      }
    });
    if (!matched) {
      const webcam = cameras.find(c => c.id === 'CAM_WEBCAM' || c.type === 'webcam');
      if (webcam) setCamAlerts(prev => ({ ...prev, [webcam.id]: { ...latestAlert, id: Date.now() } }));
    }
  }, [latestAlert, cameras]);

  const activeCams = cameras.filter(c => c.status === 'active');
  const alertCount = Object.values(camAlerts).filter(isDangerousDetection).length;

  return (
    <div className="multiview-page">
      <div className="mv-header">
        <div className="mv-header-left">
          <div className="mv-title-row">
            <span className="mv-title">Live Camera Grid</span>
            <span className={`pill ${serverStatus === 'online' ? 'pill-online' : 'pill-offline'}`}>
              <span className={`pill-dot ${serverStatus === 'online' ? 'pulse' : ''}`}/>
              {serverStatus === 'online' ? 'System Active' : 'Server Offline'}
            </span>
          </div>
          <div className="mv-subtitle">
            {cameras.length} cameras · {activeCams.length} active ·{' '}
            {alertCount > 0
              ? <span style={{color:'var(--danger)',fontWeight:700}}>{alertCount} live threat{alertCount>1?'s':''}</span>
              : <span style={{color:'var(--success)'}}>No active threats</span>}
          </div>
        </div>
        <div className="mv-header-right">
          <div className="mv-layout-toggle">
            <button className={`btn btn-sm ${layout==='grid'?'btn-primary':''}`} onClick={()=>setLayout('grid')}>⊞ Grid</button>
            <button className={`btn btn-sm ${layout==='list'?'btn-primary':''}`} onClick={()=>setLayout('list')}>☰ List</button>
          </div>
        </div>
      </div>

      <div className="mv-summary-bar">
        <SummaryPill icon={<Camera size={13}/>} label="Cameras" value={cameras.length} color="var(--accent)"/>
        <SummaryPill icon={<Activity size={13}/>} label="Active" value={activeCams.length} color="var(--success)"/>
        <SummaryPill icon={<WifiOff size={13}/>} label="Offline" value={cameras.filter(c=>c.status!=='active').length} color="var(--text-muted)"/>
        <SummaryPill icon={<AlertTriangle size={13}/>} label="Live Threats" value={alertCount} color={alertCount>0?'var(--danger)':'var(--text-muted)'}/>
        <SummaryPill icon={<Eye size={13}/>} label="Total Detections" value={alertHistory.length} color="var(--warn)"/>
      </div>

      {serverStatus === 'online' && (
        <div className="card mv-main-feed">
          <div className="section-header" style={{marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div className="mv-cam-dot active"/>
              <h2>Webcam — Live Stream</h2>
            </div>
            <span className="pill pill-online"><span className="pill-dot pulse"/>Streaming</span>
          </div>
          <div className="mv-main-feed-inner">
            <div className="mv-live-wrap">
              <img src={`${serverBase}/video_feed`} alt="Live feed" className="mv-live-img"
                onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
              <div className="mv-feed-error" style={{display:'none'}}><Camera size={28}/><p>Feed unavailable</p></div>
              {isDangerousDetection(latestAlert) && (
                <div className="mv-live-badge danger"><AlertTriangle size={11}/> {latestAlert.animal_type} — {latestAlert.confidence}%</div>
              )}
              <div className="mv-live-badge rec">● REC</div>
            </div>
            <div className="mv-main-info">
              <div className="mv-info-title">CAM_WEBCAM</div>
              <div className="mv-info-sub">Laptop / Dev Webcam</div>
              <div className="divider" style={{margin:'12px 0'}}/>
              {latestAlert ? (
                <>
                  <InfoRow label="Status" value={isDangerousDetection(latestAlert) ? 'Danger' : 'Safe'}/>
                  <InfoRow label="Animal" value={latestAlert.animal_type || 'None'}/>
                  <InfoRow label="Confidence" value={latestAlert.confidence ? `${latestAlert.confidence}%` : '—'}/>
                  <InfoRow label="Location" value={latestAlert.location || '—'} mono/>
                  <InfoRow label="Last update" value={latestAlert.timestamp ? new Date(latestAlert.timestamp*1000).toLocaleTimeString() : '—'}/>
                  {isDangerousDetection(latestAlert) && (
                    <div className="mv-danger-badge" style={{marginTop:10,background:levelGlow(getDangerLevel(latestAlert.animal_type)),border:`1px solid ${levelBorder(getDangerLevel(latestAlert.animal_type))}`,color:levelColor(getDangerLevel(latestAlert.animal_type))}}>
                      ⚠ Danger Level {getDangerLevel(latestAlert.animal_type)} / 5
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{padding:'20px 0'}}>
                  <Clock size={20}/><p>Waiting for data…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={layout==='grid' ? 'mv-cam-grid' : 'mv-cam-list'}>
        {cameras.map(cam => {
          const lastAlert = camAlerts[cam.id] || null;
          const lvl = isDangerousDetection(lastAlert) ? getDangerLevel(lastAlert.animal_type) : 0;
          return <CameraDetectionCard key={cam.id} cam={cam} lastAlert={lastAlert} dangerLevel={lvl} isActive={cam.status==='active'} layout={layout}/>;
        })}
        {cameras.length === 0 && (
          <div className="empty-state" style={{gridColumn:'1/-1',padding:'60px 24px'}}>
            <Camera size={40}/><p>No cameras registered yet — add them in Camera Management</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CameraDetectionCard({ cam, lastAlert, dangerLevel, isActive, layout }) {
  const hasDetection = lastAlert?.animal_detected;
  const hasAlert = isDangerousDetection(lastAlert);
  const color = hasAlert ? levelColor(dangerLevel) : isActive ? 'var(--success)' : 'var(--text-muted)';
  const glow = hasAlert ? levelGlow(dangerLevel) : 'transparent';
  const border = hasAlert ? levelBorder(dangerLevel) : isActive ? 'rgba(52,211,153,0.2)' : 'var(--border)';

  if (layout === 'list') {
    return (
      <div className="mv-list-row" style={{borderLeft:`3px solid ${color}`}}>
        <div className="mv-list-icon" style={{background:hasAlert?glow:'var(--bg-card)',color}}>
          {hasAlert ? <AlertTriangle size={15}/> : isActive ? <CheckCircle size={15}/> : <WifiOff size={15}/>}
        </div>
        {cam.camera_number != null && <span className="cam-number-badge" style={{minWidth:24,height:24,fontSize:11}}>#{cam.camera_number}</span>}
        <div className="mv-list-id mono">{cam.id}</div>
        <div className="mv-list-name">{cam.name || cam.id}</div>
        <div className="mv-list-loc">{cam.place || cam.location}</div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:12}}>
          {hasAlert
            ? <span style={{color:'var(--danger)',fontWeight:700,fontSize:12,fontFamily:'var(--font-mono)'}}>{lastAlert.animal_type} ({lastAlert.confidence}%)</span>
            : <span style={{color:'var(--success)',fontSize:12}}>{hasDetection ? `${lastAlert.animal_type} safe` : 'Clear'}</span>}
          <span className={`pill ${isActive?'pill-online':'pill-offline'}`}>
            <span className="pill-dot"/>{cam.status}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mv-cam-card" style={{borderColor:border,background:hasAlert?`linear-gradient(135deg, var(--bg-card) 0%, ${glow} 100%)`:'var(--bg-card)'}}>
      <div className="mv-card-header">
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          {cam.camera_number != null && <span className="cam-number-badge" style={{minWidth:22,height:22,fontSize:10}}>#{cam.camera_number}</span>}
          <div className="mv-cam-dot" style={{background:color,boxShadow:`0 0 6px ${color}`}}/>
          <span className="mono" style={{fontSize:11,color:'var(--text-muted)'}}>{cam.id}</span>
        </div>
        <span className={`pill ${isActive?'pill-online':'pill-offline'}`} style={{fontSize:10,padding:'2px 7px'}}>
          <span className="pill-dot"/>{cam.status}
        </span>
      </div>
      <div className="mv-card-name">{cam.name || cam.id}</div>
      <div className="mv-card-place">{cam.place || cam.location || '—'}</div>
      {hasAlert ? (
        <div className="mv-card-alert" style={{background:glow,borderColor:border}}>
          <div className="mv-card-alert-row">
            <AlertTriangle size={13} style={{color,flexShrink:0}}/>
            <span style={{color,fontWeight:700,fontSize:13}}>{lastAlert.animal_type}</span>
            <span style={{marginLeft:'auto',fontFamily:'var(--font-mono)',fontSize:12,color}}>{lastAlert.confidence}%</span>
          </div>
          <div className="mv-card-alert-sub">LV{dangerLevel} · {lastAlert.timestamp ? new Date(lastAlert.timestamp*1000).toLocaleTimeString() : '—'}</div>
          {lastAlert.image && <img src={`data:image/jpeg;base64,${lastAlert.image}`} alt="Detection" className="mv-card-thumb"/>}
        </div>
      ) : (
        <div className="mv-card-clear">
          {isActive ? <><CheckCircle size={14} style={{color:'var(--success)'}}/><span>{hasDetection ? `${lastAlert.animal_type} safe` : 'No detection'}</span></> : <><WifiOff size={14} style={{color:'var(--text-muted)'}}/><span>Offline</span></>}
        </div>
      )}
      <div className="mv-card-footer">
        <span style={{fontSize:10,color:'var(--text-muted)'}}>{cam.type?.toUpperCase()}</span>
        {lastAlert && <span style={{fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{new Date(lastAlert.id||lastAlert.timestamp*1000).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}

function SummaryPill({ icon, label, value, color }) {
  return (
    <div className="mv-summary-pill">
      <div style={{color,display:'flex',alignItems:'center',gap:4}}>{icon}<span style={{fontSize:11,color:'var(--text-muted)'}}>{label}</span></div>
      <div style={{fontFamily:'var(--font-mono)',fontSize:18,fontWeight:700,color,lineHeight:1}}>{value}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
      <span style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</span>
      <span style={{fontSize:12,fontFamily:mono?'var(--font-mono)':'inherit',color:'var(--text-primary)',fontWeight:500}}>{value}</span>
    </div>
  );
}
