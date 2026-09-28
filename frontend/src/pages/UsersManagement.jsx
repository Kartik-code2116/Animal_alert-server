import { useState, useEffect, useMemo } from 'react';
import { Users, Trash2, MapPin, Shield, CheckCircle, AlertTriangle, Search, RefreshCw, UserPlus, Mail, Globe, Map, ChevronDown, Eye } from 'lucide-react';

export default function UsersManagement({ serverBase, user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [serverBase]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('wt_token');
      const response = await fetch(`${serverBase}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (email, name) => {
    if (!window.confirm(`Remove access for ${name || email}? This action cannot be undone.`)) return;
    try {
      const token = localStorage.getItem('wt_token');
      const response = await fetch(`${serverBase}/api/users/${email}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to remove user');
      setUsers(users.filter(u => u.email !== email));
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.district || '').toLowerCase().includes(q)
      );
    }
    if (filterRole !== 'ALL') {
      result = result.filter(u => u.role === filterRole);
    }
    return result;
  }, [users, searchQuery, filterRole]);

  const stats = useMemo(() => ({
    total: users.length,
    areaAdmins: users.filter(u => u.role === 'AREA_ADMIN').length,
    appUsers: users.filter(u => u.role === 'USER').length,
    districts: [...new Set(users.map(u => u.district).filter(Boolean))].length,
  }), [users]);

  /* ───── ROLE GATING ───── */
  if (!user || user.role === 'USER') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="card" style={{ textAlign: 'center', padding: '60px 40px', maxWidth: 420 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={28} style={{ color: '#ef4444' }}/>
          </div>
          <h2 style={{ marginBottom: 8 }}>Access Restricted</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
            Personnel management is reserved for Area Administrators and Central Agency Admins. Contact your district administrator for elevated access.
          </p>
        </div>
      </div>
    );
  }

  const isAgency = user.role === 'AGENCY_ADMIN';
  const pageTitle = isAgency ? 'Area Controllers' : 'Field Personnel';
  const pageDesc = isAgency
    ? `Manage all Area Administrators deployed across your state — ${user.state || user.country || 'your jurisdiction'}`
    : `Manage App Users & field residents in ${user.district || 'your area'}`;
  const managedRoleLabel = isAgency ? 'Area Admin' : 'App User';

  return (
    <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ─── HEADER ─── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{pageTitle}</h1>
            <p className="text-muted" style={{ margin: '6px 0 0', fontSize: '0.9rem' }}>{pageDesc}</p>
          </div>
          <button className="btn btn-primary" onClick={fetchUsers} disabled={loading} style={{ gap: 6 }}>
            <RefreshCw size={14} className={loading ? 'spin-slow' : ''}/> Sync Personnel
          </button>
        </div>
      </div>

      {/* ─── STATS ROW ─── */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-accent-bar" style={{ background: '#3b82f6' }}/>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="stat-label">Total Personnel</div>
            <div style={{ color: '#3b82f6', opacity: 0.7 }}><Users size={18}/></div>
          </div>
          <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.total}</div>
          <div className="stat-sub">Under your command</div>
        </div>
        {isAgency && (
          <div className="stat-card">
            <div className="stat-accent-bar" style={{ background: '#8b5cf6' }}/>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="stat-label">Area Controllers</div>
              <div style={{ color: '#8b5cf6', opacity: 0.7 }}><Shield size={18}/></div>
            </div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.areaAdmins}</div>
            <div className="stat-sub">Active administrators</div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-accent-bar" style={{ background: '#10b981' }}/>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="stat-label">Districts Covered</div>
            <div style={{ color: '#10b981', opacity: 0.7 }}><Map size={18}/></div>
          </div>
          <div className="stat-value" style={{ color: '#10b981' }}>{stats.districts}</div>
          <div className="stat-sub">Geographic zones</div>
        </div>
        <div className="stat-card">
          <div className="stat-accent-bar" style={{ background: '#f59e0b' }}/>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="stat-label">App Users</div>
            <div style={{ color: '#f59e0b', opacity: 0.7 }}><Eye size={18}/></div>
          </div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.appUsers}</div>
          <div className="stat-sub">Field residents</div>
        </div>
      </div>

      {/* ─── SEARCH & FILTER ─── */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}/>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, email, or district..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>
        {isAgency && (
          <select
            className="form-select"
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="ALL">All Roles</option>
            <option value="AREA_ADMIN">Area Admins Only</option>
            <option value="USER">App Users Only</option>
          </select>
        )}
        <span className="text-muted" style={{ fontSize: 12 }}>{filteredUsers.length} results</span>
      </div>

      {/* ─── ERROR ─── */}
      {error && (
        <div className="card" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} style={{ color: '#ef4444' }}/>
          <span style={{ color: '#ef4444' }}>Error loading personnel: {error}</span>
          <button className="btn btn-sm" onClick={fetchUsers} style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}

      {/* ─── USERS LIST ─── */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <RefreshCw size={24} className="spin-slow" style={{ color: 'var(--accent)', margin: '0 auto 16px', display: 'block' }}/>
          <p className="text-muted">Loading personnel records...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(59,130,246,0.08)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserPlus size={24} style={{ color: '#3b82f6' }}/>
          </div>
          <h3 style={{ margin: '0 0 6px' }}>No Personnel Found</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem', maxWidth: 360, margin: '0 auto' }}>
            {searchQuery ? 'No users match your search criteria.' : `No ${managedRoleLabel}s have registered under your jurisdiction yet. They will appear here after signing up through the WildTrack portal.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredUsers.map((u) => {
            const isExpanded = expandedUser === u._id;
            const roleColor = u.role === 'AGENCY_ADMIN' ? '#8b5cf6' : u.role === 'AREA_ADMIN' ? '#3b82f6' : '#10b981';
            const roleLabel = u.role === 'AGENCY_ADMIN' ? 'Central Admin' : u.role === 'AREA_ADMIN' ? 'Area Admin' : 'App User';
            const joinDate = u.created_at ? new Date(u.created_at * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

            return (
              <div key={u._id} className="card" style={{ padding: 0, overflow: 'hidden', transition: 'all 0.2s ease' }}>
                {/* Main row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer' }}
                  onClick={() => setExpandedUser(isExpanded ? null : u._id)}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: `linear-gradient(135deg, ${roleColor}22, ${roleColor}44)`,
                    color: roleColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-mono)',
                  }}>
                    {u.name ? u.name[0].toUpperCase() : 'U'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{u.name || 'Unnamed'}</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700,
                        background: `${roleColor}18`, color: roleColor, letterSpacing: '0.04em',
                      }}>
                        {roleLabel.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: 2 }}>
                      {u.email}
                      {u.district && <span> · {u.district}</span>}
                    </div>
                  </div>

                  {/* Status + Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 600,
                      background: 'rgba(52,211,153,0.1)', color: '#34d399',
                    }}>
                      <CheckCircle size={10}/> ACTIVE
                    </span>
                    <ChevronDown size={16} className="text-muted" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}/>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    borderTop: '1px solid var(--border)', padding: '16px 20px',
                    background: 'var(--bg)',
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
                      <DetailBlock icon={<Mail size={13}/>} label="Email" value={u.email} />
                      <DetailBlock icon={<Globe size={13}/>} label="Country" value={u.country || '—'} />
                      <DetailBlock icon={<Map size={13}/>} label="State" value={u.state || '—'} />
                      <DetailBlock icon={<MapPin size={13}/>} label="District" value={u.district || '—'} />
                      <DetailBlock icon={<Shield size={13}/>} label="Role" value={roleLabel} />
                      <DetailBlock icon={<Users size={13}/>} label="Joined" value={joinDate} />
                    </div>

                    {u.areaLocation && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                        📍 Area Coordinates: <code style={{ color: 'var(--accent)' }}>{u.areaLocation}</code>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.email, u.name); }}
                        className="btn btn-sm"
                        style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', gap: 5 }}
                      >
                        <Trash2 size={13}/> Revoke Access
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailBlock({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{icon}</div>
      <div>
        <div className="text-muted" style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );
}
