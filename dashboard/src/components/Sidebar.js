import { Camera, LayoutDashboard, Bell, Settings, Server, Wifi, WifiOff, ChevronRight, Shield, Grid, Smartphone, BookOpen, Home, LogOut } from 'lucide-react';
import './Sidebar.css';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'multiview', label: 'Live Grid',      icon: Grid },
  { id: 'cameras',   label: 'Cameras',        icon: Camera },
  { id: 'alerts',    label: 'Alert History',  icon: Bell },
  { id: 'cctvsetup', label: 'CCTV Setup',     icon: BookOpen },
  { id: 'android',   label: 'Android App',    icon: Smartphone },
  { id: 'server',    label: 'Server Config',  icon: Server },
  { id: 'settings',  label: 'Settings',       icon: Settings },
  { id: 'landing',   label: 'Public Website', icon: Home },
];

const NAV_SECTIONS = [
  { label: 'Monitoring',  ids: ['dashboard', 'multiview', 'alerts'] },
  { label: 'Management',  ids: ['cameras', 'cctvsetup'] },
  { label: 'Setup',       ids: ['android', 'server', 'settings'] },
  { label: 'Portal',      ids: ['landing'] },
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
          <div className="brand-name">WildTrack</div>
          <div className="brand-sub">Animal Alert System</div>
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
        {NAV_SECTIONS.map(section => (
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
          <div className="user-avatar">
            <span className="mono">{user.name ? user.name[0].toUpperCase() : 'O'}</span>
          </div>
          <div className="user-meta">
            <div className="user-name">{user.name || 'Operator'}</div>
            <div className="user-role">Console Admin</div>
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
