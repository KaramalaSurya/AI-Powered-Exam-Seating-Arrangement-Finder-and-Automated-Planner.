import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Clock, BookOpen, Download, User, QrCode, RefreshCw, Bell } from 'lucide-react';

export default function StudentSearch() {
  const [rollNumber, setRollNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [activeSession, setActiveSession] = useState('');
  const [activeSlots, setActiveSlots] = useState([]);
  
  const [sessionsList, setSessionsList] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');

  useEffect(() => {
    const fetchActiveSession = async () => {
      try {
        const res = await fetch('http://localhost:8085/api/admin/dashboard-stats');
        const data = await res.json();
        if (data.active_session && data.active_session !== 'None') {
          setActiveSession(data.active_session);
        }
      } catch (e) {
        console.error('Failed to fetch active session:', e);
      }
    };
    
    const fetchActiveSlots = async () => {
      try {
        const res = await fetch('http://localhost:8085/api/student/active-slots');
        const data = await res.json();
        if (Array.isArray(data)) {
          setActiveSlots(data);
        }
      } catch (e) {
        console.error('Failed to fetch active slots:', e);
      }
    };

    fetchActiveSession();
    fetchActiveSlots();
    
    const fetchSessions = async () => {
      try {
        const res = await fetch('http://localhost:8085/api/student/active-sessions');
        const data = await res.json();
        if (Array.isArray(data)) {
          setSessionsList(data);
          if (data.length > 0) {
            setSelectedSessionId(data[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to fetch active sessions:', e);
      }
    };
    fetchSessions();
  }, []);

  // Sample roll numbers for testing
  const suggestions = [
    { roll: '23711A0518', label: 'CSE Student (Room 401)' },
    { roll: '23711A1205', label: 'CST Student (Room 401)' },
    { roll: '23711A0545', label: 'CSE Student (Room 402)' },
    { roll: '23711A0412', label: 'ECE Student (Room 403)' }
  ];

  const handleSearch = async (roll) => {
    const targetRoll = roll || rollNumber;
    if (!targetRoll.trim()) {
      setError('Please enter a valid roll number.');
      return;
    }
    
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const sessionParam = selectedSessionId ? `&session_id=${selectedSessionId}` : '';
      const response = await fetch(`http://localhost:8085/api/student/search?roll_number=${encodeURIComponent(targetRoll.trim())}${sessionParam}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Failed to find seating arrangement.');
      }
      
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getShortSubject = (subject) => {
    if (!subject) return '—';
    const parenMatch = subject.match(/\(([^)]+)\)/);
    if (parenMatch) {
      return parenMatch[1];
    }
    const lower = subject.toLowerCase();
    if (lower.includes('machine learning')) return 'ML';
    if (lower.includes('deep learning')) return 'DL';
    if (lower.includes('computer networks')) return 'CN';
    if (lower.includes('software engineering')) return 'SE';
    if (lower.includes('universal human values')) return 'UHV';
    if (lower.includes('discrete mathematics')) return 'DM';
    return subject.substring(0, 8);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Search Bar Panel */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>Find Your Seating</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          Enter your 10-character college roll number to instantly retrieve your exam block, room, and seat coordinates.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {sessionsList.length > 0 && (
            <div style={{ minWidth: '220px', position: 'relative' }}>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="input-field"
                style={{ width: '100%', cursor: 'pointer', fontWeight: 600 }}
              >
                {sessionsList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
            <input
              type="text"
              placeholder="e.g. 23711A0518"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="input-field"
              style={{ width: '100%', paddingLeft: '3rem', textTransform: 'uppercase' }}
            />
            <Search 
              size={18} 
              style={{ position: 'absolute', left: '1.2rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
            />
          </div>
          <button 
            onClick={() => handleSearch()} 
            disabled={loading} 
            className="btn-primary"
            style={{ minWidth: '140px' }}
          >
            {loading ? <RefreshCw className="spinner" size={18} /> : <Search size={18} />}
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Suggestion tags */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Try Demo Rolls:</span>
          {suggestions.map((s) => (
            <button
              key={s.roll}
              onClick={() => {
                setRollNumber(s.roll);
                handleSearch(s.roll);
              }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                padding: '0.3rem 0.75rem',
                borderRadius: '15px',
                fontSize: '0.75rem',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(59,130,246,0.1)'}
              onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
            >
              {s.roll} ({s.label.split(' ')[0]})
            </button>
          ))}
        </div>
      </div>

      {/* Active Exam Sessions Status Dashboard */}
      {activeSlots.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          {/* Header block with legend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Active Exam Sessions</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
                Real-time status of departmental seating arrangements.
              </p>
            </div>
            
            {/* Status Legend indicators */}
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', fontWeight: 600 }}>
              <span style={{ 
                background: 'rgba(16, 185, 129, 0.05)', 
                color: 'var(--accent)', 
                border: '1px solid rgba(16, 185, 129, 0.15)', 
                padding: '0.35rem 0.75rem', 
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <span style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%', display: 'inline-block' }} />
                Seating Published
              </span>
              <span style={{ 
                background: 'rgba(255,255,255,0.03)', 
                color: 'var(--text-muted)', 
                border: '1px solid var(--border-color)', 
                padding: '0.35rem 0.75rem', 
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <span style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', display: 'inline-block' }} />
                Draft Phase / Processing
              </span>
            </div>
          </div>

          {/* Cards Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {activeSlots.map((slot, index) => {
              const isPublished = slot.status === 'Published';
              return (
                <div 
                  key={index} 
                  className="glass-panel" 
                  style={{ 
                    padding: '1.5rem', 
                    position: 'relative',
                    borderLeft: isPublished ? '4px solid var(--accent)' : '4px solid #64748b',
                    opacity: isPublished ? 1 : 0.75,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '200px'
                  }}
                >
                  <div>
                    {/* Header: Department + Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em' }}>
                        {slot.department}
                      </span>
                      {isPublished ? (
                        <span style={{ color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          ✓ Published
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <RefreshCw size={12} className="spinner" style={{ animationDuration: '3s' }} /> Processing
                        </span>
                      )}
                    </div>

                    {/* Course Code & Title */}
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'var(--text-main)', lineHeight: 1.3 }}>
                      {slot.subject_code}: {slot.subject_name}
                    </h3>
                    
                    {/* Exam Location */}
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      {slot.exam_hall}
                    </p>
                  </div>

                  {/* Footer Stats section */}
                  <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.25rem' }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, display: 'block', letterSpacing: '0.05em' }}>STUDENTS</span>
                        <strong style={{ fontSize: '1.15rem', color: 'var(--text-main)' }}>{slot.students_count}</strong>
                      </div>
                      
                      {isPublished ? (
                        <button 
                          onClick={() => {
                            if (slot.subject_name.toLowerCase().includes('machine')) {
                              setRollNumber('24691A0505');
                              handleSearch('24691A0505');
                            } else if (slot.subject_name.toLowerCase().includes('deep')) {
                              setRollNumber('24691A3101');
                              handleSearch('24691A3101');
                            }
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '50%',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--text-main)',
                            transition: 'all 0.2s'
                          }}
                          title="Auto-fill and search sample student roll"
                        >
                          →
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          ETA: 10m
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)' }}>
          <p style={{ color: '#fca5a5', fontWeight: 600 }}>{error}</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Check if your roll number has the correct prefix or search using one of the demo roll numbers above.
          </p>
        </div>
      )}

      {/* Result Slip & Grid */}
      {result && (
        <div className="grid-2">
          {/* Seating Slip Card */}
          <div className="glass-panel print-slip" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', overflow: 'hidden' }}>
            {/* Background design accents */}
            <div style={{
              position: 'absolute', top: '-10%', right: '-10%', width: '150px', height: '150px',
              background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)', pointerEvents: 'none'
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed var(--border-color)', paddingBottom: '1.25rem' }}>
              <div>
                <span className="badge badge-info" style={{ marginBottom: '0.5rem' }}>MITS HALL TICKET SLIP</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }} className="text-gradient">{result.session_name}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Madanapalle Inst. of Tech. & Science</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)' }}>Seat {result.seating_details.seat_number}</span>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Assigned Position</span>
              </div>
            </div>

            {/* Info Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                  <User size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Roll Number</p>
                  <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>{result.roll_number}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                  <MapPin size={18} style={{ color: 'var(--secondary)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Exam Block</p>
                  <p style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>{result.seating_details.block}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                  <BookOpen size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subject & Room</p>
                  <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>{result.seating_details.subject} (Room {result.seating_details.room_name})</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                  <Calendar size={18} style={{ color: 'var(--warning)' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date & Time</p>
                  <p style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{result.seating_details.exam_date} | {result.seating_details.exam_time}</p>
                </div>
              </div>
            </div>

            {/* Grid coordinates */}
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Row</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{result.seating_details.row + 1}</p>
              </div>
              <div style={{ width: '1px', height: '30px', background: 'var(--border-color)' }} />
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bench Column</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>{result.seating_details.column + 1}</p>
              </div>
              <div style={{ width: '1px', height: '30px', background: 'var(--border-color)' }} />
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Desk Position</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>
                  {result.seating_details.students_per_bench === 1 ? 'Single Seat' : result.seating_details.side}
                </p>
              </div>
            </div>

            {/* QR Code and Actions */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`MITS-Exam: Roll ${result.roll_number}, Block ${result.seating_details.block}, Room ${result.seating_details.room_name}, Seat ${result.seating_details.seat_number}`)}`}
                  alt="Seating QR Code"
                  style={{ background: 'white', padding: '4px', borderRadius: '6px', width: '90px', height: '90px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <QrCode size={12} /> Scan QR with mobile for fast navigation on campus exam day.
                </p>
                <button onClick={handlePrint} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', width: '100%' }}>
                  <Download size={16} /> Print Seating Slip
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Classroom Grid View */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Classroom Layout</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Room {result.seating_details.room_name} Seating Grid Map</p>
              </div>
              
              {/* Legend */}
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                  <span style={{ width: '10px', height: '10px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: '3px' }} />
                  You
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                  <span style={{ width: '10px', height: '10px', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '3px' }} />
                  Occupied
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                  <span style={{ width: '10px', height: '10px', border: '1px dashed rgba(255, 255, 255, 0.2)', borderRadius: '3px' }} />
                  Empty
                </span>
              </div>
            </div>

            {/* Grid Map */}
            <div className="classroom-map-container">
              <div className="podium-screen">Blackboard / Proctor Table (Front)</div>

              <div 
                className="classroom-grid"
                style={{ 
                  gridTemplateColumns: `repeat(${result.seating_details.room_grid[0]?.length || 4}, 1fr)` 
                }}
              >
                {result.seating_details.room_grid.map((rowCells, rIdx) => 
                  rowCells.map((cell, cIdx) => (
                    <div 
                      key={`${rIdx}-${cIdx}`} 
                      className="bench-cell"
                      style={result.seating_details.students_per_bench === 1 ? { gridTemplateColumns: '1fr' } : {}}
                    >
                      {/* Left seat of the bench */}
                      {cell.left && (() => {
                        const isHighlighted = cell.left.highlighted;
                        const isEmpty = cell.left.roll === 'Empty';
                        const isSubjectA = (rIdx + cIdx + 0) % 2 === 0;
                        const seatStyle = !isHighlighted && !isEmpty ? {
                          background: isSubjectA ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                          color: isSubjectA ? 'var(--primary)' : 'var(--accent)',
                          border: isSubjectA ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)'
                        } : {};
                        return (
                          <div 
                            className={`seat ${cell.left.roll === 'Empty' ? 'empty' : ''} ${cell.left.highlighted ? 'my-seat' : ''}`}
                            title={cell.left.roll}
                            style={seatStyle}
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: !isHighlighted && !isEmpty ? (isSubjectA ? 'var(--primary)' : 'var(--accent)') : undefined }}>
                              {cell.left.roll === 'Empty' ? '—' : cell.left.roll.slice(-4)}
                            </span>
                            <span className="seat-label" style={{ fontSize: '0.55rem', opacity: 0.8, color: !isHighlighted && !isEmpty ? (isSubjectA ? 'var(--primary)' : 'var(--accent)') : undefined }}>
                              {cell.left.roll === 'Empty' ? 'Vacant' : getShortSubject(cell.left.subject)}
                            </span>
                          </div>
                        );
                      })()}

                      {/* Right seat of the bench */}
                      {result.seating_details.students_per_bench === 2 && cell.right && (() => {
                        const isHighlighted = cell.right.highlighted;
                        const isEmpty = cell.right.roll === 'Empty';
                        const isSubjectA = (rIdx + cIdx + 1) % 2 === 0;
                        const seatStyle = !isHighlighted && !isEmpty ? {
                          background: isSubjectA ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                          color: isSubjectA ? 'var(--primary)' : 'var(--accent)',
                          border: isSubjectA ? '1px solid rgba(59, 130, 246, 0.15)' : '1px solid rgba(16, 185, 129, 0.15)'
                        } : {};
                        return (
                          <div 
                            className={`seat ${cell.right.roll === 'Empty' ? 'empty' : ''} ${cell.right.highlighted ? 'my-seat' : ''}`}
                            title={cell.right.roll}
                            style={seatStyle}
                          >
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: !isHighlighted && !isEmpty ? (isSubjectA ? 'var(--primary)' : 'var(--accent)') : undefined }}>
                              {cell.right.roll === 'Empty' ? '—' : cell.right.roll.slice(-4)}
                            </span>
                            <span className="seat-label" style={{ fontSize: '0.55rem', opacity: 0.8, color: !isHighlighted && !isEmpty ? (isSubjectA ? 'var(--primary)' : 'var(--accent)') : undefined }}>
                              {cell.right.roll === 'Empty' ? 'Vacant' : getShortSubject(cell.right.subject)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
              
              <div style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', marginTop: '0.5rem' }}>
                Back of Classroom (Entrance)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
