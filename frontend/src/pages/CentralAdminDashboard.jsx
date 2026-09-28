import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Shield, Camera, Users, Bell, MapPin, Activity, CheckCircle, AlertTriangle, Smartphone } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GOOGLE_MAPS_API_KEY, parseLocation, DEFAULT_MAP_CENTER } from '../config/maps';

export default function CentralAdminDashboard({ user, serverBase, serverStatus, latestAlert, alertHistory, cameras, systemStatus }) {
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Ref for map
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('wt_token');
        const response = await fetch(`${serverBase}/api/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setPersonnel(data);
        }
      } catch (err) {
        console.error("Failed to fetch users for central admin view", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [serverBase]);

  // Aggregate Data
  const areaAdmins = useMemo(() => personnel.filter(p => p.role === 'AREA_ADMIN'), [personnel]);
  const appUsers = useMemo(() => personnel.filter(p => p.role === 'USER'), [personnel]);
  
  const stats = useMemo(() => {
    return {
      totalDistricts: [...new Set(areaAdmins.map(a => a.district).filter(Boolean))].length,
      totalAreaAdmins: areaAdmins.length,
      totalAppUsers: appUsers.length,
      totalCameras: cameras.length,
      activeCameras: cameras.filter(c => c.status === 'active').length,
      totalAlerts: alertHistory.length
    };
  }, [areaAdmins, appUsers, cameras, alertHistory]);

  const adminData = useMemo(() => {
    return areaAdmins.map(admin => {
      const usersInDistrict = appUsers.filter(u => u.district === admin.district).length;
      return {
        ...admin,
        appUsersCount: usersInDistrict,
        camerasCount: cameras.length // Placeholder: ideally we'd filter cameras by district too
      };
    });
  }, [areaAdmins, appUsers, cameras, alertHistory]);

  // Google Maps injection & rendering
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !mapDivRef.current) return;
    
    const initMap = () => {
      const g = window.google.maps;
      if (!mapRef.current) {
        mapRef.current = new g.Map(mapDivRef.current, {
          center: parseLocation(DEFAULT_MAP_CENTER),
          zoom: 7,
          mapTypeControl: false,
          streetViewControl: false,
        });
      }

      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];

      // Add Area Admin markers
      areaAdmins.forEach(admin => {
        if (admin.areaLocation) {
          const pos = parseLocation(admin.areaLocation);
          const marker = new g.Marker({
            position: pos,
            map: mapRef.current,
            title: `Area Admin: ${admin.name || admin.email} (${admin.district})`,
            icon: {
              path: g.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#ffffff',
            }
          });
          
          // Add a circle to represent the jurisdiction radius
          const circle = new g.Circle({
            strokeColor: "#3b82f6",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            map: mapRef.current,
            center: pos,
            radius: 5000, // 5km radius example
          });

          markersRef.current.push(marker);
          markersRef.current.push(circle);
        }
      });

      // Add Camera markers
      cameras.forEach(cam => {
        if (cam.location) {
          const pos = parseLocation(cam.location);
          const marker = new g.Marker({
            position: pos,
            map: mapRef.current,
            title: `Camera: ${cam.name}`,
            icon: {
              path: g.SymbolPath.BACKWARD_CLOSED_ARROW,
              scale: 5,
              fillColor: cam.status === 'active' ? '#10b981' : '#ef4444',
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: '#ffffff',
            }
          });
          markersRef.current.push(marker);
        }
      });
    };

    if (window.google && window.google.maps) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    }
  }, [areaAdmins, cameras]);

  return (
    <div className="central-admin-dashboard fade-in">
      {/* ─── ROLE WELCOME BANNER ─── */}
      <div className="card" style={{
        marginBottom: 16, padding: '18px 20px',
        background: `linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.18))`,
        borderColor: `rgba(139,92,246,0.3)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: `rgba(139,92,246,0.2)`, color: '#8b5cf6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)',
          }}>
            {user.name ? user.name[0].toUpperCase() : 'C'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
              Central Command Center
            </div>
            <div className="text-muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#8b5cf6', fontWeight: 600 }}>
                <Shield size={13}/> Central Agency Admin
              </span>
              <span>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <MapPin size={13}/> {user.state || user.country || 'State-wide Authority'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── OPERATIONS CONTROLS ─── */}
      <div className="card" style={{marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12}}>
        <div>
          <div style={{fontSize:11, color:'var(--text-muted)', marginBottom:4}}>Operations</div>
          <div style={{fontSize:15, fontWeight:700, color: systemStatus?.monitoring_enabled !== false ? 'var(--success)' : 'var(--warn)'}}>
            {systemStatus?.monitoring_enabled !== false ? 'MONITORING ON' : 'MONITORING PAUSED'}
            <span style={{fontWeight:400, color:'var(--text-secondary)', fontSize:12, marginLeft:10}}>
              · {stats.activeCameras}/{stats.totalCameras} cameras
            </span>
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-sm" disabled={serverStatus !== 'online'}>
            <Bell size={13}/> Global Alerts
          </button>
        </div>
      </div>

      {/* ─── STATE OVERVIEW STATS ─── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <StatCard title="Active Districts" value={stats.totalDistricts} icon={<MapPin size={20}/>} color="#8b5cf6" />
        <StatCard title="Area Controllers" value={stats.totalAreaAdmins} icon={<Shield size={20}/>} color="#3b82f6" />
        <StatCard title="Field App Users" value={stats.totalAppUsers} icon={<Smartphone size={20}/>} color="#f59e0b" />
        <StatCard title="Total Network Cameras" value={`${stats.activeCameras} / ${stats.totalCameras}`} icon={<Camera size={20}/>} color="#10b981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
        
        {/* ─── LIVE STATE MAP ─── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.02)' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <MapPin size={16} color="#8b5cf6"/> Live Jurisdiction Map
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Blue circles denote Area Admin zones. Green/Red markers denote cameras.
            </div>
          </div>
          <div ref={mapDivRef} style={{ flex: 1, width: '100%', minHeight: 400, background: '#e5e7eb' }}></div>
        </div>

        {/* ─── AREA ADMIN DIRECTORY ─── */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} color="#3b82f6"/> Area Controller Management
            </div>
          </div>
          <div style={{ padding: 16, flex: 1, overflowY: 'auto', maxHeight: 400 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading network data...</div>
            ) : adminData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No Area Controllers registered yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {adminData.map((d, i) => (
                  <div key={i} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#3b82f6' }}>{d.district || 'Unassigned District'}</div>
                        <div style={{ fontSize: '0.85rem' }}>{d.name || d.email}</div>
                      </div>
                      <div style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '0.7rem', fontWeight: 700 }}>
                        ACTIVE
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Smartphone size={12}/> {d.appUsersCount} App Users</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Camera size={12}/> {d.camerasCount} Area Cameras</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-accent-bar" style={{ background: color }}/>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="stat-label">{title}</div>
        <div style={{ color: color, opacity: 0.8 }}>{icon}</div>
      </div>
      <div className="stat-value" style={{ color: color }}>{value}</div>
    </div>
  );
}
