import React, { useState, useEffect } from 'react';
import { Upload, Plus, Trash2, CheckCircle, AlertTriangle, AlertCircle, Play, Eye, FileText, Database, ShieldAlert, Key, Settings, RefreshCw, Layers, Download, Check } from 'lucide-react';

function expandRangeList(prefix, startStr, endStr) {
  prefix = String(prefix || "").trim();
  startStr = String(startStr || "").trim().toUpperCase();
  endStr = String(endStr || "").trim().toUpperCase();
  if (!startStr || !endStr) return [];
  
  // Purely numeric
  if (/^\d+$/.test(startStr) && /^\d+$/.test(endStr)) {
    const s = parseInt(startStr, 10);
    const e = parseInt(endStr, 10);
    const width = startStr.length;
    const list = [];
    for (let i = s; i <= e; i++) {
      list.push(prefix + String(i).padStart(width, '0'));
    }
    return list;
  }
  
  // Alphanumeric JNTU or double letters
  if (startStr.length !== endStr.length) {
    return [prefix + startStr, prefix + endStr];
  }
  
  const digits = Array.from({length: 10}, (_, i) => String(i));
  const letters = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i));
  
  const charSets = [];
  for (let i = 0; i < startStr.length; i++) {
    const char = startStr[i];
    if (/\d/.test(char)) {
      charSets.push(digits);
    } else if (/[A-Z]/i.test(char)) {
      charSets.push(letters);
    } else {
      charSets.push([char]);
    }
  }
  
  const list = [];
  const generate = (index, currentStr) => {
    if (index === startStr.length) {
      if (currentStr >= startStr && currentStr <= endStr) {
        list.push(prefix + currentStr);
      }
      return;
    }
    const set = charSets[index];
    for (let char of set) {
      const nextStr = currentStr + char;
      const startPrefix = startStr.substring(0, nextStr.length);
      const endPrefix = endStr.substring(0, nextStr.length);
      if (nextStr >= startPrefix && nextStr <= endPrefix) {
        generate(index + 1, nextStr);
      }
    }
  };
  
  generate(0, "");
  return list;
}

