import React, { useState, useEffect } from 'react';
import StudentSearch from './components/StudentSearch';
import AdminPortal from './components/AdminPortal';
import AdminLogin from './components/AdminLogin';
import { API_BASE_URL } from './config';

export default function App() {
  const [view, setView] = useState('student'); // 'student', 'admin'
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const [adminToken, setAdminToken] = useState(localStorage.getItem('admin_token') || '');

  useEffect(() => {
    // Check if backend API is online
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/`);
        const data = await res.json();
        if (data.status === 'online') {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch (e) {
        setBackendStatus('offline');
      }
    };
    checkBackend();
  }, []);

  return (
    <div>
      {/* Developer Ops Top Strip (Admin Only) */}
      {view === 'admin' && (
        <div style={{
          background: '#000000',
          color: '#ffffff',
          padding: '0.4rem 1.5rem',
          fontSize: '0.7rem',
          fontWeight: 600,
          fontFamily: 'monospace',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #333333'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>NODE_ENV: PRODUCTION</span>
            <span style={{ color: '#9ca3af' }}>|</span>
            <span>CONSOLE: v1.5.0-STABLE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              width: '6px', 
              height: '6px', 
              background: backendStatus === 'online' ? '#16a34a' : backendStatus === 'offline' ? '#dc2626' : '#d97706', 
              borderRadius: '50%',
              display: 'inline-block'
            }} />
            <span>API ENDPOINT: {backendStatus === 'online' ? 'ONLINE (LATENCY: <10ms)' : backendStatus === 'offline' ? 'OFFLINE' : 'CHECKING'}</span>
          </div>
        </div>
      )}

      <div className="container">
        {/* Top Navigation & Branding Header */}
        <header className="animate-fade-in" style={{ marginTop: '1rem' }}>
          <a href="/" className="logo" onClick={(e) => { e.preventDefault(); setView('student'); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
            <img src="/favicon.png" alt="Alloc8 Logo" style={{ height: '48px', objectFit: 'contain', background: '#ffffff', padding: '6px 16px', borderRadius: '4px', border: '2px solid #000000' }} />
            {view === 'admin' && (
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', margin: 0 }}>
                AI-Powered Examination Seating Planning and Student Seating Finder System
              </p>
            )}
          </a>

          {/* View Switch Tabs */}
          <div className="header-actions">
            <div className="nav-tabs">
              <button 
                onClick={() => setView('student')} 
                className={`nav-btn ${view === 'student' ? 'active' : ''}`}
              >
                <img 
                  src={view === 'student' ? "https://img.icons8.com/ios-glyphs/24/ffffff/user.png" : "https://img.icons8.com/ios-glyphs/24/4b5563/user.png"} 
                  style={{ width: '16px', height: '16px', objectFit: 'contain' }} 
                  alt="" 
                /> Student Finder
              </button>
              <button 
                onClick={() => setView('admin')} 
                className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
              >
                <img 
                  src={view === 'admin' ? "https://img.icons8.com/ios-glyphs/24/ffffff/shield.png" : "https://img.icons8.com/ios-glyphs/24/4b5563/shield.png"} 
                  style={{ width: '16px', height: '16px', objectFit: 'contain' }} 
                  alt="" 
                /> Admin Portal
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ minHeight: '60vh' }}>
          {view === 'student' ? (
            <StudentSearch />
          ) : (
            adminToken ? (
              <AdminPortal token={adminToken} onLogout={() => {
                localStorage.removeItem('admin_token');
                setAdminToken('');
              }} />
            ) : (
              <AdminLogin onLoginSuccess={(token) => setAdminToken(token)} />
            )
          )}
        </main>

        {/* Footer Info */}
        <footer style={{ marginTop: '5rem', borderTop: '2px solid var(--border-color)', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>© 2026 AI-Powered Examination Seating Planning and Student Seating Finder System</p>
            <p style={{ marginTop: '0.25rem' }}>Maintained by IT Operations & Academic Planning Group. For support, contact Admin Operations.</p>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <a href="#help" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
              <img 
                src="https://img.icons8.com/ios-glyphs/24/4b5563/help.png" 
                style={{ width: '14px', height: '14px', objectFit: 'contain' }} 
                alt="" 
              /> System Manual
            </a>
            <span style={{ fontWeight: 600 }}>BUILD: v1.5.0-STABLE (REACT + FASTAPI)</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
