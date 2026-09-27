import { useState, useEffect } from 'react';
import { Users, Trash2, MapPin, Shield, CheckCircle } from 'lucide-react';
import './pages.css';

export default function UsersManagement({ serverBase, user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const handleDeleteUser = async (email) => {
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;
    try {
      const token = localStorage.getItem('wt_token');
      const response = await fetch(`${serverBase}/api/users/${email}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to delete user');
      setUsers(users.filter(u => u.email !== email));
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user || user.role === 'USER') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <Shield size={48} style={{ color: 'var(--border)', marginBottom: 20 }}/>
        <h2>Access Restricted</h2>
        <p className="text-muted">You do not have permission to view managed personnel.</p>
      </div>
    );
  }

  const roleTitle = user.role === 'AGENCY_ADMIN' ? 'Area Administrators' : 'App Users & Residents';
  const roleDesc = user.role === 'AGENCY_ADMIN' 
    ? 'Manage local administrators within your District.'
    : 'Manage field patrols and app users registered in your Area.';

  return (
    <div className="users-mgmt-container fade-in">
      <div className="section-header">
        <h2>{roleTitle}</h2>
        <p className="text-muted">{roleDesc}</p>
      </div>
      
      {error && (
        <div className="camera-map-error" style={{ marginBottom: 20 }}>
          <span>Error loading users: {error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading personnel...</div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <Users size={32} style={{ color: 'var(--border)', marginBottom: 15 }} />
          <p>No personnel registered under your jurisdiction yet.</p>
        </div>
      ) : (
        <div className="users-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {users.map((u) => (
            <div key={u._id} className="card user-card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {u.name ? u.name[0].toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{u.name}</h3>
                    <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>{u.email}</p>
                  </div>
                </div>
                <div style={{ padding: '4px 8px', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', fontSize: '0.75rem', fontWeight: 600 }}>
                  <CheckCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }}/>
                  ACTIVE
                </div>
              </div>
              
              <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <MapPin size={14} className="text-muted" />
                  <span><strong>District:</strong> {u.district || 'Unassigned'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={14} className="text-muted" />
                  <span><strong>Role:</strong> {u.role}</span>
                </div>
              </div>
              
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <button 
                  onClick={() => handleDeleteUser(u.email)}
                  className="btn btn-secondary" 
                  style={{ color: '#ef4444', borderColor: 'transparent' }}
                >
                  <Trash2 size={14} /> Remove Access
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