export default function AdminPortal({ token, onLogout }) {
  const fetch = async (url, options = {}) => {
    try {
      const res = await window.fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        onLogout();
      }
      return res;
    } catch (e) {
      throw e;
    }
  };

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [newSessionName, setNewSessionName] = useState('');
  const [studentsPerBench, setStudentsPerBench] = useState(1);
  const [useAiIngestion, setUseAiIngestion] = useState(false);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletingSession, setDeletingSession] = useState(false);
  
  // File uploading states
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [apiResult, setApiResult] = useState(null);
  
  // Parsed arrangements table state
  const [ranges, setRanges] = useState([]);
  const [validationResults, setValidationResults] = useState(null);
  
  // Current database active ranges
  const [dbRanges, setDbRanges] = useState([]);
  const [selectedBlockDb, setSelectedBlockDb] = useState('All');
  const [selectedBlockPreview, setSelectedBlockPreview] = useState('All');
  const [tab, setTab] = useState('upload'); // 'upload', 'manage', 'settings', 'planner'
  
  // API Key state
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [saveKeySuccess, setSaveKeySuccess] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({ total_sessions: 0, active_session: 'None', total_rooms: 0, total_ranges: 0 });

  // Planner states
  const [plannerStatus, setPlannerStatus] = useState({ students_count: 0, schedule_count: 0, rooms_count: 0 });
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null); // { exam_date, exam_time }
  const [allocationPreview, setAllocationPreview] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvedSlot, setApprovedSlot] = useState(false);
  const [seedingInventory, setSeedingInventory] = useState(false);
  const [targetBlock, setTargetBlock] = useState('All');
  const [classroomText, setClassroomText] = useState(`East Block (EB)
Ground Floor: EB-011, EB-012, EB-013, EB-014, EB-015 (Smart Classroom)
First Floor: EB-102 (Scale-up Classroom), EB-105, EB-105A, EB-106, EB-107, EB-115
Second Floor: EB-210, EB-211, EB-212, EB-213, EB-214 (Smart Classroom), EB-217, EB-219

West Block (WB)
First Floor: WB-103, WB-107, WB-108, WB-109, WB-110 (Smart Classroom), WB-117 (Smart Classroom), WB-118, WB-121, WB-122
Second Floor: WB-202, WB-203, WB-207, WB-208, WB-209, WB-210, WB-211A, WB-215 (Smart Classroom), WB-216, WB-217, WB-218, WB-221
Third Floor: WB-302, WB-303, WB-308 (Smart Classroom), WB-309, WB-310, WB-311, WB-314, WB-315, WB-316, WB-317, WB-320, WB-321, WB-322

South Block (SB)
Ground Floor: SB-011
First Floor: SB-112 (Smart Classroom), SB-113, SB-114, SB-115 (Smart Classroom), SB-116, SB-117, SB-118, SB-119
Second Floor: SB-207, SB-208, SB-209, SB-210 (Smart Classroom), SB-212, SB-213, SB-214, SB-215, SB-216, SB-217, SB-218, SB-219
Third Floor: SB-302 (Smart Classroom), SB-303, SB-304, SB-305, SB-306, SB-308, SB-310, SB-311, SB-312, SB-313, SB-314, SB-315`);
  const [ingestingStudents, setIngestingStudents] = useState(false);
  const [ingestingSchedule, setIngestingSchedule] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchSettings();
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchDbRanges(activeSessionId);
      fetchPlannerStatus(activeSessionId);
      fetchSlots(activeSessionId);
    }
  }, [activeSessionId]);

  const fetchPlannerStatus = async (sessId) => {
    if (!sessId) return;
    try {
      const res = await fetch(`http://localhost:8085/api/admin/planner-status?session_id=${sessId}`);
      const data = await res.json();
      setPlannerStatus(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSlots = async (sessId) => {
    if (!sessId) return;
    try {
      const res = await fetch(`http://localhost:8085/api/admin/allocation/slots?session_id=${sessId}`);
      const data = await res.json();
      setSlots(data);
      if (data.length > 0) {
        setSelectedSlot(data[0]);
      } else {
        setSelectedSlot(null);
      }
    } catch (e) {
      console.error(e);
    }
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

  const handleStudentsUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!activeSessionId) {
      alert("Please select or create an active examination session first.");
      return;
    }
    setIngestingStudents(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', activeSessionId);
    try {
      const res = await fetch('http://localhost:8085/api/admin/ingest-students', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully ingested ${data.count} student registration records.`);
        fetchPlannerStatus(activeSessionId);
      } else {
        alert(data.detail || 'Failed to ingest students list.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIngestingStudents(false);
    }
  };

  const handleScheduleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!activeSessionId) {
      alert("Please select or create an active examination session first.");
      return;
    }
    setIngestingSchedule(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', activeSessionId);
    try {
      const res = await fetch('http://localhost:8085/api/admin/ingest-schedule', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully ingested ${data.count} exam schedule entries.`);
        fetchPlannerStatus(activeSessionId);
        fetchSlots(activeSessionId);
      } else {
        alert(data.detail || 'Failed to ingest exam schedule.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIngestingSchedule(false);
    }
  };

  const handleSeedRooms = async () => {
    if (!classroomText.trim()) {
      alert("Please paste/enter classroom layout text first.");
      return;
    }
    setSeedingInventory(true);
    try {
      const res = await fetch('http://localhost:8085/api/admin/seed-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          session_id: parseInt(activeSessionId),
          text_content: classroomText
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully parsed and seeded ${data.count} classrooms!`);
        fetchPlannerStatus(activeSessionId);
        fetchStats();
      } else {
        alert(data.detail || 'Failed to seed classrooms.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSeedingInventory(false);
    }
  };

  const handleRunPlanner = async () => {
    if (!selectedSlot) return;
    setPlanning(true);
    setApprovedSlot(false);
    try {
      const res = await fetch('http://localhost:8085/api/admin/allocation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: parseInt(activeSessionId),
          exam_date: selectedSlot.exam_date,
          exam_time: selectedSlot.exam_time,
          block: targetBlock,
          students_per_bench: studentsPerBench
        })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.success === false) {
          alert(data.error || 'Failed to run seating planner.');
        } else {
          setAllocationPreview(data);
        }
      } else {
        alert(data.detail || 'Failed to run seating planner.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to backend server: ' + err.message + '\n\nPlease ensure the backend API is running.');
    } finally {
      setPlanning(false);
    }
  };

  const handleApproveAllocation = async () => {
    if (!selectedSlot) return;
    setApproving(true);
    try {
      const res = await fetch('http://localhost:8085/api/admin/allocation/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: parseInt(activeSessionId),
          exam_date: selectedSlot.exam_date,
          exam_time: selectedSlot.exam_time,
          block: targetBlock,
          students_per_bench: studentsPerBench
        })
      });
      if (res.ok) {
        setApprovedSlot(true);
        fetchStats();
        fetchDbRanges(activeSessionId);
        alert("Seating arrangement approved and published to student lookup finder!");
      } else {
        const data = await res.json();
        alert(data.detail || 'Failed to approve seating arrangement.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to backend server: ' + err.message + '\n\nPlease ensure the backend API is running.');
    } finally {
      setApproving(false);
    }
  };

  const handleDownloadPDF = async (endpoint, reportName) => {
    if (!selectedSlot) return;
    try {
      const blockParam = selectedBlockPreview !== 'All' ? `&block=${encodeURIComponent(selectedBlockPreview)}` : '';
      const url = `http://localhost:8085/api/admin/reports/${endpoint}?session_id=${activeSessionId}&exam_date=${encodeURIComponent(selectedSlot.exam_date)}&exam_time=${encodeURIComponent(selectedSlot.exam_time)}${blockParam}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.detail || "Failed to generate report PDF.");
        return;
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const blockSuffix = selectedBlockPreview !== 'All' ? `_${selectedBlockPreview.replace(/\s+/g, '_')}` : '';
      const filename = `${reportName}_${selectedSlot.exam_date.replace(/-/g, '_')}${blockSuffix}.pdf`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert("Error generating PDF: " + err.message);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:8085/api/admin/dashboard-stats');
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('http://localhost:8085/api/admin/sessions');
      const data = await res.json();
      setSessions(data);
      
      // Preserve currently selected session if it still exists
      if (activeSessionId && data.some(s => s.id === activeSessionId)) {
        return;
      }
      
      const active = data.find(s => s.is_active === 1);
      if (active) {
        setActiveSessionId(active.id);
      } else if (data.length > 0) {
        setActiveSessionId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDbRanges = async (sessId) => {
    try {
      const res = await fetch(`http://localhost:8085/api/admin/ranges?session_id=${sessId}`);
      const data = await res.json();
      setDbRanges(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('http://localhost:8085/api/admin/settings');
      const data = await res.json();
      setGeminiApiKey(data.gemini_api_key);
    } catch (e) {
      console.error(e);
    }
  };

  const saveSettings = async () => {
    try {
      const res = await fetch('http://localhost:8085/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini_api_key: geminiApiKey })
      });
      if (res.ok) {
        setSaveKeySuccess(true);
        setTimeout(() => setSaveKeySuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return;
    try {
      const res = await fetch('http://localhost:8085/api/admin/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSessionName })
      });
      if (res.ok) {
        setNewSessionName('');
        fetchSessions();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create session.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to backend server: ' + e.message + '\n\nPlease ensure the backend API is running.');
    }
  };

  const handleActivateSession = async (sessId) => {
    try {
      const res = await fetch(`http://localhost:8085/api/admin/sessions/${sessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      });
      if (res.ok) {
        fetchSessions();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to activate session.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to backend server: ' + e.message + '\n\nPlease ensure the backend API is running.');
    }
  };

  const handleToggleSessionActive = async (sessId, isCurrentlyActive) => {
    try {
      const res = await fetch(`http://localhost:8085/api/admin/sessions/${sessId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isCurrentlyActive })
      });
      if (res.ok) {
        fetchSessions();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to update session status.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to backend server: ' + e.message + '\n\nPlease ensure the backend API is running.');
    }
  };

  const handleDeleteSession = (sessId, sessName) => {
    setDeleteConfirmId(sessId);
    setDeleteConfirmName(sessName);
  };

  const executeDeleteSession = async () => {
    if (!deleteConfirmId) return;
    setDeletingSession(true);
    try {
      const res = await fetch(`http://localhost:8085/api/admin/sessions/${deleteConfirmId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (activeSessionId === deleteConfirmId) {
          const remaining = sessions.filter(s => s.id !== deleteConfirmId);
          if (remaining.length > 0) {
            setActiveSessionId(remaining[0].id);
            await fetch(`http://localhost:8085/api/admin/sessions/${remaining[0].id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_active: true })
            });
          } else {
            setActiveSessionId('');
          }
        }
        setDeleteConfirmId(null);
        fetchSessions();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to delete session.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to connect to backend server: ' + e.message + '\n\nPlease ensure the backend API is running.');
    } finally {
      setDeletingSession(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    triggerUpload(file);
  };

  const triggerUpload = async (file) => {
    if (!activeSessionId) {
      alert("Please select or create an active examination session first.");
      return;
    }
    setUploading(true);
    setUploadedFile(file);
    setApiResult(null);
    setRanges([]);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', activeSessionId);
    formData.append('use_ai', useAiIngestion);
    
    try {
      const res = await fetch('http://localhost:8085/api/admin/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Upload or extraction failed.');
      }
      
      setApiResult(data);
      setRanges(data.validation.validated_data);
      setValidationResults(data.validation);
    } catch (err) {
      alert(err.message);
      setUploadedFile(null);
    } finally {
      setUploading(false);
    }
  };

  // Generate Mock text data for testing
  const handleLoadMockNotice = async () => {
    const mockText = `
    MITS COLLEGE EXAMS
    Date: 2026-07-06  Time: 10:00 AM - 01:00 PM
    
    Block: CSE Block (Block B)
    Room: 401
    - CSE: Roll No 23711A0501 to 23711A0540 (Subject: Computer Networks)
    - CST: Roll No 23711A1201 to 23711A1208 (Subject: Software Engineering)
    
    Room: 402
    - CSE: Roll No 23711A0541 to 23711A0588 (Subject: Computer Networks)
    
    Block: Mechanical Block (Block C)
    Room: 301
    - ME: Roll No 23711A0301 to 23711A0330 (Subject: Thermodynamics)
    `;
    
    // Create a mock blob text file
    const file = new File([mockText], "seating_notice.txt", { type: "text/plain" });
    triggerUpload(file);
  };

  // Handle cell edits in ranges list
  const handleRangeEdit = (index, field, value) => {
    const updated = [...ranges];
    let typedValue = value;
    if (['rows', 'columns', 'padding', 'students_per_bench'].includes(field)) {
      typedValue = parseInt(value) || 0;
    } else if (['start_num', 'end_num', 'roll_prefix'].includes(field)) {
      typedValue = String(value).toUpperCase().trim();
    }
    updated[index][field] = typedValue;
    setRanges(updated);
    
    // Run client side local audits
    auditRangesLocal(updated);
  };

  const handleDeleteRange = (index) => {
    const updated = ranges.filter((_, idx) => idx !== index);
    setRanges(updated);
    auditRangesLocal(updated);
  };

  const handleAddRange = () => {
    const newRow = {
      block: 'CSE Block (Block B)',
      room_name: '401',
      rows: 6,
      columns: 4,
      students_per_bench: 1,
      filling_strategy: 'column_wise',
      roll_prefix: '23711A05',
      start_num: '01',
      end_num: '40',
      padding: 2,
      exam_date: '2026-07-06',
      exam_time: '10:00 AM - 01:00 PM',
      subject: 'Computer Networks'
    };
    const updated = [...ranges, newRow];
    setRanges(updated);
    auditRangesLocal(updated);
  };

  const auditRangesLocal = (data) => {
    // Basic duplicates and capacity validation
    const errors = [];
    const warnings = [];
    const rooms = {};
    
    // Track occupied roll numbers per room
    const roomRollSets = {};

    data.forEach((r, idx) => {
      const studentsPerBench = r.students_per_bench || 1;
      const cap = r.rows * r.columns * studentsPerBench;
      const key = `${r.block}-${r.room_name}`;
      
      const expandedList = expandRangeList(r.roll_prefix, r.start_num, r.end_num);
      const size = expandedList.length;
      
      if (!rooms[key]) {
        rooms[key] = { cap, total: 0 };
      }
      rooms[key].total += size;
      
      if (!roomRollSets[key]) {
        roomRollSets[key] = new Set();
      }
      
      const overlapRolls = [];
      expandedList.forEach(roll => {
        if (roomRollSets[key].has(roll)) {
          overlapRolls.push(roll);
        } else {
          roomRollSets[key].add(roll);
        }
      });
      
      if (overlapRolls.length > 0) {
        errors.push(`Room ${r.room_name} has overlapping student roll numbers: ${overlapRolls.slice(0, 5).join(', ')} overlaps.`);
      }
    });

    Object.keys(rooms).forEach((key) => {
      const room = rooms[key];
      if (room.total > room.cap) {
        warnings.push(`Room ${key.split('-')[1]} allocation (${room.total}) exceeds seating capacity (${room.cap}).`);
      }
    });

    setValidationResults({
      is_valid: errors.length === 0,
      errors: Array.from(new Set(errors)),
      warnings: Array.from(new Set(warnings))
    });
  };

  const handleSaveArrangements = async () => {
    if (!validationResults.is_valid) {
      alert('Please correct all validation errors before saving.');
      return;
    }
    
    try {
      const res = await fetch('http://localhost:8085/api/admin/save-arrangements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: activeSessionId,
          ranges: ranges
        })
      });
      if (res.ok) {
        alert('Seating arrangements saved successfully!');
        setApiResult(null);
        setRanges([]);
        fetchDbRanges(activeSessionId);
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isDownloadEnabled = approvedSlot || (selectedSlot && dbRanges.some(
    r => r.exam_date === selectedSlot.exam_date && r.exam_time === selectedSlot.exam_time
  ));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Top Header Session Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Admin Seating Controller</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.1rem' }}>Configure rooms, upload registrations, and run the 12-12 planner</p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Exam Session:</span>
          <select 
            value={activeSessionId}
            onChange={(e) => handleActivateSession(parseInt(e.target.value))}
            className="input-field"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(59,130,246,0.05)', borderRadius: '6px', cursor: 'pointer' }}
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.is_active ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Layers size={36} style={{ color: 'var(--primary)' }} />
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sessions</span>
            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.total_sessions}</p>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <CheckCircle size={36} style={{ color: 'var(--accent)' }} />
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Exam</span>
            <p style={{ fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{stats.active_session}</p>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Database size={36} style={{ color: 'var(--secondary)' }} />
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allocated Rooms</span>
            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.total_rooms}</p>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <FileText size={36} style={{ color: 'var(--warning)' }} />
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Seating Ranges</span>
            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.total_ranges}</p>
          </div>
        </div>
      </div>

      {/* Admin Tab Controls */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setTab('upload')} 
          className={`nav-btn ${tab === 'upload' ? 'active' : ''}`}
          style={{ borderRadius: '8px' }}
        >
          <Upload size={16} /> AI Ingestion & Upload
        </button>
        <button 
          onClick={() => setTab('planner')} 
          className={`nav-btn ${tab === 'planner' ? 'active' : ''}`}
          style={{ borderRadius: '8px' }}
        >
          <Database size={16} /> AI Seating Planner
        </button>
        <button 
          onClick={() => setTab('manage')} 
          className={`nav-btn ${tab === 'manage' ? 'active' : ''}`}
          style={{ borderRadius: '8px' }}
        >
          <Layers size={16} /> Sessions & Current Seating
        </button>
        <button 
          onClick={() => setTab('settings')} 
          className={`nav-btn ${tab === 'settings' ? 'active' : ''}`}
          style={{ borderRadius: '8px' }}
        >
          <Settings size={16} /> AI Settings
        </button>
        <button 
          onClick={onLogout} 
          className="nav-btn"
          style={{ borderRadius: '8px', marginLeft: 'auto', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
        >
          Logout
        </button>
      </div>

      {/* ======================================= */}
      {/*       TAB: AI INGESTION & UPLOAD        */}
      {/* ======================================= */}
      {tab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Settings Notice if active session is missing */}
          {!activeSessionId && (
            <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)' }}>
              <p style={{ fontWeight: 700, color: '#fca5a5' }}>No Active Session Selected</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Go to the **Sessions & Current Seating** tab to select or create an active examination session before uploading notices.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.5rem', fontWeight: 500 }}>
                💡 <strong>API Connection Check:</strong> If the connection indicator in the top right shows "API OFFLINE", please run <code>python -m backend.main</code> in your backend project folder to start the database server.
              </p>
            </div>
          )}

          {activeSessionId && !apiResult && (
            <div className="glass-panel" style={{ padding: '2.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
                Upload Seating Arrangement for Active Session: <span style={{ color: 'var(--primary)' }}>{stats.active_session || 'None'}</span>
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <label className="dropzone">
                  <input type="file" onChange={handleFileUpload} accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg" style={{ display: 'none' }} />
                  <div className="dropzone-icon">
                    <Upload size={28} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Drag & Drop Seating Notice</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Supports text-based PDF/Excel, scanned notice board PDFs, or PNG/JPG images
                    </p>
                  </div>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', margin: '0.25rem 0' }}>
                  <input
                    type="checkbox"
                    id="use-ai-ingestion"
                    checked={useAiIngestion}
                    onChange={(e) => setUseAiIngestion(e.target.checked)}
                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <label htmlFor="use-ai-ingestion" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>
                    Use AI Ingestion & OCR Extraction (Requires configured Gemini API key)
                  </label>
                </div>
 
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span>— OR —</span>
                  <button onClick={handleLoadMockNotice} className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                    <Play size={14} /> One-Click Mock Notice Upload
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loader */}
          {uploading && (
            <div className="glass-panel animate-fade-in" style={{ padding: '3rem', textAlign: 'center' }}>
              <RefreshCw className="spinner" size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', animation: 'spin 2s linear infinite' }} />
              <h4 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Processing File through AI Agents</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem', maxWidth: '400px', margin: '0.5rem auto 0' }}>
                The Document Ingestor is reading files, OCR engine is extracting scanned text, and the LLM agent is parsing logical roll ranges...
              </p>
            </div>
          )}

          {/* Editor Panel after Extraction */}
          {apiResult && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>AI Parsing Preview & Editor</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Extracted {ranges.length} seating range blocks from: <strong style={{ color: 'var(--primary)' }}>{uploadedFile?.name}</strong></p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleAddRange} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    <Plus size={16} /> Add Range Row
                  </button>
                  <button onClick={handleSaveArrangements} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                    <CheckCircle size={16} /> Save to Database
                  </button>
                </div>
              </div>

              {/* Validation Cards */}
              {validationResults && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {validationResults.errors.map((err, i) => (
                    <div key={i} className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <AlertCircle size={20} style={{ color: 'var(--error)' }} />
                      <p style={{ fontSize: '0.9rem', color: '#fca5a5', fontWeight: 600 }}>{err}</p>
                    </div>
                  ))}

                  {validationResults.warnings.map((warn, i) => (
                    <div key={i} className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--warning)', background: 'rgba(245, 158, 11, 0.05)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
                      <p style={{ fontSize: '0.9rem', color: '#fde047', fontWeight: 600 }}>{warn}</p>
                    </div>
                  ))}

                  {validationResults.is_valid && validationResults.errors.length === 0 && (
                    <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--accent)', background: 'rgba(16, 185, 129, 0.05)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <CheckCircle size={20} style={{ color: 'var(--accent)' }} />
                      <p style={{ fontSize: '0.9rem', color: '#a7f3d0', fontWeight: 600 }}>Validation Passed: No overlapping student ranges found. Ready to commit.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Raw text logs dropdown */}
              <details style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  View Raw Extracted Document Text (AI Input)
                </summary>
                <div style={{ marginTop: '1rem' }}>
                  <pre className="code-preview">{apiResult.raw_text_preview}</pre>
                </div>
              </details>

              {/* Range Editor Table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem' }}>Block / Location</th>
                      <th style={{ padding: '0.75rem' }}>Room</th>
                      <th style={{ padding: '0.75rem' }}>Grid (R x C)</th>
                      <th style={{ padding: '0.75rem' }}>Bench Mode</th>
                      <th style={{ padding: '0.75rem' }}>Prefix</th>
                      <th style={{ padding: '0.75rem' }}>Start</th>
                      <th style={{ padding: '0.75rem' }}>End</th>
                      <th style={{ padding: '0.75rem' }}>Padding</th>
                      <th style={{ padding: '0.75rem' }}>Subject</th>
                      <th style={{ padding: '0.75rem' }}>Date / Time</th>
                      <th style={{ padding: '0.75rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranges.map((row, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid var(--border-color)', background: index % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <input type="text" value={row.block} onChange={(e) => handleRangeEdit(index, 'block', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '150px' }} />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input type="text" value={row.room_name} onChange={(e) => handleRangeEdit(index, 'room_name', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '60px' }} />
                        </td>
                        <td style={{ padding: '0.5rem', display: 'flex', gap: '0.2rem', alignItems: 'center', borderBottom: 'none' }}>
                          <input type="number" value={row.rows} onChange={(e) => handleRangeEdit(index, 'rows', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '40px' }} />
                          <span>×</span>
                          <input type="number" value={row.columns} onChange={(e) => handleRangeEdit(index, 'columns', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '40px' }} />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <select 
                            value={row.students_per_bench || 1} 
                            onChange={(e) => handleRangeEdit(index, 'students_per_bench', e.target.value)} 
                            className="input-field" 
                            style={{ padding: '0.4rem', fontSize: '0.8rem', width: '120px' }}
                          >
                            <option value={1}>1 student / bench</option>
                            <option value={2}>2 students / bench</option>
                          </select>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input type="text" value={row.roll_prefix} onChange={(e) => handleRangeEdit(index, 'roll_prefix', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '100px' }} />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input type="text" value={row.start_num} onChange={(e) => handleRangeEdit(index, 'start_num', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '60px' }} />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input type="text" value={row.end_num} onChange={(e) => handleRangeEdit(index, 'end_num', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '60px' }} />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input type="number" value={row.padding} onChange={(e) => handleRangeEdit(index, 'padding', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '50px' }} />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input type="text" value={row.subject} onChange={(e) => handleRangeEdit(index, 'subject', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.8rem', width: '150px' }} />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input type="text" value={row.exam_date} onChange={(e) => handleRangeEdit(index, 'exam_date', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.75rem', width: '90px', marginBottom: '0.2rem' }} />
                          <input type="text" value={row.exam_time} onChange={(e) => handleRangeEdit(index, 'exam_time', e.target.value)} className="input-field" style={{ padding: '0.4rem', fontSize: '0.75rem', width: '120px' }} />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <button onClick={() => handleDeleteRange(index)} style={{ border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => setApiResult(null)} className="btn-secondary">Cancel</button>
                <button onClick={handleSaveArrangements} className="btn-primary">
                  <CheckCircle size={18} /> Save & Activate Arrangements
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================= */}
      {/*   TAB: SESSIONS & CURRENT SEATING      */}
      {/* ======================================= */}
      {tab === 'manage' && (
        <div className="grid-2">
          {/* Create & Select Session */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Examination Sessions</h3>
            
            {/* Create new */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="New Session Name (e.g. Backlog Exams Dec 2026)"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                className="input-field"
                style={{ flex: 1, padding: '0.6rem 1rem', fontSize: '0.9rem' }}
              />
              <button onClick={handleCreateSession} className="btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                <Plus size={16} /> Create
              </button>
            </div>

            {/* Sessions list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sessions.map((s) => (
                <div 
                  key={s.id} 
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem', background: s.is_active ? 'rgba(59,130,246,0.06)' : 'rgba(255,255,255,0.01)',
                    border: s.is_active ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    borderRadius: '8px'
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 700, color: s.is_active ? 'var(--text-main)' : 'var(--text-muted)' }}>{s.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Created: {new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button 
                      onClick={() => handleToggleSessionActive(s.id, s.is_active)} 
                      className={`btn-${s.is_active ? 'primary' : 'secondary'}`} 
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '4px' }}
                    >
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDeleteSession(s.id, s.name)} style={{ border: 'none', background: 'transparent', color: 'rgba(239, 68, 68, 0.6)', cursor: 'pointer', padding: '0.2rem' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

            {/* Database Ranges Display */}
          <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Seating Map Database</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Currently saved arrangements inside SQL database</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Session:</span>
                <span className="badge badge-info">{stats.active_session}</span>
              </div>
              
              {dbRanges.length > 0 && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.4rem' }}>Filter Block:</span>
                  {['All', ...new Set(dbRanges.map(r => r.block))].map(block => (
                    <button
                      key={block}
                      onClick={() => setSelectedBlockDb(block)}
                      className={`nav-btn ${selectedBlockDb === block ? 'active' : ''}`}
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem', borderRadius: '15px' }}
                    >
                      {block}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              {dbRanges.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No seating ranges loaded for this session. Use the Ingestion tab to upload files.
                </div>
              ) : dbRanges.filter(r => selectedBlockDb === 'All' || r.block === selectedBlockDb).length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No seating ranges found for block "{selectedBlockDb}".
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '0.5rem' }}>Location</th>
                      <th style={{ padding: '0.5rem' }}>Roll Range</th>
                      <th style={{ padding: '0.5rem' }}>Capacity</th>
                      <th style={{ padding: '0.5rem' }}>Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbRanges
                      .filter(r => selectedBlockDb === 'All' || r.block === selectedBlockDb)
                      .map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem' }}>
                            <strong>Room {r.room_name}</strong>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.block}</div>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <code>{r.roll_prefix}{r.start_num}</code> to <code>{r.roll_prefix}{r.end_num}</code>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <strong>{expandRangeList(r.roll_prefix, r.start_num, r.end_num).length}</strong> students
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                              Grid: {r.rows}x{r.columns} ({r.students_per_bench === 1 ? '1 student/bench' : '2 students/bench'})
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{r.subject}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================= */}
      {/*         TAB: AI SEATING PLANNER         */}
      {/* ======================================= */}
      {tab === 'planner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {!activeSessionId && (
            <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)' }}>
              <p style={{ fontWeight: 700, color: '#fca5a5' }}>No Active Session Selected</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Go to the **Sessions & Current Seating** tab to select or create an active examination session before planning seating arrangements.
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.5rem', fontWeight: 500 }}>
                💡 <strong>API Connection Check:</strong> If the connection indicator in the top right shows "API OFFLINE", please run <code>python -m backend.main</code> in your backend project folder to start the database server.
              </p>
            </div>
          )}

          {activeSessionId && (
            <>
              {/* Section 1: Campus Inventory and Uploads */}
              <div className="grid-2">
                
                {/* Classroom Ingestion Textarea */}
                <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>1. Classroom Inventory Ingestion</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                    Paste or edit the block and classroom layout text below. Each room will be configured for a default capacity of 24 students (6x4 bench grid).
                  </p>
                  
                  <textarea
                    value={classroomText}
                    onChange={(e) => setClassroomText(e.target.value)}
                    className="input-field"
                    style={{ 
                      width: '100%', 
                      height: '180px', 
                      fontFamily: 'monospace', 
                      fontSize: '0.75rem', 
                      lineHeight: '1.4', 
                      padding: '0.5rem',
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px'
                    }}
                    placeholder="Block Name
Floor: Room1, Room2, ..."
                  />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
                    {plannerStatus.rooms_count > 0 ? (
                      <span className="badge badge-success">{plannerStatus.rooms_count} Classrooms Loaded</span>
                    ) : (
                      <span className="badge badge-warning">No Rooms Seeded</span>
                    )}
                  </div>
                  
                  <button 
                    onClick={handleSeedRooms} 
                    disabled={seedingInventory} 
                    className="btn-primary" 
                    style={{ width: '100%' }}
                  >
                    {seedingInventory ? <RefreshCw className="spinner" size={16} /> : <Database size={16} />}
                    {seedingInventory ? 'Parsing & Seeding...' : 'Seed Classrooms from Text'}
                  </button>
                </div>

                {/* Exam Data Ingestion uploads */}
                <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    2. Exam Data Ingestion: <span style={{ color: 'var(--primary)' }}>{stats.active_session || 'None'}</span>
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
                    Upload Excel or PDF files to ingest student registrations (PIN lists) and the master schedule slots. These are stored securely to generate the mixed layouts.
                  </p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                    {/* Student Registration upload */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        STUDENTS LIST ({plannerStatus.students_count} loaded)
                      </span>
                      <label className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}>
                        <Upload size={14} />
                        <input type="file" onChange={handleStudentsUpload} accept=".pdf,.xlsx,.xls" style={{ display: 'none' }} />
                        {ingestingStudents ? 'Uploading...' : 'Upload Student list'}
                      </label>
                    </div>

                    {/* Schedule upload */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        EXAM SCHEDULE ({plannerStatus.schedule_count} loaded)
                      </span>
                      <label className="btn-secondary" style={{ padding: '0.5rem', fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}>
                        <Upload size={14} />
                        <input type="file" onChange={handleScheduleUpload} accept=".csv,.xlsx,.xls,.txt,.pdf" style={{ display: 'none' }} />
                        {ingestingSchedule ? 'Uploading...' : 'Upload Schedule'}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Seating Planner Runner */}
              <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  3. "12-12" Mixed Seating Planner: <span style={{ color: 'var(--primary)' }}>{stats.active_session || 'None'}</span>
                </h3>
                
                {slots.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No exam slots found. Please upload a Master Exam Schedule above to display available planning slots.
                  </p>
                ) : (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        Select Scheduled Exam Slot
                      </label>
                      <select 
                        className="input-field"
                        style={{ width: '100%', padding: '0.55rem' }}
                        onChange={(e) => {
                          const idx = parseInt(e.target.value);
                          setSelectedSlot(slots[idx]);
                          setAllocationPreview(null);
                          setApprovedSlot(false);
                        }}
                      >
                        {slots.map((s, idx) => (
                          <option key={idx} value={idx}>
                            {s.exam_date} | {s.exam_time}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        Select Target Block (Optional)
                      </label>
                      <select 
                        value={targetBlock}
                        className="input-field"
                        style={{ width: '100%', padding: '0.55rem' }}
                        onChange={(e) => {
                          setTargetBlock(e.target.value);
                          setAllocationPreview(null);
                          setApprovedSlot(false);
                        }}
                      >
                        {(() => {
                          const blocks = ['All'];
                          classroomText.split('\n').forEach(line => {
                            const trimmed = line.trim();
                            if (trimmed && !trimmed.includes(':')) {
                              if (!blocks.includes(trimmed)) {
                                blocks.push(trimmed);
                              }
                            }
                          });
                          return blocks;
                        })().map((block, idx) => (
                          <option key={idx} value={block}>
                            {block}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '180px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Capacity Configuration</label>
                      <select 
                        value={studentsPerBench} 
                        onChange={(e) => {
                          setStudentsPerBench(parseInt(e.target.value));
                          setAllocationPreview(null);
                          setApprovedSlot(false);
                        }}
                        className="input-field"
                        style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                      >
                        <option value={1}>1 Student per Bench (24/Room)</option>
                        <option value={2}>2 Students per Bench (48/Room)</option>
                      </select>
                    </div>
                    
                    <button 
                      onClick={handleRunPlanner}
                      disabled={planning || !selectedSlot}
                      className="btn-primary"
                      style={{ padding: '0.55rem 1.5rem', alignSelf: 'flex-end' }}
                    >
                      {planning ? <RefreshCw className="spinner" size={16} /> : <Play size={16} />}
                      {planning ? 'Running Allocation...' : 'Run 12-12 Allocation Planner'}
                    </button>
                  </div>
                )}
              </div>

              {/* Section 3: Allocation Preview Results */}
              {allocationPreview && (
                <div className="glass-panel animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Summary Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Allocation Preview & Audit</h4>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.1rem' }}>
                        Slot: <strong style={{ color: 'var(--primary)' }}>{allocationPreview.exam_date} | {allocationPreview.exam_time}</strong>
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button 
                        onClick={handleApproveAllocation}
                        disabled={approving || approvedSlot}
                        className="btn-primary"
                        style={{ padding: '0.5rem 1.2rem', background: approvedSlot ? 'var(--accent)' : 'var(--primary)' }}
                      >
                        {approving ? <RefreshCw className="spinner" size={16} /> : approvedSlot ? <Check size={16} /> : <CheckCircle size={16} />}
                        {approving ? 'Saving...' : approvedSlot ? 'Published Live' : 'Approve & Publish to Student Finder'}
                      </button>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rooms Required</span>
                      <p style={{ fontSize: '1.25rem', fontWeight: 800 }}>{allocationPreview.total_rooms_used} Rooms</p>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Students Placed</span>
                      <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>{allocationPreview.total_students_allocated} Students</p>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Leftover Unallocated</span>
                      <p style={{ fontSize: '1.25rem', fontWeight: 800, color: allocationPreview.total_leftovers > 0 ? 'var(--error)' : 'var(--text-main)' }}>
                        {allocationPreview.total_leftovers} Students
                      </p>
                    </div>
                  </div>

                  {/* Warning for leftovers */}
                  {allocationPreview.total_leftovers > 0 && (
                    <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <AlertTriangle size={20} style={{ color: 'var(--error)', marginTop: '0.1rem' }} />
                      <div>
                        <p style={{ fontSize: '0.9rem', color: '#fca5a5', fontWeight: 600 }}>Capacity Alert: Unplaced Leftover Students Found</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          There are {allocationPreview.total_leftovers} students scheduled for this slot that could not be assigned to classrooms because all available rooms are full. Seed more rooms or add more sessions.
                        </p>
                        <div style={{ marginTop: '0.5rem', maxHeight: '100px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {allocationPreview.leftover_students.map((stud, idx) => (
                            <span key={idx} style={{ padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '0.7rem' }}>
                              {stud.roll_number} ({stud.subject.substring(0, 8)}..)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Block Selection pills */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', margin: '0.5rem 0' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '0.5rem' }}>Select Block to View/Download:</span>
                    {['All', ...new Set(allocationPreview.room_allocations.map(r => r.block))].map(block => (
                      <button
                        key={block}
                        onClick={() => setSelectedBlockPreview(block)}
                        className={`nav-btn ${selectedBlockPreview === block ? 'active' : ''}`}
                        style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '20px' }}
                      >
                        {block}
                      </button>
                    ))}
                  </div>

                  {/* PDF Downloads (Only enabled after Approval) */}
                  <div style={{ padding: '1.5rem', background: isDownloadEnabled ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255,255,255,0.02)', border: isDownloadEnabled ? '1px solid var(--accent)' : '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <h5 style={{ fontWeight: 700, fontSize: '0.95rem', color: isDownloadEnabled ? '#a7f3d0' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isDownloadEnabled ? <CheckCircle size={16} style={{ color: 'var(--accent)' }} /> : <FileText size={16} />}
                        {isDownloadEnabled ? `Arrangements Live! Download PDF Documents${selectedBlockPreview !== 'All' ? ` for ${selectedBlockPreview}` : ''}` : 'PDF Administrative Reports'}
                      </h5>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {isDownloadEnabled ? 'Seating coordinates are written to SQL. You can now download the notice documents and attendance lists.' : 'Approve and publish the seating arrangement to enable downloads for door charts, notice board summaries, and invigilator sheets.'}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      <button 
                        onClick={() => handleDownloadPDF('door-charts', 'door_charts')}
                        disabled={!isDownloadEnabled}
                        className={`btn-secondary ${!isDownloadEnabled ? 'disabled' : ''}`}
                        style={{ opacity: isDownloadEnabled ? 1 : 0.5, cursor: isDownloadEnabled ? 'pointer' : 'not-allowed', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                      >
                        <Download size={14} /> Door Grid Charts (PDF)
                      </button>
                      <button 
                        onClick={() => handleDownloadPDF('master-allocation', 'master_hall_allocation')}
                        disabled={!isDownloadEnabled}
                        className={`btn-secondary ${!isDownloadEnabled ? 'disabled' : ''}`}
                        style={{ opacity: isDownloadEnabled ? 1 : 0.5, cursor: isDownloadEnabled ? 'pointer' : 'not-allowed', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                      >
                        <Download size={14} /> Board Summary List (PDF)
                      </button>
                      <button 
                        onClick={() => handleDownloadPDF('attendance-sheets', 'invigilator_attendance_sheets')}
                        disabled={!isDownloadEnabled}
                        className={`btn-secondary ${!isDownloadEnabled ? 'disabled' : ''}`}
                        style={{ opacity: isDownloadEnabled ? 1 : 0.5, cursor: isDownloadEnabled ? 'pointer' : 'not-allowed', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                      >
                        <Download size={14} /> Invigilator Sheets (PDF)
                      </button>
                    </div>
                  </div>

                  {/* List of room grids preview */}
                  <div>
                    <h5 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem' }}>
                      Visual Classroom Map Allocation ({allocationPreview.room_allocations.filter(room => selectedBlockPreview === 'All' || room.block === selectedBlockPreview).length} Rooms 
                      {selectedBlockPreview !== 'All' ? ` in ${selectedBlockPreview}` : ''})
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                      {allocationPreview.room_allocations
                        .filter(room => selectedBlockPreview === 'All' || room.block === selectedBlockPreview)
                        .map((room, rIdx) => (
                        <div key={rIdx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                          {/* Room header bar */}
                          <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <strong style={{ fontSize: '0.95rem' }}>Room {room.room_name}</strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>({room.block})</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', flexWrap: 'wrap' }}>
                              {room.count_A > 0 && (
                                <span style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', border: '1px solid rgba(59,130,246,0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                  {room.count_A} {room.subject_A.substring(0, 15)}..
                                </span>
                              )}
                              {room.count_B > 0 && (
                                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                                  {room.count_B} {room.subject_B.substring(0, 15)}..
                                </span>
                              )}
                              {room.empty_count > 0 && (
                                <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                  {room.empty_count} Vacant
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Room 6x4 checkerboard layout diagram */}
                          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(255,255,255,0.005)' }}>
                            <div style={{ width: '100%', maxWidth: '550px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem', textAlign: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                              FRONT OF ROOM (PROCTOR TABLE / BLACKBOARD)
                            </div>
                            
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: '0.5rem',
                              width: '100%',
                              maxWidth: '550px'
                            }}>
                              {/* Draw grid seats (rows = 6, cols = 4) */}
                              {Array.from({ length: 6 }).map((_, rIdx) => 
                                Array.from({ length: 4 }).map((_, cIdx) => {
                                  const isTwoPerBench = room.capacity === 48;
                                  
                                  if (isTwoPerBench) {
                                    const leftIdx = cIdx * 12 + rIdx * 2;
                                    const rightIdx = leftIdx + 1;
                                    const leftSeat = room.seats[leftIdx];
                                    const rightSeat = room.seats[rightIdx];
                                    
                                    const isLeftEven = (rIdx + cIdx + 0) % 2 === 0;
                                    const isRightEven = (rIdx + cIdx + 1) % 2 === 0;
                                    
                                    return (
                                      <div key={`${rIdx}-${cIdx}`} style={{ display: 'flex', gap: '2px', border: '1px solid rgba(255,255,255,0.02)', padding: '2px', borderRadius: '4px', background: 'rgba(255,255,255,0.01)', minHeight: '44px' }}>
                                        {/* Left seat */}
                                        <div style={{
                                          flex: 1,
                                          border: leftSeat ? '1px solid rgba(255,255,255,0.05)' : '1px dashed var(--border-color)',
                                          background: leftSeat 
                                            ? (isLeftEven ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)') 
                                            : 'rgba(255,255,255,0.01)',
                                          padding: '0.3rem 0.1rem',
                                          borderRadius: '2px',
                                          textAlign: 'center',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'center'
                                        }}>
                                          {leftSeat ? (
                                            <>
                                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: isLeftEven ? 'var(--primary)' : 'var(--accent)', display: 'block', lineHeight: 1 }}>
                                                {leftSeat.roll_number.slice(-4)}
                                              </span>
                                              <span style={{ fontSize: '0.45rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', marginTop: '2px' }} title={leftSeat.subject}>
                                                {getShortSubject(leftSeat.subject)}
                                              </span>
                                            </>
                                          ) : (
                                            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>—</span>
                                          )}
                                        </div>
                                        {/* Right seat */}
                                        <div style={{
                                          flex: 1,
                                          border: rightSeat ? '1px solid rgba(255,255,255,0.05)' : '1px dashed var(--border-color)',
                                          background: rightSeat 
                                            ? (isRightEven ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)') 
                                            : 'rgba(255,255,255,0.01)',
                                          padding: '0.3rem 0.1rem',
                                          borderRadius: '2px',
                                          textAlign: 'center',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'center'
                                        }}>
                                          {rightSeat ? (
                                            <>
                                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: isRightEven ? 'var(--primary)' : 'var(--accent)', display: 'block', lineHeight: 1 }}>
                                                {rightSeat.roll_number.slice(-4)}
                                              </span>
                                              <span style={{ fontSize: '0.45rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', marginTop: '2px' }} title={rightSeat.subject}>
                                                {getShortSubject(rightSeat.subject)}
                                              </span>
                                            </>
                                          ) : (
                                            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>—</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    const seatIdx = cIdx * 6 + rIdx;
                                    const seat = room.seats[seatIdx];
                                    const isEven = (rIdx + cIdx) % 2 === 0;
                                    
                                    return (
                                      <div 
                                        key={`${rIdx}-${cIdx}`}
                                        style={{
                                          border: seat ? '1px solid rgba(255,255,255,0.05)' : '1px dashed var(--border-color)',
                                          background: seat 
                                            ? (isEven ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)') 
                                            : 'rgba(255,255,255,0.01)',
                                          padding: '0.4rem 0.2rem',
                                          borderRadius: '4px',
                                          textAlign: 'center',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          justifyContent: 'center',
                                          minHeight: '42px'
                                        }}
                                      >
                                        {seat ? (
                                          <>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isEven ? 'var(--primary)' : 'var(--accent)' }}>
                                              {seat.roll_number.slice(-4)}
                                            </span>
                                            <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 2px' }} title={seat.subject}>
                                              {getShortSubject(seat.subject)}
                                            </span>
                                          </>
                                        ) : (
                                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            —
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

        </div>
      )}

      {/* ======================================= */}
      {/*            TAB: AI SETTINGS            */}
      {/* ======================================= */}
      {tab === 'settings' && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key size={20} style={{ color: 'var(--primary)' }} /> AI Agent Orchestration Settings
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Configure the Google Gemini API key to enable premium AI-powered processing. When the key is set, the OCR Agent will read text from scanned photos of notices, and the LLM parsing agent will structure arbitrary notices. Without a key, the system runs with local regex and OCR simulators.
          </p>

          <div className="input-group">
            <span className="input-label">Google Gemini API Key</span>
            <input
              type="password"
              placeholder="Paste your GEMINI_API_KEY here"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="input-field"
            />
          </div>

          <button onClick={saveSettings} className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            Save API Key Configuration
          </button>

          {saveKeySuccess && (
            <div className="glass-panel animate-fade-in" style={{ padding: '0.75rem', borderLeft: '4px solid var(--accent)', background: 'rgba(16, 185, 129, 0.05)', marginTop: '1.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: '#a7f3d0', fontWeight: 600 }}>API key updated successfully!</p>
            </div>
          )}

          <div style={{ marginTop: '2.5rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              <ShieldAlert size={14} style={{ color: 'var(--warning)' }} /> Note on Security
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              The API key is stored securely in your local SQLite settings table and is never sent to external servers other than directly to the Google Gemini SDK.
            </p>
          </div>
        </div>
      )}
      {/* Custom Glassmorphic Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '450px',
            width: '100%',
            padding: '2rem',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <ShieldAlert size={24} style={{ color: '#ef4444' }} /> Confirm Session Deletion
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Are you sure you want to permanently delete the examination session <strong style={{ color: 'var(--primary)' }}>"{deleteConfirmName}"</strong>? 
              This will cascade delete all allocated classrooms, seating grids, registrations, and student lookups.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={() => setDeleteConfirmId(null)} 
                className="btn-secondary"
                disabled={deletingSession}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                onClick={executeDeleteSession} 
                className="btn-primary"
                disabled={deletingSession}
                style={{ 
                  background: '#ef4444', 
                  borderColor: '#ef4444', 
                  color: '#fff',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                {deletingSession ? <RefreshCw className="spinner" size={14} /> : <Trash2 size={14} />}
                {deletingSession ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
