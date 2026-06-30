import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  const token = localStorage.getItem('wt_token');
  if (token && typeof resource === 'string' && !resource.includes('/api/auth/')) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return originalFetch(resource, config);
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
