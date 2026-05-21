import { useState, useRef, useCallback, Component } from 'react';
import { Plus, Trash2, Edit3, CheckCircle, WifiOff, Camera, X, Save, Link, Info, Star, Play, Square, MapPin } from 'lucide-react';
import { CameraLocationMap, AllCamerasMap } from '../components/CameraLocationMap';

const CAM_TYPES = ['webcam', 'cctv', 'ip_camera', 'rtsp', 'usb'];

class CamerasMapBoundary extends Component {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="notice-banner warn" style={{ marginBottom: 12 }}>
          City map could not load — camera list below still works. Rebuild the dashboard after updating code.
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Cameras({ cameras, addCamera, removeCamera, updateCamera, cameraControl, serverStatus, systemStatus }) {
  const deploymentCity = systemStatus?.deployment_city || cameras[0]?.city || 'Pune';
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    id: '', name: '', location: '', place: '', type: 'cctv',
    status: 'active', rtspUrl: '', streamUrl: '', notes: ''
  });
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? cameras : cameras.filter(c => c.status === filter);

  const handleAdd = () => {
    if (!form.id || !form.location) return;
    addCamera({ ...form });
    setForm({ id:'', name:'', location:'', place:'', type:'cctv', status:'active', rtspUrl:'', streamUrl:'', notes:'' });
    setShowAdd(false);
  };

  const startEdit = (cam) => { setEditId(cam.id); setEditForm({ ...cam }); };

  const saveEdit = () => {
    updateCamera(editId, editForm);
    setEditId(null);
  };

  const locationSaveTimer = useRef(null);

  const saveLocationLive = useCallback((cameraId, newLocation) => {
    setEditForm((p) => ({ ...p, location: newLocation }));
    if (locationSaveTimer.current) clearTimeout(locationSaveTimer.current);
    locationSaveTimer.current = setTimeout(() => {
      if (serverStatus === 'online') {
        updateCamera(cameraId, { location: newLocation });
      }
    }, 450);
  }, [serverStatus, updateCamera]);

  const activeCams = cameras.filter(c => c.status === 'active').length;
  const offlineCams = cameras.filter(c => c.status !== 'active').length;
  const withRtsp = cameras.filter(c => c.rtspUrl).length;

  return (
    <div className="cameras-page">
      {/* Summary stats */}
      <div className="cam-summary-row">
        <CamStat label="Total" value={cameras.length} color="var(--accent)" />
        <CamStat label="Active" value={activeCams} color="var(--success)" />
        <CamStat label="Offline" value={offlineCams} color="var(--danger)" />
        <CamStat label="RTSP Configured" value={withRtsp} color="var(--warn)" />
      </div>

      {/* Header */}
      <div className="section-header" style={{marginBottom:12}}>
        <div style={{display:'flex',gap:8}}>
          {['all','active','offline'].map(f => (
            <button
              key={f}
              className={`btn btn-sm ${filter===f ? 'btn-primary' : ''}`}
              onClick={() => setFilter(f)}
              style={{textTransform:'capitalize'}}
            >
              {f} ({f==='all' ? cameras.length : cameras.filter(c=>c.status===f).length})
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={14}/> Add Camera
        </button>
      </div>

      {/* Server sync notice */}
      {serverStatus !== 'online' && (
        <div className="notice-banner warn">
          <WifiOff size={14}/>
          Server offline — cameras saved locally. They'll register when server starts.
        </div>
      )}

      {serverStatus === 'online' && cameras.length > 0 && (
        <CamerasMapBoundary>
          <AllCamerasMap
            cameras={cameras}
            city={deploymentCity}
            selectedId={editId}
            onSelectCamera={(cam) => startEdit(cam)}
            height={300}
          />
        </CamerasMapBoundary>
      )}

      {/* Camera grid */}
      <div className="cameras-grid">
        {filtered.map(cam => (
          editId === cam.id
            ? <CameraEditCard
                key={cam.id}
                form={editForm}
                setForm={setEditForm}
                onSave={saveEdit}
                onCancel={() => setEditId(null)}
                onLocationLiveSave={(loc) => saveLocationLive(cam.id, loc)}
                serverOnline={serverStatus === 'online'}
              />
            : <CameraCard
                key={cam.id} cam={cam}
                onEdit={() => startEdit(cam)}
                onRemove={() => removeCamera(cam.id)}
                onStart={() => cameraControl(cam.id, 'start')}
                onStop={() => cameraControl(cam.id, 'stop')}
                onSetPrimary={() => cameraControl(cam.id, 'set_primary')}
              />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state" style={{gridColumn:'1/-1'}}>
            <Camera size={36}/><p>No cameras in this category</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{maxWidth:560}}>
            <div className="modal-header">
              <span className="modal-title">Add New Camera</span>
              <button className="btn btn-icon" onClick={() => setShowAdd(false)}><X size={16}/></button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
              <div className="form-group">
                <label className="form-label">Camera ID * <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:10}}>(e.g. CAM_04)</span></label>
                <input className="form-input mono" placeholder="CAM_04" value={form.id}
                  onChange={e => setForm(f=>({...f,id:e.target.value.toUpperCase()}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input className="form-input" placeholder="e.g. West Gate Camera" value={form.name}
                  onChange={e => setForm(f=>({...f,name:e.target.value}))} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Camera number <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:10}}>(shown on map in {deploymentCity})</span></label>
              <input className="form-input" type="number" min={1} placeholder="Auto if empty"
                value={form.camera_number ?? ''}
                onChange={e => setForm(f=>({...f, camera_number: e.target.value ? Number(e.target.value) : undefined}))} />
            </div>

            <div className="form-group">
              <label className="form-label">GPS Coordinates * <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:10}}>(lat,lng)</span></label>
              <input className="form-input mono" placeholder="18.5204,73.8567" value={form.location}
                onChange={e => setForm(f=>({...f,location:e.target.value}))} />
            </div>

            <CameraLocationMap
              location={form.location || '18.5204,73.8567'}
              camera={{ ...form, city: deploymentCity, camera_number: form.camera_number }}
              onLocationChange={(loc) => setForm((f) => ({ ...f, location: loc }))}
              height={220}
            />

            <div className="form-group">
              <label className="form-label">Physical Location / Description</label>
              <input className="form-input" placeholder="e.g. North gate, east side, 2m height" value={form.place}
                onChange={e => setForm(f=>({...f,place:e.target.value}))} />
            </div>

            <div className="form-group">
              <label className="form-label">RTSP Stream URL <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:10}}>(for CCTV cameras)</span></label>
              <input className="form-input mono" placeholder="rtsp://admin:pass@192.168.1.100:554/stream" value={form.rtspUrl}
                onChange={e => setForm(f=>({...f,rtspUrl:e.target.value}))} />
            </div>

            <div className="form-group">
              <label className="form-label">HTTP Stream URL <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:10}}>(optional — for browser preview)</span></label>
              <input className="form-input mono" placeholder="http://192.168.1.100/video.mjpg" value={form.streamUrl}
                onChange={e => setForm(f=>({...f,streamUrl:e.target.value}))} />
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="form-group">
                <label className="form-label">Camera Type</label>
                <select className="form-select" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  {CAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Initial Status</label>
                <select className="form-select" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="active">Active</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} style={{resize:'vertical'}}
                placeholder="Installation notes, maintenance info, etc."
                value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            </div>

            <div className="notice-banner info" style={{marginBottom:12}}>
              <Info size={13}/>
              GPS coordinates are sent to the server and shown on the Android app's map. See CCTV Setup for RTSP URL formats.
            </div>

            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={!form.id||!form.location}>
                <Save size={14}/> Add Camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CamStat({ label, value, color }) {
  return (
    <div className="stat-card" style={{flex:1}}>
      <div className="stat-accent-bar" style={{background:color}}/>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{color, fontSize:24}}>{value}</div>
    </div>
  );
}

