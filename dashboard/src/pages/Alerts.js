import { useState, useMemo } from 'react';
import { Trash2, AlertTriangle, CheckCircle, Download, Filter, RefreshCw } from 'lucide-react';

export default function Alerts({ alertHistory, clearAlerts, syncAlertsFromServer, serverStatus }) {
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const filtered = useMemo(() => {
    let list = [...alertHistory];
    if (filter) list = list.filter(a => a.animal_type?.toLowerCase().includes(filter.toLowerCase()));
    if (sortBy === 'oldest') list.reverse();
    if (sortBy === 'confidence') list.sort((a,b) => b.confidence - a.confidence);
    return list;
  }, [alertHistory, filter, sortBy]);

  const exportCSV = () => {
    const rows = [['Animal','Confidence','Location','Time']];
    alertHistory.forEach(a => rows.push([a.animal_type, a.confidence, a.location, new Date(a.id).toISOString()]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'wildtrack_alerts.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="alerts-page">
      {/* Controls */}
      <div className="alerts-controls">
        <div className="alerts-search-wrap">
          <Filter size={14} className="search-icon" />
          <input
            className="form-input"
            style={{paddingLeft:32}}
            placeholder="Filter by animal type…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
        <select className="form-select" value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{width:'auto'}}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="confidence">By confidence</option>
        </select>
        <button className="btn btn-sm" onClick={exportCSV} disabled={alertHistory.length===0}>
          <Download size={13}/> Export CSV
        </button>
        <button className="btn btn-sm" onClick={syncAlertsFromServer} disabled={serverStatus !== 'online'}>
          <RefreshCw size={13}/> Sync from Server
        </button>
        <button className="btn btn-sm btn-danger" onClick={clearAlerts} disabled={alertHistory.length===0}>
          <Trash2 size={13}/> Clear All (MongoDB)
        </button>
      </div>

      {/* Summary bar */}
      <div className="alerts-summary">
        <span>Showing <strong>{filtered.length}</strong> of <strong>{alertHistory.length}</strong> alerts</span>
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <CheckCircle size={36} />
            <p>No alerts recorded yet — detections will appear here automatically</p>
          </div>
        </div>
      ) : (
        <div className="alerts-list">
          {filtered.map(a => <AlertRow key={a.id} alert={a} />)}
        </div>
      )}
    </div>
  );
}

function alertTime(a) {
  const ts = a.timestamp ? (a.timestamp > 1e12 ? a.timestamp : a.timestamp * 1000) : (a.id || Date.now());
  return new Date(ts);
}

function AlertRow({ alert: a }) {
  const [expanded, setExpanded] = useState(false);
  const high = a.confidence >= 75;
  const when = alertTime(a);
  return (
    <div className={`alert-row-card ${high ? 'high' : ''}`} onClick={() => setExpanded(e=>!e)}>
      <div className="alert-row-main">
        <div className={`alert-row-icon ${high ? 'danger' : 'warn'}`}>
          <AlertTriangle size={15} />
        </div>
        <div className="alert-row-info">
          <span className="alert-row-name">{a.animal_type}</span>
          <span className="alert-row-loc mono">{a.location}</span>
        </div>
        <div className="alert-row-right">
          <span className={`alert-conf ${high ? 'high' : ''}`}>{a.confidence}%</span>
          <span className="alert-time">{when.toLocaleTimeString()}</span>
          <span className="alert-date">{when.toLocaleDateString()}</span>
        </div>
      </div>
      {expanded && a.image && (
        <div className="alert-row-expand">
          <img src={`data:image/jpeg;base64,${a.image}`} alt="Detection frame" className="alert-thumb" />
          <div className="alert-meta">
            <MetaRow label="Full timestamp" value={when.toISOString()} />
            <MetaRow label="Confidence" value={`${a.confidence}%`} />
            <MetaRow label="GPS" value={a.location} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div style={{display:'flex',gap:12,marginBottom:4}}>
      <span style={{fontSize:11,color:'var(--text-muted)',minWidth:110}}>{label}</span>
      <span style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--text-secondary)'}}>{value}</span>
    </div>
  );
}
