import { FileText } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  Send, 
  Database, 
  Upload, 
  ExternalLink,
  Bookmark
} from 'lucide-react';
import type {  ChatMessage, Citation, DocumentRecord  } from '../types';

interface AssistantProps {
  backendUrl: string;
}

export const Assistant: React.FC<AssistantProps> = ({ backendUrl }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'assistant',
      text: 'Hello! I am your ACC Clinical Assistant. I can answer questions about Adenoid Cystic Carcinoma (such as standard treatments, proton therapy, clinical trials, c-Kit/VEGFR inhibitors) and help analyze your medical logs.\n\nToggle **Search Records** to let me search your medical logs and uploads, or **Search Web** to fetch recent treatments online.',
      mode: 'Ready'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Settings switches
  const [searchWeb, setSearchWeb] = useState(true);
  const [searchRecords, setSearchRecords] = useState(true);

  // Document upload state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  
  // Active citations (fetched from the last assistant message)
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch documents list on load
  const fetchDocuments = async () => {
    try {
      const resp = await fetch(`${backendUrl}/api/documents`);
      if (resp.ok) {
        const data = await resp.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userQuery = input.trim();
    setInput('');
    
    // Add user message
    const userMsg: ChatMessage = { sender: 'user', text: userQuery };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const resp = await fetch(`${backendUrl}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userQuery,
          search_web: searchWeb,
          search_records: searchRecords
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const assistantMsg: ChatMessage = {
          sender: 'assistant',
          text: data.answer,
          citations: data.citations || [],
          mode: data.mode || 'AI RAG'
        };
        setMessages(prev => [...prev, assistantMsg]);
        if (data.citations && data.citations.length > 0) {
          setActiveCitations(data.citations);
        } else {
          setActiveCitations([]);
        }
      } else {
        setMessages(prev => [...prev, {
          sender: 'assistant',
          text: 'I encountered an error querying my knowledge network. Please check backend connection.',
          mode: 'System Error'
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: 'Network error. Could not reach clinical RAG server.',
        mode: 'Offline'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDocUploadClick = () => {
    docInputRef.current?.click();
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith('.txt') && !file.name.toLowerCase().endsWith('.pdf')) {
      alert("Only PDF (.pdf) and Plain Text (.txt) reports are supported.");
      return;
    }

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch(`${backendUrl}/api/documents/upload`, {
        method: 'POST',
        body: formData
      });

      if (resp.ok) {
        const data = await resp.json();
        setDocuments(prev => [...prev, {
          id: data.document_id,
          filename: data.filename,
          filepath: '',
          filetype: file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'txt',
          summary: data.summary
        }]);
        
        // Add clinical event system message
        setMessages(prev => [...prev, {
          sender: 'assistant',
          text: `Successfully uploaded and processed **${file.name}**. I have index-chunked the document and computed embeddings. \n\n*Summary:* ${data.summary}`,
          mode: 'System Indexer'
        }]);
      } else {
        alert("Failed to upload document.");
      }
    } catch (err) {
      console.error(err);
      alert("Error uploading document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Convert markdown-like headers & bullets to styled HTML simply
  const renderMessageText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      // Headings
      if (line.startsWith('### ')) {
        return <h3 key={idx} style={{ color: 'var(--accent-cyan)', marginTop: '0.75rem', marginBottom: '0.25rem', fontSize: '1.05rem', fontWeight: 700 }}>{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} style={{ color: 'var(--accent-cyan)', marginTop: '1rem', marginBottom: '0.5rem', fontSize: '1.15rem', fontWeight: 700 }}>{line.replace('## ', '')}</h3>;
      }
      
      // Bullet points
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const cleanLine = line.replace(/^\s*[\*\-]\s+/, '');
        // Check for bold parts
        return <li key={idx} style={{ marginLeft: '1rem', marginBottom: '0.25rem', listStyleType: 'disc' }}>{parseBoldText(cleanLine)}</li>;
      }

      // Numbered lists (e.g., "1. Item", "2. Item")
      const numberedMatch = line.trim().match(/^(\d+)\.\s+(.+)/);
      if (numberedMatch) {
        return <li key={idx} style={{ marginLeft: '1rem', marginBottom: '0.25rem', listStyleType: 'decimal' }}>{parseBoldText(numberedMatch[2])}</li>;
      }
      
      return <p key={idx} style={{ marginBottom: '0.5rem' }}>{parseBoldText(line)}</p>;
    });
  };

  const parseBoldText = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, i) => i % 2 === 1 ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{part}</strong> : part);
  };

  return (
    <div className="assistant-layout">
      {/* Chat Interface */}
      <div className="card chat-panel">
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chat-bubble-wrapper ${msg.sender}`}>
              <div className="chat-bubble">
                {renderMessageText(msg.text)}
              </div>
              <span className="chat-mode-tag">
                {msg.sender === 'user' ? 'Patient Query' : `${msg.mode || 'AI assistant'}`}
              </span>
            </div>
          ))}
          
          {loading && (
            <div className="typing-indicator">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input 
            type="text"
            className="chat-input-field"
            placeholder={loading ? "AI is reasoning..." : "Ask about ACC treatments, your medications, or summarize your history..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn" style={{ padding: '0.85rem' }} disabled={loading}>
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Settings & Citations Sidebar */}
      <div className="assistant-sidebar">
        {/* Settings Card */}
        <div className="card settings-card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Brain size={18} style={{ color: 'var(--accent-cyan)' }} />
            Search Settings
          </h3>
          
          <div className="switch-group">
            <div className="switch-label-container">
              <span className="switch-lbl">Search Records</span>
              <span className="switch-desc">Query logs & uploaded records</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={searchRecords} 
                onChange={(e) => setSearchRecords(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="switch-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            <div className="switch-label-container">
              <span className="switch-lbl">Search Web Online</span>
              <span className="switch-desc">Fetch latest clinical trials</span>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={searchWeb} 
                onChange={(e) => setSearchWeb(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Medical Document Uploader */}
        <div className="card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Database size={18} style={{ color: 'var(--accent-cyan)' }} />
            Upload Clinical Records
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.35 }}>
            Upload biopsy pathology reports or oncological notes to expand RAG knowledge (supports `.txt` or `.pdf`).
          </p>

          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', fontSize: '0.85rem', display: 'flex', gap: '0.5rem' }}
            onClick={handleDocUploadClick}
            disabled={uploadingDoc}
          >
            <Upload size={14} />
            {uploadingDoc ? 'Processing...' : 'Upload Pathology Report'}
          </button>
          
          <input 
            type="file"
            ref={docInputRef}
            style={{ display: 'none' }}
            onChange={handleDocUpload}
            accept=".txt,.pdf"
          />

          {documents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>INDEXED RECORDS:</span>
              {documents.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.02)', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                  <FileText size={12} style={{ color: 'var(--accent-cyan)' }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }} title={doc.filename}>{doc.filename}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Citations Pane */}
        <div className="card citations-panel">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bookmark size={18} style={{ color: 'var(--accent-cyan)' }} />
            Active Source Citations
          </h3>
          
          {activeCitations.length > 0 ? (
            <div className="citations-list">
              {activeCitations.map((cite, i) => (
                <div key={i} className="citation-card">
                  <span className="citation-title">[{i + 1}] {cite.title}</span>
                  {cite.url.startsWith('http') ? (
                    <a href={cite.url} target="_blank" rel="noreferrer" className="citation-link">
                      <span>Source Link</span>
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Local System Log</span>
                  )}
                  <p className="citation-snippet">"{cite.snippet}"</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No sources cited in the last response.</p>
          )}
        </div>
      </div>
    </div>
  );
};
