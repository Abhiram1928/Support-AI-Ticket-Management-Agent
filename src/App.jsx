import React, { useState, useEffect } from 'react';
import { classifyTicketWithOllama } from './api/ollama';

function TicketDetailPage({ ticket, ticketsDb, ollamaUrl, onBack, setViewingTicket }) {
  const [votes, setVotes] = useState(() => Math.floor(Math.random() * 30) + 10);
  const [voteType, setVoteType] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset states when ticket changes
  useEffect(() => {
    setVotes(Math.floor(Math.random() * 30) + 10);
    setVoteType(null);
    setMessages([
      {
        role: 'assistant',
        content: `Hi u/${ticket.name || 'user'}! I am your Llama 3.2 AI Assistant. I have parsed ticket **${ticket.ticket_id}** (Category: "${ticket.category}"). Ask me any questions, and I will recommend solutions using our database of past resolved issues!`
      }
    ]);
    setInputVal('');
    setLoading(false);
  }, [ticket.ticket_id]);

  const handleVote = (type) => {
    if (voteType === type) {
      setVoteType(null);
      setVotes(prev => prev + (type === 'up' ? -1 : 1));
    } else {
      const diff = type === 'up' 
        ? (voteType === 'down' ? 2 : 1)
        : (voteType === 'up' ? -2 : -1);
      setVoteType(type);
      setVotes(prev => prev + diff);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputVal.trim() || loading) return;

    const userText = inputVal.trim();
    const newMsg = { role: 'user', content: userText };
    setMessages(prev => [...prev, newMsg]);
    setInputVal('');
    setLoading(true);

    // Extract similar past tickets context
    const similarTickets = ticketsDb.filter(t => t.category === ticket.category && t.status === 'Resolved' && t.ticket_id !== ticket.ticket_id);
    const pastContext = similarTickets.map(t => 
      `- Past Ticket Title: "${t.title}". Description: "${t.desc || t.description}". Resolution Remarks: "${t.remarks}".`
    ).join('\n');

    const systemPrompt = `You are a helpful IT support chatbot assistant.
The employee u/${ticket.name || 'user'} is asking questions regarding support ticket:
Title: "${ticket.title}"
Category: "${ticket.category}"
Description: "${ticket.desc || ticket.description}"
Status: "${ticket.status}"

Here is context on similar past tickets in this category that were resolved:
${pastContext || 'No past similar tickets found.'}

If the user asks questions or has doubts, give recommendations and suggestions from these previous tickets if relevant. If a similar past ticket solved this problem, mention it. Answer user questions directly and concisely.`;

    try {
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role !== 'system'),
            newMsg
          ],
          stream: false
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.message?.content || 'No response generated.';
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } else {
        throw new Error(`HTTP Error ${res.status}`);
      }
    } catch (err) {
      console.warn("Local Llama 3.2 model unreachable, using database lookup fallback:", err);
      
      const query = userText.toLowerCase();
      const isAskingAboutCurrent = query.includes('ticket') || query.includes('brief') || query.includes('detail') || query.includes('raise') || query.includes('this') || query.includes('current') || query.includes('what') || query.includes('info') || query.includes('summary') || query.includes('tell me');
      const isAskingAboutPrevious = query.includes('previous') || query.includes('similar') || query.includes('past') || query.includes('history') || query.includes('old') || query.includes('before') || query.includes('other') || query.includes('recommend');

      let replyText = `[Llama 3.2 Offline] I couldn't reach the Ollama server at ${ollamaUrl}. However, here is what I found in our database regarding your question:\n\n`;

      if (isAskingAboutCurrent || (!isAskingAboutCurrent && !isAskingAboutPrevious)) {
        replyText += `📋 **Current Ticket Details (${ticket.ticket_id}):**\n`;
        replyText += `• **Title:** "${ticket.title}"\n`;
        replyText += `• **Description:** "${ticket.desc || ticket.description || 'No description provided.'}"\n`;
        replyText += `• **Category:** ${ticket.category}\n`;
        replyText += `• **Priority:** ${ticket.priority}\n`;
        replyText += `• **Status:** ${ticket.status}\n\n`;
      }

      if (isAskingAboutPrevious || (!isAskingAboutCurrent && !isAskingAboutPrevious) || query.includes('brief')) {
        replyText += `📚 **Similar resolved tickets in "${ticket.category}":**\n\n`;
        if (similarTickets.length > 0) {
          similarTickets.slice(0, 3).forEach(st => {
            replyText += `📌 **Thread: "${st.title}"** (Resolved by ${st.resolved_by || 'IT Support'})\n`;
            replyText += `> **Fix steps taken:** ${st.remarks || 'No remarks provided.'}\n\n`;
          });
          replyText += `Please try these steps or verify that Ollama is running local Llama 3.2.`;
        } else {
          replyText += `No previous resolved tickets in the "${ticket.category}" category were found to draw resolutions from.`;
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
    } finally {
      setLoading(false);
    }
  };

  // Find related tickets in the same category
  const relatedTickets = ticketsDb.filter(t => t.category === ticket.category && t.ticket_id !== ticket.ticket_id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: '#0f172a', animation: 'fadeIn 0.3s ease' }}>
      {/* Navigation Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #000000', paddingBottom: '0.75rem' }}>
        <button 
          onClick={onBack}
          style={{ 
            backgroundColor: '#1e293b', 
            color: '#ffffff', 
            border: '2px solid #000000', 
            padding: '0.5rem 1.25rem', 
            borderRadius: '8px', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          ← Back to Queue
        </button>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em' }}>
          {"r/" + ticket.category.toLowerCase().replace(/[^a-z0-9]/g, '')} • Thread ID: {ticket.ticket_id}
        </span>
      </div>

      {/* Reddit-style Content Layout (Vertical Stack) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Main Post Section (Top Panel) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Post Card */}
          <div className="matte-card" style={{ display: 'flex', padding: '1.5rem', border: '2px solid #000000', backgroundColor: '#fff7ed', borderRadius: '12px', position: 'relative' }}>
            
            {/* Post Content Body */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Header Meta info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
                <span style={{ backgroundColor: '#cbd5e1', padding: '0.15rem 0.4rem', borderRadius: '4px', color: '#1e293b' }}>u/{ticket.name}</span>
                <span>• Raised this thread</span>
                <span>• Priority:</span>
                <span className={`priority-badge priority-${ticket.priority?.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                  {ticket.priority}
                </span>
                <span style={{ marginLeft: 'auto', backgroundColor: ticket.status === 'Resolved' ? '#22c55e' : '#fbbf24', color: '#0f172a', padding: '0.15rem 0.5rem', borderRadius: '12px', fontWeight: 800, fontSize: '0.75rem' }}>
                  {ticket.status}
                </span>
              </div>

              {/* Title */}
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                {ticket.title}
              </h2>

              {/* Tag Badges */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#ea580c', color: '#ffffff', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                  Category: {ticket.category}
                </span>
                {ticket.assigned_to && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#1e293b', color: '#ffffff', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                    Assigned: {ticket.assigned_to}
                  </span>
                )}
              </div>

              {/* Desc content */}
              <p style={{ 
                margin: '0.25rem 0',
                backgroundColor: '#0f172a', 
                color: '#f8fafc',
                padding: '0.6rem 1rem', 
                borderRadius: '8px', 
                fontSize: '0.9rem', 
                lineHeight: '1.5', 
                whiteSpace: 'pre-wrap',
                border: '1.5px solid #000000'
              }}>
                {ticket.desc || ticket.description}
              </p>

              {/* Resolution details if Resolved */}
              {ticket.status === 'Resolved' && (
                <div style={{ borderLeft: '4px solid #22c55e', paddingLeft: '1rem', marginTop: '0.5rem', backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ margin: 0, color: '#166534', fontWeight: 800, fontSize: '0.9rem' }}>✅ Resolution closing remarks:</h4>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', color: '#14532d', lineHeight: '1.4' }}>
                    <strong>Resolved by {ticket.resolved_by}:</strong> {ticket.remarks || 'No remarks provided.'}
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Chatbot Column (Bottom Panel) */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="matte-card" style={{ display: 'flex', flexDirection: 'column', height: '600px', border: '2px solid #000000', backgroundColor: '#fff7ed', borderRadius: '12px', padding: 0, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            {/* Chat header */}
            <div style={{ backgroundColor: '#1e293b', color: '#ffffff', padding: '1rem', borderBottom: '2.5px solid #000000', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>🤖</span>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Llama 3.2 AI Assistant</div>
                  <div style={{ fontSize: '0.7rem', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <span style={{ width: '6px', height: '6px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
                    Online Context Engine
                  </div>
                </div>
              </div>
              <span style={{ fontSize: '0.7rem', backgroundColor: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, color: '#f97316' }}>
                OLLAMA
              </span>
            </div>

            {/* Chat Messages Log */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                return (
                  <div 
                    key={idx} 
                    style={{ 
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      backgroundColor: isUser ? '#1e293b' : '#fff7ed',
                      color: isUser ? '#ffffff' : '#0f172a',
                      padding: '0.75rem 1rem',
                      borderRadius: isUser ? '12px 12px 0 12px' : '12px 12px 12px 0',
                      border: '1.5px solid #000000',
                      fontSize: '0.85rem',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-wrap',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                    }}
                  >
                    {m.content}
                  </div>
                );
              })}
              {loading && (
                <div style={{ alignSelf: 'flex-start', backgroundColor: '#fff7ed', border: '1.5px solid #000000', padding: '0.5rem 1rem', borderRadius: '12px 12px 12px 0', fontSize: '0.8rem', fontStyle: 'italic', color: '#64748b' }}>
                  ⚡ AI Assistant is searching past ticket resolutions...
                </div>
              )}
            </div>

            {/* Chat Input form */}
            <form onSubmit={handleSend} style={{ borderTop: '2.5px solid #000000', display: 'flex', backgroundColor: '#ffffff' }}>
              <input 
                type="text" 
                className="form-input" 
                style={{ flex: 1, border: 'none', borderRadius: 0, padding: '0.85rem', fontSize: '0.85rem', outline: 'none' }}
                placeholder="Ask AI Copilot for solution doubts..." 
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={loading}
              />
              <button 
                type="submit" 
                style={{ 
                  backgroundColor: '#f97316', 
                  color: '#ffffff', 
                  border: 'none', 
                  borderLeft: '2.5px solid #000000',
                  padding: '0 1.5rem', 
                  fontWeight: 'bold', 
                  fontSize: '0.9rem',
                  cursor: 'pointer' 
                }}
                disabled={loading}
              >
                Send
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}

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
  
  // Tickets state fetched from SQLite database
  const [ticketsDb, setTicketsDb] = useState([]);

  // Configurable Ollama VM Server URL
  const [ollamaUrl, setOllamaUrl] = useState(() => {
    return localStorage.getItem('ollama_url') || 'http://localhost:11434';
  });

  // Custom text input states for dynamic dropdown options
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState('');

  // Database Connection Status
  const [dbServerOffline, setDbServerOffline] = useState(false);

  // Ticket Dashboard filter/search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Technician Workspace queue filters & search
  const [techSearch, setTechSearch] = useState('');
  const [techPriorityFilter, setTechPriorityFilter] = useState('All');
  const [techCategoryFilter, setTechCategoryFilter] = useState('All');
  const [techAssignFilter, setTechAssignFilter] = useState('All');

  // Modals state: detail page and resolution remarks popup
  const [viewingTicket, setViewingTicket] = useState(null);
  const [resolvingTicketIndex, setResolvingTicketIndex] = useState(null);
  const [resolutionRemarks, setResolutionRemarks] = useState('');

  // Ollama Connection Status
  const [ollamaStatus, setOllamaStatus] = useState('checking');
  const [ollamaError, setOllamaError] = useState('');

  const checkOllamaConnection = async (url) => {
    setOllamaStatus('checking');
    setOllamaError('');
    try {
      const res = await fetch(`${url}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        // Check if llama3.2 (either base or latest tag) is installed
        const hasModel = data.models && data.models.some(m => m.name && m.name.toLowerCase().includes('llama3.2'));
        if (hasModel) {
          setOllamaStatus('online');
        } else {
          setOllamaStatus('offline');
          setOllamaError("Model 'llama3.2' not found. Please open a new terminal and run: 'ollama pull llama3.2'");
        }
      } else {
        setOllamaStatus('offline');
        setOllamaError(`HTTP Error: ${res.status}`);
      }
    } catch (err) {
      setOllamaStatus('offline');
      setOllamaError(err.message === 'Failed to fetch' 
        ? 'Failed to fetch (CORS block or VM offline)' 
        : err.message
      );
    }
  };

  useEffect(() => {
    checkOllamaConnection(ollamaUrl);
  }, [ollamaUrl]);

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
    localStorage.setItem('ollama_url', ollamaUrl);
  }, [loggedIn, userRole, sessionUser, ollamaUrl]);

  // Fetch tickets from SQLite database on app load / authentication
  useEffect(() => {
    if (loggedIn) {
      fetch('http://localhost:5000/api/tickets')
        .then(res => {
          setDbServerOffline(false);
          return res.json();
        })
        .then(data => setTicketsDb(data))
        .catch(err => {
          console.error("Error connecting to SQLite backend server:", err);
          setDbServerOffline(true);
        });
    }
  }, [loggedIn]);

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
    setCustomTitle('');
    setCustomCategory('');
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
    } else if (loginRole === 'Technician Portal') {
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
    } else {
      // Admin Portal
      if (!loginName || !loginId || !loginMail || !loginPwd) {
        setErrorMsg('⚠️ Please fill in all required fields (*) to authenticate.');
        return;
      }
      if (!loginMail.includes('@') || !loginMail.includes('.')) {
        setErrorMsg('⚠️ Please enter a valid admin email address.');
        return;
      }

      const user = { name: loginName, id: loginId, email: loginMail, dept: 'IT Management' };
      setSessionUser(user);
      setUserRole('admin');
      setLoggedIn(true);
      setAppMode('Employee Mode');
      resetForm();
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUserRole(null);
    setSessionUser({ name: '', id: '', email: '', dept: '' });
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

    const finalTitle = formTitle === 'Type custom title...' ? customTitle : formTitle;
    const finalCategory = formCategory === 'Type custom category...' ? customCategory : formCategory;

    if (!formName || !formId || !formMail || 
        formTitle === '-- Select ticket title or topic --' || 
        (formTitle === 'Type custom title...' && !customTitle) || 
        formCategory === '-- Select Issue Type --' || 
        (formCategory === 'Type custom category...' && !customCategory) || 
        !formDescription) {
      setErrorMsg('⚠️ Please fill in all required fields (*) before submitting.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);

    const titleText = finalTitle === 'Other (Describe below)' 
      ? `Other: ${formDescription.substring(0, 30)}...` 
      : finalTitle;

    try {
      // Connect to Ollama VM server to auto-assign priority, sentiment, and resolution steps
      const analysis = await classifyTicketWithOllama(finalCategory, titleText, formDescription, ollamaUrl);
      
      setTicketData({
        name: formName,
        id: formId,
        email: formMail,
        title: titleText,
        category: finalCategory,
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

  const handleQueueTicket = async () => {
    const newTckId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket = {
      ticket_id: newTckId,
      name: ticketData.name,
      email: ticketData.email,
      title: ticketData.title,
      category: ticketData.category,
      priority: ticketData.priority,
      desc: ticketData.desc,
      status: "Pending Assignment",
      sentiment: ticketData.sentiment || "Neutral",
      steps: Array.isArray(ticketData.steps) ? JSON.stringify(ticketData.steps) : (ticketData.steps || "[]")
    };

    try {
      const response = await fetch('http://localhost:5000/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTicket)
      });
      if (response.ok) {
        setTicketsDb(prev => [newTicket, ...prev]);
        setStep('submitted_agent');
      }
    } catch (err) {
      console.error("Error saving ticket to SQLite backend:", err);
      // Local fallback push if backend is offline
      setTicketsDb(prev => [newTicket, ...prev]);
      setStep('submitted_agent');
    }
  };

  // Dashboard technician resolution popping and escalation handlers
  const handleDashboardResolve = async (originalIndex, remarks) => {
    const ticket = ticketsDb[originalIndex];
    const resolverName = sessionUser.name || 'Technician';
    const finalRemarks = remarks || 'Resolved with notes.';
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/${ticket.ticket_id}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resolved_by: resolverName,
          remarks: finalRemarks
        })
      });
      if (response.ok) {
        setTicketsDb(prev => prev.map((tck, idx) => {
          if (idx === originalIndex) {
            return { ...tck, status: 'Resolved', resolved_by: resolverName, remarks: finalRemarks };
          }
          return tck;
        }));
      } else {
        throw new Error(`Server returned error status ${response.status}`);
      }
    } catch (err) {
      console.error("Error resolving ticket from SQLite backend:", err);
      // Fallback local update if offline or server fails
      setTicketsDb(prev => prev.map((tck, idx) => {
        if (idx === originalIndex) {
          return { ...tck, status: 'Resolved', resolved_by: resolverName, remarks: finalRemarks };
        }
        return tck;
      }));
    }
  };

  const handleAssignTicket = async (originalIndex) => {
    const ticket = ticketsDb[originalIndex];
    const technicianName = sessionUser.name || 'Technician';
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/${ticket.ticket_id}/assign`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assigned_to: technicianName
        })
      });
      if (response.ok) {
        setTicketsDb(prev => prev.map((tck, idx) => {
          if (idx === originalIndex) {
            return { ...tck, status: 'In Progress', assigned_to: technicianName };
          }
          return tck;
        }));
      } else {
        throw new Error(`Server returned error status ${response.status}`);
      }
    } catch (err) {
      console.error("Error assigning ticket:", err);
      // Fallback local update
      setTicketsDb(prev => prev.map((tck, idx) => {
        if (idx === originalIndex) {
          return { ...tck, status: 'In Progress', assigned_to: technicianName };
        }
        return tck;
      }));
    }
  };

  const handleDashboardEscalate = async (originalIndex) => {
    const ticket = ticketsDb[originalIndex];
    try {
      const response = await fetch(`http://localhost:5000/api/tickets/${ticket.ticket_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          priority: 'Critical',
          status: 'Escalated'
        })
      });
      if (response.ok) {
        setTicketsDb(prev => prev.map((tck, i) => {
          if (i === originalIndex) {
            return { ...tck, priority: 'Critical', status: 'Escalated' };
          }
          return tck;
        }));
      } else {
        throw new Error(`Server returned error status ${response.status}`);
      }
    } catch (err) {
      console.error("Error escalating ticket on SQLite backend:", err);
      setTicketsDb(prev => prev.map((tck, i) => {
        if (i === originalIndex) {
          return { ...tck, priority: 'Critical', status: 'Escalated' };
        }
        return tck;
      }));
    }
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
                  <option value="Admin Portal">Admin Portal</option>
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
  // SORT & FILTER TICKETS FOR TECHNICIAN QUEUE (EXCLUDES RESOLVED TICKETS)
  // --------------------------------------------------------------------------
  const activeTickets = ticketsDb.filter(t => t.status !== 'Resolved');

  const filteredActiveTickets = activeTickets.filter(tck => {
    const matchesSearch = 
      (tck.ticket_id || '').toLowerCase().includes(techSearch.toLowerCase()) ||
      (tck.name || '').toLowerCase().includes(techSearch.toLowerCase()) ||
      (tck.title || '').toLowerCase().includes(techSearch.toLowerCase()) ||
      (tck.desc || '').toLowerCase().includes(techSearch.toLowerCase());

    const matchesPriority = techPriorityFilter === 'All' || tck.priority === techPriorityFilter;
    const matchesCategory = techCategoryFilter === 'All' || tck.category === techCategoryFilter;
    
    let matchesAssignee = true;
    if (techAssignFilter === 'Assigned to Me') {
      matchesAssignee = tck.assigned_to === sessionUser.name;
    } else if (techAssignFilter === 'Unassigned') {
      matchesAssignee = !tck.assigned_to;
    }

    return matchesSearch && matchesPriority && matchesCategory && matchesAssignee;
  });

  const priorityWeight = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const sortedTickets = [...filteredActiveTickets]
    .map((tck) => {
      const originalIndex = ticketsDb.findIndex(t => t.ticket_id === tck.ticket_id);
      return { tck, originalIndex };
    })
    .sort((a, b) => {
      const wa = priorityWeight[a.tck.priority] ?? 2;
      const wb = priorityWeight[b.tck.priority] ?? 2;
      return wa - wb;
    });

  // Default option catalogs
  const defaultTitles = [
    "Cannot log into internal HR portal",
    "VPN connection failing with handshake error",
    "Requesting software license approval",
    "Hardware issue - flickering external monitor",
    "Other (Describe below)"
  ];

  const defaultCategories = [
    "Authentication & Access",
    "Network & Connectivity",
    "Software / Licenses",
    "Hardware Support",
    "General Enquiry"
  ];

  // Extract unique custom titles and categories from the database history
  const dbTitles = ticketsDb ? ticketsDb.map(t => t.title) : [];
  const uniqueDbTitles = [...new Set(dbTitles)].filter(t => t && !defaultTitles.includes(t));
  const titleOptions = [
    "-- Select ticket title or topic --",
    ...defaultTitles.slice(0, -1),
    ...uniqueDbTitles,
    "Other (Describe below)",
    "Type custom title..."
  ];

  const dbCategories = ticketsDb ? ticketsDb.map(t => t.category) : [];
  const uniqueDbCategories = [...new Set(dbCategories)].filter(c => c && !defaultCategories.includes(c));
  const categoryOptions = [
    "-- Select Issue Type --",
    ...defaultCategories,
    ...uniqueDbCategories,
    "Type custom category..."
  ];

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
          {/* Employee Mode: Visible to Employee, Technician, and Admin */}
          {(userRole === 'employee' || userRole === 'technician' || userRole === 'admin') && (
            <div 
              className={`nav-item ${appMode === 'Employee Mode' ? 'active' : ''}`}
              onClick={() => { setAppMode('Employee Mode'); setViewingTicket(null); }}
            >
              <input 
                type="radio" 
                name="nav-mode" 
                checked={appMode === 'Employee Mode'} 
                readOnly 
              />
              Employee Mode
            </div>
          )}

          {/* Technician: Visible to Technician and Admin */}
          {(userRole === 'technician' || userRole === 'admin') && (
            <div 
              className={`nav-item ${appMode === 'Technician' ? 'active' : ''}`}
              onClick={() => { setAppMode('Technician'); setViewingTicket(null); }}
            >
              <input 
                type="radio" 
                name="nav-mode" 
                checked={appMode === 'Technician'} 
                readOnly 
              />
              Technician
            </div>
          )}

          {/* Ticket Dashboard: Visible to Admin */}
          {userRole === 'admin' && (
            <div 
              className={`nav-item ${appMode === 'Ticket Dashboard' ? 'active' : ''}`}
              onClick={() => { setAppMode('Ticket Dashboard'); setViewingTicket(null); }}
            >
              <input 
                type="radio" 
                name="nav-mode" 
                checked={appMode === 'Ticket Dashboard'} 
                readOnly 
              />
              Ticket Dashboard
            </div>
          )}

          {/* AI Analysis: Visible to Admin */}
          {userRole === 'admin' && (
            <div 
              className={`nav-item ${appMode === 'AI Analysis' ? 'active' : ''}`}
              onClick={() => { setAppMode('AI Analysis'); setViewingTicket(null); }}
            >
              <input 
                type="radio" 
                name="nav-mode" 
                checked={appMode === 'AI Analysis'} 
                readOnly 
              />
              AI Analysis
            </div>
          )}
        </div>

        <hr className="sidebar-divider" />

        <div className="sidebar-title">Ollama VM URL</div>
        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
          <input 
            type="text" 
            className="form-input" 
            style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#f1f5f9', marginBottom: '0.5rem' }}
            placeholder="http://localhost:11434"
            value={ollamaUrl} 
            onChange={(e) => setOllamaUrl(e.target.value)} 
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              type="button" 
              onClick={() => checkOllamaConnection(ollamaUrl)} 
              style={{ fontSize: '0.75rem', padding: '4px 10px', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#cbd5e1', borderRadius: '4px', cursor: 'pointer', flex: 1 }}
            >
              🔄 Test Connection
            </button>
          </div>
          {ollamaStatus === 'offline' && ollamaError && (
            <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '0.35rem', lineHeight: '1.2' }}>
              ⚠️ {ollamaError}
            </div>
          )}
        </div>

        <hr className="sidebar-divider" />

        <div className="sidebar-title">System Status</div>
        <div className="status-box" style={{ marginBottom: '1.5rem' }}>
          <div className="status-line">
            <span>AI Agent:</span>
            <span className="status-value" style={{ 
              color: ollamaStatus === 'online' ? '#22c55e' : ollamaStatus === 'checking' ? '#fbbf24' : '#ef4444',
              fontWeight: 600
            }}>
              {ollamaStatus === 'online' && '🟢 Connected'}
              {ollamaStatus === 'checking' && '🟡 Checking...'}
              {ollamaStatus === 'offline' && '🔴 Offline'}
            </span>
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
          
          {dbServerOffline && (
            <div className="alert-error" style={{ marginBottom: '1.5rem', borderLeft: '5px solid #ef4444' }}>
              <span>⚠️ <strong>Database Offline:</strong> Could not connect to the backend server. Please make sure to run <code>node server/index.js</code> inside your project directory to load your SQLite database!</span>
            </div>
          )}
          
          {viewingTicket ? (
            <TicketDetailPage 
              ticket={viewingTicket} 
              ticketsDb={ticketsDb} 
              ollamaUrl={ollamaUrl} 
              onBack={() => setViewingTicket(null)} 
              setViewingTicket={setViewingTicket}
            />
          ) : (
            <>
              {appMode === 'Employee Mode' && (
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
                          onChange={(e) => {
                            setFormTitle(e.target.value);
                            if (e.target.value !== 'Type custom title...') {
                              setCustomTitle('');
                            }
                          }}
                        >
                          {titleOptions.map((opt, idx) => (
                            <option key={idx} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {formTitle === 'Type custom title...' && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Enter custom ticket title (e.g. Faced detection problem)" 
                              value={customTitle}
                              onChange={(e) => setCustomTitle(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Issue Facing *</label>
                        <select 
                          className="form-select" 
                          value={formCategory}
                          onChange={(e) => {
                            setFormCategory(e.target.value);
                            if (e.target.value !== 'Type custom category...') {
                              setCustomCategory('');
                            }
                          }}
                        >
                          {categoryOptions.map((opt, idx) => (
                            <option key={idx} value={opt}>{opt}</option>
                          ))}
                        </select>
                        {formCategory === 'Type custom category...' && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <input 
                              type="text" 
                              className="form-input" 
                              placeholder="Enter custom category (e.g. Technical glitch in facial recognition)" 
                              value={customCategory}
                              onChange={(e) => setCustomCategory(e.target.value)}
                            />
                          </div>
                        )}
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
          )}

          {/* TECHNICIAN MODE VIEW */}
          {appMode === 'Technician' && (
            <>
              <h1 className="title-gradient">Technician Queue</h1>
              <p className="subtitle-text">
                View, prioritize, and manage live support issues submitted by employees.
              </p>

              {/* KPI metrics row for Technician */}
              <div className="form-row" style={{ marginBottom: '2rem', gap: '1.25rem' }}>
                <div className="matte-card" style={{ flex: 1, padding: 0, border: '2px solid #000000', backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #000000' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f97316', letterSpacing: '0.05em' }}>ACTIVE TICKETS</span>
                  </div>
                  <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#fff7ed', flex: 1 }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{activeTickets.length}</span>
                  </div>
                </div>
                <div className="matte-card" style={{ flex: 1, padding: 0, border: '2px solid #000000', backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #000000' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}>CRITICAL PRIORITIES</span>
                  </div>
                  <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#fff7ed', flex: 1 }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{activeTickets.filter(t => t.priority === 'Critical').length}</span>
                  </div>
                </div>
                <div className="matte-card" style={{ flex: 1, padding: 0, border: '2px solid #000000', backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #000000' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22c55e', letterSpacing: '0.05em' }}>ASSIGNED TO ME</span>
                  </div>
                  <div style={{ padding: '1rem', textAlign: 'center', backgroundColor: '#fff7ed', flex: 1 }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{activeTickets.filter(t => t.assigned_to === sessionUser.name).length}</span>
                  </div>
                </div>
              </div>

              {/* Search & Filter Controls Panel */}
              <div className="matte-card" style={{ border: '2px solid #000000', backgroundColor: '#1e293b', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                <div className="section-header" style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>🔍 Filter & Search Queue</div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ flex: 2, minWidth: '200px', padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                    placeholder="Search by ID, Name, Title, Description..." 
                    value={techSearch}
                    onChange={(e) => setTechSearch(e.target.value)}
                  />
                  <select 
                    className="form-select" 
                    style={{ flex: 1, minWidth: '120px', padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                    value={techPriorityFilter}
                    onChange={(e) => setTechPriorityFilter(e.target.value)}
                  >
                    <option value="All">All Priorities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <select 
                    className="form-select" 
                    style={{ flex: 1, minWidth: '140px', padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                    value={techCategoryFilter}
                    onChange={(e) => setTechCategoryFilter(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    {defaultCategories.map((c, i) => (
                      <option key={i} value={c}>{c}</option>
                    ))}
                  </select>
                  <select 
                    className="form-select" 
                    style={{ flex: 1, minWidth: '140px', padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}
                    value={techAssignFilter}
                    onChange={(e) => setTechAssignFilter(e.target.value)}
                  >
                    <option value="All">All Assignees</option>
                    <option value="Assigned to Me">Assigned to Me</option>
                    <option value="Unassigned">Unassigned</option>
                  </select>
                </div>
              </div>

              <div className="matte-card">
                <div className="section-header">Current Active Queue ({sortedTickets.length})</div>

                {sortedTickets.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontWeight: 600 }}>
                    No active tickets match your filters!
                  </p>
                ) : (
                  sortedTickets.map(({ tck, originalIndex }) => (
                    <div className="glass-card-sm" key={tck.ticket_id}>
                      <div className="card-header">
                        <strong>{tck.ticket_id} - {tck.title}</strong>
                        <span className={`priority-badge priority-${tck.priority.toLowerCase()}`}>
                          {tck.priority}
                        </span>
                      </div>
                      
                      <div className="card-meta">
                        👤 Employee: <strong>{tck.name}</strong> ({tck.email}) | 📁 Category: <strong>{tck.category}</strong> 
                      </div>
                      <div className="card-meta" style={{ marginTop: '0.25rem', borderTop: '1px solid #334155', paddingTop: '0.25rem' }}>
                        ⚙️ Status: <span style={{ color: tck.status === 'In Progress' ? '#fbbf24' : '#60a5fa', fontWeight: 'bold' }}>{tck.status}</span> | 🛠️ Assignee: <strong style={{ color: '#f97316' }}>{tck.assigned_to || 'Unassigned'}</strong>
                      </div>

                      <div className="card-desc">
                        {tck.desc}
                      </div>

                      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                        {tck.assigned_to !== sessionUser.name && (
                          <button 
                            className="btn-primary" 
                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                            onClick={() => handleAssignTicket(originalIndex)}
                          >
                            Assign to Me
                          </button>
                        )}
                        <button 
                          className="btn-primary" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                          onClick={() => {
                            setResolvingTicketIndex(originalIndex);
                            setResolutionRemarks('');
                          }}
                        >
                          Resolve Ticket
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                          onClick={() => handleDashboardEscalate(originalIndex)}
                        >
                          Escalate
                        </button>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', marginLeft: 'auto', backgroundColor: '#475569', color: '#ffffff' }}
                          onClick={() => setViewingTicket(tck)}
                        >
                          🔍 View Details
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}


          {/* TICKET DASHBOARD VIEW */}
          {appMode === 'Ticket Dashboard' && (() => {
            const total = ticketsDb.length;
            const categoriesCount = {};
            defaultCategories.forEach(c => { categoriesCount[c] = 0; });
            ticketsDb.forEach(t => {
              if (categoriesCount[t.category] !== undefined) {
                categoriesCount[t.category]++;
              } else if (t.category) {
                categoriesCount[t.category] = (categoriesCount[t.category] || 0) + 1;
              }
            });

            const prioritiesCount = { Critical: 0, High: 0, Medium: 0, Low: 0 };
            ticketsDb.forEach(t => {
              if (prioritiesCount[t.priority] !== undefined) {
                prioritiesCount[t.priority]++;
              }
            });

            const leaderboardMap = {};
            ticketsDb.forEach(t => {
              if (t.status === 'Resolved' && t.resolved_by) {
                leaderboardMap[t.resolved_by] = (leaderboardMap[t.resolved_by] || 0) + 1;
              }
            });
            const leaderboard = Object.entries(leaderboardMap)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count);

            return (
              <>
                <h1 className="title-gradient">Ticket Dashboard</h1>
                <p className="subtitle-text">
                  Real-time analytics metrics and database records for IT support tickets.
                </p>

                {/* Analytics Metric Cards Grid - Matte & Blended with Page Colors */}
                <div className="form-row" style={{ marginBottom: '2rem', gap: '1.25rem' }}>
                  {/* Total Tickets Card */}
                  <div className="matte-card" style={{ flex: 1, padding: 0, border: '2px solid #000000', backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #000000' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f97316', letterSpacing: '0.05em' }}>TOTAL TICKETS</span>
                    </div>
                    <div style={{ padding: '1.25rem 1rem', textAlign: 'center', backgroundColor: '#fff7ed', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>{total}</span>
                    </div>
                  </div>

                  {/* Resolved Tickets Card */}
                  <div className="matte-card" style={{ flex: 1, padding: 0, border: '2px solid #000000', backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #000000' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22c55e', letterSpacing: '0.05em' }}>RESOLVED TICKETS</span>
                    </div>
                    <div style={{ padding: '1.25rem 1rem', textAlign: 'center', backgroundColor: '#fff7ed', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>{ticketsDb.filter(t => t.status === 'Resolved').length}</span>
                    </div>
                  </div>

                  {/* Active Queue Card */}
                  <div className="matte-card" style={{ flex: 1, padding: 0, border: '2px solid #000000', backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #000000' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', letterSpacing: '0.05em' }}>ACTIVE QUEUE</span>
                    </div>
                    <div style={{ padding: '1.25rem 1rem', textAlign: 'center', backgroundColor: '#fff7ed', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>{ticketsDb.filter(t => t.status !== 'Resolved').length}</span>
                    </div>
                  </div>

                  {/* Resolution Rate Card */}
                  <div className="matte-card" style={{ flex: 1, padding: 0, border: '2px solid #000000', backgroundColor: '#1e293b', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '0.75rem 1rem', textAlign: 'center', borderBottom: '1px solid #000000' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6', letterSpacing: '0.05em' }}>RESOLUTION RATE</span>
                    </div>
                    <div style={{ padding: '1.25rem 1rem', textAlign: 'center', backgroundColor: '#fff7ed', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>
                        {total > 0 
                          ? Math.round((ticketsDb.filter(t => t.status === 'Resolved').length / total) * 100) 
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Master database logs table */}
                <div className="matte-card" style={{ border: '2px solid #000000', backgroundColor: '#1e293b', padding: '2rem', borderRadius: '12px' }}>
                  <div className="section-header" style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>Database Ticket Logs</div>

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ flex: 2, padding: '0.75rem', fontSize: '0.9rem', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f1f5f9' }}
                      placeholder="🔍 Search by Ticket ID, Employee Name, Title, Category, or Technician..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select 
                      className="form-select" 
                      style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', backgroundColor: '#0f172a', border: '1px solid #475569', color: '#f1f5f9' }}
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="All">All Statuses</option>
                      <option value="Active">Active Only</option>
                      <option value="Resolved">Resolved Only</option>
                    </select>
                  </div>

                  {(() => {
                    const filtered = ticketsDb.filter(tck => {
                      const matchesSearch = 
                        (tck.ticket_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (tck.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (tck.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (tck.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (tck.resolved_by || '').toLowerCase().includes(searchTerm.toLowerCase());
                      
                      const matchesStatus = statusFilter === 'All' || 
                        (statusFilter === 'Resolved' && tck.status === 'Resolved') ||
                        (statusFilter === 'Active' && tck.status !== 'Resolved');

                      return matchesSearch && matchesStatus;
                    });

                    if (filtered.length === 0) {
                      return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No tickets found matching the filters.</p>;
                    }

                    return (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#f1f5f9', fontSize: '0.9rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #000000', textAlign: 'left', backgroundColor: '#fff7ed', color: '#0f172a' }}>
                              <th style={{ padding: '0.75rem', color: '#0f172a' }}>Ticket ID</th>
                              <th style={{ padding: '0.75rem', color: '#0f172a' }}>Employee Name</th>
                              <th style={{ padding: '0.75rem', color: '#0f172a' }}>Ticket Title</th>
                              <th style={{ padding: '0.75rem', color: '#0f172a' }}>Issue Facing</th>
                              <th style={{ padding: '0.75rem', color: '#0f172a' }}>Status</th>
                              <th style={{ padding: '0.75rem', color: '#0f172a' }}>Resolved By</th>
                              <th style={{ padding: '0.75rem', color: '#0f172a' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((tck, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #334155', backgroundColor: idx % 2 === 0 ? '#1e293b' : '#0f172a' }}>
                                <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#f97316' }}>{tck.ticket_id}</td>
                                <td style={{ padding: '0.75rem' }}>{tck.name}</td>
                                <td style={{ padding: '0.75rem' }}>{tck.title}</td>
                                <td style={{ padding: '0.75rem' }}>
                                  <span className="priority-badge" style={{ backgroundColor: '#334155', color: '#93c5fd', fontSize: '0.75rem', border: '1px solid #475569' }}>{tck.category}</span>
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <span style={{ 
                                    color: tck.status === 'Resolved' ? '#22c55e' : '#ea580c', 
                                    fontWeight: 'bold' 
                                  }}>
                                    {tck.status}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem', color: tck.status === 'Resolved' ? '#f1f5f9' : '#64748b', fontStyle: tck.status === 'Resolved' ? 'normal' : 'italic' }}>
                                  {tck.status === 'Resolved' ? `👤 ${tck.resolved_by || 'Unknown'}` : '—'}
                                </td>
                                <td style={{ padding: '0.75rem' }}>
                                  <button 
                                    className="btn-primary" 
                                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', backgroundColor: '#f97316', borderColor: '#f97316', fontWeight: 800 }}
                                    onClick={() => setViewingTicket(tck)}
                                  >
                                    🔍 Thread
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </>
            );
          })()}


          {/* AI ANALYSIS VIEW */}
          {appMode === 'AI Analysis' && (() => {
            const total = ticketsDb.length;
            const categoriesCount = {};
            defaultCategories.forEach(c => { categoriesCount[c] = 0; });
            ticketsDb.forEach(t => {
              if (categoriesCount[t.category] !== undefined) {
                categoriesCount[t.category]++;
              } else if (t.category) {
                categoriesCount[t.category] = (categoriesCount[t.category] || 0) + 1;
              }
            });

            const prioritiesCount = { Critical: 0, High: 0, Medium: 0, Low: 0 };
            ticketsDb.forEach(t => {
              if (prioritiesCount[t.priority] !== undefined) {
                prioritiesCount[t.priority]++;
              }
            });

            const leaderboardMap = {};
            ticketsDb.forEach(t => {
              if (t.status === 'Resolved' && t.resolved_by) {
                leaderboardMap[t.resolved_by] = (leaderboardMap[t.resolved_by] || 0) + 1;
              }
            });
            const leaderboard = Object.entries(leaderboardMap)
              .map(([name, count]) => ({ name, count }))
              .sort((a, b) => b.count - a.count);

            const maxCategoryCount = Math.max(...Object.values(categoriesCount), 1);

            return (
              <>
                <h1 className="title-gradient">AI Analysis</h1>
                <p className="subtitle-text">
                  Advanced AI data metrics, classifications, and system performance telemetry.
                </p>

                {/* Row 1: Priority Distribution (Segmented Donut) & Category Breakdown (Area Line Chart) */}
                <div className="form-row" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
                  {/* Priority Distribution (Circular Donut Chart) */}
                  <div className="matte-card" style={{ flex: 1, border: '2px solid #000000', backgroundColor: '#fff7ed', padding: '2rem', borderRadius: '16px', color: '#0f172a', display: 'flex', flexDirection: 'column', minHeight: '440px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                    <div className="section-header" style={{ marginBottom: '1.5rem', fontSize: '1.25rem', color: '#000000', borderBottom: '2px solid #ea580c', paddingBottom: '0.5rem', fontWeight: 'bold' }}> Priority Distribution Overview</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                      {/* Donut SVG */}
                      <div style={{ position: 'relative', width: '240px', height: '240px', marginBottom: '1.5rem' }}>
                        <svg width="240" height="240" viewBox="0 0 240 240" style={{ filter: 'drop-shadow(0px 8px 16px rgba(15, 23, 42, 0.08))' }}>
                          <defs>
                            <linearGradient id="critGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#f87171" />
                              <stop offset="100%" stopColor="#dc2626" />
                            </linearGradient>
                            <linearGradient id="highGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#fb923c" />
                              <stop offset="100%" stopColor="#ea580c" />
                            </linearGradient>
                            <linearGradient id="medGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#4ade80" />
                              <stop offset="100%" stopColor="#16a34a" />
                            </linearGradient>
                            <linearGradient id="lowGrad" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#60a5fa" />
                              <stop offset="100%" stopColor="#2563eb" />
                            </linearGradient>
                          </defs>

                          {/* Background ring track */}
                          <circle 
                            cx="120" 
                            cy="120" 
                            r="75" 
                            fill="transparent" 
                            stroke="#e2e8f0" 
                            strokeWidth="36" 
                          />
                          {/* Segmented Slices */}
                          {total > 0 && (() => {
                            let accumPct = 0;
                            const prioritiesKeys = ['Critical', 'High', 'Medium', 'Low'];
                            const priorityGradients = { Critical: 'url(#critGrad)', High: 'url(#highGrad)', Medium: 'url(#medGrad)', Low: 'url(#lowGrad)' };
                            const circ = 471.24;
                            
                            return prioritiesKeys.map(key => {
                              const count = prioritiesCount[key] || 0;
                              const pct = (count / total) * 100;
                              const strokeOffset = circ - (circ * pct) / 100;
                              const rotOffset = (accumPct / 100) * 360;
                              accumPct += pct;
                              
                              if (count === 0) return null;
                              return (
                                <circle 
                                  key={key}
                                  cx="120" 
                                  cy="120" 
                                  r="75" 
                                  fill="transparent" 
                                  stroke={priorityGradients[key]} 
                                  strokeWidth="36" 
                                  strokeDasharray={`${(pct / 100) * circ} ${circ}`}
                                  strokeDashoffset="0"
                                  strokeLinecap="round"
                                  transform={`rotate(${-90 + rotOffset} 120 120)`} 
                                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                                />
                              );
                            });
                          })()}
                        </svg>
                        {/* Center Labels overlay */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', lineHeight: '1' }}>{total}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.1em', marginTop: '0.25rem' }}>TOTAL TICKETS</span>
                        </div>
                      </div>

                      {/* Legend Row with colored dots */}
                      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {['Critical', 'High', 'Medium', 'Low'].map(key => {
                          const color = key === 'Critical' ? '#ef4444' : key === 'High' ? '#f97316' : key === 'Medium' ? '#16a34a' : '#2563eb';
                          const count = prioritiesCount[key] || 0;
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', backgroundColor: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid #cbd5e1' }}>
                              <span style={{ width: '10px', height: '10px', backgroundColor: color, borderRadius: '50%', display: 'inline-block', boxShadow: `0 0 8px ${color}` }}></span>
                              <span>{key}: <strong style={{ color: '#0f172a' }}>{count}</strong></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Category Breakdown (Vertical Bar Graph style) */}
                  <div className="matte-card" style={{ flex: 1, border: '2px solid #000000', backgroundColor: '#fff7ed', padding: '2rem', borderRadius: '16px', color: '#0f172a', display: 'flex', flexDirection: 'column', minHeight: '440px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                    <div className="section-header" style={{ marginBottom: '1.5rem', fontSize: '1.25rem', color: '#000000', borderBottom: '2px solid #ea580c', paddingBottom: '0.5rem', fontWeight: 'bold' }}> Category Breakdown</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', height: '260px', justifyContent: 'flex-end', padding: '0.5rem 0', flex: 1 }}>
                      {/* Bars Row */}
                      <div style={{ display: 'flex', height: '200px', alignItems: 'flex-end', justifyContent: 'space-around', gap: '1rem', borderBottom: '2.5px solid #cbd5e1', paddingBottom: '0.4rem', position: 'relative' }}>
                        {/* Reference helper line */}
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '40%', borderTop: '1px dashed #cbd5e1', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '70%', borderTop: '1px dashed #cbd5e1', pointerEvents: 'none' }} />
                        
                        {(() => {
                          const categoryKeys = [
                            'Authentication & Access',
                            'Network & Connectivity',
                            'Software / Licenses',
                            'Hardware Support',
                            'General Enquiry'
                          ];
                          
                          return categoryKeys.map(cat => {
                            const count = categoriesCount[cat] || 0;
                            const barHeightPct = (count / maxCategoryCount) * 100;
                            return (
                              <div key={cat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end', zIndex: 1 }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>{count}</span>
                                <div 
                                  style={{ 
                                    width: '44px', 
                                    height: `${Math.max(barHeightPct, 6)}%`, 
                                    background: 'linear-gradient(180deg, #f97316 0%, #ea580c 100%)', 
                                    borderRadius: '6px 6px 0 0',
                                    transition: 'height 0.4s ease-in-out',
                                    boxShadow: '0 4px 10px rgba(234, 88, 12, 0.25)',
                                    border: '1.5px solid #000000',
                                    borderBottom: 'none'
                                  }} 
                                  title={`${cat}: ${count} tickets`}
                                />
                              </div>
                            );
                          });
                        })()}
                      </div>
                      
                      {/* Labels Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '0.75rem' }}>
                        {[
                          'Authentication & Access',
                          'Network & Connectivity',
                          'Software / Licenses',
                          'Hardware Support',
                          'General Enquiry'
                        ].map((cat, idx) => {
                          const shortLabel = cat === 'Authentication & Access' ? 'Auth' :
                                             cat === 'Network & Connectivity' ? 'Network' :
                                             cat === 'Software / Licenses' ? 'Software' :
                                             cat === 'Hardware Support' ? 'Hardware' : 'Enquiry';
                          return (
                            <span key={idx} style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textAlign: 'center', width: '64px' }} title={cat}>
                              {shortLabel}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Technician Leaderboard */}
                <div className="form-row" style={{ gap: '1.25rem', marginBottom: '2rem' }}>
                  <div className="matte-card" style={{ flex: 1, border: '2px solid #000000', backgroundColor: '#fff7ed', padding: '2rem', borderRadius: '16px', color: '#0f172a', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                    <div className="section-header" style={{ marginBottom: '1.5rem', fontSize: '1.25rem', color: '#000000', borderBottom: '2px solid #ea580c', paddingBottom: '0.5rem', fontWeight: 'bold' }}> Technician Performance Leaderboard</div>
                    {leaderboard.length === 0 ? (
                      <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', paddingTop: '1.5rem', fontStyle: 'italic' }}>No ticket resolutions recorded yet.</p>
                    ) : (
                      leaderboard.slice(0, 4).map((tech, idx) => (
                        <div key={tech.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 0', borderBottom: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 900, color: idx === 0 ? '#d97706' : idx === 1 ? '#475569' : '#b45309', fontSize: '1rem' }}>#{idx + 1}</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{tech.name}</span>
                          </div>
                          <span style={{ fontSize: '0.85rem', backgroundColor: '#1e293b', color: '#ffffff', fontWeight: 'bold', padding: '0.3rem 0.8rem', borderRadius: '20px', border: '1px solid #000000', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>{tech.count} Resolved</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </>
      )}
        </div>
      </div>

      {/* -------------------------------------------------------------------------- */}
      {/* 2. RESOLVE REMARKS DIALOG POPUP (MODULE 7: ENGINEER REMARKS / WORKFLOW)   */}
      {/* -------------------------------------------------------------------------- */}
      {resolvingTicketIndex !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '2rem' }}>
          <div style={{ backgroundColor: '#1e293b', border: '2px solid #22c55e', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '2rem', color: '#f1f5f9' }}>
            
            <h3 style={{ margin: 0, color: '#22c55e', borderBottom: '2px solid #22c55e', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              ✅ Resolve Support Ticket
            </h3>

            <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '1.5rem' }}>
              Provide closing remarks and resolution notes to document how the issue was fixed for future analytics.
            </p>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Resolution Remarks *</label>
              <textarea 
                className="form-textarea" 
                style={{ minHeight: '120px', fontSize: '0.9rem' }}
                placeholder="Type resolution steps taken e.g. Reset user credentials and validated login works..."
                value={resolutionRemarks}
                onChange={(e) => setResolutionRemarks(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn-secondary"
                style={{ padding: '0.5rem 1.25rem' }}
                onClick={() => setResolvingTicketIndex(null)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                style={{ padding: '0.5rem 1.25rem', backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                onClick={() => {
                  if (!resolutionRemarks) {
                    alert("Please enter resolution remarks before closing the ticket.");
                    return;
                  }
                  handleDashboardResolve(resolvingTicketIndex, resolutionRemarks);
                  setResolvingTicketIndex(null);
                }}
              >
                Confirm Resolution
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
