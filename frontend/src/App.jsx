import React, { useState, useEffect } from 'react';
import StudentSearch from './components/StudentSearch';
import AdminPortal from './components/AdminPortal';
import AdminLogin from './components/AdminLogin';
import { GraduationCap, User, ShieldCheck, HelpCircle } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('student'); // 'student', 'admin'
  const [backendStatus, setBackendStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const [adminToken, setAdminToken] = useState(localStorage.getItem('admin_token') || '');

  useEffect(() => {
    // Check if backend API is online
    const checkBackend = async () => {
      try {
        const res = await fetch('http://localhost:8085/');
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
    <div className="container">
      {/* Top Navigation & Branding Header */}
      <header className="animate-fade-in">
        <a href="/" className="logo" onClick={(e) => { e.preventDefault(); setView('student'); }}>
          <div className="logo-icon">
            <GraduationCap size={24} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 'inherit', fontWeight: 'inherit', margin: 0, padding: 0, display: 'inline' }}>
              MITS <span className="text-gradient">Exam Seating</span>
            </h1>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '-2px' }}>
              AI Orchestrator Platform
            </p>
          </div>
        </a>

        {/* View Switch Tabs */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Server Connection Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', marginRight: '1rem' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              background: backendStatus === 'online' ? 'var(--accent)' : backendStatus === 'offline' ? 'var(--error)' : 'var(--warning)', 
              borderRadius: '50%',
              boxShadow: backendStatus === 'online' ? '0 0 8px var(--accent)' : 'none',
              display: 'inline-block'
            }} />
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
              {backendStatus === 'online' ? 'API ONLINE' : backendStatus === 'offline' ? 'API OFFLINE' : 'CHECKING STATUS'}
            </span>
          </div>

          <div className="nav-tabs">
            <button 
              onClick={() => setView('student')} 
              className={`nav-btn ${view === 'student' ? 'active' : ''}`}
            >
              <User size={16} /> Student Finder
            </button>
            <button 
              onClick={() => setView('admin')} 
              className={`nav-btn ${view === 'admin' ? 'active' : ''}`}
            >
              <ShieldCheck size={16} /> Admin Portal
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
      <footer style={{ marginTop: '5rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <div>
          <p>© 2026 Madanapalle Institute of Technology & Science. All rights reserved.</p>
          <p style={{ marginTop: '0.25rem' }}>Designed for semester exams & seating block automation.</p>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="#help" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <HelpCircle size={14} /> Help Center
          </a>
          <span>V1.0.0 (FastAPI + React + SQLite)</span>
        </div>
      </footer>
    </div>
  );
}
