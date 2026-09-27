import { Camera, LayoutDashboard, Bell, Settings, Server, Wifi, WifiOff, ChevronRight, Shield, Grid, Smartphone, BookOpen, Home, LogOut, Users } from 'lucide-react';
import './Sidebar.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'multiview', label: 'Live Grid',      icon: Grid },
  { id: 'cameras',   label: 'Cameras',        icon: Camera },
  { id: 'alerts',    label: 'Alert History',  icon: Bell },
  { id: 'cctvsetup', label: 'CCTV Setup',     icon: BookOpen },
  { id: 'users',     label: 'Personnel',      icon: Users },
  { id: 'android',   label: 'Android App',    icon: Smartphone },
  { id: 'server',    label: 'Server Config',  icon: Server },
  { id: 'settings',  label: 'Settings',       icon: Settings },
  { id: 'landing',   label: 'Public Website', icon: Home },
];

const NAV_SECTIONS = [
  { label: 'Monitoring',  ids: ['dashboard', 'multiview', 'alerts'], roles: ['USER', 'AREA_ADMIN', 'AGENCY_ADMIN'] },
  { label: 'Management',  ids: ['cameras', 'cctvsetup', 'users'], roles: ['AREA_ADMIN', 'AGENCY_ADMIN'] },
  { label: 'Setup',       ids: ['android', 'server', 'settings'], roles: ['AGENCY_ADMIN'] },
  { label: 'Portal',      ids: ['landing'], roles: ['USER', 'AREA_ADMIN', 'AGENCY_ADMIN'] },
];

export default function Sidebar({ page, setPage, serverStatus, cameras, user, onLogout }) {
  const activeCount = cameras.filter(c => c.status === 'active').length;
  const offlineCount = cameras.filter(c => c.status !== 'active').length;

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Shield size={18} strokeWidth={2.5}/>
        </div>
        <div>
          <div className="brand-name">Gov Command</div>
          <div className="brand-sub">National Wildlife Dept</div>
        </div>
      </div>

      {/* Server status */}
      <div className="sidebar-server-status">
        <div className="server-dot-wrap">
          {serverStatus === 'online'
            ? <Wifi size={14} color="var(--success)"/>
            : <WifiOff size={14} color="var(--danger)"/>}
          <span className={serverStatus === 'online' ? 'text-success' : 'text-danger'} style={{fontSize:12,fontWeight:600}}>
            {serverStatus === 'online' ? 'Server Online' : 'Server Offline'}
          </span>
        </div>
        <span className="server-host mono">:5000</span>
      </div>

      {/* Nav with sections */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.filter(section => {
          const effectiveRole = user?.role || 'USER';
          return section.roles.includes(effectiveRole);
        }).map(section => (
          <div key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {NAV.filter(n => section.ids.includes(n.id)).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${page === id ? 'active' : ''}`}
                onClick={() => setPage(id)}
              >
                <Icon size={15} strokeWidth={page === id ? 2.5 : 2}/>
                <span>{label}</span>
                {id === 'cameras' && cameras.length > 0 && (
                  <span className="nav-badge">{cameras.length}</span>
                )}
                {page === id && <ChevronRight size={12} className="nav-arrow"/>}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Operator Account block */}
      {user && (
        <div className="sidebar-user-block">
          <div className="user-avatar" style={{
            background: user.role === 'AGENCY_ADMIN' ? 'rgba(139,92,246,0.15)' : user.role === 'AREA_ADMIN' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
            color: user.role === 'AGENCY_ADMIN' ? '#a78bfa' : user.role === 'AREA_ADMIN' ? '#60a5fa' : '#34d399',
          }}>
            <span className="mono">{user.name ? user.name[0].toUpperCase() : 'O'}</span>
          </div>
          <div className="user-meta">
            <div className="user-name">{user.name || 'Operator'}</div>
            <div className="user-role" style={{
              color: user.role === 'AGENCY_ADMIN' ? '#a78bfa' : user.role === 'AREA_ADMIN' ? '#60a5fa' : '#34d399',
            }}>
              {user.role === 'AGENCY_ADMIN' ? 'Central Agency Admin' : user.role === 'AREA_ADMIN' ? 'Area Controller' : 'Field User'}
            </div>
            {(user.district || user.state) && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                📍 {user.district || user.state || user.country || ''}
              </div>
            )}
          </div>
          <button className="user-logout-btn" onClick={onLogout} title="Log Out">
            <LogOut size={14}/>
          </button>
        </div>
      )}

      {/* Footer stats */}
      <div className="sidebar-footer">
        <div className="sidebar-stat">
          <span className="sidebar-stat-label">Active Cameras</span>
          <span className="sidebar-stat-value text-success">{activeCount}</span>
        </div>
        {offlineCount > 0 && (
          <div className="sidebar-stat">
            <span className="sidebar-stat-label">Offline</span>
            <span className="sidebar-stat-value" style={{color:'var(--danger)'}}>{offlineCount}</span>
          </div>
        )}
        <div className="sidebar-stat">
          <span className="sidebar-stat-label">Total Cameras</span>
          <span className="sidebar-stat-value">{cameras.length}</span>
        </div>
        <div className="sidebar-version mono">v1.0.0 · WildTrack</div>
      </div>
    </aside>
  );
}
