import React, { useState, useEffect } from 'react';
import { classifyTicketWithOllama } from './api/ollama';

export default function App() {
  // --------------------------------------------------------------------------
  // STATE DEFINITIONS
  // --------------------------------------------------------------------------
  const [loggedIn, setLoggedIn] = useState(() => {
    return localStorage.getItem('logged_in') === 'true';
  });
  
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('user_role') || null;
  });

  const [sessionUser, setSessionUser] = useState(() => {
    const saved = localStorage.getItem('session_user');
    return saved ? JSON.parse(saved) : { name: '', id: '', email: '', dept: '' };
  });

  const [appMode, setAppMode] = useState('Employee Mode'); // 'Employee Mode' or 'Staff Mode (Dashboard)'
  const [step, setStep] = useState('form'); // 'form', 'resolution', 'completed', 'submitted_agent'
  const [ticketData, setTicketData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Persist tickets in localStorage
  const [ticketsDb, setTicketsDb] = useState(() => {
    const saved = localStorage.getItem('tickets_db');
    return saved ? JSON.parse(saved) : [];
  });

  // Login inputs state
  const [loginRole, setLoginRole] = useState('Employee Portal');
  const [loginName, setLoginName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [loginMail, setLoginMail] = useState('');
  const [loginDept, setLoginDept] = useState('--Department--');
  const [loginPwd, setLoginPwd] = useState('');

  // Ticket Form inputs state
  const [formName, setFormName] = useState('');
  const [formId, setFormId] = useState('');
  const [formMail, setFormMail] = useState('');
  const [formTitle, setFormTitle] = useState('-- Select ticket title or topic --');
  const [formCategory, setFormCategory] = useState('-- Select Issue Type --');
  const [formDescription, setFormDescription] = useState('');

  // --------------------------------------------------------------------------
  // EFFECTS (LOCAL STORAGE PERSISTENCE)
  // --------------------------------------------------------------------------
  useEffect(() => {
    localStorage.setItem('logged_in', loggedIn);
    localStorage.setItem('user_role', userRole || '');
    localStorage.setItem('session_user', JSON.stringify(sessionUser));
  }, [loggedIn, userRole, sessionUser]);

  useEffect(() => {
    localStorage.setItem('tickets_db', JSON.stringify(ticketsDb));
  }, [ticketsDb]);

  // Sync ticket form values with logged-in user profile
  useEffect(() => {
    if (loggedIn) {
      setFormName(sessionUser.name);
      setFormId(sessionUser.id);
      setFormMail(sessionUser.email);
    }
  }, [loggedIn, sessionUser]);

  // Reset form inputs
  const resetForm = () => {
    setFormTitle('-- Select ticket title or topic --');
    setFormCategory('-- Select Issue Type --');
    setFormDescription('');
    setStep('form');
  };

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------
  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (loginRole === 'Employee Portal') {
      if (!loginName || !loginId || !loginMail || loginDept === '--Department--' || !loginPwd) {
        setErrorMsg('⚠️ Please fill in all required fields (*) to authenticate.');
        return;
      }
      if (!loginMail.includes('@') || !loginMail.includes('.')) {
        setErrorMsg('⚠️ Please enter a valid employee email address.');
        return;
      }

      const user = { name: loginName, id: loginId, email: loginMail, dept: loginDept };
      setSessionUser(user);
      setUserRole('employee');
      setLoggedIn(true);
      setAppMode('Employee Mode');
      resetForm();
    } else {
      if (!loginName || !loginId || !loginMail || !loginPwd) {
        setErrorMsg('⚠️ Please fill in all required fields (*) to authenticate.');
        return;
      }
      if (!loginMail.includes('@') || !loginMail.includes('.')) {
        setErrorMsg('⚠️ Please enter a valid technician email address.');
        return;
      }

      const user = { name: loginName, id: loginId, email: loginMail, dept: 'IT Support' };
      setSessionUser(user);
      setUserRole('technician');
      setLoggedIn(true);
      setAppMode('Employee Mode');
      resetForm();
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUserRole(null);
    setSessionUser({ name: '', id: '', email: '', dept: '' });
    setTicketsDb([]); // Reset session tickets on logout if desired, or keep them
    // Reset login form fields
    setLoginName('');
    setLoginId('');
    setLoginMail('');
    setLoginDept('--Department--');
    setLoginPwd('');
    resetForm();
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formName || !formId || !formMail || formTitle === '-- Select ticket title or topic --' || formCategory === '-- Select Issue Type --' || !formDescription) {
      setErrorMsg('⚠️ Please fill in all required fields (*) before submitting.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);

    const titleText = formTitle === 'Other (Describe below)' 
      ? `Other: ${formDescription.substring(0, 30)}...` 
      : formTitle;

    try {
      // Connect to Ollama VM server to auto-assign priority, sentiment, and resolution steps
      const analysis = await classifyTicketWithOllama(formCategory, titleText, formDescription);
      
      setTicketData({
        name: formName,
        id: formId,
        email: formMail,
        title: titleText,
        category: formCategory,
        desc: formDescription,
        priority: analysis.priority,
        sentiment: analysis.sentiment,
        steps: analysis.steps,
        source: analysis.source
      });

      setStep('resolution');
    } catch (err) {
      console.error("Error analyzing ticket:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveTicket = () => {
    resetForm();
    setStep('completed');
  };

  const handleQueueTicket = () => {
    const newTckId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket = {
      id: newTckId,
      name: ticketData.name,
      email: ticketData.email,
      title: ticketData.title,
      category: ticketData.category,
      priority: ticketData.priority,
      desc: ticketData.desc,
      status: "Pending Assignment"
    };

    // Insert at front of local tickets array
    setTicketsDb(prev => [newTicket, ...prev]);
    setStep('submitted_agent');
  };

  // Dashboard technician resolution popping and escalation handlers
  const handleDashboardResolve = (originalIndex) => {
    setTicketsDb(prev => prev.filter((_, i) => i !== originalIndex));
  };

  const handleDashboardEscalate = (originalIndex) => {
    setTicketsDb(prev => prev.map((tck, i) => {
      if (i === originalIndex) {
        return { ...tck, priority: 'Critical', status: 'Escalated' };
      }
      return tck;
    }));
  };

  // --------------------------------------------------------------------------
  // RENDER LOGIN SCREEN
  // --------------------------------------------------------------------------
  if (!loggedIn) {
    return (
      <div className="login-container">
        <h1 className="title-gradient">Support AI Ticket Management Agent</h1>
        
        <div className="login-layout-wrapper">
          <div className="login-side-image-container left">
            <img src="/left-removebg-preview.png" alt="Left Decor" className="login-side-image" />
          </div>

          <div className="login-card">
            <div className="login-header">
              <h3>Login</h3>
            </div>

            {errorMsg && (
              <div className="alert-error">
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Select Portal Role *</label>
                <select 
                  className="form-select" 
                  value={loginRole} 
                  onChange={(e) => {
                    setLoginRole(e.target.value);
                    setErrorMsg('');
                  }}
                >
                  <option value="Employee Portal">Employee Portal</option>
                  <option value="Technician Portal">Technician Portal</option>
                </select>
              </div>

              {loginRole === 'Employee Portal' ? (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Employee Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Abhiram" 
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Employee ID *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. EMP-2026" 
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Employee Mail *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. abhiram.g@company.com" 
                      value={loginMail}
                      onChange={(e) => setLoginMail(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Employee Department *</label>
                    <select 
                      className="form-select" 
                      value={loginDept}
                      onChange={(e) => setLoginDept(e.target.value)}
                    >
                      <option value="--Department--">--Department--</option>
                      <option value="Engineering">Engineering</option>
                      <option value="IT Operations">IT Operations</option>
                      <option value="Human Resources">Human Resources</option>
                      <option value="Finance & Accounts">Finance & Accounts</option>
                      <option value="Sales & Marketing">Sales & Marketing</option>
                      <option value="Customer Success">Customer Success</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>Email Password *</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="••••••••" 
                      value={loginPwd}
                      onChange={(e) => setLoginPwd(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn-primary btn-full">
                    🔑 Log in to Employee Portal
                  </button>
                </>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Technician Name *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. Admin User" 
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Technician ID *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. TECH-45" 
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Technician Mail *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="e.g. tech.admin@company.com" 
                      value={loginMail}
                      onChange={(e) => setLoginMail(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label>Console Password *</label>
                    <input 
                      type="password" 
                      className="form-input" 
                      placeholder="••••••••" 
                      value={loginPwd}
                      onChange={(e) => setLoginPwd(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="btn-primary btn-full">
                    🛠️ Log in to Technician Console
                  </button>
                </>
              )}
            </form>
          </div>

          <div className="login-side-image-container right">
            <img src="/right-removebg-preview.png" alt="Right Decor" className="login-side-image" />
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SORT TICKETS FOR STAFF DASHBOARD
  // --------------------------------------------------------------------------
  const priorityWeight = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sortedTickets = [...ticketsDb]
    .map((tck, idx) => ({ tck, originalIndex: idx }))
    .sort((a, b) => {
      const wa = priorityWeight[a.tck.priority] ?? 2;
      const wb = priorityWeight[b.tck.priority] ?? 2;
      return wa - wb;
    });

  // --------------------------------------------------------------------------
  // MAIN APPLICATION LAYOUT
  // --------------------------------------------------------------------------
  return (
    <div className="app-container">
      {/* Loading Spinner overlay */}
      {loading && (
        <div className="spinner-overlay">
          <div className="spinner"></div>
          <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
            🤖 Support AI is analyzing ticket sentiment and auto-classifying priority...
          </p>
        </div>
      )}

      {/* Main XML SVGs in background */}
      <div className="bg-diagrams-main">
        <div className="main-diag-1">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="30" r="4"/>
            <circle cx="50" cy="15" r="5"/>
            <circle cx="80" cy="40" r="4"/>
            <circle cx="40" cy="65" r="6"/>
            <circle cx="70" cy="75" r="4"/>
            <line x1="24" y1="28" x2="45" y2="17" strokeDasharray="2,2"/>
            <line x1="55" y1="18" x2="76" y2="37"/>
            <line x1="40" y1="59" x2="22" y2="34"/>
            <line x1="46" y1="65" x2="66" y2="73"/>
            <line x1="70" y1="71" x2="80" y2="44" strokeDasharray="2,2"/>
            <line x1="44" y1="59" x2="76" y2="42"/>
          </svg>
        </div>
        <div className="main-diag-2">
          <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="10" width="50" height="40" rx="4"/>
            <path d="M12,23 L18,27 L12,31"/>
            <line x1="21" y1="31" x2="31" y2="31"/>
          </svg>
        </div>
        <div className="main-diag-3">
          <svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="5" width="40" height="50" rx="3" />
            <line x1="10" y1="20" x2="50" y2="20" />
            <line x1="10" y1="35" x2="50" y2="35" />
            <circle cx="18" cy="12" r="2" />
            <circle cx="18" cy="27" r="2" />
            <circle cx="18" cy="42" r="2" />
            <line x1="25" y1="12" x2="42" y2="12" />
            <line x1="25" y1="27" x2="42" y2="27" />
            <line x1="25" y1="42" x2="42" y2="42" />
          </svg>
        </div>
        <div className="main-diag-4">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <path d="M18,40 C14,40 10,36 10,32 C10,28 13.5,24.5 17,24 C19,16 26,12 33,14 C39,16 43.5,21 44,27 C49,27 54,31 54,36 C54,41 49,45 44,45 L18,45 Z" />
            <line x1="22" y1="31" x2="42" y2="31" strokeDasharray="2,2"/>
            <line x1="22" y1="38" x2="42" y2="38" />
          </svg>
        </div>
        <div className="main-diag-5">
          <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
            <circle cx="40" cy="40" r="35"/>
            <ellipse cx="40" cy="40" rx="35" ry="12"/>
            <ellipse cx="40" cy="40" rx="12" ry="35"/>
            <line x1="5" y1="40" x2="75" y2="40" strokeDasharray="3,3"/>
            <line x1="40" y1="5" x2="40" y2="75"/>
          </svg>
        </div>
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">🤖 Support AI</h1>
          <h1 className="sidebar-subtitle">Ticket Management System</h1>
        </div>

        <hr className="sidebar-divider" />

        {/* Navigation block */}
        <div className="sidebar-title">Navigation</div>
        <div className="nav-group" style={{ marginBottom: '1.5rem' }}>
          {userRole === 'technician' ? (
            <>
              <div 
                className={`nav-item ${appMode === 'Employee Mode' ? 'active' : ''}`}
                onClick={() => setAppMode('Employee Mode')}
              >
                <input 
                  type="radio" 
                  name="nav-mode" 
                  checked={appMode === 'Employee Mode'} 
                  readOnly 
                />
                Employee Mode
              </div>
              <div 
                className={`nav-item ${appMode === 'Staff Mode (Dashboard)' ? 'active' : ''}`}
                onClick={() => setAppMode('Staff Mode (Dashboard)')}
              >
                <input 
                  type="radio" 
                  name="nav-mode" 
                  checked={appMode === 'Staff Mode (Dashboard)'} 
                  readOnly 
                />
                Staff Mode (Dashboard)
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', color: '#a5b4fc', fontWeight: 600 }}>
              Employee Mode Active
            </p>
          )}
        </div>

        <hr className="sidebar-divider" />

        <div className="sidebar-title">System Status</div>
        <div className="status-box" style={{ marginBottom: '1.5rem' }}>
          <div className="status-line">
            <span>AI Agent:</span>
            <span className="status-value" style={{ color: '#22c55e' }}>🟢 Online</span>
          </div>
          <div className="status-line">
            <span>Active Tickets:</span>
            <span className="status-value">{ticketsDb.length}</span>
          </div>
        </div>

        <button 
          className="btn-secondary btn-full" 
          style={{ marginBottom: '1rem' }}
          onClick={() => {
            setStep('form');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          🔄 Reset Session Flow
        </button>

        <hr className="sidebar-divider" />

        <button 
          className="btn-secondary btn-full" 
          onClick={handleLogout}
        >
          🚪 Log Out
        </button>

        {/* Hollow XML cylinder inside Sidebar */}
        <div className="bg-sidebar-diagram">
          <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
            <path d="M15,20 C15,15 65,15 65,20 L65,30 C65,35 15,35 15,30 Z"/>
            <path d="M15,20 C15,25 65,25 65,20"/>
            <path d="M15,35 L15,45 C15,50 65,50 65,45 L65,35"/>
            <path d="M15,35 C15,40 65,40 65,35"/>
            <path d="M15,50 L15,60 C15,65 65,65 65,60 L65,50"/>
            <path d="M15,50 C15,55 65,55 65,50"/>
          </svg>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        <div className="content-container">
          
          {appMode === 'Employee Mode' ? (
            <>
              <h1 className="title-gradient">AI-Powered Support Desk</h1>
              <p className="subtitle-text">
                Raise an issue and get instant AI-guided self-resolution or immediate dispatch.
              </p>

              {/* STEP 1: FORM VIEW */}
              {step === 'form' && (
                <div className="matte-card">
                  <div className="section-header">Employee Profile & Ticket Details</div>
                  
                  {errorMsg && (
                    <div className="alert-error" style={{ marginBottom: '1.5rem' }}>
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleTicketSubmit}>
                    {/* Row 1: Details */}
                    <div className="form-row">
                      <div className="form-group">
                        <label>Employee Name *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Abhiram" 
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Employee ID *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. EMP-2026" 
                          value={formId}
                          onChange={(e) => setFormId(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Employee Mail *</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. abhiram.g@company.com" 
                          value={formMail}
                          onChange={(e) => setFormMail(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Row 2: Selectors */}
                    <div className="form-row-2col">
                      <div className="form-group">
                        <label>Ticket Title *</label>
                        <select 
                          className="form-select" 
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                        >
                          <option value="-- Select ticket title or topic --">-- Select ticket title or topic --</option>
                          <option value="Cannot log into internal HR portal">Cannot log into internal HR portal</option>
                          <option value="VPN connection failing with handshake error">VPN connection failing with handshake error</option>
                          <option value="Requesting software license approval">Requesting software license approval</option>
                          <option value="Hardware issue - flickering external monitor">Hardware issue - flickering external monitor</option>
                          <option value="Other (Describe below)">Other (Describe below)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Issue Facing *</label>
                        <select 
                          className="form-select" 
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                        >
                          <option value="-- Select Issue Type --">-- Select Issue Type --</option>
                          <option value="Authentication & Access">Authentication & Access</option>
                          <option value="Network & Connectivity">Network & Connectivity</option>
                          <option value="Software / Licenses">Software / Licenses</option>
                          <option value="Hardware Support">Hardware Support</option>
                          <option value="General Enquiry">General Enquiry</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Description */}
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label>Issue Description *</label>
                      <textarea 
                        className="form-textarea" 
                        placeholder="Please detail your problem, including any error codes, steps to reproduce, or recent system changes..." 
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-primary">
                        Submit Ticket ➡️
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 2: AI SELF-RESOLUTION BANNER VIEW */}
              {step === 'resolution' && (
                <div className="matte-card">
                  <div className="section-header">AI Agent Response & Self Resolution</div>

                  <div className="badge-row">
                    <span className="badge-title">Ticket Auto-Analysis:</span>
                    <span className="priority-badge priority-badge-sentiment">
                      {ticketData.sentiment === 'Calm' ? '😊 Calm' : 
                       ticketData.sentiment === 'Frustrated' ? '😟 Frustrated' : 
                       ticketData.sentiment === 'Angry' ? '😡 Angry' : '😐 Neutral'}
                    </span>
                    <span className={`priority-badge priority-${ticketData.priority?.toLowerCase()}`}>
                      {ticketData.priority}
                    </span>
                    <span className="badge-source">(Assigned by {ticketData.source})</span>
                  </div>

                  <div className="resolution-banner">
                    <p style={{ fontWeight: 700, marginBottom: '1rem' }}>
                      ✨ AI Support Agent Analysis: Based on your description, here are your self-resolution steps:
                    </p>
                    <div style={{ paddingLeft: '1rem', marginBottom: '1.5rem' }}>
                      {ticketData.steps?.map((step, idx) => (
                        <p key={idx} style={{ marginBottom: '0.5rem' }}>
                          <strong>{idx + 1}.</strong> {step}
                        </p>
                      ))}
                    </div>
                    <p style={{ fontSize: '0.95rem', borderTop: '1px solid #ffedd5', paddingTop: '1rem' }}>
                      🕒 <strong>Resolution SLA:</strong> If this does not resolve your problem, a support specialist will address your ticket within{' '}
                      <strong>
                        {ticketData.priority === 'Critical' ? '30 minutes' : 
                         ticketData.priority === 'High' ? '2 hours' : 
                         ticketData.priority === 'Medium' ? '8 hours' : '24 hours'}
                      </strong>.
                    </p>
                  </div>

                  <p style={{ textAlign: 'center', color: '#475569', marginBottom: '1.5rem', fontWeight: 500 }}>
                    Did this information help resolve your problem?
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
                    <button 
                      className="btn-primary btn-resolve" 
                      onClick={handleResolveTicket}
                    >
                      ✅ Issue Resolved
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={handleQueueTicket}
                    >
                      ❌ Issue Not Resolved
                    </button>
                  </div>
                </div>
              )}

              {/* SUCCESS VIEW */}
              {step === 'completed' && (
                <div className="matte-card">
                  <h2 className="success-title">🎉 Great! Issue Resolved Successfully</h2>
                  <div className="centered-message">
                    <p>The AI Support Agent has successfully guided you to self-resolution.</p>
                    <p>Your workspace is clear, and no duplicate ticket was sent to the operations support desk.</p>
                    <p style={{ fontWeight: 600, marginTop: '1rem', color: '#166534' }}>
                      Thank you for helping us keep queues short!
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button className="btn-primary" onClick={resetForm}>
                      Raise Another Ticket
                    </button>
                  </div>
                </div>
              )}

              {/* QUEUED / DISPATCHED VIEW */}
              {step === 'submitted_agent' && (
                <div className="matte-card">
                  <h2 className="dispatch-title">📤 Ticket Queued for Operations Specialist</h2>
                  <div className="centered-message">
                    <p>Your ticket has been officially registered in the system.</p>
                    <p>
                      An IT support agent will pick it up and reach out to you at{' '}
                      <strong>{ticketData.email}</strong>.
                    </p>
                    
                    <ul className="bullet-list">
                      <li><strong>Priority:</strong> <span style={{ color: '#ea580c' }}>{ticketData.priority}</span></li>
                      <li><strong>Expected Response:</strong> Within SLA timeline guidelines.</li>
                    </ul>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button className="btn-primary" onClick={resetForm}>
                      Raise Another Ticket
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            // STAFF OPERATIONS DASHBOARD VIEW
            <>
              <h1 className="title-gradient">Agent Operations Dashboard</h1>
              <p className="subtitle-text">
                View, prioritize, and manage live support issues submitted by employees.
              </p>

              <div className="matte-card">
                <div className="section-header">Current Queue</div>

                {sortedTickets.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontWeight: 600 }}>
                    No tickets currently in queue!
                  </p>
                ) : (
                  sortedTickets.map(({ tck, originalIndex }) => (
                    <div className="glass-card-sm" key={tck.id}>
                      <div className="card-header">
                        <strong>{tck.id} - {tck.title}</strong>
                        <span className={`priority-badge priority-${tck.priority.toLowerCase()}`}>
                          {tck.priority}
                        </span>
                      </div>
                      
                      <div className="card-meta">
                        👤 Raised by: <strong>{tck.name}</strong> ({tck.email}) | 📁 Category: <strong>{tck.category}</strong> | Status: <span>{tck.status}</span>
                      </div>

                      <div className="card-desc">
                        {tck.desc}
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button 
                          className="btn-primary" 
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
                          onClick={() => handleDashboardResolve(originalIndex)}
                        >
                          Resolve Ticket
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem' }}
                          onClick={() => handleDashboardEscalate(originalIndex)}
                        >
                          Escalate
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
