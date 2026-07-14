import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, RefreshCw } from 'lucide-react';

export default function AdminLogin({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Password is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8085/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: password.trim()
        })
      });

      const data = response.ok ? await response.json() : null;
      if (response.ok && data?.success && data?.token) {
        localStorage.setItem('admin_token', data.token);
        onLoginSuccess(data.token);
      } else {
        const errorData = data || await response.json().catch(() => ({}));
        setError(errorData.detail || 'Invalid administrator password.');
      }
    } catch (err) {
      setError('Connection to authentication services failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh',
      padding: '1rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        maxWidth: '400px',
        width: '100%',
        padding: '2.5rem',
        textAlign: 'center',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
      }}>
        {/* Branding Shield Icon */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '50%',
          width: '56px',
          height: '56px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          boxShadow: '0 0 15px rgba(59, 130, 246, 0.15)'
        }}>
          <ShieldCheck size={28} style={{ color: 'var(--primary)' }} />
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
          Admin Portal Access
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Enter the administrator credential password to authenticate and unlock coordination controls.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="password"
              placeholder="Administrator Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              style={{ width: '100%', paddingLeft: '3rem' }}
              disabled={loading}
              autoFocus
            />
            <Lock size={18} style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: '6px',
              padding: '0.75rem',
              color: '#fca5a5',
              fontSize: '0.8rem',
              textAlign: 'left',
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem 1rem' }}
          >
            {loading ? <RefreshCw className="spinner" size={16} /> : <ArrowRight size={16} />}
            {loading ? 'Authenticating...' : 'Authenticate Access'}
          </button>
        </form>
      </div>
    </div>
  );
}