function CameraCard({ cam, onEdit, onRemove, onStart, onStop, onSetPrimary }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = cam.status === 'active';
  const isPrimary = cam.is_primary;
  return (
    <div className={`camera-card ${isActive ? '' : 'offline'} ${isPrimary ? 'primary-cam' : ''}`}
      style={isPrimary ? { boxShadow: '0 0 0 2px rgba(251,191,36,0.5)' } : {}}>
      <div className="camera-card-header">
        {cam.camera_number != null && (
          <span className="cam-number-badge">#{cam.camera_number}</span>
        )}
        <div className="camera-icon-wrap">
          <Camera size={18}/>
        </div>
        <div className="camera-card-id mono">{cam.id}</div>
        {isPrimary && <span className="pill" style={{background:'rgba(251,191,36,0.2)',color:'#fbbf24',fontSize:10}}>PRIMARY</span>}
        <span className={`pill ${isActive ? 'pill-online' : 'pill-offline'}`}>
          <span className={`pill-dot ${isActive ? 'pulse' : ''}`}/>{cam.status}
        </span>
      </div>

      <div className="camera-card-name">
        {cam.camera_number != null && <span style={{color:'var(--accent)',marginRight:6}}>#{cam.camera_number}</span>}
        {cam.name || cam.id}
        {cam.city && <span style={{fontSize:10,color:'var(--text-muted)',marginLeft:6}}>{cam.city}</span>}
      </div>

      <div className="camera-card-rows">
        <CRow label="Map #" value={cam.camera_number != null ? `Camera ${cam.camera_number}` : '—'} />
        <CRow label="Type" value={cam.type?.toUpperCase()} />
        <CRow label="GPS" value={cam.location} mono />
        <CRow label="Location" value={cam.place || '—'} />
        <CRow label="Added" value={new Date(cam.addedAt).toLocaleDateString()} />
      </div>

      {/* RTSP badge */}
      {cam.rtspUrl && (
        <div className="cam-rtsp-badge">
          <Link size={10}/>
          <span className="mono" style={{fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{cam.rtspUrl}</span>
        </div>
      )}

      {/* Notes toggle */}
      {cam.notes && (
        <div className="cam-notes-toggle" onClick={() => setExpanded(e=>!e)}>
          <Info size={11}/> {expanded ? 'Hide notes' : 'Show notes'}
        </div>
      )}
      {expanded && cam.notes && (
        <div className="cam-notes-text">{cam.notes}</div>
      )}

      <div className="camera-card-actions" style={{flexWrap:'wrap'}}>
        {isActive ? (
          <button className="btn btn-sm" onClick={onStop}><Square size={12}/> Stop</button>
        ) : (
          <button className="btn btn-sm" onClick={onStart}><Play size={12}/> Start</button>
        )}
        {!isPrimary && (
          <button className="btn btn-sm" onClick={onSetPrimary} title="Use this camera GPS for new alerts">
            <Star size={12}/> Set Primary
          </button>
        )}
        <button className="btn btn-sm" onClick={onEdit}><Edit3 size={13}/> Edit</button>
        <button className="btn btn-sm btn-danger" onClick={onRemove}><Trash2 size={13}/></button>
      </div>
    </div>
  );
}

function CameraEditCard({ form, setForm, onSave, onCancel, onLocationLiveSave, serverOnline }) {
  return (
    <div className="camera-card editing" style={{gridColumn:'span 1'}}>
      <div className="section-header" style={{marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:13,color:'var(--accent)'}}>Editing {form.id}</span>
        {serverOnline && (
          <span className="pill pill-online" style={{fontSize:10}}>
            <MapPin size={10}/> Live sync to Android
          </span>
        )}
      </div>
      <div className="form-group" style={{marginBottom:8}}>
        <label className="form-label">Display Name</label>
        <input className="form-input" placeholder="Camera name" value={form.name||''}
          onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
      </div>
      <div className="form-group" style={{marginBottom:8}}>
        <label className="form-label">GPS Coordinates (lat,lng)</label>
        <input className="form-input mono" placeholder="18.5204,73.8567" value={form.location||''}
          onChange={e => onLocationLiveSave(e.target.value)}/>
      </div>
      <CameraLocationMap
        location={form.location || '18.5204,73.8567'}
        camera={form}
        onLocationChange={onLocationLiveSave}
        height={200}
      />
      {[
        {label:'Physical Location', key:'place', placeholder:'Gate, section, height'},
        {label:'RTSP URL', key:'rtspUrl', placeholder:'rtsp://admin:pass@IP:554/stream', mono:true},
        {label:'HTTP Stream URL', key:'streamUrl', placeholder:'http://IP/stream.mjpg', mono:true},
      ].map(f => (
        <div key={f.key} className="form-group" style={{marginBottom:8}}>
          <label className="form-label">{f.label}</label>
          <input className={`form-input${f.mono?' mono':''}`} placeholder={f.placeholder}
            value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
        </div>
      ))}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:8}}>
        <div className="form-group" style={{marginBottom:0}}>
          <label className="form-label">Type</label>
          <select className="form-select" value={form.type||'cctv'} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
            {CAM_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group" style={{marginBottom:0}}>
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status||'active'} onChange={e=>setForm(p=>({...p,status:e.target.value}))}>
            <option value="active">Active</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>
      <div className="form-group" style={{marginBottom:10}}>
        <label className="form-label">Notes</label>
        <textarea className="form-input" rows={2} style={{resize:'vertical'}}
          value={form.notes||''} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/>
      </div>
      <div style={{display:'flex',gap:8}}>
        <button className="btn btn-sm" onClick={onCancel}><X size={13}/> Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={onSave}><Save size={13}/> Save</button>
      </div>
    </div>
  );
}

function CRow({ label, value, mono }) {
  return (
    <div className="camera-row">
      <span className="camera-row-label">{label}</span>
      <span className={`camera-row-value${mono?' mono':''}`}>{value}</span>
    </div>
  );
}
